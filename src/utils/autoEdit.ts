/** Auto-editor — Plan A (local-only, no LLM).
 *
 * Pure orchestration: each template consumes editor state + options,
 * computes the resulting timeline patch, and applies it through the
 * existing `useEditor` actions. No new state shape needed.
 *
 * Currently shipped templates:
 *   - runTalkingHeadCleanup — Whisper-driven silence removal + auto-subs
 *   - runSlideshow — sequential image/video clips with crossfade
 *
 * Each function reports progress via the optional `onProgress` callback
 * so the dialog can show what's happening (Whisper download, splitting,
 * etc.). Errors are thrown — callers surface them in their UI.
 *
 * NOTE: keep these as plain functions (not hooks). They run from a
 * dialog handler, not in render. */

import { useEditor, newClipId, clipDisplayDur } from '../state/editorStore';
import type { Clip } from '../types';
import {
  extractAudioForWhisper,
  transcribe,
  type WhisperModel,
  type TranscribeProgress,
  type TranscriptionChunk,
  type TranscriptionWord,
} from './whisper';
import {
  analyzeLoudness,
  detectBeats,
  type LoudnessSegment,
} from './audioAnalysis';

export type AutoEditProgress = {
  phase: string;
  progress: number; // 0..1, -1 = indeterminate
};

// ─── Talking-head cleanup ──────────────────────────────────────────────────

export interface TalkingHeadOptions {
  language: string;             // 'korean' | 'english' | ... | 'auto'
  model: WhisperModel;
  /** Minimum gap (in *source-media* seconds) between Whisper chunks to count
   * as a silence worth cutting. Smaller = more aggressive cuts. */
  minSilenceSec: number;
  /** Maximum gap to cut. Gaps LONGER than this are preserved (treated as
   * intentional pauses, dramatic effects, B-roll cuts, etc.). Set to a very
   * large number to cut all gaps regardless. Default 4s. */
  maxSilenceSec: number;
  /** Padding (in source seconds) added before each kept range so words don't
   * start mid-syllable. Default 0.15. */
  leadPadSec: number;
  /** Padding after each kept range. Default 0.2. */
  tailPadSec: number;
  /** If true, generate one Subtitle per Whisper chunk (mapped to timeline
   * coords AFTER the silence removal). */
  generateSubtitles: boolean;
  /** Crossfade between every two kept fragments (timeline seconds). 0 = hard
   * cut. Implemented by overlapping fragments and setting fadeIn/fadeOut.
   *
   * Note: same-track crossfades show a slight darkening at the midpoint
   * because the canvas compositor alpha-blends both fragments against the
   * black canvas. Hard cut (0) is the safer default for talking-head. */
  crossfadeSec: number;
  /** Request per-word Whisper timestamps and use them for silence detection.
   * Slightly slower transcribe but yields much cleaner cuts (won't slice
   * mid-word) — silences are detected at word boundaries, not segment
   * boundaries. Subtitles are still chunk-level. Default true. */
  useWordLevel: boolean;
  /** Strip filler words (음/어/uh/um/…) from the kept ranges so they get
   * cut together with the surrounding silence. Requires `useWordLevel`.
   * Default true. */
  removeFillerWords: boolean;
  /** Lingering breath after the FINAL kept word in the clip (source seconds).
   * The general `tailPadSec` is fine between phrases but feels abrupt at the
   * very end — this extends only the last fragment's outPoint so the result
   * doesn't end mid-breath. Also drives an auto fade-out on the last clip
   * (half of this value, capped at 0.5s) so the cut decays smoothly.
   * Capped by whatever source-media headroom is available past the last
   * spoken word — won't invent frames that aren't there. Default 0.6. */
  endingTailSec: number;
}

/** Per-language filler-word lists. Kept conservative — we previously
 * included single-syllable Korean phonemes 어/에/아/으 but those false-
 * positive constantly: Whisper often mis-tokenizes the tail of a stretched
 * word ("출바알", "고고") as a standalone syllable and that ate real
 * endings. Now only forms that are almost-never-real-words: 음, doubled
 * syllables, and unambiguous interjections. */
const FILLER_WORDS: Record<string, string[]> = {
  korean: ['음', '음음', '으음', '어어', '아아', '에에', '으으'],
  english: ['uh', 'um', 'uhh', 'umm', 'uhm', 'er', 'erm', 'ahh', 'mm', 'hmm'],
  japanese: ['えー', 'えーと', 'うーん', 'えっと'],
  chinese: ['呃', '嗯'],
};

