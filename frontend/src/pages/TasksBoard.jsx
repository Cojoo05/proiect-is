import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import {
  TASK_STATUSES,
  formatDate,
  taskStatusLabel
} from '../utils/format.js';
import { colors } from '../theme.js';
import { API_BASE_URL } from '../config';

const API_URL = `${API_BASE_URL}/api/tasks`;
const USERS_API_URL = `${API_BASE_URL}/api/users`;

const EMPTY_TASK = { title: '', description: '', assigneeId: '', dueDate: '' };

function TasksBoard({ currentUser }) {
  const toast = useToast();

  const [viewMode, setViewMode] = useState('myTasks');
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newTask, setNewTask] = useState(EMPTY_TASK);
  const [creating, setCreating] = useState(false);

  const loadTasks = useCallback(() => {
    if (!currentUser?.id) return;

    const endpoint =
      viewMode === 'myTasks'
        ? `${API_URL}/my-tasks/${currentUser.id}`
        : `${API_URL}/given-tasks/${currentUser.id}`;

    setLoading(true);
    setError('');

    fetch(endpoint)
      .then((res) => {
        if (!res.ok) throw new Error('Taskurile nu au putut fi încărcate.');
        return res.json();
      })
      .then((data) => setTasks(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [currentUser, viewMode]);

  useEffect(() => {
    fetch(USERS_API_URL)
      .then((res) => res.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadTasks, 0);
    return () => window.clearTimeout(timer);
  }, [loadTasks]);

  const handleDragStart = (event, taskId) => {
    event.dataTransfer.setData('text/plain', String(taskId));
  };

  const handleDragOver = (event) => event.preventDefault();

  const changeStatus = (taskId, status) => {
    const current = tasks.find((task) => task.id === taskId);
    const previousStatus = current?.status;
    if (previousStatus === status) return;

    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, status } : task)));

    fetch(`${API_URL}/${taskId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
      .then((res) => {
        if (!res.ok) throw new Error('Statusul nu a putut fi actualizat.');
        toast.success(`Task mutat în „${taskStatusLabel(status)}".`);
      })
      .catch((err) => {
        setTasks((prev) =>
          prev.map((task) => (task.id === taskId ? { ...task, status: previousStatus } : task))
        );
        toast.error(err.message);
      });
  };

  const handleDrop = (event, status) => {
    event.preventDefault();
    const taskId = Number(event.dataTransfer.getData('text/plain'));
    if (taskId) changeStatus(taskId, status);
  };

  const handleCreateTask = (event) => {
    event.preventDefault();

    if (!currentUser?.id) {
      toast.error('Trebuie să fii autentificat pentru a crea taskuri.');
      return;
    }
    if (!newTask.title.trim() || !newTask.assigneeId) {
      toast.error('Completează titlul și alege un responsabil.');
      return;
    }

    setCreating(true);

    const payload = {
      title: newTask.title.trim(),
      description: newTask.description.trim(),
      creator: { id: currentUser.id },
      assignee: { id: Number(newTask.assigneeId) },
      dueLine: newTask.dueDate ? `${newTask.dueDate}T23:59:00` : null
    };

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then((res) => {
        if (!res.ok) throw new Error('Taskul nu a putut fi creat.');
        return res.json();
      })
      .then(() => {
        setNewTask(EMPTY_TASK);
        toast.success('Task creat cu succes.');
        loadTasks();
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setCreating(false));
  };

  const isOverdue = (task) =>
    task.dueLine && task.status !== 'TERMINAT' && task.status !== 'ANULAT'
      ? // ora curentă e citită intenționat la fiecare randare
        // eslint-disable-next-line react-hooks/purity
        new Date(task.dueLine).getTime() < Date.now()
      : false;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">✅ Tasks</h1>
          <p className="page-subtitle">Taskurile primite și cele date colegilor, organizate pe status.</p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className={`btn ${viewMode === 'myTasks' ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setViewMode('myTasks')}
          >
            Primite
          </button>
          <button
            type="button"
            className={`btn ${viewMode === 'giveTasks' ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setViewMode('giveTasks')}
          >
            Date de mine
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert--error" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn--secondary btn--sm" onClick={loadTasks}>
            Reîncearcă
          </button>
        </div>
      )}

      {viewMode === 'giveTasks' && (
        <form onSubmit={handleCreateTask} className="card" style={{ marginBottom: '24px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '1.05rem', color: '#1e293b' }}>Atribuie un task nou</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label" htmlFor="task-title">Titlu</label>
              <input
                id="task-title"
                className="input"
                type="text"
                placeholder="ex: Actualizează pagina de start"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              />
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label" htmlFor="task-assignee">Responsabil</label>
              <select
                id="task-assignee"
                className="select"
                value={newTask.assigneeId}
                onChange={(e) => setNewTask({ ...newTask, assigneeId: e.target.value })}
              >
                <option value="">Selectează un utilizator</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username || user.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label" htmlFor="task-due">Termen limită (opțional)</label>
              <input
                id="task-due"
                className="input"
                type="date"
                value={newTask.dueDate}
                onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
              />
            </div>
          </div>

          <div className="field" style={{ marginTop: '16px', marginBottom: '16px' }}>
            <label className="label" htmlFor="task-description">Descriere</label>
            <textarea
              id="task-description"
              className="textarea"
              rows={2}
              placeholder="Ce trebuie făcut?"
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
            />
          </div>

          <button type="submit" className="btn btn--primary" disabled={creating}>
            {creating ? 'Se creează...' : '+ Creează task'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="empty-state">Se încarcă taskurile...</div>
      ) : (
        <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '12px' }}>
          {TASK_STATUSES.map((status) => {
            const columnTasks = tasks.filter((task) => task.status === status);

            return (
              <section
                key={status}
                onDragOver={handleDragOver}
                onDrop={(event) => handleDrop(event, status)}
                aria-label={`Coloana ${taskStatusLabel(status)}`}
                style={{
                  flex: '1 0 240px',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '14px',
                  backgroundColor: '#f1f5f9',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '12px'
                }}
              >
                <h2
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    margin: '0 0 12px',
                    paddingBottom: '10px',
                    borderBottom: `1px solid ${colors.borderStrong}`,
                    fontSize: '0.85rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: '#475569'
                  }}
                >
                  <span>{taskStatusLabel(status)}</span>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>{columnTasks.length}</span>
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                  {columnTasks.length === 0 && (
                    <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>
                      Niciun task aici.
                    </p>
                  )}

                  {columnTasks.map((task) => (
                    <article
                      key={task.id}
                      draggable
                      onDragStart={(event) => handleDragStart(event, task.id)}
                      style={{
                        padding: '14px',
                        backgroundColor: '#ffffff',
                        border: `1px solid ${colors.border}`,
                        borderLeft: `4px solid ${isOverdue(task) ? '#dc2626' : colors.accent}`,
                        borderRadius: '8px',
                        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
                        cursor: 'grab'
                      }}
                    >
                      <h3 style={{ margin: '0 0 6px', fontSize: '0.95rem', color: '#1e293b' }}>{task.title}</h3>

                      {task.description && (
                        <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#475569' }}>
                          {task.description}
                        </p>
                      )}

                      {task.dueLine && (
                        <p
                          style={{
                            margin: '0 0 10px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: isOverdue(task) ? '#b91c1c' : '#64748b'
                          }}
                        >
                          {isOverdue(task) ? '⚠️ Depășit: ' : '🗓️ Scadent: '}
                          {formatDate(task.dueLine)}
                        </p>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                          {viewMode === 'myTasks'
                            ? `De la: ${task.creator?.username || '—'}`
                            : `Către: ${task.assignee?.username || '—'}`}
                        </span>

                        <select
                          className="select"
                          aria-label={`Schimbă statusul taskului ${task.title}`}
                          value={task.status}
                          onChange={(e) => changeStatus(task.id, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }}
                        >
                          {TASK_STATUSES.map((option) => (
                            <option key={option} value={option}>
                              {taskStatusLabel(option)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <p className="field-hint" style={{ marginTop: '12px' }}>
        Poți muta un task între coloane prin drag & drop sau din meniul de status de pe card.
      </p>
    </div>
  );
}

export default TasksBoard;
