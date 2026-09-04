/**
 * Dev-only script hook for the web build.
 *
 * The desktop build has a real agent bridge (`agentBridge.ts`). On a machine
 * with no Rust toolchain the same editing can still be driven from browser
 * automation — but only if the store and the export graph builder are
 * reachable from the page. This module puts them on `window.__aura` in dev
 * mode and nothing else; it is never part of a production bundle.
 *
 * The edit still goes through the ordinary store actions, and the ffmpeg
 * arguments come from the same `buildCommand` the real exports use, so an
 * outside process can render them with native ffmpeg exactly the way
 * `exportNative.ts` does.
 */
import { useEditor } from '../state/editorStore';
import { buildCommand, renderSubtitleToPng } from './export';
import { loadMediaFile, generateWaveform } from './media';
import { exportProjectZip } from './project';
import { createGeneratorAsset } from './generators';

export function installWebAgent(): void {
  (window as any).__aura = {
    useEditor,
    buildCommand,
    renderSubtitleToPng,
    loadMediaFile,
    generateWaveform,
    exportProjectZip,
    createGeneratorAsset,
  };
  console.log('[webAgent] window.__aura ready');
}