function normalizeWord(text: string): string {
  // Strip punctuation, whitespace, lowercase. Whisper word entries
  // commonly come like " 음," or "Uh.." — normalize before matching.
  return text
    .trim()
    .toLowerCase()
    .replace(/[.,!?…\s"'()\[\]。，！？]+/g, '');
}

function isFillerWord(text: string, language: string): boolean {
  const norm = normalizeWord(text);
  if (!norm) return false;
  const lists =
    language === 'auto' || !FILLER_WORDS[language]
      ? Object.values(FILLER_WORDS)
      : [FILLER_WORDS[language]];
  for (const list of lists) {
    if (list.includes(norm)) return true;
  }
  return false;
}

export const TALKING_HEAD_DEFAULTS: TalkingHeadOptions = {
  language: 'korean',
  // Whisper-small is the sweet spot for Korean — `tiny` and `base` both
  // make consistent errors on Korean phonemes (함흥냉면→할당냉면, 빠진→빗들해진).
  // `small` is a 500MB one-time download but cached by the browser after.
  model: 'Xenova/whisper-small',
  // Conservative defaults: cut short pauses (breaths, ums) but preserve
  // longer dramatic gaps that the speaker probably left on purpose.
  minSilenceSec: 0.8,
  maxSilenceSec: 4.0,
  leadPadSec: 0.15,
  tailPadSec: 0.2,
  generateSubtitles: true,
  crossfadeSec: 0,
  useWordLevel: true,
  removeFillerWords: true,
  endingTailSec: 0.6,
};

export interface TalkingHeadResult {
  /** Number of silence gaps removed. */
  cutsRemoved: number;
  /** Number of fragments after the cleanup (= cutsRemoved + 1, normally). */
  fragmentsKept: number;
  /** Number of subtitles generated. */
  subtitlesAdded: number;
  /** Total source-seconds removed. */
  secondsRemoved: number;
}

export async function runTalkingHeadCleanup(
  clipId: string,
  opts: TalkingHeadOptions,
  onProgress?: (p: AutoEditProgress) => void
): Promise<TalkingHeadResult> {
  const s0 = useEditor.getState();
  const clip = s0.clips[clipId];
  if (!clip) throw new Error('클립을 찾을 수 없습니다.');
  const asset = s0.assets[clip.assetId];
  if (!asset) throw new Error('미디어 자산을 찾을 수 없습니다.');
  if (!asset.hasAudio) throw new Error('이 클립은 오디오가 없어 무음 검출이 불가합니다.');
  if (asset.isImage) throw new Error('이미지 클립은 토킹헤드 정리에 사용할 수 없습니다.');

  // 1. Decode + transcribe the FULL asset audio. We slice to the clip's
  //    [inPoint, outPoint] range afterwards. This is conceptually wasteful
  //    if the user has trimmed heavily, but keeps the pipeline identical to
  //    the existing WhisperDialog and the Whisper transcriber doesn't expose
  //    a fast range-slice API.
  const audio = await extractAudioForWhisper(asset.file, (p: TranscribeProgress) => {
    onProgress?.({ phase: p.phase, progress: p.progress });
  });
  const chunks = await transcribe(audio, {
    model: opts.model,
    language: opts.language === 'auto' ? undefined : opts.language,
    wordTimestamps: opts.useWordLevel,
    onProgress: (p) => onProgress?.({ phase: p.phase, progress: p.progress }),
  });
  onProgress?.({ phase: `Whisper: ${chunks.length}개 세그먼트`, progress: -1 });

  // 2. Build a list of "padded ranges" — one per unit of speech that should
  //    be KEPT. When word-level timestamps are available, each WORD becomes
  //    a range so silence detection happens at word boundaries (no mid-word
  //    slices). Otherwise we fall back to one range per chunk.
  //    Each range carries its parent chunkIndex so the subtitle emitter
  //    later can dedupe and produce one subtitle per chunk that survives.
  const inP = clip.inPoint;
  const outP = clip.outPoint;
  // Pre-pass: find the chronologically LAST word that falls inside the clip
  // range. Used to protect the natural ending — even if that word matches
  // the filler list (e.g. Whisper mis-tokenized "출바알" as a trailing "아"),
  // we keep it, otherwise the speaker's final phrase gets eaten.
  let lastWordRef: TranscriptionWord | null = null;
  if (opts.useWordLevel && opts.removeFillerWords) {
    for (const c of chunks) {
      if (c.end <= inP || c.start >= outP) continue;
      if (!c.words) continue;
      for (const w of c.words) {
        if (w.end <= inP || w.start >= outP) continue;
        if (!lastWordRef || w.end > lastWordRef.end) lastWordRef = w;
      }
    }
  }

  // Each padded entry optionally carries the source word it came from (word-
  // level mode only). We need this later: if a chunk's words straddle a cut,
  // each merged fragment gets its OWN subtitle built from JUST those words —
  // otherwise the same chunk text leaks into multiple fragments and ends up
  // displayed over audio that doesn't match.
  const padded: { start: number; end: number; chunkIndex: number; word?: TranscriptionWord }[] = [];
  const usableChunks: TranscriptionChunk[] = [];
  chunks.forEach((c) => {
    if (c.end <= inP || c.start >= outP) return;
    const ci = usableChunks.length;
    usableChunks.push(c);
    if (opts.useWordLevel && c.words && c.words.length > 0) {
      for (const w of c.words) {
        // Filler skip — but NEVER skip the chronologically last word, so
        // the ending of the speech is always preserved.
        if (opts.removeFillerWords && w !== lastWordRef && isFillerWord(w.text, opts.language)) continue;
        let a = w.start - opts.leadPadSec;
        let b = w.end + opts.tailPadSec;
        if (b <= inP || a >= outP) continue;
        a = Math.max(inP, a);
        b = Math.min(outP, b);
        if (b - a < 0.05) continue;
        padded.push({ start: a, end: b, chunkIndex: ci, word: w });
      }
    } else {
      let a = c.start - opts.leadPadSec;
      let b = c.end + opts.tailPadSec;
      if (b <= inP || a >= outP) return;
      a = Math.max(inP, a);
      b = Math.min(outP, b);
      if (b - a < 0.05) return;
      padded.push({ start: a, end: b, chunkIndex: ci });
    }
  });

  if (padded.length === 0) {
    throw new Error('Whisper가 인식한 음성 구간이 클립 범위 내에 없습니다.');
  }

  // 3. Merge kept ranges. A gap between two adjacent ranges is CUT only if
  //    it falls in [minSilenceSec, maxSilenceSec]. Gaps shorter than
  //    minSilenceSec are too short to be worth cutting (and would just
  //    splice mid-word). Gaps longer than maxSilenceSec are treated as
  //    INTENTIONAL pauses (dramatic effects, b-roll moments, etc.) and
  //    also merged through — preserved as-is in the output.
  padded.sort((a, b) => a.start - b.start);
  type MergedRange = {
    start: number;
    end: number;
    chunkIndexes: number[];
    // Per-chunk list of WORDS from that chunk that landed in this fragment.
    // Used to rebuild subtitle text + timing so it matches what's actually
    // heard in this specific fragment.
    wordsByChunk: Map<number, TranscriptionWord[]>;
  };
  const merged: MergedRange[] = [];
  const pushWord = (m: MergedRange, ci: number, w: TranscriptionWord | undefined) => {
    if (!w) return;
    const arr = m.wordsByChunk.get(ci);
    if (arr) arr.push(w);
    else m.wordsByChunk.set(ci, [w]);
  };
  for (const r of padded) {
    const last = merged[merged.length - 1];
    const gap = last ? r.start - last.end : Infinity;
    const shouldMerge = last && (gap < opts.minSilenceSec || gap > opts.maxSilenceSec);
    if (shouldMerge) {
      last.end = Math.max(last.end, r.end);
      last.chunkIndexes.push(r.chunkIndex);
      pushWord(last, r.chunkIndex, r.word);
    } else {
      const m: MergedRange = {
        start: r.start,
        end: r.end,
        chunkIndexes: [r.chunkIndex],
        wordsByChunk: new Map(),
      };
      pushWord(m, r.chunkIndex, r.word);
      merged.push(m);
    }
  }

  // 3b. Extend the LAST merged fragment so the ending doesn't feel chopped
  //     mid-breath. m.end currently sits at lastWord.end + tailPadSec — we
  //     push it out to lastWord.end + endingTailSec, capped by the clip's
  //     actual outPoint (no inventing source we don't have).
  if (merged.length > 0 && opts.endingTailSec > opts.tailPadSec) {
    const lastM = merged[merged.length - 1];
    const extra = opts.endingTailSec - opts.tailPadSec;
    lastM.end = Math.min(outP, lastM.end + extra);
  }

  // 4. Compute timeline layout for each kept fragment. With crossfadeSec > 0,
  //    each fragment after the first overlaps the previous by that amount.
  const speed = clip.speed ?? 1;
  const xfade = Math.max(0, opts.crossfadeSec);
  // Auto fade-out on the last clip — half of the ending tail, capped at 0.5s.
  // Only kicks in if it would be longer than the user's existing fadeOut so
  // we never SHORTEN an intentional fade.
  const autoEndingFade = Math.min(0.5, opts.endingTailSec * 0.5);
  let cursorTimeline = clip.start;
  const newClips: Clip[] = [];
  const subtitlesToAdd: { text: string; start: number; duration: number }[] = [];

  merged.forEach((m, idx) => {
    const sourceDur = m.end - m.start;
    const timelineDur = sourceDur / speed;
    const isFirst = idx === 0;
    const isLast = idx === merged.length - 1;
    const fadeIn = isFirst ? clip.fadeIn : xfade;
    let fadeOut = isLast ? clip.fadeOut : xfade;
    if (isLast && autoEndingFade > 0) {
      fadeOut = Math.max(fadeOut, autoEndingFade);
    }
    const newClip: Clip = {
      ...clip,
      id: newClipId(),
      inPoint: m.start,
      outPoint: m.end,
      start: cursorTimeline,
      fadeIn,
      fadeOut,
      audioTail: isLast ? clip.audioTail : 0,
    };
    newClips.push(newClip);

    // Emit one subtitle per (chunk × fragment) pair. Word-level mode uses the
    // ACTUAL words that landed in this fragment (so a chunk split across two
    // fragments gets two distinct partial subtitles); segment-level falls
    // back to the whole-chunk text/timing.
    if (opts.generateSubtitles) {
      const seen = new Set<number>();
      for (const ci of m.chunkIndexes) {
        if (seen.has(ci)) continue;
        seen.add(ci);
        const ch = usableChunks[ci];
        let text: string;
        let subSrcStart: number;
        let subSrcEnd: number;
        const fragWords = m.wordsByChunk.get(ci);
        if (opts.useWordLevel && fragWords && fragWords.length > 0) {
          text = fragWords.map((w) => w.text).join(' ').replace(/\s+/g, ' ').trim();
          subSrcStart = fragWords[0].start;
          subSrcEnd = fragWords[fragWords.length - 1].end;
        } else {
          text = ch.text;
          subSrcStart = ch.start;
          subSrcEnd = ch.end;
        }
        if (!text) continue;
        const startInFragment = Math.max(0, subSrcStart - m.start);
        const endInFragment = Math.min(sourceDur, subSrcEnd - m.start);
        if (endInFragment <= startInFragment) continue;
        const subStartTL = newClip.start + startInFragment / speed;
        const subDurTL = (endInFragment - startInFragment) / speed;
        subtitlesToAdd.push({ text, start: subStartTL, duration: subDurTL });
      }
    }

    // Advance cursor — overlap by xfade for the NEXT fragment.
    cursorTimeline += timelineDur - (isLast ? 0 : xfade);
  });

  const oldDispDur = clipDisplayDur(clip);
  const newDispDur = cursorTimeline - clip.start;
  const shift = newDispDur - oldDispDur; // negative = clips after move left

  // 5. Apply: remove original, add new fragments, ripple later clips on the
  //    same track, add subtitles.
  onProgress?.({ phase: '타임라인 갱신 중…', progress: -1 });
  const s = useEditor.getState();
  s.removeClip(clipId);
  for (const nc of newClips) s.addClip(nc);

  // Ripple-shift later clips on the same track. Done via direct state set so
  // we don't fire N undo events.
  if (Math.abs(shift) > 0.001) {
    useEditor.setState((st) => {
      const updated: Record<string, Clip> = {};
      for (const [id, c] of Object.entries(st.clips)) {
        if (c.trackId === clip.trackId && c.start >= clip.start + oldDispDur - 0.001) {
          updated[id] = { ...c, start: Math.max(0, c.start + shift) };
        } else {
          updated[id] = c;
        }
      }
      return { clips: updated };
    });
  }

  // Subtitles — use the store action so they participate in undo.
  let subsAdded = 0;
  if (opts.generateSubtitles) {
    const addSubtitle = useEditor.getState().addSubtitle;
    for (const sb of subtitlesToAdd) {
      addSubtitle({ text: sb.text, start: sb.start, duration: sb.duration });
      subsAdded++;
    }
  }

  const secondsRemoved = (outP - inP - merged.reduce((acc, m) => acc + (m.end - m.start), 0));
  return {
    cutsRemoved: Math.max(0, merged.length - 1),
    fragmentsKept: merged.length,
    subtitlesAdded: subsAdded,
    secondsRemoved: Math.max(0, secondsRemoved),
  };
}

// ─── Slideshow ─────────────────────────────────────────────────────────────

export interface SlideshowOptions {
  /** Seconds of *timeline* duration each slide visually occupies. */
  perSlideSec: number;
  /** Crossfade length between adjacent slides (timeline seconds). 0 = hard cut. */
  crossfadeSec: number;
  /** Where on the timeline to start placing slides. 'end' = after last clip,
   * 'playhead' = at the current playhead, 0 = beginning. */
  insertAt: 'end' | 'playhead' | 'zero';
  /** Order of inputs. */
  order: 'given' | 'shuffle';
}

export const SLIDESHOW_DEFAULTS: SlideshowOptions = {
  perSlideSec: 3,
  crossfadeSec: 0.5,
  insertAt: 'end',
  order: 'given',
};

export interface SlideshowResult {
  slidesPlaced: number;
  totalDuration: number;
}

/** Place the given assets (images or videos) sequentially on the topmost
 * (first) video track, each `perSlideSec` long with optional crossfades. */
export function runSlideshow(
  assetIds: string[],
  opts: SlideshowOptions
): SlideshowResult {
  if (assetIds.length === 0) throw new Error('슬라이드쇼에 추가할 미디어가 없습니다.');
  const s = useEditor.getState();
  const videoTrack = s.tracks.find((t) => t.kind === 'video');
  if (!videoTrack) throw new Error('비디오 트랙이 없습니다.');

  const ordered = opts.order === 'shuffle'
    ? [...assetIds].sort(() => Math.random() - 0.5)
    : [...assetIds];

  let baseStart = 0;
  if (opts.insertAt === 'end') {
    for (const c of Object.values(s.clips)) {
      if (c.trackId !== videoTrack.id) continue;
      const end = c.start + clipDisplayDur(c);
      if (end > baseStart) baseStart = end;
    }
  } else if (opts.insertAt === 'playhead') {
    baseStart = s.playhead;
  } else {
    baseStart = 0;
  }

  const xfade = Math.max(0, opts.crossfadeSec);
  const perSlide = Math.max(0.2, opts.perSlideSec);
  let cursor = baseStart;
  let placed = 0;

  for (let i = 0; i < ordered.length; i++) {
    const assetId = ordered[i];
    const a = s.assets[assetId];
    if (!a) continue;
    if (!a.hasVideo && !a.isImage) continue; // skip audio-only assets
    const isFirst = i === 0;
    const isLast = i === ordered.length - 1;
    // For images, use a synthetic outPoint = perSlide (in source seconds, but
    // since image asset duration is nominal, this is just the displayed dur).
    // For videos, trim the head perSlide seconds (clamped to asset duration).
    const slideDur = perSlide;
    const inPoint = 0;
    const outPoint = a.isImage
      ? slideDur
      : Math.min(a.duration, slideDur);
    const clip: Clip = {
      id: newClipId(),
      assetId,
      trackId: videoTrack.id,
      start: cursor,
      inPoint,
      outPoint,
      fadeIn: isFirst ? 0 : xfade,
      fadeOut: isLast ? 0 : xfade,
      volume: 1,
      muted: a.isImage === true, // images have no audio anyway; mute video slides to keep BGM clean later
      speed: 1,
      audioTail: 0,
      transformX: 0,
      transformY: 0,
      transformScale: 1,
      transformRotation: 0,
      transformOpacity: 1,
      brightness: 0,
      contrast: 1,
      saturation: 1,
      gamma: 1,
    };
    useEditor.getState().addClip(clip);
    placed++;
    // Advance cursor — overlap the NEXT slide by xfade.
    cursor += slideDur - (isLast ? 0 : xfade);
  }

  return { slidesPlaced: placed, totalDuration: cursor - baseStart };
}

// ─── Highlight reel ────────────────────────────────────────────────────────

export interface HighlightOptions {
  /** Target total length of the assembled reel (timeline seconds). */
  targetDurationSec: number;
  /** Length of each picked highlight segment (source seconds). */
  segmentSec: number;
  /** Crossfade between adjacent highlights (timeline seconds). */
  crossfadeSec: number;
  /** Drop candidates whose loudness score is below this fraction of the
   * top-scoring segment across all inputs. 0.3 = keep peaks within 70% of
   * the loudest moment, drop quieter ones. */
  scoreFloor: number;
  /** Where to drop the assembled reel onto the timeline. */
  insertAt: 'end' | 'playhead' | 'zero';
  /** If true, run Whisper on each picked segment's audio and add captions. */
  generateSubtitles: boolean;
  language: string;
  model: WhisperModel;
}

export const HIGHLIGHT_DEFAULTS: HighlightOptions = {
  targetDurationSec: 30,
  segmentSec: 3,
  crossfadeSec: 0.3,
  scoreFloor: 0.4,
  insertAt: 'end',
  generateSubtitles: false,
  language: 'korean',
  model: 'Xenova/whisper-tiny',
};

export interface HighlightResult {
  segmentsPlaced: number;
  totalDuration: number;
  subtitlesAdded: number;
}

/** Build a highlight reel from one or more video assets by scoring each
 * asset's audio loudness curve, picking the top peaks, and concatenating
 * the picked segments on the timeline with optional crossfade and subs.
 *
 * Within-asset order is preserved (highlights from asset A come before
 * highlights from asset B in the same order the user provided), which feels
 * more natural than ranking all candidates globally and interleaving.
 *
 * If an asset has no audio (e.g. silent video), it's skipped — there's no
 * signal to score on. Audio-only assets are also skipped. */
export async function runHighlightReel(
  assetIds: string[],
  opts: HighlightOptions,
  onProgress?: (p: AutoEditProgress) => void
): Promise<HighlightResult> {
  if (assetIds.length === 0) throw new Error('하이라이트에 사용할 미디어를 1개 이상 선택하세요.');
  const s0 = useEditor.getState();
  const videoTrack = s0.tracks.find((t) => t.kind === 'video');
  if (!videoTrack) throw new Error('비디오 트랙이 없습니다.');

  // 1. Analyze each asset, collecting (assetId, candidate segments[]).
  //    Skip assets that lack audio or aren't video.
  const perAsset: { assetId: string; segments: LoudnessSegment[]; assetOrder: number }[] = [];
  for (let i = 0; i < assetIds.length; i++) {
    const aid = assetIds[i];
    const a = s0.assets[aid];
    if (!a || !a.hasVideo || !a.hasAudio || a.isImage) continue;
    onProgress?.({ phase: `분석 중: ${a.name}`, progress: i / assetIds.length });
    const segments = await analyzeLoudness(a.file, {
      segmentSec: opts.segmentSec,
      minGapSec: opts.segmentSec * 0.5,
      scoreFloor: opts.scoreFloor,
    });
    perAsset.push({ assetId: aid, segments, assetOrder: i });
  }
  if (perAsset.length === 0) {
    throw new Error('오디오가 있는 비디오 자산이 없어 점수를 매길 수 없습니다.');
  }

  // 2. Take top segments from each asset until total duration meets target.
  //    Strategy: round-robin across assets so no single asset dominates.
  const target = opts.targetDurationSec;
  let totalSrc = 0;
  const picks: { assetId: string; seg: LoudnessSegment; assetOrder: number }[] = [];
  const cursors = perAsset.map(() => 0);
  while (totalSrc < target) {
    let progressed = false;
    for (let i = 0; i < perAsset.length; i++) {
      if (totalSrc >= target) break;
      const list = perAsset[i].segments;
      const c = cursors[i];
      if (c >= list.length) continue;
      const seg = list[c];
      cursors[i] = c + 1;
      picks.push({ assetId: perAsset[i].assetId, seg, assetOrder: perAsset[i].assetOrder });
      totalSrc += seg.end - seg.start;
      progressed = true;
    }
    if (!progressed) break;
  }
  if (picks.length === 0) {
    throw new Error('점수 기준을 통과한 구간이 없습니다. "점수 하한" 값을 낮춰보세요.');
  }

  // 3. Within each asset, sort picks by source start time so they play in
  //    chronological order; across assets, keep the user's provided order.
  picks.sort((a, b) => {
    if (a.assetOrder !== b.assetOrder) return a.assetOrder - b.assetOrder;
    return a.seg.start - b.seg.start;
  });

  // 4. Determine timeline insertion point.
  const s = useEditor.getState();
  let baseStart = 0;
  if (opts.insertAt === 'end') {
    for (const c of Object.values(s.clips)) {
      if (c.trackId !== videoTrack.id) continue;
      const end = c.start + clipDisplayDur(c);
      if (end > baseStart) baseStart = end;
    }
  } else if (opts.insertAt === 'playhead') {
    baseStart = s.playhead;
  }

  // 5. Place picks on the timeline.
  const xfade = Math.max(0, opts.crossfadeSec);
  let cursor = baseStart;
  const placedClips: { clipId: string; assetId: string; seg: LoudnessSegment }[] = [];
  for (let i = 0; i < picks.length; i++) {
    const { assetId, seg } = picks[i];
    const isFirst = i === 0;
    const isLast = i === picks.length - 1;
    const sourceDur = seg.end - seg.start;
    const clip: Clip = {
      id: newClipId(),
      assetId,
      trackId: videoTrack.id,
      start: cursor,
      inPoint: seg.start,
      outPoint: seg.end,
      fadeIn: isFirst ? 0 : xfade,
      fadeOut: isLast ? 0 : xfade,
      volume: 1,
      muted: false,
      speed: 1,
      audioTail: 0,
      transformX: 0,
      transformY: 0,
      transformScale: 1,
      transformRotation: 0,
      transformOpacity: 1,
      brightness: 0,
      contrast: 1,
      saturation: 1,
      gamma: 1,
    };
    useEditor.getState().addClip(clip);
    placedClips.push({ clipId: clip.id, assetId, seg });
    cursor += sourceDur - (isLast ? 0 : xfade);
  }

  // 6. Optional: subtitles. Run Whisper on each pick's audio range,
  //    then map chunk timestamps into the clip's timeline window.
  let subsAdded = 0;
  if (opts.generateSubtitles) {
    for (let i = 0; i < placedClips.length; i++) {
      const { clipId, assetId, seg } = placedClips[i];
      const a = useEditor.getState().assets[assetId];
      if (!a) continue;
      onProgress?.({
        phase: `자막 생성 ${i + 1}/${placedClips.length}: ${a.name}`,
        progress: i / placedClips.length,
      });
      try {
        const audio = await extractAudioForWhisper(a.file, () => {});
        // Slice to [seg.start, seg.end] in 16kHz samples.
        const startSample = Math.max(0, Math.floor(seg.start * 16000));
        const endSample = Math.min(audio.length, Math.ceil(seg.end * 16000));
        const slice = audio.slice(startSample, endSample);
        const chunks = await transcribe(slice, {
          model: opts.model,
          language: opts.language === 'auto' ? undefined : opts.language,
        });
        const clip = useEditor.getState().clips[clipId];
        if (!clip) continue;
        const speed = clip.speed ?? 1;
        for (const ch of chunks) {
          const startInClip = Math.max(0, ch.start);
          const endInClip = Math.min(seg.end - seg.start, ch.end);
          if (endInClip <= startInClip) continue;
          const subStart = clip.start + startInClip / speed;
          const subDur = (endInClip - startInClip) / speed;
          useEditor.getState().addSubtitle({
            text: ch.text,
            start: subStart,
            duration: subDur,
          });
          subsAdded++;
        }
      } catch (e) {
        // Subtitle failures shouldn't kill the whole reel.
        console.warn('Whisper on segment failed', e);
      }
    }
  }

  return {
    segmentsPlaced: placedClips.length,
    totalDuration: cursor - baseStart,
    subtitlesAdded: subsAdded,
  };
}

// ─── Beat-cut to BGM ───────────────────────────────────────────────────────

export interface BeatCutOptions {
  /** BGM asset id. Required — beats are detected from this audio. */
  bgmAssetId: string;
  /** Place a new video clip every Nth beat. 1 = on every beat (frantic),
   * 4 = every 4 beats (typical bar in 4/4). */
  beatsPerCut: number;
  /** Maximum total length (timeline seconds). 0 = use full BGM duration. */
  maxDurationSec: number;
  /** Crossfade between video cuts (timeline seconds). 0 = hard cut. */
  crossfadeSec: number;
  /** Where on the timeline to drop the reel. */
  insertAt: 'end' | 'playhead' | 'zero';
  /** When trimming a video for a beat slot, start at this offset from the
   * source's `inPoint` zero. 0 = always start from the top of each video. */
  videoStartOffsetSec: number;
}

export const BEAT_CUT_DEFAULTS: BeatCutOptions = {
  bgmAssetId: '',
  beatsPerCut: 4,
  maxDurationSec: 30,
  crossfadeSec: 0.15,
  insertAt: 'end',
  videoStartOffsetSec: 0,
};

export interface BeatCutResult {
  bpm: number;
  beatsTotal: number;
  cutsPlaced: number;
  totalDuration: number;
}

/** Build a beat-cut reel: detect BGM tempo, then cycle the provided video
 * assets through cut boundaries aligned to every Nth beat. BGM goes on the
 * first audio track; the video sequence goes on the first video track. */
export async function runBeatCut(
  videoAssetIds: string[],
  opts: BeatCutOptions,
  onProgress?: (p: AutoEditProgress) => void
): Promise<BeatCutResult> {
  if (videoAssetIds.length === 0) throw new Error('비디오 자산을 1개 이상 선택하세요.');
  if (!opts.bgmAssetId) throw new Error('BGM 자산을 선택하세요.');
  const s0 = useEditor.getState();
  const bgmAsset = s0.assets[opts.bgmAssetId];
  if (!bgmAsset) throw new Error('BGM 자산을 찾을 수 없습니다.');
  if (!bgmAsset.hasAudio) throw new Error('선택한 BGM 자산에 오디오가 없습니다.');
  const videoTrack = s0.tracks.find((t) => t.kind === 'video');
  const audioTrack = s0.tracks.find((t) => t.kind === 'audio');
  if (!videoTrack) throw new Error('비디오 트랙이 없습니다.');
  if (!audioTrack) throw new Error('오디오 트랙이 없습니다.');

  // 1. Detect beats in the BGM.
  onProgress?.({ phase: `BGM 비트 검출 중: ${bgmAsset.name}`, progress: -1 });
  const beatInfo = await detectBeats(bgmAsset.file);
  if (beatInfo.beats.length < 2) {
    throw new Error(`비트를 검출할 수 없습니다 (검출된 비트: ${beatInfo.beats.length}개). BGM이 너무 짧거나 박자가 모호한지 확인하세요.`);
  }
  onProgress?.({
    phase: `${beatInfo.bpm} BPM · ${beatInfo.beats.length}개 비트 검출`,
    progress: -1,
  });

  // 2. Pick cut boundaries — every Nth beat.
  const stride = Math.max(1, Math.floor(opts.beatsPerCut));
  const cutTimes: number[] = [0];
  for (let i = stride - 1; i < beatInfo.beats.length; i += stride) {
    cutTimes.push(beatInfo.beats[i]);
  }
  // Cap at maxDuration if set.
  const totalCap = opts.maxDurationSec > 0 ? opts.maxDurationSec : beatInfo.durationSec;
  while (cutTimes.length > 1 && cutTimes[cutTimes.length - 1] > totalCap) cutTimes.pop();
  // Append the final stop time if we trimmed early.
  if (cutTimes[cutTimes.length - 1] < totalCap) cutTimes.push(Math.min(totalCap, beatInfo.durationSec));

  if (cutTimes.length < 2) {
    throw new Error('비트가 충분히 많지 않아 컷을 만들 수 없습니다. "비트당 컷" 값을 줄여보세요.');
  }

  // 3. Determine insertion point on timeline.
  const s = useEditor.getState();
  let baseStart = 0;
  if (opts.insertAt === 'end') {
    for (const c of Object.values(s.clips)) {
      if (c.trackId !== videoTrack.id && c.trackId !== audioTrack.id) continue;
      const end = c.start + clipDisplayDur(c);
      if (end > baseStart) baseStart = end;
    }
  } else if (opts.insertAt === 'playhead') {
    baseStart = s.playhead;
  }

  // 4. Place BGM clip on the audio track for the full reel length.
  const reelDur = cutTimes[cutTimes.length - 1] - cutTimes[0];
  const bgmClip: Clip = {
    id: newClipId(),
    assetId: opts.bgmAssetId,
    trackId: audioTrack.id,
    start: baseStart,
    inPoint: 0,
    outPoint: Math.min(bgmAsset.duration, reelDur),
    fadeIn: 0,
    fadeOut: Math.min(1, reelDur * 0.05),
    volume: 1,
    muted: false,
    speed: 1,
    audioTail: 0,
    transformX: 0, transformY: 0, transformScale: 1, transformRotation: 0, transformOpacity: 1,
    brightness: 0, contrast: 1, saturation: 1, gamma: 1,
  };
  useEditor.getState().addClip(bgmClip);

  // 5. Place video cuts on the video track, cycling through assets.
  //    Each cut takes the next chunk of source from the assigned video.
  const xfade = Math.max(0, opts.crossfadeSec);
  // Track per-video source cursor so a repeat-visit takes a fresh chunk.
  const videoCursor: Record<string, number> = {};
  for (const vid of videoAssetIds) videoCursor[vid] = opts.videoStartOffsetSec;

  let placed = 0;
  for (let i = 0; i < cutTimes.length - 1; i++) {
    const segStart = cutTimes[i];
    const segEnd = cutTimes[i + 1];
    const segDur = segEnd - segStart;
    if (segDur <= 0.05) continue;
    const assetId = videoAssetIds[i % videoAssetIds.length];
    const a = useEditor.getState().assets[assetId];
    if (!a) continue;
    // Image clip: just use slot duration.
    let inP = 0;
    let outP = segDur;
    if (!a.isImage) {
      // Video clip: take the next chunk; wrap around when we hit the end.
      let cursor = videoCursor[assetId] ?? 0;
      if (cursor + segDur > a.duration) cursor = opts.videoStartOffsetSec;
      inP = cursor;
      outP = Math.min(a.duration, cursor + segDur);
      videoCursor[assetId] = outP;
    }
    const isFirst = placed === 0;
    const isLast = i === cutTimes.length - 2;
    const clip: Clip = {
      id: newClipId(),
      assetId,
      trackId: videoTrack.id,
      start: baseStart + segStart,
      inPoint: inP,
      outPoint: outP,
      fadeIn: isFirst ? 0 : xfade,
      fadeOut: isLast ? 0 : xfade,
      volume: 1,
      muted: true, // mute video audio so BGM is clean
      speed: 1,
      audioTail: 0,
      transformX: 0, transformY: 0, transformScale: 1, transformRotation: 0, transformOpacity: 1,
      brightness: 0, contrast: 1, saturation: 1, gamma: 1,
    };
    useEditor.getState().addClip(clip);
    placed++;
  }

  return {
    bpm: beatInfo.bpm,
    beatsTotal: beatInfo.beats.length,
    cutsPlaced: placed,
    totalDuration: reelDur,
  };
}
