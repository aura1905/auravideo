/** Whisper-based automatic speech recognition.
 *
 * The transformers.js package is large (~3 MB JS + a 40-200 MB model on first
 * use) so it's loaded with a dynamic import — the main bundle stays light for
 * users who never run transcription. The HuggingFace model files are cached
 * by the browser after the first run. */

export interface TranscriptionWord {
  /** Start time in seconds, relative to the audio that was fed in. */
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionChunk {
  /** Start time in seconds, relative to the audio that was fed in. */
  start: number;
  end: number;
  text: string;
  /** Per-word timestamps. Present only when transcribe() is called with
   * `wordTimestamps: true`. Each word's `text` may include leading/trailing
   * spaces — exactly as Whisper emits it. */
  words?: TranscriptionWord[];
}

export type WhisperModel = 'Xenova/whisper-tiny' | 'Xenova/whisper-base' | 'Xenova/whisper-small';

export interface TranscribeProgress {
  phase: string;
  /** 0..1, or -1 if indeterminate. */
  progress: number;
  log?: string;
}

/** Decode an audio/video file's audio track into a 16 kHz mono Float32Array,
 * which is the input format Whisper expects. */
export async function extractAudioForWhisper(
  file: File,
  onProgress?: (p: TranscribeProgress) => void
): Promise<Float32Array> {
  onProgress?.({ phase: '오디오 디코딩 중…', progress: -1 });
  const ab = await file.arrayBuffer();
  const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
  const ctx = new Ctx();
  const buf = await ctx.decodeAudioData(ab.slice(0));
  ctx.close();
  const targetSampleRate = 16000;
  // Resample to 16 kHz mono via OfflineAudioContext.
  const offline = new OfflineAudioContext(
    1,
    Math.max(1, Math.ceil(buf.duration * targetSampleRate)),
    targetSampleRate
  );
  const src = offline.createBufferSource();
  src.buffer = buf;
  src.connect(offline.destination);
  src.start(0);
  onProgress?.({ phase: '오디오 리샘플링 중…', progress: -1 });
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

let cachedTranscriber: any = null;
let cachedModel: WhisperModel | null = null;

export async function transcribe(
  audio: Float32Array,
  options: {
    model: WhisperModel;
    language?: string; // 'korean', 'english', etc. omit for auto-detect
    /** Request per-word timestamps in addition to per-segment ones. Slightly
     * slower but produces much cleaner silence cuts (we won't slice
     * mid-word) and lets us split long subtitle chunks at natural pauses. */
    wordTimestamps?: boolean;
    onProgress?: (p: TranscribeProgress) => void;
  }
): Promise<TranscriptionChunk[]> {
  const { model, language, wordTimestamps, onProgress } = options;
  // Lazy-load transformers.js so the main bundle stays small.
  onProgress?.({ phase: 'Whisper 모델 로드 중…', progress: 0 });
  const tj: any = await import('@xenova/transformers');
  // Disable progress bar in console.
  if (tj.env) tj.env.allowLocalModels = false;

  if (!cachedTranscriber || cachedModel !== model) {
    cachedTranscriber = await tj.pipeline('automatic-speech-recognition', model, {
      progress_callback: (p: any) => {
        if (typeof p === 'object' && p.status === 'progress') {
          const pct = p.progress != null ? p.progress / 100 : -1;
          onProgress?.({
            phase: `모델 다운로드 중… ${p.file ?? ''}`,
            progress: pct,
          });
        } else if (p?.status === 'done') {
          onProgress?.({ phase: `로드 완료: ${p.file ?? ''}`, progress: -1 });
        }
      },
    });
    cachedModel = model;
  }

  onProgress?.({ phase: '음성 인식 중…', progress: -1 });
  const result = await cachedTranscriber(audio, {
    // `'word'` requests per-word timestamps; `true` is segment-only.
    return_timestamps: wordTimestamps ? 'word' : true,
    chunk_length_s: 30,
    stride_length_s: 5,
    language,
    task: 'transcribe',
  });

  const chunks: TranscriptionChunk[] = [];
  if (wordTimestamps && Array.isArray(result?.chunks)) {
    // Word mode returns one entry per WORD in result.chunks; group them
    // into sentence-like segments so the rest of the pipeline can keep
    // using chunk-level granularity for subtitles, while still having
    // word timestamps available via `.words` for fine-grained cuts.
    const words: TranscriptionWord[] = [];
    for (const w of result.chunks) {
      const start = Array.isArray(w.timestamp) ? w.timestamp[0] ?? 0 : 0;
      const endRaw = Array.isArray(w.timestamp) ? w.timestamp[1] : null;
      const end = endRaw ?? start + 0.2;
      const text = (w.text ?? '').trim();
      if (text) words.push({ start, end, text });
    }
    // Group words into chunks by inter-word gap > 0.5s OR by a soft cap
    // on word count (~14 words ~= a comfortable subtitle line).
    let bucket: TranscriptionWord[] = [];
    const flush = () => {
      if (bucket.length === 0) return;
      const start = bucket[0].start;
      const end = bucket[bucket.length - 1].end;
      const text = bucket.map((w) => w.text).join(' ').replace(/\s+/g, ' ').trim();
      chunks.push({ start, end, text, words: bucket });
      bucket = [];
    };
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (bucket.length === 0) { bucket.push(w); continue; }
      const prev = bucket[bucket.length - 1];
      const gap = w.start - prev.end;
      if (gap > 0.5 || bucket.length >= 14) { flush(); }
      bucket.push(w);
    }
    flush();
    return chunks;
  }

  if (Array.isArray(result?.chunks)) {
    for (const c of result.chunks) {
      const start = Array.isArray(c.timestamp) ? c.timestamp[0] ?? 0 : 0;
      const endRaw = Array.isArray(c.timestamp) ? c.timestamp[1] : null;
      const end = endRaw ?? start + 2;
      const text = (c.text ?? '').trim();
      if (text) chunks.push({ start, end, text });
    }
  } else if (typeof result?.text === 'string') {
    // Some configurations return a single string with no per-segment timestamps.
    chunks.push({ start: 0, end: audio.length / 16000, text: result.text.trim() });
  }
  return chunks;
}
