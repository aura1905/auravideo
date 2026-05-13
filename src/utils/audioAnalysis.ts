/** Audio analysis primitives used by the auto-editor.
 *
 * - analyzeLoudness: scans an audio/video file, decodes its audio track,
 *   computes RMS energy in fixed-size windows, smooths the curve, and
 *   returns ranked "interesting" segments (peaks above a local baseline).
 *   Used by the highlight-reel template.
 *
 * - detectBeats: simple onset-based beat detection. Decodes audio, computes
 *   per-frame energy + its positive derivative, peak-picks with an adaptive
 *   threshold + minimum-gap rule, and estimates BPM from the inter-beat
 *   intervals. Used by the beat-cut template.
 *
 * Both functions decode the FULL file via AudioContext, which can be
 * memory-hungry on long files. For 5–10 min clips this is fine in modern
 * browsers; longer-form material would warrant streaming decode (not done). */

/** Decode the audio track of a file into a mono Float32Array at the
 * AudioContext's sample rate. Helper shared by both analyzers. */
async function decodeMono(file: File): Promise<{ samples: Float32Array; sampleRate: number }> {
  const ab = await file.arrayBuffer();
  const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
  const ctx = new Ctx();
  let buf: AudioBuffer;
  try {
    buf = await ctx.decodeAudioData(ab.slice(0));
  } finally {
    ctx.close();
  }
  if (buf.numberOfChannels === 1) {
    return { samples: buf.getChannelData(0), sampleRate: buf.sampleRate };
  }
  // Mixdown to mono by averaging channels.
  const len = buf.length;
  const out = new Float32Array(len);
  const ch = buf.numberOfChannels;
  for (let c = 0; c < ch; c++) {
    const data = buf.getChannelData(c);
    for (let i = 0; i < len; i++) out[i] += data[i];
  }
  for (let i = 0; i < len; i++) out[i] /= ch;
  return { samples: out, sampleRate: buf.sampleRate };
}

export interface LoudnessSegment {
  /** Start time in source-media seconds. */
  start: number;
  /** End time in source-media seconds. */
  end: number;
  /** Mean RMS within the segment — higher = louder = more "interesting". */
  score: number;
}

export interface LoudnessOptions {
  /** Length of each candidate segment (seconds). */
  segmentSec: number;
  /** Minimum gap between adjacent candidates (seconds). Prevents picking
   * overlapping peaks from the same loud moment. */
  minGapSec: number;
  /** Drop segments whose score is below this fraction of the global max. */
  scoreFloor: number;
}

export const LOUDNESS_DEFAULTS: LoudnessOptions = {
  segmentSec: 3,
  minGapSec: 1.5,
  scoreFloor: 0.3,
};

/** Analyze loudness and return candidate "interesting" segments, sorted by
 * descending score. Caller can then take the top N or filter by total
 * duration. Each segment is `opts.segmentSec` long and corresponds to a
 * local maximum of the smoothed RMS curve. */
export async function analyzeLoudness(
  file: File,
  opts: LoudnessOptions = LOUDNESS_DEFAULTS
): Promise<LoudnessSegment[]> {
  const { samples, sampleRate } = await decodeMono(file);
  const durationSec = samples.length / sampleRate;

  // RMS in ~100ms frames.
  const frameSec = 0.1;
  const frameSize = Math.max(1, Math.round(sampleRate * frameSec));
  const numFrames = Math.floor(samples.length / frameSize);
  const rms = new Float32Array(numFrames);
  for (let f = 0; f < numFrames; f++) {
    let sum = 0;
    const off = f * frameSize;
    for (let i = 0; i < frameSize; i++) {
      const v = samples[off + i];
      sum += v * v;
    }
    rms[f] = Math.sqrt(sum / frameSize);
  }

  // Smooth with a moving average over `segmentSec` worth of frames so the
  // score reflects sustained loudness, not a single spike.
  const winFrames = Math.max(1, Math.round(opts.segmentSec / frameSec));
  const smoothed = new Float32Array(numFrames);
  let runSum = 0;
  for (let f = 0; f < numFrames; f++) {
    runSum += rms[f];
    if (f >= winFrames) runSum -= rms[f - winFrames];
    const denom = Math.min(f + 1, winFrames);
    smoothed[f] = runSum / denom;
  }

  // Greedy peak picking with min-gap. At each step pick the frame with the
  // highest smoothed score, mask out a ±halfGap window around it, repeat
  // until either coverage is exhausted or all remaining peaks fall below
  // the score floor.
  const halfGapFrames = Math.round(opts.minGapSec / frameSec / 2);
  const segFrames = winFrames;
  let globalMax = 0;
  for (let f = 0; f < numFrames; f++) if (smoothed[f] > globalMax) globalMax = smoothed[f];
  const floor = globalMax * opts.scoreFloor;
  const taken = new Uint8Array(numFrames);
  const segments: LoudnessSegment[] = [];

  // Cap iterations so a pathological signal doesn't loop forever.
  for (let iter = 0; iter < 10000; iter++) {
    let bestF = -1;
    let bestVal = floor;
    for (let f = 0; f < numFrames; f++) {
      if (taken[f]) continue;
      if (smoothed[f] > bestVal) {
        bestVal = smoothed[f];
        bestF = f;
      }
    }
    if (bestF < 0) break;
    const segCenterSec = bestF * frameSec;
    const segStart = Math.max(0, segCenterSec - opts.segmentSec / 2);
    const segEnd = Math.min(durationSec, segStart + opts.segmentSec);
    segments.push({ start: segStart, end: segEnd, score: bestVal });
    const maskFrom = Math.max(0, bestF - halfGapFrames - Math.floor(segFrames / 2));
    const maskTo = Math.min(numFrames, bestF + halfGapFrames + Math.floor(segFrames / 2));
    for (let f = maskFrom; f < maskTo; f++) taken[f] = 1;
  }

  segments.sort((a, b) => b.score - a.score);
  return segments;
}

