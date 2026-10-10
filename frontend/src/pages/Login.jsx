import { useState } from 'react';

function Login({ setCurrentView }) {
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const API_URL = 'http://localhost:8080/api/users';

  const handleLogin = (e) => {
    e.preventDefault();
    fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginData)
    })
    .then(res => {
      if (res.ok) setCurrentView('dashboard');
      else alert("Invalid username or password!");
    })
    .catch(() => alert("Eroare de conexiune la server!"));
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f4f6f8' }}>
      <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', width: '100%', maxWidth: '350px', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '10px' }}>🔐</div>
        <h2>Welcome Back</h2>
        <p style={{ color: '#777', fontSize: '14px', marginBottom: '30px' }}>Please login to your account</p>
        
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input type="text" placeholder="Username" value={loginData.username} onChange={(e) => setLoginData({...loginData, username: e.target.value})} required style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc' }} />
          <input type="password" placeholder="Password" value={loginData.password} onChange={(e) => setLoginData({...loginData, password: e.target.value})} required style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc' }} />
          <button type="submit" style={{ padding: '12px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>Sign In</button>
        </form>

        <div style={{ marginTop: '20px', fontSize: '14px', color: '#555' }}>
          Don't have an account?{' '}
          <button onClick={() => setCurrentView('register')} style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', fontWeight: 'bold', padding: 0 }}>Create User</button>
        </div>
      </div>
    </div>
  );
}

export default Login;