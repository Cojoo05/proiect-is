import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, GOOGLE_CLIENT_ID } from '../../config';

function Register({ setCurrentUser }) {
  const [registerData, setRegisterData] = useState({ username: '', email: '', password: '' });
  const [googleClient, setGoogleClient] = useState(null);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [googleAuthData, setGoogleAuthData] = useState(null); // { googleEmail, googleId, accessToken, picture, name }
  const [googleForm, setGoogleForm] = useState({ username: '', password: '' });
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const API_URL = `${API_BASE_URL}/api/users`;

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
                await handleGoogleTokenReceived(resp.access_token);
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

  // Handle Google token: verify if account already exists, if not, ask for Username and Password
  const handleGoogleTokenReceived = async (accessToken) => {
    setLoadingGoogle(true);
    setErrorMessage('');
    try {
      const gRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!gRes.ok) {
        throw new Error('Nu s-au putut prelua datele de la Google.');
      }

      const googleInfo = await gRes.json();
      const googleEmail = (googleInfo.email || '').trim().toLowerCase();
      const googleId = googleInfo.sub || '';
      const picture = googleInfo.picture || '';
      const name = googleInfo.name || '';

      if (!googleEmail || !googleId) {
        throw new Error('Contul Google nu a furnizat suficiente date de identificare.');
      }

      // Pre-check if this Google ID or email is already registered in backend
      const checkRes = await fetch(`${API_URL}/check-google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleEmail, googleId }),
      });

      if (!checkRes.ok) {
        const errData = await checkRes.json().catch(() => ({}));
        setErrorMessage(errData.message || 'Acest cont Google este deja folosit.');
        setLoadingGoogle(false);
        return;
      }

      // Pre-fill suggested username from Google name or email prefix
      const suggestedUsername = (name || googleEmail.split('@')[0] || '')
        .replace(/[^a-zA-Z0-9._-]/g, '')
        .trim();

      setGoogleAuthData({
        googleEmail,
        googleId,
        accessToken,
        picture,
        name,
      });

      setGoogleForm({
        username: suggestedUsername,
        password: '',
      });
    } catch (err) {
      console.error('Eroare la preluarea profilului Google:', err);
      setErrorMessage(err.message || 'Eroare la conectarea cu Google.');
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleStartGoogle = () => {
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
                await handleGoogleTokenReceived(resp.access_token);
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
      alert('Modulul Google se inițializează, vă rugăm reîncercați.');
      return;
    }
    setLoadingGoogle(true);
    googleClient.requestAccessToken({ prompt: 'select_account' });
  };

  // Submit Google registration with Username & Password
  const handleCompleteGoogleRegister = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!googleForm.username.trim()) {
      setErrorMessage('Te rugăm să introduci un nume de utilizator.');
      return;
    }

    if (googleForm.password.length < 3) {
      setErrorMessage('Parola trebuie să aibă minim 3 caractere.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/register-google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleEmail: googleAuthData.googleEmail,
          googleId: googleAuthData.googleId,
          username: googleForm.username.trim(),
          password: googleForm.password.trim(),
        }),
      });

      if (res.ok) {
        const newUser = await res.json();

        // Save Google access token for Calendar integration
        if (googleAuthData.accessToken) {
          localStorage.setItem('google_access_token', googleAuthData.accessToken);
        }

        // Auto-login newly registered user
        if (setCurrentUser) {
          setCurrentUser(newUser);
        }
        localStorage.setItem('currentUser', JSON.stringify(newUser));

        alert('Contul a fost creat și sincronizat cu Google cu succes!');
        navigate('/dashboard');
      } else {
        const errData = await res.json().catch(() => ({}));
        setErrorMessage(errData.message || 'Eroare la crearea contului cu Google.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Eroare de conexiune la server.');
    } finally {
      setSubmitting(false);
    }
  };

  // Standard registration (Username, Email, Password)
  const handleStandardRegister = (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (registerData.username.trim() === '' || registerData.email.trim() === '' || registerData.password.length < 3) {
      setErrorMessage('Te rugăm să completezi toate câmpurile. Parola trebuie să aibă minim 3 caractere.');
      return;
    }

    setSubmitting(true);
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...registerData, role: 'User' }),
    })
      .then(async (res) => {
        if (res.ok) {
          alert('Contul a fost creat cu succes! Te poți autentifica acum.');
          navigate('/login');
        } else {
          const errData = await res.json().catch(() => ({}));
          setErrorMessage(errData.message || 'Eroare la crearea contului.');
        }
      })
      .catch(() => setErrorMessage('Eroare de conexiune la server!'))
      .finally(() => setSubmitting(false));
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
        <div style={{ fontSize: '42px', marginBottom: '10px' }}>
          {googleAuthData ? '✨' : '📝'}
        </div>
        <h2 style={{ margin: '0 0 6px', color: '#111827', fontSize: '24px', fontWeight: '700' }}>
          {googleAuthData ? 'Finalizează contul' : 'Create Account'}
        </h2>
        <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 24px' }}>
          {googleAuthData
            ? 'Setează numele de utilizator și parola contului tău'
            : 'Înregistrează-te pentru a continua'}
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

        {/* STEP 2: Google profile is connected -> prompt Username & Password */}
        {googleAuthData ? (
          <div>
            {/* Google Profile Card */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                marginBottom: '18px',
                textAlign: 'left',
              }}
            >
              {googleAuthData.picture ? (
                <img
                  src={googleAuthData.picture}
                  alt="Google Avatar"
                  style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: '#dcfce7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                  }}
                >
                  🟢
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#166534', textTransform: 'uppercase' }}>
                  Cont Google conectat
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#14532d',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={googleAuthData.googleEmail}
                >
                  {googleAuthData.googleEmail}
                </div>
              </div>
            </div>

            <form onSubmit={handleCompleteGoogleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ textAlign: 'left' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>
                  Alege un Username
                </label>
                <input
                  type="text"
                  placeholder="Username"
                  value={googleForm.username}
                  onChange={(e) => setGoogleForm({ ...googleForm, username: e.target.value })}
                  required
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ textAlign: 'left' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>
                  Setează o Parolă
                </label>
                <input
                  type="password"
                  placeholder="Minim 3 caractere"
                  value={googleForm.password}
                  onChange={(e) => setGoogleForm({ ...googleForm, password: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  marginTop: '6px',
                  padding: '12px',
                  backgroundColor: '#16a34a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => !submitting && (e.currentTarget.style.backgroundColor = '#15803d')}
                onMouseLeave={(e) => !submitting && (e.currentTarget.style.backgroundColor = '#16a34a')}
              >
                {submitting ? 'Se creează contul...' : 'Creează contul și conectează-te'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setGoogleAuthData(null);
                  setErrorMessage('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6b7280',
                  fontSize: '13px',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                ← Alege alt cont sau anulează
              </button>
            </form>
          </div>
        ) : (
          /* STEP 1: Standard registration + Google Register Button */
          <div>
            {/* Google Register Button */}
            <button
              type="button"
              onClick={handleStartGoogle}
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
                marginBottom: '18px',
              }}
              onMouseEnter={(e) => !loadingGoogle && (e.currentTarget.style.backgroundColor = '#f9fafb')}
              onMouseLeave={(e) => !loadingGoogle && (e.currentTarget.style.backgroundColor = '#ffffff')}
            >
              {loadingGoogle ? (
                <span>Se deschide Google...</span>
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
                  <span>Înregistrează-te cu Google</span>
                </>
              )}
            </button>

            {/* Divider */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                margin: '18px 0 20px',
                color: '#9ca3af',
                fontSize: '13px',
              }}
            >
              <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }} />
              <span style={{ padding: '0 12px', fontWeight: '500' }}>sau completează manual</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }} />
            </div>

            {/* Standard Form */}
            <form onSubmit={handleStandardRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input
                type="text"
                placeholder="Username"
                value={registerData.username}
                onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
                required
                style={{
                  padding: '12px 14px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
              <input
                type="email"
                placeholder="Email"
                value={registerData.email}
                onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                required
                style={{
                  padding: '12px 14px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
              <input
                type="password"
                placeholder="Password"
                value={registerData.password}
                onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                required
                style={{
                  padding: '12px 14px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '12px',
                  backgroundColor: '#16a34a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => !submitting && (e.currentTarget.style.backgroundColor = '#15803d')}
                onMouseLeave={(e) => !submitting && (e.currentTarget.style.backgroundColor = '#16a34a')}
              >
                {submitting ? 'Se creează...' : 'Sign Up'}
              </button>
            </form>
          </div>
        )}

        <div style={{ marginTop: '24px', fontSize: '14px', color: '#6b7280' }}>
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => navigate('/login')}
            style={{
              background: 'none',
              border: 'none',
              color: '#2563eb',
              cursor: 'pointer',
              fontWeight: '600',
              padding: 0,
            }}
          >
            Login
          </button>
        </div>
      </div>
    </div>
  );
}

export default Register;