// ─── Beat detection ─────────────────────────────────────────────────────────

export interface BeatAnalysis {
  beats: number[];   // beat times in seconds (sorted)
  bpm: number;       // estimated tempo (60..200, may be 0 if undetectable)
  durationSec: number;
}

export interface BeatOptions {
  /** Minimum gap between detected beats (seconds). Caps maximum BPM ≈
   * 60 / minGap. Default 0.2 → max 300 BPM. */
  minGapSec: number;
  /** Threshold multiplier on the local median — higher = fewer beats. */
  thresholdMul: number;
}

export const BEAT_DEFAULTS: BeatOptions = {
  minGapSec: 0.2,
  thresholdMul: 1.3,
};

/** Detect beats via spectral-flux-like energy-derivative onset detection.
 * Not as accurate as ML-based detectors (madmom etc.) but pure JS, fast,
 * and good enough for typical electronic / pop music. */
export async function detectBeats(
  file: File,
  opts: BeatOptions = BEAT_DEFAULTS
): Promise<BeatAnalysis> {
  const { samples, sampleRate } = await decodeMono(file);
  const durationSec = samples.length / sampleRate;

  // Frame at ~23ms (512 samples at 22050Hz; we use the source rate but
  // round to a similar number). Smaller frames = higher temporal precision
  // at the cost of more compute.
  const frameSize = Math.max(1, Math.round(sampleRate * 0.023));
  const numFrames = Math.floor(samples.length / frameSize);
  if (numFrames < 8) {
    return { beats: [], bpm: 0, durationSec };
  }

  // Per-frame energy (sum of squares).
  const energy = new Float32Array(numFrames);
  for (let f = 0; f < numFrames; f++) {
    let sum = 0;
    const off = f * frameSize;
    for (let i = 0; i < frameSize; i++) {
      const v = samples[off + i];
      sum += v * v;
    }
    energy[f] = sum;
  }

  // Half-wave-rectified derivative — only count energy *increases*, which
  // is what makes a percussive onset stand out.
  const flux = new Float32Array(numFrames);
  for (let f = 1; f < numFrames; f++) {
    const d = energy[f] - energy[f - 1];
    flux[f] = d > 0 ? d : 0;
  }

  // Adaptive threshold: local median over ~1 second of context.
  const medianWin = Math.max(1, Math.round(1.0 / 0.023));
  const threshold = new Float32Array(numFrames);
  for (let f = 0; f < numFrames; f++) {
    const a = Math.max(0, f - medianWin);
    const b = Math.min(numFrames, f + medianWin + 1);
    let sum = 0;
    for (let i = a; i < b; i++) sum += flux[i];
    threshold[f] = (sum / (b - a)) * opts.thresholdMul;
  }

  // Peak pick: local max in a small neighborhood + above threshold + min-gap.
  const beats: number[] = [];
  const minGapFrames = Math.max(1, Math.round(opts.minGapSec / 0.023));
  let lastBeatFrame = -minGapFrames;
  const localWin = 3;
  for (let f = localWin; f < numFrames - localWin; f++) {
    if (flux[f] <= threshold[f]) continue;
    if (f - lastBeatFrame < minGapFrames) continue;
    let isLocalMax = true;
    for (let i = -localWin; i <= localWin; i++) {
      if (i === 0) continue;
      if (flux[f + i] > flux[f]) { isLocalMax = false; break; }
    }
    if (!isLocalMax) continue;
    beats.push(f * 0.023);
    lastBeatFrame = f;
  }

  // Estimate BPM from median inter-beat-interval (more robust to outliers
  // than mean). Octave-fold to [60, 200] BPM.
  let bpm = 0;
  if (beats.length >= 2) {
    const ibis: number[] = [];
    for (let i = 1; i < beats.length; i++) ibis.push(beats[i] - beats[i - 1]);
    ibis.sort((a, b) => a - b);
    const medianIBI = ibis[Math.floor(ibis.length / 2)];
    if (medianIBI > 0) {
      let est = 60 / medianIBI;
      while (est < 60) est *= 2;
      while (est > 200) est /= 2;
      bpm = Math.round(est);
    }
  }

  return { beats, bpm, durationSec };
}
