import { useEffect, useState } from 'react';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('login'); 
  const [users, setUsers] = useState([]);
  
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  
  const [formData, setFormData] = useState({ username: '', email: '', password: '', role: 'USER' });
  const [editingId, setEditingId] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'asc' });
  const [expandedPasswords, setExpandedPasswords] = useState({});
  
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
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: loginData.username,
        password: loginData.password
      })
    })
    .then(res => {
      if (res.ok) {
        setCurrentView('dashboard');
        setLoginData({ username: '', password: '' });
      } else {
        alert("Invalid username or password!");
      }
    })
    .catch(err => {
      console.error(err);
      alert("Eroare de conexiune la server!");
    });
  };

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

    if (!editingId && formData.password.length < 3) {
      alert("Password must be at least 3 characters long!");
      return;
    }
    
    if (editingId && formData.password.length > 0 && formData.password.length < 3) {
      alert("New password must be at least 3 characters long!");
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
      if (!res.ok) {
        throw new Error("Baza de date a respins salvarea! (Probabil email duplicat sau rol invalid). Verifică consola IntelliJ.");
      }
      fetchUsers();
      setFormData({ username: '', email: '', password: '', role: 'USER' });
      setEditingId(null);
    })
    .catch(err => {
      console.error(err);
      alert(err.message);
    });
  };

  const handleDelete = (id) => {
    if(window.confirm("Are you sure you want to delete this user?")) {
      fetch(`${API_URL}/${id}`, { method: 'DELETE' })
        .then(() => fetchUsers())
        .catch(err => console.error(err));
    }
  };

  const handleEdit = (user) => {
    setFormData({ 
      username: user.username || '', 
      email: user.email, 
      password: '', 
      role: user.role 
    });
    setEditingId(user.id);
  };

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

  const getSortIndicator = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
    }
    return '';
  };

  const togglePassword = (id) => {
    setExpandedPasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  if (currentView === 'login') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f4f6f8', fontFamily: 'sans-serif' }}>
        <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', width: '100%', maxWidth: '350px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>🔐</div>
          <h2 style={{ marginBottom: '5px', color: '#333' }}>Welcome Back</h2>
          <p style={{ color: '#777', fontSize: '14px', marginBottom: '30px' }}>Please login to your account</p>
          
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input
              type="text"
              placeholder="Username"
              value={loginData.username}
              onChange={(e) => setLoginData({...loginData, username: e.target.value})}
              required
              style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '15px' }}
            />
            <input
              type="password"
              placeholder="Password"
              value={loginData.password}
              onChange={(e) => setLoginData({...loginData, password: e.target.value})}
              required
              style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '15px' }}
            />
            <button type="submit" style={{ padding: '12px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', marginTop: '10px' }}>
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (currentView === 'dashboard') {
    return (
      <div style={{ padding: '40px', fontFamily: 'sans-serif', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1000px', margin: '0 auto', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '2.5rem', margin: 0 }}>Project IS Dashboard</h1>
          <button 
            onClick={() => setCurrentView('login')}
            style={{ padding: '8px 15px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
          >
            Logout
          </button>
        </div>
        
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

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
        <button 
          onClick={() => setCurrentView('dashboard')}
          style={{ padding: '8px 15px', cursor: 'pointer', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          ⬅️ Back to Dashboard
        </button>
      </div>

      <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>Admin Panel - Manage Users</h1>

      {isAdmin && (
        <div style={{ border: '1px solid #ddd', padding: '20px', marginBottom: '30px', borderRadius: '8px', backgroundColor: '#fdfdfd', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
          <form onSubmit={handleSave} noValidate style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <input 
              type="text" 
              placeholder="Username" 
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc', flex: '1', minWidth: '150px' }}
            />
            <input 
              type="email" 
              placeholder="Email" 
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc', flex: '1', minWidth: '150px' }}
            />
            <input 
              type="password" 
              placeholder="Password" 
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc', flex: '1', minWidth: '150px' }}
            />
            
            <select 
              value={formData.role} 
              onChange={(e) => setFormData({...formData, role: e.target.value})}
              style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc', flex: '0.5', minWidth: '100px' }}
            >
              <option value="USER">User</option>
              <option value="STUDENT">Student</option>
            </select>
            
            <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              {editingId ? "Save" : "Add"}
            </button>
            
            {editingId && (
              <button type="button" onClick={() => {setEditingId(null); setFormData({ username: '', email: '', password: '', role: 'USER' })}} style={{ padding: '10px 15px', cursor: 'pointer', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#fff' }}>
                Cancel
              </button>
            )}
          </form>
        </div>
      )}

      <div style={{ overflowX: 'auto', borderRadius: '8px', boxShadow: '0 0 10px rgba(0,0,0,0.05)', border: '1px solid #eee' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', backgroundColor: 'white', fontSize: '0.95rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f4f6f8', color: '#333' }}>
              <th onClick={() => handleSort('id')} style={{ padding: '12px 15px', borderBottom: '2px solid #ddd', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                ID{getSortIndicator('id')}
              </th>
              <th onClick={() => handleSort('username')} style={{ padding: '12px 15px', borderBottom: '2px solid #ddd', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Username{getSortIndicator('username')}
              </th>
              <th onClick={() => handleSort('email')} style={{ padding: '12px 15px', borderBottom: '2px solid #ddd', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Email{getSortIndicator('email')}
              </th>
              <th onClick={() => handleSort('password')} style={{ padding: '12px 15px', borderBottom: '2px solid #ddd', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Password{getSortIndicator('password')}
              </th>
              <th onClick={() => handleSort('role')} style={{ padding: '12px 15px', borderBottom: '2px solid #ddd', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Role{getSortIndicator('role')}
              </th>
              {isAdmin && <th style={{ padding: '12px 15px', borderBottom: '2px solid #ddd', whiteSpace: 'nowrap' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map(user => {
              const isLongPassword = user.password && user.password.length > 25;
              
              return (
                <tr key={user.id} style={{ borderBottom: '1px solid #eee', transition: 'background-color 0.2s' }}>
                  <td style={{ padding: '12px 15px' }}>{user.id}</td>
                  <td style={{ padding: '12px 15px' }}>{user.username}</td>
                  <td style={{ padding: '12px 15px' }}>{user.email}</td>
                  
                  <td style={{ padding: '12px 15px', maxWidth: '200px', color: '#777' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ 
                        flex: 1,
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: expandedPasswords[user.id] ? 'normal' : 'nowrap',
                        wordBreak: expandedPasswords[user.id] ? 'break-all' : 'normal'
                      }}>
                        {user.password}
                      </span>
                      {isLongPassword && (
                        <button 
                          onClick={() => togglePassword(user.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: '0', color: '#555' }}
                        >
                          {expandedPasswords[user.id] ? '▲' : '▼'}
                        </button>
                      )}
                    </div>
                  </td>
                  
                  <td style={{ padding: '12px 15px', fontWeight: '500' }}>{user.role}</td>
                  {isAdmin && (
                    <td style={{ padding: '12px 15px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleEdit(user)} style={{ cursor: 'pointer', padding: '6px 12px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#fff', fontSize: '0.85rem' }}>Edit</button>
                        <button onClick={() => handleDelete(user.id)} style={{ color: 'white', backgroundColor: '#dc3545', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: '4px', fontSize: '0.85rem' }}>Delete</button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {users.length === 0 && <p style={{ marginTop: '20px', fontStyle: 'italic', textAlign: 'center', color: '#777' }}>No users found in the database.</p>}
    </div>
  );
}

export default App;