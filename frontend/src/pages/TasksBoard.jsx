import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function TasksBoard({ currentUser }) {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('myTasks'); 
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [newTask, setNewTask] = useState({ title: '', description: '', assigneeUsername: '' });

  const API_URL = 'http://localhost:8080/api/tasks';
  const USERS_API_URL = 'http://localhost:8080/api/users';
  const columns = ['PRIMIT', 'IN_LUCRU', 'TERMINAT', 'ANULAT'];

  const fetchTasks = () => {
    if (!currentUser) return;
    const endpoint = viewMode === 'myTasks' ? `${API_URL}/my-tasks/${currentUser.id}` : `${API_URL}/given-tasks/${currentUser.id}`;
    fetch(endpoint).then(res => res.json()).then(data => setTasks(Array.isArray(data) ? data : [])).catch(err => console.error(err));
  };

  const fetchUsers = () => {
    fetch(USERS_API_URL).then(res => res.json()).then(data => setUsers(Array.isArray(data) ? data : [])).catch(err => console.error(err));
  };

  useEffect(() => { fetchUsers(); }, []);
  useEffect(() => { if (currentUser) fetchTasks(); }, [viewMode, currentUser]);

  const handleDragStart = (e, taskId) => { e.dataTransfer.setData('taskId', taskId); };
  const handleDragOver = (e) => { e.preventDefault(); };

  const handleDrop = (e, newStatus) => {
    const taskId = e.dataTransfer.getData('taskId');
    setTasks(prev => prev.map(t => t.id === parseInt(taskId) ? { ...t, status: newStatus } : t));
    fetch(`${API_URL}/${taskId}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) })
      .catch(err => { console.error(err); fetchTasks(); });
  };

  const handleCreateTask = (e) => {
    e.preventDefault();
    if (!currentUser) return window.location.reload();
    if (!newTask.title || !newTask.assigneeUsername) return alert("Completează titlul și alege un utilizator!");

    const targetUser = users.find(u => u.username.toLowerCase().trim() === newTask.assigneeUsername.toLowerCase().trim());
    if (!targetUser) return alert(`Utilizatorul "${newTask.assigneeUsername}" nu există în baza de date!`);

    const taskPayload = { title: newTask.title, description: newTask.description, creator: { id: currentUser.id }, assignee: { id: targetUser.id } };

    fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(taskPayload) })
    .then(res => {
      if (res.ok) { setNewTask({ title: '', description: '', assigneeUsername: '' }); fetchTasks(); } 
      else { alert("Eroare la crearea task-ului."); }
    }).catch(err => console.error(err));
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <button onClick={() => navigate('/dashboard')} style={{ padding: '8px 15px', marginBottom: '20px', cursor: 'pointer', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '5px' }}>
        ⬅️ Back to Dashboard
      </button>

      <h1 style={{ textAlign: 'center', color: '#333' }}>Task Management</h1>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '30px' }}>
        <button onClick={() => setViewMode('myTasks')} style={{ padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: viewMode === 'myTasks' ? '#007bff' : '#e9ecef', color: viewMode === 'myTasks' ? 'white' : '#333' }}>My Tasks</button>
        <button onClick={() => setViewMode('giveTasks')} style={{ padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: viewMode === 'giveTasks' ? '#28a745' : '#e9ecef', color: viewMode === 'giveTasks' ? 'white' : '#333' }}>Give Tasks</button>
      </div>

      {viewMode === 'giveTasks' && (
        <div style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #ddd' }}>
          <h3>Assign a new task</h3>
          <form onSubmit={handleCreateTask} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input type="text" placeholder="Task Title" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} style={{ padding: '10px', flex: '1', minWidth: '200px' }} />
            <input type="text" placeholder="Description" value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} style={{ padding: '10px', flex: '2', minWidth: '200px' }} />
            <input type="text" list="users-list" placeholder="Assignee Username" value={newTask.assigneeUsername} onChange={e => setNewTask({...newTask, assigneeUsername: e.target.value})} style={{ padding: '10px', flex: '1', minWidth: '150px' }} />
            <datalist id="users-list">{users.map(u => (<option key={u.id} value={u.username} />))}</datalist>
            <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>Create Task</button>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '20px' }}>
        {columns.map(status => (
          <div key={status} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, status)} style={{ flex: 1, minWidth: '250px', backgroundColor: '#f4f6f8', borderRadius: '8px', padding: '15px', border: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ textAlign: 'center', marginBottom: '15px', color: '#555', borderBottom: '2px solid #ddd', paddingBottom: '10px' }}>{status.replace('_', ' ')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
              {tasks.filter(t => t.status === status).map(task => (
                <div key={task.id} draggable onDragStart={(e) => handleDragStart(e, task.id)} style={{ backgroundColor: 'white', padding: '15px', borderRadius: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', cursor: 'grab', borderLeft: '4px solid #007bff' }}>
                  <h4 style={{ margin: '0 0 8px 0', color: '#333' }}>{task.title}</h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>{task.description}</p>
                  <div style={{ marginTop: '10px', fontSize: '11px', color: '#999', textAlign: 'right' }}>
                    {viewMode === 'myTasks' ? `From: ${task.creator?.username}` : `To: ${task.assignee?.username}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TasksBoard;