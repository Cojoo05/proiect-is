import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, GOOGLE_CLIENT_ID } from '../../config';

function Login({ setCurrentUser }) {
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [googleClient, setGoogleClient] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const API_URL = `${API_BASE_URL}/api/users`;
  const navigate = useNavigate();

  // Initialize Google OAuth Token Client (Google Identity Services)
  useEffect(() => {
    const initGsi = () => {
      if (window.google?.accounts?.oauth2) {
        try {
          const client = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: [
              'https://www.googleapis.com/auth/calendar.events',
              'https://www.googleapis.com/auth/calendar',
              'https://www.googleapis.com/auth/userinfo.email',
              'https://www.googleapis.com/auth/userinfo.profile',
              'openid',
            ].join(' '),
            callback: async (resp) => {
              if (resp?.access_token) {
                await handleGoogleLoginSuccess(resp.access_token);
              } else {
                setLoadingGoogle(false);
              }
            },
            error_callback: (err) => {
              console.error('Google OAuth error:', err);
              setLoadingGoogle(false);
            },
          });
          setGoogleClient(client);
        } catch (err) {
          console.error('Eroare la inițializarea Google GSI:', err);
        }
      }
    };

    initGsi();
    const timer = setTimeout(initGsi, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Handle successful Google token: fetch Google info and log into backend
  const handleGoogleLoginSuccess = async (accessToken) => {
    setLoadingGoogle(true);
    setErrorMessage('');
    try {
      const gRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!gRes.ok) {
        throw new Error('Nu s-au putut prelua datele de identificare Google.');
      }

      const googleInfo = await gRes.json();
      const googleEmail = (googleInfo.email || '').trim().toLowerCase();
      const googleId = googleInfo.sub || '';

      if (!googleEmail && !googleId) {
        throw new Error('Contul Google nu a furnizat suficiente date de identificare.');
      }

      const res = await fetch(`${API_URL}/login-google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleEmail, googleId }),
      });

      if (res.ok) {
        const loggedUser = await res.json();
        // Store Google access token for Calendar integration
        localStorage.setItem('google_access_token', accessToken);
        setCurrentUser(loggedUser);
        localStorage.setItem('currentUser', JSON.stringify(loggedUser));
        navigate('/dashboard');
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.message || 'Contul nu a putut fi autentificat cu Google.');
      }
    } catch (err) {
      console.error('Eroare Google Login:', err);
      setErrorMessage(err.message || 'Eroare de conexiune la autentificarea cu Google.');
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleGoogleClick = () => {
    setErrorMessage('');
    if (!googleClient) {
      if (window.google?.accounts?.oauth2) {
        try {
          const client = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: [
              'https://www.googleapis.com/auth/calendar.events',
              'https://www.googleapis.com/auth/calendar',
              'https://www.googleapis.com/auth/userinfo.email',
              'https://www.googleapis.com/auth/userinfo.profile',
              'openid',
            ].join(' '),
            callback: async (resp) => {
              if (resp?.access_token) {
                await handleGoogleLoginSuccess(resp.access_token);
              } else {
                setLoadingGoogle(false);
              }
            },
          });
          setGoogleClient(client);
          setLoadingGoogle(true);
          client.requestAccessToken({ prompt: 'select_account' });
          return;
        } catch (e) {
          console.error(e);
        }
      }
      alert('Modulul Google se inițializează, vă rugăm să reîncercați.');
      return;
    }
    setLoadingGoogle(true);
    googleClient.requestAccessToken({ prompt: 'select_account' });
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setErrorMessage('');

    fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginData),
    })
      .then(async (res) => {
        if (res.ok) {
          const usersRes = await fetch(API_URL);
          const allUsers = await usersRes.json();

          const realUser = allUsers.find((u) => u.username === loginData.username);

          if (realUser) {
            setCurrentUser(realUser);
            localStorage.setItem('currentUser', JSON.stringify(realUser));
            navigate('/dashboard');
          } else {
            setErrorMessage('Eroare: Utilizatorul s-a logat, dar nu a fost găsit în baza de date.');
          }
        } else {
          const errText = await res.text().catch(() => '');
          setErrorMessage(errText || 'Nume de utilizator sau parolă incorectă!');
        }
      })
      .catch((err) => {
        console.error('Eroare la rețea:', err);
        setErrorMessage('Eroare de conexiune la server!');
      });
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f4f6f8',
        padding: '20px',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '40px 32px',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          width: '100%',
          maxWidth: '380px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '42px', marginBottom: '10px' }}>🔐</div>
        <h2 style={{ margin: '0 0 6px', color: '#111827', fontSize: '24px', fontWeight: '700' }}>
          Welcome Back
        </h2>
        <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 24px' }}>
          Please login to your account
        </p>

        {errorMessage && (
          <div
            style={{
              backgroundColor: '#fef2f2',
              color: '#991b1b',
              border: '1px solid #fecaca',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '18px',
              textAlign: 'left',
              lineHeight: '1.45',
            }}
          >
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Regular Login Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <input
            type="text"
            placeholder="Username"
            value={loginData.username}
            onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
            required
            style={{
              padding: '12px 14px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={loginData.password}
            onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
            required
            style={{
              padding: '12px 14px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '12px',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1d4ed8')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
          >
            Sign In
          </button>
        </form>

        {/* Divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            margin: '22px 0 18px',
            color: '#9ca3af',
            fontSize: '13px',
          }}
        >
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }} />
          <span style={{ padding: '0 12px', fontWeight: '500' }}>sau</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }} />
        </div>

        {/* Google Login Button */}
        <button
          type="button"
          onClick={handleGoogleClick}
          disabled={loadingGoogle}
          style={{
            width: '100%',
            padding: '11px 16px',
            backgroundColor: '#ffffff',
            color: '#374151',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            cursor: loadingGoogle ? 'not-allowed' : 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            transition: 'background-color 0.15s ease, border-color 0.15s ease',
            boxSizing: 'border-box',
          }}
          onMouseEnter={(e) => !loadingGoogle && (e.currentTarget.style.backgroundColor = '#f9fafb')}
          onMouseLeave={(e) => !loadingGoogle && (e.currentTarget.style.backgroundColor = '#ffffff')}
        >
          {loadingGoogle ? (
            <span>Se conectează cu Google...</span>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Conectează-te cu Google</span>
            </>
          )}
        </button>

        <div style={{ marginTop: '24px', fontSize: '14px', color: '#6b7280' }}>
          Don't have an account?{' '}
          <button
            type="button"
            onClick={() => navigate('/register')}
            style={{
              background: 'none',
              border: 'none',
              color: '#2563eb',
              cursor: 'pointer',
              fontWeight: '600',
              padding: 0,
            }}
          >
            Create User
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;
