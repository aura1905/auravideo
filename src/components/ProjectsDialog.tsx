import { useEffect, useState } from 'react';
import { listProjects, deleteProject, type ProjectMeta } from '../utils/db';
import { saveProject, loadProject } from '../utils/project';
import { setLastProject, AUTOSAVE_PROJECT_NAME } from '../utils/autosave';

type Mode = 'save' | 'open';

export function ProjectsDialog({ mode, onClose }: { mode: Mode; onClose: () => void }) {
  const [items, setItems] = useState<ProjectMeta[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const list = await listProjects();
    // hide autosave entries from the user-facing list
    setItems(list.filter((p) => p.name !== AUTOSAVE_PROJECT_NAME));
  };

  useEffect(() => {
    refresh();
  }, []);

  const onSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('이름을 입력하세요');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const existing = items.find((p) => p.name === trimmed);
      const id = await saveProject(trimmed, existing?.id);
      await setLastProject(id);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const onOpen = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await loadProject(id);
      await setLastProject(id);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm('이 프로젝트를 삭제할까요?')) return;
    await deleteProject(id);
    await refresh();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{mode === 'save' ? '프로젝트 저장' : '프로젝트 열기'}</div>
        <div className="modal-body">
          {mode === 'save' && (
            <div className="save-row">
              <input
                type="text"
                placeholder="프로젝트 이름"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSave();
                }}
                autoFocus
              />
              <button className="primary" onClick={onSave} disabled={busy}>
                저장
              </button>
            </div>
          )}
          {items.length === 0 ? (
            <div className="props-empty">저장된 프로젝트가 없습니다</div>
          ) : (
            <ul className="project-list">
              {items.map((p) => (
                <li key={p.id} className="project-item">
                  <button
                    className="project-pick"
                    onClick={() => (mode === 'open' ? onOpen(p.id) : setName(p.name))}
                    disabled={busy}
                    title={mode === 'open' ? '열기' : '이 이름으로 덮어쓰기'}
                  >
                    <div className="project-name">{p.name}</div>
                    <div className="project-sub">{new Date(p.updatedAt).toLocaleString()}</div>
                  </button>
                  <button onClick={() => onDelete(p.id)} disabled={busy} title="삭제">
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && <pre className="error">{error}</pre>}
        </div>
        <div className="modal-actions">
          <button onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
