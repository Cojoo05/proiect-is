import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config';

const API_URL = `${API_BASE_URL}/api/users`;

function Login({ setCurrentUser }) {
  const navigate = useNavigate();

  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginData)
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('Nume de utilizator sau parolă greșite.');
        }

        const usersRes = await fetch(API_URL);
        const allUsers = await usersRes.json();
        const realUser = Array.isArray(allUsers)
          ? allUsers.find((u) => u.username === loginData.username)
          : null;

        if (!realUser) {
          throw new Error('Contul a fost validat, dar nu a putut fi încărcat. Încearcă din nou.');
        }

        setCurrentUser(realUser);
        localStorage.setItem('currentUser', JSON.stringify(realUser));
        navigate('/dashboard');
      })
      .catch((err) => {
        setError(
          err instanceof TypeError
            ? 'Nu pot contacta serverul. Verifică dacă backend-ul rulează pe portul 8080.'
            : err.message
        );
      })
      .finally(() => setLoading(false));
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: '24px',
        backgroundColor: '#f8fafc'
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          padding: '36px 32px',
          borderRadius: '14px',
          boxShadow: '0 10px 30px -12px rgba(15, 23, 42, 0.25)',
          width: '100%',
          maxWidth: '380px'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }} aria-hidden="true">🔐</div>
          <h1 style={{ margin: '0 0 6px', fontSize: '1.5rem', color: '#0f172a' }}>Bine ai revenit</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
            Autentifică-te pentru a intra în workspace.
          </p>
        </div>

        {error && (
          <div className="alert alert--error" role="alert" style={{ marginBottom: '16px' }}>
            <span>{error}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() => setError('')}
              aria-label="Închide mesajul de eroare"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleLogin} noValidate>
          <div className="field">
            <label className="label" htmlFor="username">Nume de utilizator</label>
            <input
              id="username"
              className="input"
              type="text"
              autoFocus
              autoComplete="username"
              placeholder=""
              value={loginData.username}
              onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
              required
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="password">Parolă</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                className="input"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder=""
                value={loginData.password}
                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                required
                style={{ paddingRight: '48px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ascunde parola' : 'Arată parola'}
                style={{
                  position: 'absolute',
                  top: '50%',
                  right: '6px',
                  transform: 'translateY(-50%)',
                  padding: '6px 8px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '15px'
                }}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn--primary"
            disabled={loading}
            style={{ width: '100%', marginTop: '4px', padding: '11px 16px' }}
          >
            {loading ? 'Se conectează...' : 'Autentificare'}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '14px', color: '#475569' }}>
          Nu ai cont?{' '}
          <button
            type="button"
            onClick={() => navigate('/register')}
            style={{ background: 'none', border: 'none', padding: 0, color: '#5a3d5c', fontWeight: 700, cursor: 'pointer' }}
          >
            Creează unul
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;
