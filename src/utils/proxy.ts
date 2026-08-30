/**
 * Preview proxies for sources the webview cannot decode.
 *
 * A "proxy" only ever feeds the *preview*. The export always renders from the
 * original file via `__nativePath`, so a proxy can be as lossy as it likes —
 * with one exception it must never get wrong: **transparency**.
 *
 * Cut-out overlay elements (an RMBG'd dancer, falling petals, a logo sting)
 * arrive as ProRes 4444 or QuickTime RLE, which the webview cannot play. The
 * old path transcoded those to H.264, which silently discarded the alpha, so
 * the preview showed the element sitting on a black rectangle while the export
 * composited it correctly. A preview that disagrees with the render is worse
 * than no preview. Chromium does decode VP9 alpha in WebM, so alpha sources get
 * a `yuva420p` WebM proxy instead and stay transparent on screen.
 */
import { canBrowserPlayVideo, transcodeToH264 } from './transcode';
import { isNative, probeMediaNative, transcodeProxyNative } from './native';

export interface ProxyResult {
  /** The file the preview should use — the original when it was already fine. */
  file: File;
  /** Whether a proxy was actually built. */
  proxied: boolean;
  /** True when the source carries transparency. */
  hasAlpha: boolean;
}

type Progress = (msg: string) => void;

/**
 * Return a file the webview can decode, preserving alpha where present.
 * `__nativePath` is carried across so the export still uses the original.
 */
export async function ensurePreviewable(
  file: File,
  onProgress: Progress = () => {}
): Promise<ProxyResult> {
  if (!file.type.startsWith('video/')) {
    return { file, proxied: false, hasAlpha: false };
  }

  const nativePath = (file as File & { __nativePath?: string }).__nativePath;

  // On the desktop, ask ffprobe rather than guessing: it is the only way to
  // know an alpha channel is there before deciding how to proxy.
  let hasAlpha = false;
  if (nativePath && isNative()) {
    try {
      const probe = await probeMediaNative(nativePath);
      hasAlpha = probe.has_alpha;
    } catch {
      /* fall through to the browser-only path */
    }
  }

  const playable = await canBrowserPlayVideo(file);
  // An alpha source that the webview *can* already play (VP9 WebM) is left
  // alone — re-encoding it would only lose quality.
  if (playable) return { file, proxied: false, hasAlpha };

  if (nativePath && isNative()) {
    onProgress(hasAlpha ? '알파 프록시 생성 중…' : '프록시 생성 중…');
    const outPath = await transcodeProxyNative(nativePath, hasAlpha);
    const { readFileAsFile } = await import('./native');
    const proxyFile = await readFileAsFile(outPath);
    // Point the export back at the ORIGINAL, not the proxy.
    Object.defineProperty(proxyFile, '__nativePath', {
      value: nativePath,
      enumerable: false,
      configurable: true,
      writable: true,
    });
    return { file: proxyFile, proxied: true, hasAlpha };
  }

  // Browser build: the wasm transcode is all there is, and it cannot keep
  // alpha. Nothing to be done here beyond what the web build always did.
  onProgress('브라우저 변환 중…');
  const out = await transcodeToH264(file, ({ phase, progress }) => {
    const pct = progress >= 0 ? ` ${Math.round(progress * 100)}%` : '';
    onProgress(`${phase}${pct}`);
  });
  return { file: out, proxied: true, hasAlpha: false };
}
