import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config';

function Register() {
  const [registerData, setRegisterData] = useState({ username: '', email: '', password: '' });
  const navigate = useNavigate();
  const API_URL = `${API_BASE_URL}/api/users`;

  const handleRegister = (e) => {
    e.preventDefault();
    if (registerData.username.trim() === '' || registerData.email.trim() === '' || registerData.password.length < 3) {
      alert("Please fill all fields correctly. Password must be at least 3 characters.");
      return;
    }

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...registerData, role: 'User' })
    })
    .then(res => {
      if (res.ok) {
        alert("Account created successfully! You can now login.");
        navigate('/login');
      } else {
        alert("Error creating account.");
      }
    })
    .catch(() => alert("Server error!"));
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f4f6f8' }}>
      <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', width: '100%', maxWidth: '350px', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '10px' }}>📝</div>
        <h2>Create Account</h2>
        <p style={{ color: '#777', fontSize: '14px', marginBottom: '30px' }}>Join us today</p>
        
        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input type="text" placeholder="Username" value={registerData.username} onChange={(e) => setRegisterData({...registerData, username: e.target.value})} required style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc' }} />
          <input type="email" placeholder="Email" value={registerData.email} onChange={(e) => setRegisterData({...registerData, email: e.target.value})} required style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc' }} />
          <input type="password" placeholder="Password" value={registerData.password} onChange={(e) => setRegisterData({...registerData, password: e.target.value})} required style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc' }} />
          <button type="submit" style={{ padding: '12px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>Sign Up</button>
        </form>

        <div style={{ marginTop: '20px', fontSize: '14px', color: '#555' }}>
          Already have an account?{' '}
          <button type="button" onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', fontWeight: 'bold', padding: 0 }}>Login</button>
        </div>
      </div>
    </div>
  );
}

export default Register;
