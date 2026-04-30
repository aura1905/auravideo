import { useEffect, useState } from 'react';
import { MediaLibrary } from './components/MediaLibrary';
import { Timeline } from './components/Timeline';
import { Preview } from './components/Preview';
import { PropertiesPanel } from './components/PropertiesPanel';
import { ExportDialog } from './components/ExportDialog';
import { ProjectsDialog } from './components/ProjectsDialog';
import { useEditor, useTemporal, undo, redo } from './state/editorStore';
import { useAutosave, tryRestoreLast } from './utils/autosave';
import { useGlobalShortcuts } from './utils/shortcuts';

export function App() {
  const [exportOpen, setExportOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [openOpen, setOpenOpen] = useState(false);
  const [restored, setRestored] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const settings = useEditor((s) => s.settings);
  const setSettings = useEditor((s) => s.setSettings);
  const canUndo = useTemporal((t) => t.pastStates.length > 0);
  const canRedo = useTemporal((t) => t.futureStates.length > 0);

  // Restore last session once on mount, then enable autosave.
  useEffect(() => {
    tryRestoreLast()
      .catch((e) => console.error('restore failed', e))
      .finally(() => setRestored(true));
  }, []);
  useAutosave(restored);
  useGlobalShortcuts();

  // Capture the deferred install prompt so we can offer an explicit
  // "Install app" button instead of relying on the browser's hidden UI.
  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  // Warn before tab close if there is content
  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => {
      const s = useEditor.getState();
      if (Object.keys(s.clips).length > 0 || Object.keys(s.assets).length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBefore);
    return () => window.removeEventListener('beforeunload', onBefore);
  }, []);

  const presetValues = ['3840x2160', '2560x1440', '1920x1080', '1280x720', '1080x1920', '720x1280', '1080x1080'];
  const currentKey = `${settings.width}x${settings.height}`;
  const presetMatch = presetValues.includes(currentKey) ? currentKey : 'custom';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">AuraVideo</div>
        <div className="topbar-controls">
          <label>
            해상도
            <select
              value={presetMatch}
              onChange={(e) => {
                if (e.target.value === 'custom') return;
                const [w, h] = e.target.value.split('x').map(Number);
                setSettings({ width: w, height: h });
              }}
            >
              <option value="3840x2160">3840×2160 (4K)</option>
              <option value="2560x1440">2560×1440 (QHD)</option>
              <option value="1920x1080">1920×1080 (FHD)</option>
              <option value="1280x720">1280×720 (HD)</option>
              <option value="1080x1920">1080×1920 (세로)</option>
              <option value="720x1280">720×1280 (세로)</option>
              <option value="1080x1080">1080×1080 (정사각)</option>
              <option value="custom">사용자 지정…</option>
            </select>
          </label>
          <label className="custom-res">
            <input
              type="number"
              min={16}
              max={7680}
              step={2}
              value={settings.width}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isFinite(v)) return;
                const w = Math.max(16, Math.min(7680, v));
                setSettings({ width: w % 2 === 0 ? w : w + 1 });
              }}
              title="가로 (짝수, x264 호환)"
            />
            <span>×</span>
            <input
              type="number"
              min={16}
              max={4320}
              step={2}
              value={settings.height}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isFinite(v)) return;
                const h = Math.max(16, Math.min(4320, v));
                setSettings({ height: h % 2 === 0 ? h : h + 1 });
              }}
              title="세로 (짝수, x264 호환)"
            />
          </label>
          <label>
            FPS
            <select
              value={settings.fps}
              onChange={(e) => setSettings({ fps: parseInt(e.target.value, 10) })}
            >
              <option value="24">24</option>
              <option value="30">30</option>
              <option value="60">60</option>
            </select>
          </label>
        </div>
        <button onClick={undo} disabled={!canUndo} title="실행 취소 (Ctrl+Z)">↶ 되돌리기</button>
        <button onClick={redo} disabled={!canRedo} title="다시 실행 (Ctrl+Y / Ctrl+Shift+Z)">↷ 다시</button>
        <button onClick={() => setSaveOpen(true)} title="프로젝트 저장">💾 저장</button>
        <button onClick={() => setOpenOpen(true)} title="프로젝트 열기">📂 열기</button>
        {installPrompt && (
          <button
            onClick={async () => {
              try {
                installPrompt.prompt();
                await installPrompt.userChoice;
              } finally {
                setInstallPrompt(null);
              }
            }}
            title="브라우저 앱처럼 설치 (오프라인에서도 동작)"
          >
            ⬇ 앱 설치
          </button>
        )}
        <button className="primary" onClick={() => setExportOpen(true)}>
          내보내기
        </button>
      </header>
      <main className="main">
        <aside className="sidebar-left">
          <MediaLibrary />
        </aside>
        <section className="center">
          <Preview />
          <Timeline />
        </section>
        <aside className="sidebar-right">
          <PropertiesPanel />
        </aside>
      </main>
      {exportOpen && <ExportDialog onClose={() => setExportOpen(false)} />}
      {saveOpen && <ProjectsDialog mode="save" onClose={() => setSaveOpen(false)} />}
      {openOpen && <ProjectsDialog mode="open" onClose={() => setOpenOpen(false)} />}
    </div>
  );
}
