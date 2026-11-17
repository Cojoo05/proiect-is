import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:8080/api/users';

const EMPTY_FORM = { username: '', email: '', password: '', confirmPassword: '' };

function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = () => {
    if (!form.username.trim()) return 'Completează numele de utilizator.';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return 'Introdu o adresă de email validă.';
    if (form.password.length < 8) return 'Parola trebuie să aibă cel puțin 8 caractere.';
    if (form.password !== form.confirmPassword) return 'Parolele nu se potrivesc.';
    return '';
  };

  const handleRegister = (e) => {
    e.preventDefault();

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setLoading(true);

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        role: 'USER'
      })
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('Contul nu a putut fi creat. Poate numele de utilizator sau emailul există deja.');
        }
        navigate('/login');
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
          <div style={{ fontSize: '40px', marginBottom: '8px' }} aria-hidden="true">📝</div>
          <h1 style={{ margin: '0 0 6px', fontSize: '1.5rem', color: '#0f172a' }}>Creează cont</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
            Ai nevoie doar de un nume, un email și o parolă.
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

        <form onSubmit={handleRegister} noValidate>
          <div className="field">
            <label className="label" htmlFor="reg-username">Nume de utilizator</label>
            <input
              id="reg-username"
              className="input"
              type="text"
              autoFocus
              autoComplete="username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              className="input"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="reg-password">Parolă</label>
            <input
              id="reg-password"
              className="input"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              aria-describedby="reg-password-hint"
              required
            />
            <p className="field-hint" id="reg-password-hint">Minim 8 caractere.</p>
          </div>

          <div className="field">
            <label className="label" htmlFor="reg-confirm">Confirmă parola</label>
            <input
              id="reg-confirm"
              className="input"
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn--primary"
            disabled={loading}
            style={{ width: '100%', padding: '11px 16px' }}
          >
            {loading ? 'Se creează contul...' : 'Creează cont'}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '14px', color: '#475569' }}>
          Ai deja cont?{' '}
          <button
            type="button"
            onClick={() => navigate('/login')}
            style={{ background: 'none', border: 'none', padding: 0, color: '#5a3d5c', fontWeight: 700, cursor: 'pointer' }}
          >
            Autentifică-te
          </button>
        </div>
      </div>
    </div>
  );
}

export default Register;
