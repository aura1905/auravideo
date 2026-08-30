/**
 * Frontend half of the agent control bridge.
 *
 * Commands arrive as `agent://request` events from the Rust bridge and are
 * applied through the ordinary store actions — the same ones the UI calls — so
 * an automated edit and a hand edit go down identical code paths. The reply
 * goes back via the `agent_reply` command.
 *
 * Only active in the desktop build, and only when the Rust side actually opened
 * the bridge (which requires NABIVIDEO_AGENT=1).
 */
import { useEditor, newClipId, projectDuration, clipDisplayDur } from '../state/editorStore';
import type { Clip, Subtitle } from '../types';
import { loadMediaFile, generateWaveform } from './media';
import { canBrowserPlayVideo, transcodeToH264 } from './transcode';
import { isNative, readFileAsFile, tempRoot } from './native';
import { exportProjectNative } from './exportNative';

type Args = Record<string, any>;

function summary() {
  const s = useEditor.getState();
  return {
    settings: s.settings,
    playhead: s.playhead,
    duration: projectDuration(s),
    tracks: s.tracks.map((t) => ({
      id: t.id,
      name: t.name,
      kind: t.kind,
      muted: t.muted,
      hidden: t.hidden,
      volume: t.volume,
      solo: !!t.solo,
    })),
    assets: Object.values(s.assets).map((a) => ({
      id: a.id,
      name: a.name,
      duration: a.duration,
      width: a.width,
      height: a.height,
      hasAudio: a.hasAudio,
      hasVideo: a.hasVideo,
      isImage: a.isImage,
    })),
    clips: Object.values(s.clips).map((c) => ({
      id: c.id,
      assetId: c.assetId,
      trackId: c.trackId,
      start: c.start,
      inPoint: c.inPoint,
      outPoint: c.outPoint,
      displayDur: clipDisplayDur(c),
      speed: c.speed,
      volume: c.volume,
      muted: c.muted,
      fadeIn: c.fadeIn,
      fadeOut: c.fadeOut,
      blendMode: c.blendMode,
      glow: c.glow,
    })),
    subtitles: Object.values(s.subtitles).map((x) => ({
      id: x.id,
      text: x.text,
      start: x.start,
      duration: x.duration,
    })),
  };
}

/** Give the RAF loop time to paint the current playhead, including any video
 *  seek it triggered. There is no reliable "canvas has settled" signal, so the
 *  wait is a configurable delay. */
