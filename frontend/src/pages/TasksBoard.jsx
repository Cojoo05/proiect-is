import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';

const API = `${API_BASE_URL}/api/tasks`;
const USERS_API = `${API_BASE_URL}/api/users`;

const MONTHS = ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sept.', 'oct.', 'nov.', 'dec.'];
const COLOR_PRESETS = ['#ffffff', '#fee2e2', '#ffedd5', '#fef9c3', '#dcfce7', '#dbeafe', '#ede9fe', '#fce7f3', '#e2e8f0'];
const BUCKET_ACCENTS = ['#5a3d5c', '#2563eb', '#059669', '#d97706', '#dc2626', '#4f46e5'];

const ARCHIVE_STATUS = { DONE: 'TERMINAT', CANCEL: 'ANULAT' };

const POPOVER_WIDTH = 232;
const POPOVER_HEIGHT = 260;

// Layout rules live in a stylesheet so the page can be responsive (media queries)
// and so hover effects work without JS. Everything is scoped under .tk-page.
const PAGE_CSS = `
.tk-page, .tk-page * { box-sizing: border-box; }
.tk-page { text-align: left; font-family: sans-serif; }
.tk-page h1, .tk-page h2 { font-family: inherit; letter-spacing: normal; }

.tk-layout { display: grid; grid-template-columns: minmax(0, 1fr) 190px; gap: 16px; align-items: start; }

.tk-board {
  display: flex; gap: 16px; align-items: flex-start; min-width: 0;
  overflow-x: auto; padding: 2px 2px 14px 2px;
  scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent;
}
.tk-col {
  flex: 0 0 290px; width: 290px; display: flex; flex-direction: column; gap: 10px;
  max-height: calc(100vh - 170px); min-height: 160px; padding: 12px;
  background: #f1f5f9; border: 2px solid #e2e8f0; border-radius: 12px; transition: background .12s, border-color .12s;
}
.tk-col.tk-over { background: #f3e8ff; border-color: #5a3d5c; border-style: dashed; }
.tk-col-list {
  display: flex; flex-direction: column; gap: 10px; flex: 1 1 auto; min-height: 0;
  overflow-y: auto; padding: 2px; margin: -2px;
  scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent;
}

.tk-archive { display: flex; flex-direction: column; gap: 12px; position: sticky; top: 84px; }
.tk-zone { border: 2px dashed; border-radius: 12px; padding: 16px 10px; text-align: center; cursor: pointer; transition: background .12s; }

.tk-card { position: relative; transition: box-shadow .15s; }
.tk-card:hover { box-shadow: 0 6px 16px rgba(15, 23, 42, 0.14) !important; }

.tk-icon-btn {
  background: none; border: none; cursor: pointer; font-size: 14px; line-height: 1;
  padding: 5px; border-radius: 6px; transition: background .12s;
}
.tk-icon-btn:hover { background: rgba(0, 0, 0, 0.08); }

.tk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }

@media (max-width: 820px) {
  .tk-layout { grid-template-columns: minmax(0, 1fr); }
  .tk-archive { position: static; flex-direction: row; }
  .tk-archive > * { flex: 1 1 0; }
  .tk-col { max-height: none; }
}
`;

// ── Helpers ──────────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const dateOnly = (dueLine) => (dueLine ? String(dueLine).slice(0, 10) : '');

const formatDate = (ds) => {
  const [y, m, d] = ds.split('-');
  return `${parseInt(d, 10)} ${MONTHS[parseInt(m, 10) - 1]} ${y}`;
};

const isDarkColor = (hex) => {
  if (!hex || typeof hex !== 'string' || hex[0] !== '#') return false;
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return false;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
};

const isArchived = (task) => task.status === 'TERMINAT' || task.status === 'ANULAT';

const sortByDeadline = (a, b) => {
  const da = dateOnly(a.dueLine);
  const db = dateOnly(b.dueLine);
  if (da && db && da !== db) return da < db ? -1 : 1;
  if (da && !db) return -1;
  if (!da && db) return 1;
  return a.id - b.id;
};

const callApi = async (url, options) => {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'A apărut o eroare!');
  return data;
};

