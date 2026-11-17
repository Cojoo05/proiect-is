import { useState, useEffect, useRef, useMemo } from 'react';
import { API_BASE_URL, WS_BASE_URL } from '../../config';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client/dist/sockjs.min.js';

export default function TasksTab({ projectId, currentUser, members = [], isOwner, permissions = {} }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filterMember, setFilterMember] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Form state
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assigneeId: '',
    deadline: '',
    color: '#ffffff'
  });
  const [submitting, setSubmitting] = useState(false);

  const stompClientRef = useRef(null);
  const API = `${API_BASE_URL}/api/tasks`;

  const fetchTasks = () => {
    fetch(`${API}/project/${projectId}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP error ${r.status}`);
        return r.json();
      })
      .then(data => {
        setTasks(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Eroare încărcare task-uri proiect:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTasks();
  }, [projectId]);

  // Polling fallback
  useEffect(() => {
    const timer = setInterval(fetchTasks, 10_000);
    return () => clearInterval(timer);
  }, [projectId]);

  // WebSocket for live sync
  useEffect(() => {
    let client = null;
    try {
      client = new Client({
        webSocketFactory: () => new SockJS(WS_BASE_URL),
        reconnectDelay: 5000,
        onConnect: () => {
          client.subscribe(`/topic/projects/${projectId}/tasks`, (msg) => {
            try {
              const updatedTask = JSON.parse(msg.body);
              setTasks(prev => {
                const idx = prev.findIndex(t => t.id === updatedTask.id);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = updatedTask;
                  return next;
                }
                return [updatedTask, ...prev];
              });
            } catch (err) {
              console.error(err);
            }
          });
        }
      });
      client.activate();
      stompClientRef.current = client;
    } catch (_) {}

    return () => {
      try { stompClientRef.current?.deactivate(); } catch (_) {}
    };
  }, [projectId]);

  // Handle task creation (giving task to a member)
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim() || !newTask.assigneeId) return;

    setSubmitting(true);
    try {
      const payload = {
        title: newTask.title.trim(),
        description: newTask.description.trim(),
        dueLine: newTask.deadline ? (newTask.deadline.includes('T') ? newTask.deadline : `${newTask.deadline}T23:59:00`) : null,
        color: newTask.color,
        creator: { id: currentUser.id },
        assignee: { id: parseInt(newTask.assigneeId) },
        projectId: parseInt(projectId)
      };

      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setShowModal(false);
        setNewTask({ title: '', description: '', assigneeId: '', deadline: '', color: '#ffffff' });
        fetchTasks();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Eroare la crearea task-ului!');
      }
    } catch (err) {
      console.error(err);
      alert('Eroare de rețea la crearea task-ului!');
    } finally {
      setSubmitting(false);
    }
  };

  // Change task status directly
  const handleStatusChange = async (taskId, newStatus) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    try {
      await fetch(`${API}/${taskId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
    } catch (_) {
      fetchTasks();
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId, taskTitle) => {
    if (!window.confirm(`Ești sigur că vrei să ștergi task-ul "${taskTitle}"?`)) return;
    try {
      const res = await fetch(`${API}/${taskId}?userId=${currentUser.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setTasks(prev => prev.filter(t => t.id !== taskId));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Nu ai permisiunea de a șterge acest task.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (val) => {
    if (!val) return '—';
    try {
      const d = new Date(val);
      return d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (_) {
      return val;
    }
  };

  const isOverdue = (deadline, status) => {
    const s = (status || '').toUpperCase();
    if (!deadline || s === 'TERMINAT' || s === 'DONE' || s === 'ANULAT' || s === 'CANCEL') return false;
    try {
      const d = new Date(deadline);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      return d < now;
    } catch (_) {
      return false;
    }
  };

  // 3-bucket statistics
  // "Daca task-urile nu sunt in cancel sau done atunci sunt in lucru, daca sunt in done se aduna in 'Terminate', daca sunt cancel in 'Anulate"
  const stats = useMemo(() => {
    let inLucru = 0;
    let terminate = 0;
    let anulate = 0;

    tasks.forEach(t => {
      const s = (t.status || '').toUpperCase();
      if (s === 'TERMINAT' || s === 'DONE') {
        terminate++;
      } else if (s === 'ANULAT' || s === 'CANCEL') {
        anulate++;
      } else {
        inLucru++;
      }
    });

    return { inLucru, terminate, anulate };
  }, [tasks]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filterMember !== 'ALL' && String(t.assignee?.id) !== String(filterMember)) return false;
      if (filterStatus !== 'ALL') {
        const s = (t.status || '').toUpperCase();
        if (filterStatus === 'TERMINAT') {
          if (s !== 'TERMINAT' && s !== 'DONE') return false;
        } else if (filterStatus === 'ANULAT') {
          if (s !== 'ANULAT' && s !== 'CANCEL') return false;
        } else if (filterStatus === 'IN_LUCRU') {
          if (s === 'TERMINAT' || s === 'DONE' || s === 'ANULAT' || s === 'CANCEL') return false;
        }
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = t.title?.toLowerCase().includes(q);
        const matchesDesc = t.description?.toLowerCase().includes(q);
        const matchesUser = t.assignee?.username?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesUser) return false;
      }
      return true;
    });
  }, [tasks, filterMember, filterStatus, search]);

  return (
    <div style={{ textAlign: 'left', fontFamily: 'sans-serif' }}>
      {/* ── Top Action Bar ─────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            backgroundColor: '#5a3d5c',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(90, 61, 92, 0.25)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#472f49')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#5a3d5c')}
        >
          <span>➕</span>
          <span>Asignează Task Nou</span>
        </button>
      </div>

      {/* ── Stats Cards (In lucru X, Terminate X, Anulate X) ───────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '10px', padding: '14px 18px' }}>
          <div style={{ fontSize: '12px', color: '#b45309', fontWeight: '700' }}>🟡 În lucru</div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#b45309', marginTop: '4px' }}>{stats.inLucru}</div>
        </div>
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '14px 18px' }}>
          <div style={{ fontSize: '12px', color: '#15803d', fontWeight: '700' }}>🟢 Terminate</div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#15803d', marginTop: '4px' }}>{stats.terminate}</div>
        </div>
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #fecaca', borderRadius: '10px', padding: '14px 18px' }}>
          <div style={{ fontSize: '12px', color: '#b91c1c', fontWeight: '700' }}>🔴 Anulate</div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#b91c1c', marginTop: '4px' }}>{stats.anulate}</div>
        </div>
      </div>

      {/* ── Filters Bar ────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: '16px',
          backgroundColor: '#ffffff',
          padding: '12px 16px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
          <input
            type="text"
            placeholder="🔍 Caută task sau membru..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Membru:</span>
          <select
            value={filterMember}
            onChange={e => setFilterMember(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              backgroundColor: '#ffffff',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">Toți membrii</option>
            {members.map(m => (
              <option key={m.user?.id} value={m.user?.id}>
                {m.user?.username || m.user?.email}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Stare:</span>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              backgroundColor: '#ffffff',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">Toate statusurile</option>
            <option value="IN_LUCRU">În lucru</option>
            <option value="TERMINAT">Terminate</option>
            <option value="ANULAT">Anulate</option>
          </select>
        </div>
      </div>

      {/* ── Table of Tasks ─────────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px', color: '#64748b' }}>Se încarcă task-urile proiectului...</div>
      ) : filteredTasks.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '50px 20px',
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '2px dashed #cbd5e1',
            color: '#64748b',
          }}
        >
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>📝</div>
          <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>Niciun task găsit</div>
          <p style={{ margin: '6px 0 0', fontSize: '13px' }}>
            {tasks.length === 0
              ? 'Nu a fost delegat niciun task membrilor din acest proiect încă.'
              : 'Nu există task-uri care să corespundă filtrelor selectate.'}
          </p>
        </div>
      ) : (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ padding: '14px 18px' }}>Task</th>
                <th style={{ padding: '14px 18px' }}>Asignat către</th>
                <th style={{ padding: '14px 18px' }}>Termen limită</th>
                <th style={{ padding: '14px 18px' }}>Status</th>
                <th style={{ padding: '14px 18px', textAlign: 'right' }}>Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((t, idx) => {
                const overdue = isOverdue(t.dueLine, t.status);
                const s = (t.status || '').toUpperCase();
                const isDone = s === 'TERMINAT' || s === 'DONE';
                const isCancel = s === 'ANULAT' || s === 'CANCEL';

                const currentSelectValue = isDone ? 'TERMINAT' : isCancel ? 'ANULAT' : 'IN_LUCRU';
                const badgeBg = isDone ? '#dcfce7' : isCancel ? '#fee2e2' : '#fef3c7';
                const badgeColor = isDone ? '#15803d' : isCancel ? '#b91c1c' : '#b45309';
                const badgeBorder = isDone ? '#bbf7d0' : isCancel ? '#fecaca' : '#fde68a';

                return (
                  <tr
                    key={t.id}
                    style={{
                      borderBottom: idx === filteredTasks.length - 1 ? 'none' : '1px solid #f1f5f9',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {/* Task Title & Desc */}
                    <td style={{ padding: '14px 18px', verticalAlign: 'top', maxWidth: '320px' }}>
                      <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '14px', wordBreak: 'break-word' }}>
                        {t.title}
                      </div>
                      {t.description && (
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>
                          {t.description}
                        </div>
                      )}
                      <div style={{ marginTop: '6px', fontSize: '11px', color: '#94a3b8' }}>
                        ✍️ Creat de: <strong>{t.creator?.username || 'Admin'}</strong>
                      </div>
                    </td>

                    {/* Assignee */}
                    <td style={{ padding: '14px 18px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: '#5a3d5c',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '13px',
                            fontWeight: '700',
                          }}
                        >
                          {t.assignee?.username?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div style={{ fontWeight: '700', color: '#1e293b' }}>
                            {t.assignee?.username || 'Neasignat'}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {t.assignee?.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Deadline */}
                    <td style={{ padding: '14px 18px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      {t.dueLine ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: overdue ? '#fee2e2' : '#f1f5f9',
                            color: overdue ? '#dc2626' : '#475569',
                            border: `1px solid ${overdue ? '#fca5a5' : '#cbd5e1'}`,
                          }}
                        >
                          {overdue ? '⚠️ ' : '📅 '}
                          {formatDate(t.dueLine)}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>Fără deadline</span>
                      )}
                    </td>

                    {/* Status Dropdown */}
                    <td style={{ padding: '14px 18px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <select
                        value={currentSelectValue}
                        onChange={e => handleStatusChange(t.id, e.target.value)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '700',
                          backgroundColor: badgeBg,
                          color: badgeColor,
                          border: `1px solid ${badgeBorder}`,
                          cursor: 'pointer',
                        }}
                      >
                        <option value="IN_LUCRU">🟡 În lucru</option>
                        <option value="TERMINAT">🟢 Terminat</option>
                        <option value="ANULAT">🔴 Anulat</option>
                      </select>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 18px', verticalAlign: 'middle', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => handleDeleteTask(t.id, t.title)}
                        style={{
                          padding: '6px 10px',
                          backgroundColor: '#fee2e2',
                          color: '#dc2626',
                          border: '1px solid #fecaca',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '600',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#fecaca')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#fee2e2')}
                        title="Șterge task-ul"
                      >
                        🗑️ Șterge
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal: Asignează Task Nou ─────────────────────────────────── */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '480px',
              padding: '26px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b', fontWeight: '800' }}>
                ➕ Asignează Task Membru
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: '18px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate}>
              {/* Membru Asignat */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  👤 Membru din proiect *
                </label>
                <select
                  required
                  value={newTask.assigneeId}
                  onChange={e => setNewTask({ ...newTask, assigneeId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <option value="">Selectează un membru...</option>
                  {members.map(m => {
                    const roleName = m.projectRole?.name || m.role || 'MEMBER';
                    return (
                      <option key={m.user?.id} value={m.user?.id}>
                        {m.user?.username || m.user?.email} ({roleName})
                      </option>
                    );
                  })}
                </select>
                <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                  Membrul va primi notificare și va vedea task-ul direct în contul său la „Tasks”.
                </span>
              </div>

              {/* Titlu */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Titlu Task *
                </label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  placeholder="ex: Implementare formular înregistrare"
                  value={newTask.title}
                  onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Descriere */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Descriere (opțional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Specificații, instrucțiuni sau linkuri relevante..."
                  value={newTask.description}
                  onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Termen limită */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  📅 Termen limită (Deadline)
                </label>
                <input
                  type="date"
                  value={newTask.deadline}
                  onChange={e => setNewTask({ ...newTask, deadline: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                  style={{
                    padding: '9px 16px',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '9px 20px',
                    backgroundColor: '#5a3d5c',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 4px rgba(90, 61, 92, 0.25)',
                  }}
                >
                  {submitting ? 'Se asignează...' : 'Asignează Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