function settle(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function previewCanvas(): HTMLCanvasElement {
  const c = document.querySelector<HTMLCanvasElement>('.preview-stage canvas');
  if (!c) throw new Error('프리뷰 캔버스를 찾지 못했습니다');
  return c;
}

async function writeBytes(path: string, bytes: Uint8Array): Promise<void> {
  const { writeFile } = await import('@tauri-apps/plugin-fs');
  await writeFile(path, bytes);
}

function joinPath(dir: string, leaf: string): string {
  const sep = dir.includes('\\') ? '\\' : '/';
  return `${dir}${sep}${leaf}`;
}

const handlers: Record<string, (a: Args) => Promise<any> | any> = {
  ping: () => ({ ok: true, native: isNative() }),

  state: () => summary(),

  'project.reset': () => {
    useEditor.getState().resetProject();
    return { ok: true };
  },

  /** Import media by absolute path, the same way the desktop file picker does. */
  'media.import': async (a: Args) => {
    const paths: string[] = a.paths ?? [];
    const out: any[] = [];
    for (const p of paths) {
      const original = await readFileAsFile(p);
      let working: File = original;
      if (original.type.startsWith('video/') && !(await canBrowserPlayVideo(original))) {
        // The preview needs something the webview can decode; the export still
        // uses the original through __nativePath, carried over here.
        working = await transcodeToH264(original, () => {});
        Object.defineProperty(working, '__nativePath', { value: p, enumerable: false });
      }
      const asset = await loadMediaFile(working);
      useEditor.getState().addAsset(asset);
      const wf = await generateWaveform(working, 100).catch(() => null);
      if (wf) {
        const cur = useEditor.getState().assets[asset.id];
        if (cur) {
          useEditor.setState({
            assets: {
              ...useEditor.getState().assets,
              [asset.id]: {
                ...cur,
                waveform: wf.peaks,
                waveformPeaksPerSecond: wf.peaksPerSecond,
              },
            },
          });
        }
      }
      out.push({
        id: asset.id,
        name: asset.name,
        duration: asset.duration,
        width: asset.width,
        height: asset.height,
        hasAudio: asset.hasAudio,
        hasVideo: asset.hasVideo,
        isImage: asset.isImage,
      });
    }
    return { assets: out };
  },

  'clip.add': (a: Args) => {
    const s = useEditor.getState();
    const asset = s.assets[a.assetId];
    if (!asset) throw new Error(`알 수 없는 assetId: ${a.assetId}`);
    const trackId: string | undefined =
      a.trackId ?? s.tracks.find((t) => t.kind === (asset.hasVideo ? 'video' : 'audio'))?.id;
    if (!trackId) throw new Error('사용할 트랙이 없습니다');
    const clip: Clip = {
      id: newClipId(),
      assetId: asset.id,
      trackId,
      start: a.start ?? 0,
      inPoint: a.inPoint ?? 0,
      outPoint: a.outPoint ?? (asset.isImage ? Math.min(5, asset.duration) : asset.duration),
      fadeIn: a.fadeIn ?? 0,
      fadeOut: a.fadeOut ?? 0,
      volume: a.volume ?? 1,
      muted: a.muted ?? false,
      speed: a.speed ?? 1,
      audioTail: a.audioTail ?? 0,
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
    return { id: clip.id };
  },

  'clip.update': (a: Args) => {
    useEditor.getState().updateClip(a.id, a.patch ?? {});
    return { ok: true, clip: useEditor.getState().clips[a.id] ?? null };
  },

  'clip.split': (a: Args) => {
    const before = new Set(Object.keys(useEditor.getState().clips));
    useEditor.getState().splitClipAt(a.id, a.time);
    const after = Object.keys(useEditor.getState().clips);
    return { ok: true, newClipIds: after.filter((id) => !before.has(id)) };
  },

  'clip.remove': (a: Args) => {
    useEditor.getState().removeClip(a.id);
    return { ok: true };
  },

  'subtitle.add': (a: Args) => {
    const id = useEditor
      .getState()
      .addSubtitle({ ...a, start: a.start ?? 0 } as Partial<Subtitle> & { start: number });
    return { id };
  },

  'subtitle.update': (a: Args) => {
    useEditor.getState().updateSubtitle(a.id, a.patch ?? {});
    return { ok: true };
  },

  'playhead.set': (a: Args) => {
    useEditor.getState().setPlayhead(a.t ?? 0);
    return { ok: true, playhead: useEditor.getState().playhead };
  },

  /**
   * Seek, then capture what the preview is actually showing. This is how an
   * agent "looks at" its edit: the PNG is the same composite the export
   * produces, minus the export-only audio work.
   */
  screenshot: async (a: Args) => {
    if (typeof a.t === 'number') useEditor.getState().setPlayhead(a.t);
    await settle(a.settleMs ?? 900);
    const canvas = previewCanvas();
    const blob: Blob | null = await new Promise((r) => canvas.toBlob((b) => r(b), 'image/png'));
    if (!blob) throw new Error('캔버스 캡처 실패');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const path: string = a.path ?? joinPath(await tempRoot(), `shot-${Date.now()}.png`);
    await writeBytes(path, bytes);
    return { path, width: canvas.width, height: canvas.height, bytes: bytes.length };
  },

  export: async (a: Args) => {
    const s = useEditor.getState();
    const dur = projectDuration(s);
    return await exportProjectNative(
      {
        clips: Object.values(s.clips),
        assets: s.assets,
        tracks: s.tracks,
        settings: s.settings,
        duration: dur,
        masterVolume: s.masterVolume,
        subtitles: Object.values(s.subtitles),
        rangeStart: a.rangeStart ?? 0,
        rangeEnd: a.rangeEnd ?? dur,
      },
      () => {},
      { outPath: a.outPath, encoder: a.encoder, jobId: `agent-${Date.now()}` }
    );
  },
};

export async function installAgentBridge(): Promise<void> {
  if (!isNative()) return;
  const { listen } = await import('@tauri-apps/api/event');
  const { invoke } = await import('@tauri-apps/api/core');
  await listen<{ id: string; cmd: string; args: Args }>('agent://request', async (e) => {
    const { id, cmd, args } = e.payload;
    let result: any;
    try {
      const h = handlers[cmd];
      if (!h) throw new Error(`알 수 없는 명령: ${cmd}`);
      result = { ok: true, data: await h(args ?? {}) };
    } catch (err: any) {
      result = { ok: false, error: err?.message ?? String(err) };
    }
    try {
      await invoke('agent_reply', { id, result });
    } catch (err) {
      console.error('[agent] reply failed', err);
    }
  });
  console.log('[agent] bridge installed');
}
