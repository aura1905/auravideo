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
} from './whisper';

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
  /** Padding (in source seconds) added before each kept range so words don't
   * start mid-syllable. Default 0.15. */
  leadPadSec: number;
  /** Padding after each kept range. Default 0.2. */
  tailPadSec: number;
  /** If true, generate one Subtitle per Whisper chunk (mapped to timeline
   * coords AFTER the silence removal). */
  generateSubtitles: boolean;
  /** Crossfade between every two kept fragments (timeline seconds). 0 = hard
   * cut. Implemented by overlapping fragments and setting fadeIn/fadeOut. */
  crossfadeSec: number;
}

export const TALKING_HEAD_DEFAULTS: TalkingHeadOptions = {
  language: 'korean',
  model: 'Xenova/whisper-tiny',
  minSilenceSec: 0.6,
  leadPadSec: 0.15,
  tailPadSec: 0.2,
  generateSubtitles: true,
  crossfadeSec: 0,
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
    onProgress: (p) => onProgress?.({ phase: p.phase, progress: p.progress }),
  });
  onProgress?.({ phase: `Whisper: ${chunks.length}개 세그먼트`, progress: -1 });

  // 2. Clamp chunks to the clip's source-media window [inPoint, outPoint],
  //    drop chunks that fall entirely outside, and add lead/tail padding.
  const inP = clip.inPoint;
  const outP = clip.outPoint;
  const padded: { start: number; end: number; chunkIndex: number }[] = [];
  const usableChunks: TranscriptionChunk[] = [];
  chunks.forEach((c, i) => {
    let a = c.start - opts.leadPadSec;
    let b = c.end + opts.tailPadSec;
    if (b <= inP || a >= outP) return;
    a = Math.max(inP, a);
    b = Math.min(outP, b);
    if (b - a < 0.05) return;
    padded.push({ start: a, end: b, chunkIndex: usableChunks.length });
    usableChunks.push(c);
  });

  if (padded.length === 0) {
    throw new Error('Whisper가 인식한 음성 구간이 클립 범위 내에 없습니다.');
  }

  // 3. Merge overlapping / near-overlapping kept ranges. "Near" = gap below
  //    minSilenceSec — those gaps are too short to be worth cutting.
  padded.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number; chunkIndexes: number[] }[] = [];
  for (const r of padded) {
    const last = merged[merged.length - 1];
    if (last && r.start - last.end < opts.minSilenceSec) {
      last.end = Math.max(last.end, r.end);
      last.chunkIndexes.push(r.chunkIndex);
    } else {
      merged.push({ start: r.start, end: r.end, chunkIndexes: [r.chunkIndex] });
    }
  }

  // 4. Compute timeline layout for each kept fragment. With crossfadeSec > 0,
  //    each fragment after the first overlaps the previous by that amount.
  const speed = clip.speed ?? 1;
  const xfade = Math.max(0, opts.crossfadeSec);
  let cursorTimeline = clip.start;
  const newClips: Clip[] = [];
  const subtitlesToAdd: { text: string; start: number; duration: number }[] = [];

  merged.forEach((m, idx) => {
    const sourceDur = m.end - m.start;
    const timelineDur = sourceDur / speed;
    const isFirst = idx === 0;
    const isLast = idx === merged.length - 1;
    const fadeIn = isFirst ? clip.fadeIn : xfade;
    const fadeOut = isLast ? clip.fadeOut : xfade;
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

    // Map subtitle chunks for THIS fragment back to timeline coords.
    if (opts.generateSubtitles) {
      for (const ci of m.chunkIndexes) {
        const ch = usableChunks[ci];
        const startInFragment = Math.max(0, ch.start - m.start);
        const endInFragment = Math.min(sourceDur, ch.end - m.start);
        if (endInFragment <= startInFragment) continue;
        const subStartTL = newClip.start + startInFragment / speed;
        const subDurTL = (endInFragment - startInFragment) / speed;
        subtitlesToAdd.push({ text: ch.text, start: subStartTL, duration: subDurTL });
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
