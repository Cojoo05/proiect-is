import { useState, useEffect, useRef } from 'react';
import { API_BASE_URL, WS_BASE_URL } from '../../config';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client/dist/sockjs.min.js';

const COLUMNS = ['PRIMIT', 'IN_LUCRU', 'TERMINAT', 'ANULAT'];
const COL_COLORS = { PRIMIT: '#3b82f6', IN_LUCRU: '#f59e0b', TERMINAT: '#10b981', ANULAT: '#ef4444' };

function TasksTab({ projectId, currentUser, members, permissions = {} }) {
  const [tasks, setTasks] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', assigneeId: '' });
  const stompClientRef = useRef(null);

  const canCreate = permissions.canCreateTasks !== false;
  const canManage = permissions.canManageTasks !== false;

  const API = `${API_BASE_URL}/api/tasks`;

  const fetchTasks = () => {
    fetch(`${API}/project/${projectId}`)
      .then(r => r.json())
      .then(data => setTasks(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  useEffect(() => {
    fetchTasks();
  }, [projectId]);

  // Polling fallback
  useEffect(() => {
    const timer = setInterval(fetchTasks, 10_000);
    return () => clearInterval(timer);
  }, [projectId]);

  // WebSocket for real-time task sync across all members
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

  const handleDragStart = (e, taskId) => e.dataTransfer.setData('taskId', taskId);
  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = (e, newStatus) => {
    const taskId = e.dataTransfer.getData('taskId');
    setTasks(prev => prev.map(t => t.id === parseInt(taskId) ? { ...t, status: newStatus } : t));
    fetch(`${API}/${taskId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    }).catch(() => fetchTasks());
  };

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newTask.title || !newTask.assigneeId) return;
    fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTask.title,
        description: newTask.description,
        creator: { id: currentUser.id },
        assignee: { id: parseInt(newTask.assigneeId) },
        projectId
      })
    }).then(r => {
      if (r.ok) {
        setShowModal(false);
        setNewTask({ title: '', description: '', assigneeId: '' });
        fetchTasks();
      }
    }).catch(console.error);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        {canCreate ? (
          <button
            onClick={() => setShowModal(true)}
            style={{ padding: '9px 18px', backgroundColor: '#5a3d5c', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            + Task Nou
          </button>
        ) : (
          <span style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic', alignSelf: 'center' }}>
            ℹ️ Nu ai permisiunea de a crea task-uri pe acest proiect
          </span>
        )}
      </div>

      {/* Kanban */}
      <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '12px' }}>
        {COLUMNS.map(col => (
          <div
            key={col}
            onDragOver={handleDragOver}
            onDrop={e => handleDrop(e, col)}
            style={{ flex: 1, minWidth: '220px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}
          >
            <div style={{ padding: '12px 14px', borderBottom: '3px solid ' + COL_COLORS[col], display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '700', fontSize: '13px', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {col.replace('_', ' ')}
              </span>
              <span style={{ backgroundColor: COL_COLORS[col] + '20', color: COL_COLORS[col], borderRadius: '10px', padding: '2px 8px', fontSize: '12px', fontWeight: '700' }}>
                {tasks.filter(t => t.status === col).length}
              </span>
            </div>
            <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '200px' }}>
              {tasks.filter(t => t.status === col).map(task => (
                <div
                  key={task.id}
                  draggable={canManage}
                  onDragStart={e => canManage && handleDragStart(e, task.id)}
                  style={{ backgroundColor: 'white', padding: '12px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', cursor: canManage ? 'grab' : 'default', borderLeft: '3px solid ' + COL_COLORS[col] }}
                >
                  <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '14px', marginBottom: '4px' }}>{task.title}</div>
                  {task.description && <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>{task.description}</div>}
                  <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                    <span>👤 {task.assignee?.username || 'N/A'}</span>
                    <span>✍️ {task.creator?.username || 'N/A'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Create Task Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '28px', borderRadius: '12px', width: '100%', maxWidth: '440px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#1e293b' }}>Task Nou</h3>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px', color: '#334155' }}>Titlu *</label>
                <input
                  required
                  value={newTask.title}
                  onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                  style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '14px' }}
                />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px', color: '#334155' }}>Descriere</label>
                <textarea
                  value={newTask.description}
                  onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                  rows={3}
                  style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '14px', resize: 'vertical' }}
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px', color: '#334155' }}>Asignează la *</label>
                <select
                  required
                  value={newTask.assigneeId}
                  onChange={e => setNewTask({ ...newTask, assigneeId: e.target.value })}
                  style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '14px' }}
                >
                  <option value="">Selectează membru...</option>
                  {members.map(m => (
                    <option key={m.user?.id} value={m.user?.id}>{m.user?.username || m.user?.email} ({m.role})</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '9px 16px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#475569' }}>Anulează</button>
                <button type="submit" style={{ padding: '9px 18px', backgroundColor: '#5a3d5c', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Creează</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TasksTab;
