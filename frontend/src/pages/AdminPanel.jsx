import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function AdminPanel() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({ username: '', email: '', password: '', role: 'USER' });
  const [editingId, setEditingId] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'asc' });
  const [expandedPasswords, setExpandedPasswords] = useState({});
  
  const API_URL = 'http://localhost:8080/api/users';

  const fetchUsers = () => {
    fetch(API_URL).then(res => res.json()).then(data => setUsers(Array.isArray(data) ? data : [])).catch(err => console.error(err));
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleSave = (e) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.email.trim()) return alert("Fields cannot be empty!");
    const method = editingId ? 'PUT' : 'POST';
    const url = editingId ? `${API_URL}/${editingId}` : API_URL;

    fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
    .then(async (res) => {
      if (!res.ok) throw new Error("Database rejected the save!");
      fetchUsers();
      setFormData({ username: '', email: '', password: '', role: 'USER' });
      setEditingId(null);
    }).catch(err => alert(err.message));
  };

  const handleDelete = (id) => {
    if(window.confirm("Are you sure?")) { fetch(`${API_URL}/${id}`, { method: 'DELETE' }).then(() => fetchUsers()); }
  };

  const handleEdit = (user) => {
    setFormData({ username: user.username, email: user.email, password: '', role: user.role });
    setEditingId(user.id);
  };

  const handleSort = (key) => {
    setSortConfig({ key, direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc' });
  };

  const sortedUsers = [...users].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
    if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => navigate('/dashboard')} style={{ padding: '8px 15px', cursor: 'pointer', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '5px' }}>⬅️ Back to Dashboard</button>
      </div>
      <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>Admin Panel</h1>

      <div style={{ border: '1px solid #ddd', padding: '20px', marginBottom: '30px', borderRadius: '8px' }}>
        <form onSubmit={handleSave} style={{ display: 'flex', gap: '10px' }}>
          <input type="text" placeholder="Username" value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} style={{ padding: '10px', flex: '1' }} />
          <input type="email" placeholder="Email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} style={{ padding: '10px', flex: '1' }} />
          <input type="password" placeholder="Password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} style={{ padding: '10px', flex: '1' }} />
          <select value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} style={{ padding: '10px' }}>
            <option value="USER">User</option>
            <option value="ADMIN">Admin</option>
          </select>
          <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none' }}>{editingId ? "Save" : "Add"}</button>
          {editingId && <button type="button" onClick={() => {setEditingId(null); setFormData({ username: '', email: '', password: '', role: 'USER' })}}>Cancel</button>}
        </form>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ backgroundColor: '#f4f6f8' }}>
            <th onClick={() => handleSort('id')} style={{ padding: '12px', cursor: 'pointer' }}>ID</th>
            <th onClick={() => handleSort('username')} style={{ padding: '12px', cursor: 'pointer' }}>Username</th>
            <th onClick={() => handleSort('email')} style={{ padding: '12px', cursor: 'pointer' }}>Email</th>
            <th style={{ padding: '12px' }}>Password</th>
            <th onClick={() => handleSort('role')} style={{ padding: '12px', cursor: 'pointer' }}>Role</th>
            <th style={{ padding: '12px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedUsers.map(user => (
            <tr key={user.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '12px' }}>{user.id}</td>
              <td style={{ padding: '12px' }}>{user.username}</td>
              <td style={{ padding: '12px' }}>{user.email}</td>
              <td style={{ padding: '12px', maxWidth: '200px' }}>
                <span style={{ display: 'inline-block', width: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: expandedPasswords[user.id] ? 'normal' : 'nowrap' }}>
                  {user.password}
                </span>
                {user.password?.length > 25 && (
                  <button onClick={() => setExpandedPasswords(p => ({...p, [user.id]: !p[user.id]}))} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                    {expandedPasswords[user.id] ? '▲' : '▼'}
                  </button>
                )}
              </td>
              <td style={{ padding: '12px' }}>{user.role}</td>
              <td style={{ padding: '12px' }}>
                <button onClick={() => handleEdit(user)} style={{ marginRight: '5px' }}>Edit</button>
                <button onClick={() => handleDelete(user.id)} style={{ backgroundColor: '#dc3545', color: 'white' }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AdminPanel;