const jsonHeaders = { 'Content-Type': 'application/json' };

// ── Small components (defined outside to keep input focus stable) ────────────
function ColorPalette({ value, onPick }) {
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
      {COLOR_PRESETS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onPick(c === '#ffffff' ? null : c)}
          title={c === '#ffffff' ? 'Implicit (alb)' : c}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: c,
            border: (value || '#ffffff').toLowerCase() === c ? '3px solid #5a3d5c' : '1px solid #cbd5e1',
            cursor: 'pointer',
            padding: 0,
          }}
        />
      ))}
    </div>
  );
}

const modalOverlay = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px',
};
const modalLabel = { display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px', textAlign: 'left' };
const modalInput = {
  width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px',
  boxSizing: 'border-box', outline: 'none', fontFamily: 'sans-serif', textAlign: 'left',
};
const modalCancelBtn = {
  padding: '9px 16px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1',
  borderRadius: '8px', fontWeight: '600', cursor: 'pointer',
};
const modalSubmitBtn = (saving) => ({
  padding: '9px 20px', backgroundColor: '#5a3d5c', color: '#ffffff', border: 'none', borderRadius: '8px',
  fontWeight: '700', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
});

function TaskModal({ mode, initial, buckets, users, currentUser, onClose, onSubmit }) {
  const [title, setTitle] = useState(initial.title || '');
  const [description, setDescription] = useState(initial.description || '');
  const [deadline, setDeadline] = useState(initial.deadline || '');
  const [color, setColor] = useState(initial.color || null);
  const [bucketId, setBucketId] = useState(initial.bucketId || buckets[0]?.id || '');
  const [assigneeId, setAssigneeId] = useState(currentUser.id);
  const [saving, setSaving] = useState(false);

  const isSelf = Number(assigneeId) === Number(currentUser.id);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        deadline,
        color,
        bucketId: isSelf ? Number(bucketId) || null : null,
        assigneeId: Number(assigneeId),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={modalOverlay}>
      <form
        onSubmit={submit}
        style={{
          backgroundColor: '#ffffff', borderRadius: '14px', width: '100%', maxWidth: '480px', textAlign: 'left',
          maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        }}
      >
        <h3 style={{ margin: '0 0 18px 0', color: '#1e293b', fontSize: '1.2rem', fontWeight: '700' }}>
          {mode === 'edit' ? '✏️ Editează Task' : '➕ Task Nou'}
        </h3>

        <div style={{ marginBottom: '14px' }}>
          <label style={modalLabel}>Titlu *</label>
          <input
            type="text"
            required
            autoFocus
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ex: Pregătește prezentarea"
            style={modalInput}
          />
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={modalLabel}>Descriere</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detalii despre task (opțional)"
            style={{ ...modalInput, resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 180px', minWidth: 0 }}>
            <label style={modalLabel}>📅 Deadline</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                style={modalInput}
              />
              {deadline && (
                <button
                  type="button"
                  onClick={() => setDeadline('')}
                  title="Șterge deadline-ul"
                  style={{ border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', borderRadius: '8px', cursor: 'pointer', padding: '0 10px', flexShrink: 0 }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {isSelf && buckets.length > 0 && (
            <div style={{ flex: '1 1 180px', minWidth: 0 }}>
              <label style={modalLabel}>📋 Coloană</label>
              <select
                value={bucketId}
                onChange={(e) => setBucketId(e.target.value)}
                style={{ ...modalInput, backgroundColor: '#ffffff' }}
              >
                {buckets.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {mode === 'create' && (
          <div style={{ marginBottom: '14px' }}>
            <label style={modalLabel}>👤 Alocat către</label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              style={{ ...modalInput, backgroundColor: '#ffffff' }}
            >
              <option value={currentUser.id}>Eu ({currentUser.username})</option>
              {users.filter((u) => u.id !== currentUser.id).map((u) => (
                <option key={u.id} value={u.id}>{u.username}</option>
              ))}
            </select>
            {!isSelf && (
              <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginTop: '4px' }}>
                Task-ul va apărea în board-ul persoanei alese, iar tu îl vei vedea la „Date de mine”.
              </span>
            )}
          </div>
        )}

        <div style={{ marginBottom: '20px' }}>
          <label style={modalLabel}>🎨 Culoare cartonaș</label>
          <ColorPalette value={color} onPick={setColor} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" onClick={onClose} style={modalCancelBtn}>Anulează</button>
          <button type="submit" disabled={saving} style={modalSubmitBtn(saving)}>
            {saving ? 'Se salvează...' : mode === 'edit' ? 'Salvează' : 'Creează Task'}
          </button>
        </div>
      </form>
    </div>
  );
}

function BucketModal({ mode, initialName, onClose, onSubmit }) {
  const [name, setName] = useState(initialName || '');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSubmit(name.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={modalOverlay}>
      <form
        onSubmit={submit}
        style={{ backgroundColor: '#ffffff', borderRadius: '14px', width: '100%', maxWidth: '400px', padding: '24px', textAlign: 'left', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}
      >
        <h3 style={{ margin: '0 0 16px 0', color: '#1e293b', fontSize: '1.2rem', fontWeight: '700' }}>
          {mode === 'edit' ? '✏️ Redenumește Coloana' : '➕ Coloană Nouă'}
        </h3>
        <label style={modalLabel}>Nume coloană *</label>
        <input
          type="text"
          required
          autoFocus
          maxLength={50}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex: Luna asta, Urgent, Idei..."
          style={{ ...modalInput, marginBottom: '18px' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" onClick={onClose} style={modalCancelBtn}>Anulează</button>
          <button type="submit" disabled={saving} style={modalSubmitBtn(saving)}>
            {saving ? 'Se salvează...' : mode === 'edit' ? 'Salvează' : 'Creează'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
function TasksBoard({ currentUser }) {
  const navigate = useNavigate();
  const me = currentUser?.id;

  const [view, setView] = useState('board'); // 'board' | 'given' | 'done' | 'cancel'
  const [tasks, setTasks] = useState([]);
  const [givenTasks, setGivenTasks] = useState([]);
  const [buckets, setBuckets] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [taskModal, setTaskModal] = useState(null); // { mode, task?, bucketId? }
  const [bucketModal, setBucketModal] = useState(null); // { mode, bucket? }
  const [colorPicker, setColorPicker] = useState(null); // { taskId, top, left }
  const [pendingColor, setPendingColor] = useState('#ffffff');
  const [dragOverKey, setDragOverKey] = useState(null);

  const loadAll = useCallback(async () => {
    if (!me) return;
    try {
      const [b, mine, given] = await Promise.all([
        fetch(`${API}/buckets/${me}`).then((r) => (r.ok ? r.json() : [])),
        fetch(`${API}/my-tasks/${me}`).then((r) => (r.ok ? r.json() : [])),
        fetch(`${API}/given-tasks/${me}`).then((r) => (r.ok ? r.json() : [])),
      ]);
      setBuckets(Array.isArray(b) ? b : []);
      setTasks(Array.isArray(mine) ? mine : []);
      setGivenTasks(Array.isArray(given) ? given.filter((t) => t.assignee?.id !== me) : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [me]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    fetch(USERS_API)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]));
  }, []);

  // ── Derived data ───────────────────────────────────────────────────────────
  const firstBucketId = buckets[0]?.id;
  const bucketOf = (t) => (buckets.some((b) => b.id === t.bucketId) ? t.bucketId : firstBucketId);

  const activeTasks = tasks.filter((t) => !isArchived(t));
  const doneTasks = tasks.filter((t) => t.status === ARCHIVE_STATUS.DONE).sort(sortByDeadline);
  const cancelTasks = tasks.filter((t) => t.status === ARCHIVE_STATUS.CANCEL).sort(sortByDeadline);

  // ── Task actions ───────────────────────────────────────────────────────────
  const patchTask = async (taskId, patch) => {
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
    try {
      const saved = await callApi(`${API}/${taskId}?userId=${me}`, {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify(patch),
      });
      setTasks((ts) => ts.map((t) => (t.id === taskId ? saved : t)));
    } catch (err) {
      alert(err.message);
      loadAll();
    }
  };

  const archiveTask = (task, kind) => patchTask(task.id, { status: ARCHIVE_STATUS[kind] });
  const restoreTask = (task) => patchTask(task.id, { status: 'PRIMIT' });

  const handleTaskSubmit = async (values) => {
    const dueLine = values.deadline ? `${values.deadline}T23:59:00` : null;
    try {
      if (taskModal.mode === 'edit') {
        const patch = {
          title: values.title,
          description: values.description,
          dueLine,
          color: values.color,
        };
        if (values.bucketId) patch.bucketId = values.bucketId;
        await callApi(`${API}/${taskModal.task.id}?userId=${me}`, {
          method: 'PUT',
          headers: jsonHeaders,
          body: JSON.stringify(patch),
        });
      } else {
        await callApi(API, {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify({
            title: values.title,
            description: values.description,
            dueLine,
            color: values.color,
            bucketId: values.bucketId,
            creator: { id: me },
            assignee: { id: values.assigneeId },
          }),
        });
      }
      setTaskModal(null);
      loadAll();
    } catch (err) {
      alert(err.message);
    }
  };

  // Color popover is rendered once at page level with fixed positioning, so it is
  // never clipped by the scrollable columns.
  const openColorPicker = (e, task) => {
    if (colorPicker?.taskId === task.id) {
      setColorPicker(null);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.right - POPOVER_WIDTH, window.innerWidth - POPOVER_WIDTH - 8));
    const top = Math.max(8, Math.min(r.bottom + 6, window.innerHeight - POPOVER_HEIGHT - 8));
    setPendingColor(task.color || '#ffffff');
    setColorPicker({ taskId: task.id, top, left });
  };

  const applyColor = (task, color) => {
    setColorPicker(null);
    patchTask(task.id, { color });
  };

  // ── Bucket actions ─────────────────────────────────────────────────────────
  const handleBucketSubmit = async (name) => {
    try {
      if (bucketModal.mode === 'edit') {
        await callApi(`${API}/buckets/${bucketModal.bucket.id}`, {
          method: 'PUT',
          headers: jsonHeaders,
          body: JSON.stringify({ userId: me, name }),
        });
      } else {
        await callApi(`${API}/buckets`, {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify({ userId: me, name }),
        });
      }
      setBucketModal(null);
      loadAll();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteBucket = async (bucket) => {
    if (buckets.length <= 1) {
      alert('Trebuie să rămână cel puțin o coloană!');
      return;
    }
    const count = activeTasks.filter((t) => bucketOf(t) === bucket.id).length;
    const msg = count > 0
      ? `Ștergi coloana "${bucket.name}"?\nCele ${count} task-uri din ea vor fi mutate în "${buckets.find((b) => b.id !== bucket.id)?.name}".`
      : `Ștergi coloana "${bucket.name}"?`;
    if (!window.confirm(msg)) return;
    try {
      await callApi(`${API}/buckets/${bucket.id}?userId=${me}`, { method: 'DELETE' });
      loadAll();
    } catch (err) {
      alert(err.message);
    }
  };

  // ── Drag & drop ────────────────────────────────────────────────────────────
  const handleDragStart = (e, taskId) => {
    setColorPicker(null);
    e.dataTransfer.setData('taskId', String(taskId));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, key) => {
    e.preventDefault();
    if (dragOverKey !== key) setDragOverKey(key);
  };

  const getDraggedTask = (e) => {
    const id = parseInt(e.dataTransfer.getData('taskId'), 10);
    return tasks.find((t) => t.id === id);
  };

  const handleDropOnBucket = (e, bucket) => {
    e.preventDefault();
    setDragOverKey(null);
    const task = getDraggedTask(e);
    if (!task || isArchived(task)) return;
    if (bucketOf(task) === bucket.id) return;
    patchTask(task.id, { bucketId: bucket.id });
  };

  const handleDropOnArchive = (e, kind) => {
    e.preventDefault();
    setDragOverKey(null);
    const task = getDraggedTask(e);
    if (!task || isArchived(task)) return;
    archiveTask(task, kind);
  };

  // ── Rendering helpers ──────────────────────────────────────────────────────
  const renderDeadline = (task, archived) => {
    const ds = dateOnly(task.dueLine);
    if (!ds) return null;
    const today = todayStr();
    let bg = '#f1f5f9';
    let fg = '#475569';
    let suffix = '';
    if (!archived && ds < today) { bg = '#fee2e2'; fg = '#b91c1c'; suffix = ' · întârziat'; }
    else if (!archived && ds === today) { bg = '#fef3c7'; fg = '#b45309'; suffix = ' · azi'; }
    return (
      <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '10px', backgroundColor: bg, color: fg, whiteSpace: 'nowrap' }}>
        📅 {formatDate(ds)}{suffix}
      </span>
    );
  };

  const renderCard = (task, archived) => {
    const bg = task.color || '#ffffff';
    const dark = isDarkColor(bg);
    const textColor = dark ? '#ffffff' : '#1e293b';
    const subColor = dark ? 'rgba(255,255,255,0.85)' : '#64748b';

    return (
      <div
        key={task.id}
        className="tk-card"
        draggable={!archived}
        onDragStart={(e) => handleDragStart(e, task.id)}
        onDragEnd={() => setDragOverKey(null)}
        style={{
          backgroundColor: bg, color: textColor, padding: '12px', borderRadius: '10px', textAlign: 'left',
          border: '1px solid rgba(0,0,0,0.12)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          cursor: archived ? 'default' : 'grab', flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
          <div style={{ fontWeight: '700', fontSize: '14px', lineHeight: '1.35', wordBreak: 'break-word', minWidth: 0, paddingTop: '3px' }}>
            {task.title}
          </div>
          <div style={{ display: 'flex', flexShrink: 0, color: textColor }}>
            <button className="tk-icon-btn" title="Schimbă culoarea" onClick={(e) => openColorPicker(e, task)}>🎨</button>
            <button className="tk-icon-btn" title="Editează" onClick={() => setTaskModal({ mode: 'edit', task })}>✏️</button>
          </div>
        </div>

        {task.description && (
          <div
            style={{
              fontSize: '12px', color: subColor, marginTop: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}
          >
            {task.description}
          </div>
        )}

        {(task.dueLine || task.projectId) && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginTop: '10px' }}>
            {renderDeadline(task, archived)}
            {task.projectId && (
              <span style={{ fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '10px', backgroundColor: '#f3e8ff', color: '#6b21a8' }}>
                📁 {task.project?.name || 'Proiect'}
              </span>
            )}
          </div>
        )}

        {task.creator && task.creator.id !== me && (
          <div style={{ fontSize: '11px', color: subColor, marginTop: '8px' }}>
            De la: <strong>{task.creator.username}</strong>
          </div>
        )}

        <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
          {archived ? (
            <button
              onClick={() => restoreTask(task)}
              style={{ flex: 1, padding: '7px 8px', backgroundColor: '#5a3d5c', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
            >
              ↩ Restaurează
            </button>
          ) : (
            <>
              <button
                onClick={() => archiveTask(task, 'DONE')}
                style={{ flex: 1, padding: '6px 8px', backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #86efac', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
              >
                ✅ Done
              </button>
              <button
                onClick={() => archiveTask(task, 'CANCEL')}
                style={{ flex: 1, padding: '6px 8px', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
              >
                ✖ Cancel
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const segBtn = (active) => ({
    padding: '8px 18px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '13px',
    backgroundColor: active ? '#5a3d5c' : 'transparent', color: active ? '#ffffff' : '#475569', whiteSpace: 'nowrap',
  });
  const primaryBtn = {
    padding: '9px 16px', backgroundColor: '#5a3d5c', color: '#ffffff', border: 'none', borderRadius: '8px',
    fontSize: '13px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap',
  };
  const ghostBtn = {
    padding: '9px 16px', backgroundColor: '#ffffff', color: '#5a3d5c', border: '1px solid #d8b4e2', borderRadius: '8px',
    fontSize: '13px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap',
  };

  if (!currentUser) return null;

  const archiveViewTasks = view === 'done' ? doneTasks : cancelTasks;
  const pickerTask = colorPicker ? tasks.find((t) => t.id === colorPicker.taskId) : null;

  return (
    <div
      className="tk-page"
      style={{ minHeight: 'calc(100vh - 60px)', backgroundColor: '#f8fafc', padding: '24px 24px 32px 24px', width: '100%' }}
    >
      <style>{PAGE_CSS}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{ padding: '7px 14px', backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
          >
            ⬅️ Dashboard
          </button>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#1e293b', fontWeight: '800', lineHeight: 1.2 }}>✅ Tasks</h1>
        </div>

        {(view === 'board' || view === 'given') && (
          <div style={{ display: 'flex', gap: '4px', padding: '4px', backgroundColor: '#e2e8f0', borderRadius: '10px' }}>
            <button style={segBtn(view === 'board')} onClick={() => setView('board')}>📋 Task-urile mele</button>
            <button style={segBtn(view === 'given')} onClick={() => setView('given')}>📤 Date de mine ({givenTasks.length})</button>
          </div>
        )}

        {view === 'board' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={ghostBtn} onClick={() => setBucketModal({ mode: 'create' })}>+ Coloană</button>
            <button style={primaryBtn} onClick={() => setTaskModal({ mode: 'create' })}>+ Task nou</button>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>Se încarcă task-urile...</div>
      ) : view === 'board' ? (
        <div className="tk-layout">
          {/* Buckets */}
          <div className="tk-board">
            {buckets.map((bucket, idx) => {
              const bucketTasks = activeTasks.filter((t) => bucketOf(t) === bucket.id).sort(sortByDeadline);
              const isOver = dragOverKey === `b-${bucket.id}`;
              const accent = BUCKET_ACCENTS[idx % BUCKET_ACCENTS.length];
              return (
                <div
                  key={bucket.id}
                  className={`tk-col${isOver ? ' tk-over' : ''}`}
                  style={{ borderTop: isOver ? undefined : `4px solid ${accent}` }}
                  onDragOver={(e) => handleDragOver(e, `b-${bucket.id}`)}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget)) setDragOverKey(null);
                  }}
                  onDrop={(e) => handleDropOnBucket(e, bucket)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <span style={{ fontWeight: '800', fontSize: '14px', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {bucket.name}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: '700', backgroundColor: '#e2e8f0', color: '#475569', borderRadius: '10px', padding: '1px 8px', flexShrink: 0 }}>
                        {bucketTasks.length}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexShrink: 0 }}>
                      <button className="tk-icon-btn" title="Redenumește coloana" onClick={() => setBucketModal({ mode: 'edit', bucket })}>✏️</button>
                      <button className="tk-icon-btn" title="Șterge coloana" onClick={() => handleDeleteBucket(bucket)}>🗑️</button>
                    </div>
                  </div>

                  <div className="tk-col-list">
                    {bucketTasks.length === 0 && (
                      <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12px', padding: '16px 0' }}>
                        Niciun task
                      </div>
                    )}
                    {bucketTasks.map((t) => renderCard(t, false))}
                  </div>

                  <button
                    onClick={() => setTaskModal({ mode: 'create', bucketId: bucket.id })}
                    style={{ flexShrink: 0, padding: '8px', backgroundColor: 'transparent', color: '#64748b', border: '1px dashed #cbd5e1', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    + Adaugă task
                  </button>
                </div>
              );
            })}
          </div>

          {/* Archive drop zones */}
          <div className="tk-archive">
            {[
              { kind: 'DONE', label: '✅ Done', list: doneTasks, color: '#166534', bg: '#f0fdf4', border: '#86efac', viewKey: 'done' },
              { kind: 'CANCEL', label: '❌ Cancel', list: cancelTasks, color: '#991b1b', bg: '#fef2f2', border: '#fca5a5', viewKey: 'cancel' },
            ].map((zone) => {
              const isOver = dragOverKey === `a-${zone.kind}`;
              return (
                <div
                  key={zone.kind}
                  className="tk-zone"
                  onDragOver={(e) => handleDragOver(e, `a-${zone.kind}`)}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget)) setDragOverKey(null);
                  }}
                  onDrop={(e) => handleDropOnArchive(e, zone.kind)}
                  onClick={() => setView(zone.viewKey)}
                  title="Click pentru a vedea arhiva"
                  style={{ backgroundColor: isOver ? zone.border : zone.bg, borderColor: zone.border, color: zone.color }}
                >
                  <div style={{ fontWeight: '800', fontSize: '15px' }}>{zone.label}</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', margin: '4px 0' }}>{zone.list.length}</div>
                  <div style={{ fontSize: '11px', opacity: 0.85, lineHeight: 1.4 }}>Trage aici pentru arhivare · click pentru a vedea</div>
                </div>
              );
            })}
          </div>
        </div>
      ) : view === 'given' ? (
        <div>
          {givenTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8', lineHeight: 1.6 }}>
              Nu ai dat încă task-uri altor persoane.<br />
              Folosește „+ Task nou” din tab-ul „Task-urile mele” și alege „Alocat către”.
            </div>
          ) : (
            <div className="tk-grid">
              {[...givenTasks].sort(sortByDeadline).map((t) => {
                const archived = isArchived(t);
                const state = t.status === 'TERMINAT' ? '✅ Done' : t.status === 'ANULAT' ? '❌ Cancel' : '🟣 Activ';
                return (
                  <div key={t.id} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', textAlign: 'left' }}>
                    <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '14px', wordBreak: 'break-word' }}>{t.title}</div>
                    {t.description && (
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{t.description}</div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '10px' }}>
                      {renderDeadline(t, archived)}
                      <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569' }}>{state}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>
                      Alocat către: <strong style={{ color: '#475569' }}>{t.assignee?.username}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
            <button style={ghostBtn} onClick={() => setView('board')}>← Înapoi la board</button>
            <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b', fontWeight: '700' }}>
              {view === 'done' ? '✅ Arhivă Done' : '❌ Arhivă Cancel'} ({archiveViewTasks.length})
            </h2>
          </div>
          {archiveViewTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>Nu există task-uri arhivate aici.</div>
          ) : (
            <div className="tk-grid">
              {archiveViewTasks.map((t) => renderCard(t, true))}
            </div>
          )}
        </div>
      )}

      {/* Color popover (fixed, page level) */}
      {colorPicker && pickerTask && (
        <>
          <div
            onClick={() => setColorPicker(null)}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10001 }}
          />
          <div
            style={{
              position: 'fixed', top: colorPicker.top, left: colorPicker.left, zIndex: 10002, width: POPOVER_WIDTH,
              backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #e2e8f0', borderRadius: '12px',
              padding: '14px', boxShadow: '0 12px 32px rgba(15,23,42,0.22)', textAlign: 'left',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: '700', marginBottom: '10px' }}>Culoare cartonaș</div>
            <ColorPalette value={pickerTask.color} onPick={(c) => applyColor(pickerTask, c)} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(pendingColor) ? pendingColor : '#ffffff'}
                onChange={(e) => setPendingColor(e.target.value)}
                style={{ width: '38px', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: 0, cursor: 'pointer', flexShrink: 0 }}
              />
              <button
                onClick={() => applyColor(pickerTask, pendingColor)}
                style={{ flex: 1, padding: '7px 8px', backgroundColor: '#5a3d5c', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
              >
                Aplică culoarea
              </button>
            </div>
            {pickerTask.color && (
              <button
                onClick={() => applyColor(pickerTask, null)}
                style={{ marginTop: '8px', width: '100%', padding: '6px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
              >
                Resetează culoarea
              </button>
            )}
          </div>
        </>
      )}

      {taskModal && (
        <TaskModal
          mode={taskModal.mode}
          initial={
            taskModal.mode === 'edit'
              ? {
                  title: taskModal.task.title,
                  description: taskModal.task.description,
                  deadline: dateOnly(taskModal.task.dueLine),
                  color: taskModal.task.color,
                  bucketId: bucketOf(taskModal.task),
                }
              : { bucketId: taskModal.bucketId }
          }
          buckets={buckets}
          users={users}
          currentUser={currentUser}
          onClose={() => setTaskModal(null)}
          onSubmit={handleTaskSubmit}
        />
      )}

      {bucketModal && (
        <BucketModal
          mode={bucketModal.mode}
          initialName={bucketModal.bucket?.name}
          onClose={() => setBucketModal(null)}
          onSubmit={handleBucketSubmit}
        />
      )}
    </div>
  );
}

export default TasksBoard;
