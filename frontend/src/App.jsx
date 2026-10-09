import { useEffect, useState } from 'react';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('dashboard'); 
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({ username: '', email: '', password: '', role: 'USER' });
  const [editingId, setEditingId] = useState(null);
  
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'asc' });
  
  const isAdmin = true; 
  const API_URL = 'http://localhost:8080/api/users';

  const fetchUsers = () => {
    fetch(API_URL)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setUsers(data);
        } else {
          setUsers([]);
        }
      })
      .catch(err => console.error("Error fetching data:", err));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSave = (e) => {
    e.preventDefault();

    const cleanUsername = formData.username.trim();
    const cleanEmail = formData.email.trim();

    if (cleanUsername === '') {
      alert("Username cannot be empty!");
      return;
    }

    if (cleanEmail === '') {
      alert("Email cannot be empty!");
      return;
    }

    const emailRegex = /^[^\s@]+@(gmail\.com|yahoo\.com|hotmail\.com|outlook\.com|icloud\.com)$/i;
    if (!emailRegex.test(cleanEmail)) {
      alert("Please enter a valid email address!\nAccepted providers: @gmail.com, @yahoo.com, @hotmail.com, @outlook.com, @icloud.com");
      return;
    }

    if (formData.password.length < 3) {
      alert("Password must be at least 3 characters long!");
      return;
    }

    const method = editingId ? 'PUT' : 'POST';
    const url = editingId ? `${API_URL}/${editingId}` : API_URL;

    const dataToSend = {
      username: cleanUsername,
      email: cleanEmail,
      password: formData.password,
      role: formData.role
    };

    fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataToSend)
    })
    .then(async (res) => {
      // NOU: Dacă Java dă o eroare (ex: 400 sau 500), o prindem aici!
      if (!res.ok) {
        throw new Error("Baza de date a respins salvarea! (Probabil email duplicat sau rol invalid). Verifică consola IntelliJ.");
      }
      
      // Dacă totul e ok, actualizăm tabelul
      fetchUsers();
      setFormData({ username: '', email: '', password: '', role: 'USER' });
      setEditingId(null);
    })
    .catch(err => {
      console.error("Error saving data:", err);
      alert(err.message);
    });
  };

  const handleDelete = (id) => {
    if(window.confirm("Are you sure you want to delete this user?")) {
      fetch(`${API_URL}/${id}`, { method: 'DELETE' })
        .then(() => fetchUsers())
        .catch(err => console.error("Error deleting user:", err));
    }
  };

  const handleEdit = (user) => {
    setFormData({ username: user.username || '', email: user.email, password: user.password, role: user.role });
    setEditingId(user.id);
  };

  // --- ALG DE SORTARE ---
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedUsers = [...users].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  // Sagetiile
  const getSortIndicator = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
    }
    return '';
  };

  // ==========================================
  // VIEW 1: DASHBOARD
  // ==========================================
  if (currentView === 'dashboard') {
    return (
      <div style={{ padding: '40px', fontFamily: 'sans-serif', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '10px' }}>Project IS Dashboard</h1>
        <p style={{ color: '#666', marginBottom: '40px' }}>Select an application from the menu:</p>
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', flexWrap: 'wrap' }}>
          <div 
            onClick={() => setCurrentView('admin')}
            style={{ 
              backgroundColor: '#f8f9fa', border: '2px solid #007bff', borderRadius: '15px', 
              padding: '30px', width: '200px', cursor: 'pointer', transition: '0.2s',
              boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
            }}
          >
            <div style={{ fontSize: '40px', marginBottom: '15px' }}>⚙️</div>
            <h3 style={{ margin: 0, color: '#007bff' }}>Admin Panel</h3>
            <p style={{ fontSize: '12px', color: '#555', marginTop: '10px' }}>Manage users</p>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: ADMIN PANEL
  // ==========================================
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <button 
        onClick={() => setCurrentView('dashboard')}
        style={{ marginBottom: '20px', padding: '8px 15px', cursor: 'pointer', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '5px' }}
      >
        ⬅️ Back to Dashboard
      </button>

      <h1>Admin Panel - Manage Users</h1>

      {isAdmin && (
        <div style={{ border: '1px solid #ccc', padding: '15px', marginBottom: '20px', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
          <h3>{editingId ? "Edit User" : "Add New User"}</h3>
          <form onSubmit={handleSave} noValidate>
            <input 
              type="text" 
              placeholder="Username" 
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              style={{ marginRight: '10px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <input 
              type="email" 
              placeholder="Email" 
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              style={{ marginRight: '10px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <input 
              type="password" 
              placeholder="Password" 
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              style={{ marginRight: '10px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            
            <select 
              value={formData.role} 
              onChange={(e) => setFormData({...formData, role: e.target.value})}
              style={{ marginRight: '10px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
            
            <button type="submit" style={{ padding: '8px 15px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              {editingId ? "Save" : "Add"}
            </button>
            
            {editingId && (
              <button type="button" onClick={() => {setEditingId(null); setFormData({ username: '', email: '', password: '', role: 'USER' })}} style={{ marginLeft: '10px', padding: '8px 15px', cursor: 'pointer' }}>
                Cancel
              </button>
            )}
          </form>
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', backgroundColor: 'white' }}>
        <thead>
          <tr style={{ backgroundColor: '#f2f2f2' }}>
            <th onClick={() => handleSort('id')} style={{ padding: '12px', borderBottom: '1px solid #ddd', cursor: 'pointer' }}>
              ID{getSortIndicator('id')}
            </th>
            <th onClick={() => handleSort('username')} style={{ padding: '12px', borderBottom: '1px solid #ddd', cursor: 'pointer' }}>
              Username{getSortIndicator('username')}
            </th>
            <th onClick={() => handleSort('email')} style={{ padding: '12px', borderBottom: '1px solid #ddd', cursor: 'pointer' }}>
              Email{getSortIndicator('email')}
            </th>
            <th onClick={() => handleSort('password')} style={{ padding: '12px', borderBottom: '1px solid #ddd', cursor: 'pointer' }}>
              Password{getSortIndicator('password')}
            </th>
            <th onClick={() => handleSort('role')} style={{ padding: '12px', borderBottom: '1px solid #ddd', cursor: 'pointer' }}>
              Role{getSortIndicator('role')}
            </th>
            {isAdmin && <th style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {sortedUsers.map(user => (
            <tr key={user.id} style={{ borderBottom: '1px solid #ddd' }}>
              <td style={{ padding: '12px' }}>{user.id}</td>
              <td style={{ padding: '12px' }}>{user.username}</td>
              <td style={{ padding: '12px' }}>{user.email}</td>
              <td style={{ padding: '12px' }}>{user.password}</td>
              <td style={{ padding: '12px' }}>{user.role}</td>
              {isAdmin && (
                <td style={{ padding: '12px' }}>
                  <button onClick={() => handleEdit(user)} style={{ marginRight: '10px', cursor: 'pointer', padding: '5px 10px' }}>Edit</button>
                  <button onClick={() => handleDelete(user.id)} style={{ color: 'white', backgroundColor: '#dc3545', border: 'none', cursor: 'pointer', padding: '5px 10px', borderRadius: '3px' }}>Delete</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      
      {users.length === 0 && <p style={{ marginTop: '20px', fontStyle: 'italic' }}>No users found in the database.</p>}
    </div>
  );
}

export default App;