import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, GOOGLE_CLIENT_ID } from '../config';

const CATEGORIES = [
  { id: 'account', label: 'Account', icon: '👤', description: 'Detalii profil și sincronizare Google' },
  { id: 'notifications', label: 'Notificări', icon: '🔔', description: 'Preferințe alerte și mesaje' },
  { id: 'appearance', label: 'Aspect & Teme', icon: '🎨', description: 'Personalizare interfață' },
  { id: 'security', label: 'Securitate', icon: '🔒', description: 'Parolă și confidențialitate' },
];

export default function Settings({ currentUser, setCurrentUser }) {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('account');
  const [user, setUser] = useState(currentUser || {});
  const [tokenClient, setTokenClient] = useState(null);
  const [loadingSync, setLoadingSync] = useState(false);
  const [toast, setToast] = useState(null);

  // Warning modal when Google email differs from current account email
  const [warningModal, setWarningModal] = useState({
    isOpen: false,
    googleEmail: '',
    googleId: '',
    accessToken: '',
  });

  const showToast = useCallback((text, type = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // Refresh user data from backend to ensure up-to-date google_synced status
  const refreshUser = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/users`);
      if (res.ok) {
        const list = await res.json();
        const me = list.find((u) => u.id === currentUser.id);
        if (me) {
          setUser(me);
          const merged = { ...currentUser, ...me };
          if (setCurrentUser) setCurrentUser(merged);
          localStorage.setItem('currentUser', JSON.stringify(merged));
        }
      }
    } catch (_) {}
  }, [currentUser?.id, setCurrentUser]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

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
                setLoadingSync(false);
                showToast('Autentificarea Google a fost anulată sau a apărut o eroare.', 'error');
              }
            },
          });
          setTokenClient(client);
        } catch (err) {
          console.error('Eroare la inițializarea Google GSI:', err);
        }
      }
    };

    initGsi();
    const timer = setTimeout(initGsi, 1200);
    return () => clearTimeout(timer);
  }, [showToast]);

  // Process access token & fetch Google profile
  const handleGoogleTokenReceived = async (accessToken) => {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        throw new Error('Nu s-au putut prelua datele contului Google.');
      }

      const googleInfo = await res.json();
      const googleEmail = (googleInfo.email || '').trim().toLowerCase();
      const googleId = googleInfo.sub || '';

      if (!googleEmail) {
        throw new Error('Contul Google nu furnizează o adresă de email validă.');
      }

      // Check if emails differ -> show warning modal
      const currentEmail = (user.email || '').trim().toLowerCase();
      if (currentEmail && googleEmail !== currentEmail) {
        setWarningModal({
          isOpen: true,
          googleEmail,
          googleId,
          accessToken,
        });
        setLoadingSync(false);
        return;
      }

      // If emails match or user has no email yet, proceed immediately
      await finalizeSync(googleEmail, googleId, accessToken);
    } catch (err) {
      setLoadingSync(false);
      showToast(err.message || 'Eroare la sincronizarea cu Google.', 'error');
    }
  };

  // Finalize Google synchronization with backend
  const finalizeSync = async (googleEmail, googleId, accessToken) => {
    setLoadingSync(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${user.id}/sync-google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleEmail, googleId }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Eroare la salvarea sincronizării în server.');
      }

      const updatedUser = await res.json();

      // Store Google access token for Calendar integration
      if (accessToken) {
        localStorage.setItem('google_access_token', accessToken);
      }

      setUser(updatedUser);
      if (setCurrentUser) setCurrentUser(updatedUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));

      setWarningModal({ isOpen: false, googleEmail: '', googleId: '', accessToken: '' });
      showToast('Contul a fost sincronizat cu succes cu Google Calendar!', 'success');
    } catch (err) {
      showToast(err.message || 'Eroare la finalizarea sincronizării.', 'error');
    } finally {
      setLoadingSync(false);
    }
  };

  const handleStartGoogleSync = () => {
    if (user.googleSynced) return;
    if (!tokenClient) {
      showToast('Modulul Google Identity se încarcă... te rugăm să reîncerci într-o secundă.', 'error');
      return;
    }
    setLoadingSync(true);
    tokenClient.requestAccessToken({ prompt: 'consent' });
  };

  const isSynced = Boolean(user.googleSynced || user.googleId);

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', backgroundColor: '#f8fafc', padding: '24px 24px 40px', textAlign: 'left' }}>
      <div style={{ maxWidth: '1060px', margin: '0 auto', textAlign: 'left' }}>

        {/* Toast Alert */}
        {toast && (
          <div
            style={{
              position: 'fixed',
              top: '75px',
              right: '24px',
              zIndex: 9999,
              padding: '12px 18px',
              borderRadius: 0,
              fontSize: '13px',
              fontWeight: '600',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              backgroundColor: toast.type === 'error' ? '#fee2e2' : '#dcfce7',
              color: toast.type === 'error' ? '#991b1b' : '#166534',
              border: `1px solid ${toast.type === 'error' ? '#fca5a5' : '#86efac'}`,
            }}
          >
            {toast.type === 'error' ? '⚠️ ' : '✅ '}
            {toast.text}
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', textAlign: 'left' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#1e293b', fontWeight: '800' }}>
            ⚙️ Setări
          </h1>
        </div>

        {/* ── UNITED BOX: No gap, 0 border radius everywhere, LEFT = Categories, RIGHT = Settings ── */}
        <div
          style={{
            display: 'flex',
            border: '1px solid #cbd5e1',
            borderRadius: 0,
            backgroundColor: '#ffffff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            minHeight: '480px',
            textAlign: 'left',
          }}
        >

          {/* ── LEFT PANEL: Categories List (0 border-radius, borderRight to separate) ── */}
          <div
            style={{
              width: '230px',
              backgroundColor: '#f8fafc',
              flexShrink: 0,
              padding: 0,
              borderRadius: 0,
              borderRight: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              textAlign: 'left',
            }}
          >
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '15px 18px',
                    borderRadius: 0,
                    border: 'none',
                    borderBottom: '1px solid #e2e8f0',
                    borderLeft: isActive ? '3px solid #5a3d5c' : '3px solid transparent',
                    backgroundColor: isActive ? '#ffffff' : 'transparent',
                    color: isActive ? '#5a3d5c' : '#334155',
                    fontWeight: isActive ? '700' : '500',
                    fontSize: '13px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = '#f1f5f9';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span style={{ fontSize: '16px' }}>{cat.icon}</span>
                  <span style={{ flex: 1 }}>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* ── RIGHT PANEL: Category Options / Settings Content ── */}
          <div
            style={{
              flex: 1,
              padding: '28px 32px',
              textAlign: 'left',
              borderRadius: 0,
              backgroundColor: '#ffffff',
            }}
          >
            {activeCategory === 'account' && (
              <div style={{ textAlign: 'left' }}>
                <h2 style={{ margin: '0 0 6px', fontSize: '1.25rem', color: '#1e293b', fontWeight: '700', textAlign: 'left' }}>
                  👤 Account
                </h2>
                <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#64748b', textAlign: 'left' }}>
                  Gestionează datele contului tău și sincronizarea cu Google Calendar.
                </p>

                {/* Profile Overview Card */}
                <div style={{ backgroundColor: '#f8fafc', borderRadius: 0, border: '1px solid #e2e8f0', padding: '16px 20px', marginBottom: '24px', textAlign: 'left' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '12px', textAlign: 'left' }}>
                    Informații Cont
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', fontSize: '13px', textAlign: 'left' }}>
                    <div>
                      <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: '600' }}>Username</div>
                      <div style={{ fontWeight: '600', color: '#1e293b', marginTop: '2px' }}>{user.username}</div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: '600' }}>Email Principal</div>
                      <div style={{ fontWeight: '600', color: '#1e293b', marginTop: '2px' }}>{user.email || '—'}</div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: '600' }}>Rol în Sistem</div>
                      <div style={{ fontWeight: '600', color: '#5a3d5c', marginTop: '2px' }}>{user.role || 'User'}</div>
                    </div>
                  </div>
                </div>

                {/* Google Sync Section */}
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '20px', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '18px' }}>🌐</span>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#1e293b', fontWeight: '700' }}>
                      Sincronizare Google Calendar
                    </h3>
                  </div>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px', lineHeight: 1.5, textAlign: 'left' }}>
                    Sincronizarea cu Google Calendar îți asociază contul Google cu contul din platformă.
                  </p>

                  {/* Sync Button & Status Card */}
                  <div style={{ backgroundColor: isSynced ? '#f8fafc' : '#ffffff', border: `1px solid ${isSynced ? '#cbd5e1' : '#e2e8f0'}`, borderRadius: 0, padding: '18px 20px', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: isSynced ? '#475569' : '#1e293b', textAlign: 'left' }}>
                          {isSynced ? 'Status: Conectat cu Google' : 'Contul nu este sincronizat'}
                        </div>
                        {isSynced && (
                          <div style={{ fontSize: '12px', color: '#166534', fontWeight: '600', marginTop: '4px', textAlign: 'left' }}>
                            ✅ Cont Google salvat: <strong>{user.email}</strong>
                          </div>
                        )}
                        {!isSynced && (
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', textAlign: 'left' }}>
                            Conectează-ți contul Google pentru sincronizare.
                          </div>
                        )}
                      </div>

                      {/* The Button */}
                      <div>
                        {isSynced ? (
                          <button
                            type="button"
                            disabled
                            style={{
                              padding: '10px 20px',
                              backgroundColor: '#94a3b8',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: 0,
                              fontSize: '13px',
                              fontWeight: '700',
                              cursor: 'not-allowed',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              opacity: 0.85,
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                            </svg>
                            Sincronizat
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleStartGoogleSync}
                            disabled={loadingSync}
                            style={{
                              padding: '10px 20px',
                              backgroundColor: '#2563eb',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: 0,
                              fontSize: '13px',
                              fontWeight: '700',
                              cursor: loadingSync ? 'wait' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              transition: 'background-color 0.15s ease',
                            }}
                            onMouseEnter={(e) => { if (!loadingSync) e.currentTarget.style.backgroundColor = '#1d4ed8'; }}
                            onMouseLeave={(e) => { if (!loadingSync) e.currentTarget.style.backgroundColor = '#2563eb'; }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24">
                              <path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                              <path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                              <path fill="#ffffff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                              <path fill="#ffffff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                            </svg>
                            {loadingSync ? 'Se sincronizează...' : 'Sincronizează cu Google'}
                          </button>
                        )}
                      </div>
                    </div>

                    {isSynced && (
                      <div
                        style={{
                          marginTop: '14px',
                          padding: '10px 14px',
                          backgroundColor: '#f1f5f9',
                          borderRadius: 0,
                          border: '1px solid #e2e8f0',
                          fontSize: '12px',
                          color: '#64748b',
                          lineHeight: 1.5,
                          textAlign: 'left',
                        }}
                      >
                        🔒 <strong>Notă de securitate:</strong> Odată sincronizat, contul de Google este fixat pe contul tău. Daca apare o problema te rog contacteaza un administrator.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeCategory === 'notifications' && (
              <div style={{ textAlign: 'left' }}>
                <h2 style={{ margin: '0 0 6px', fontSize: '1.25rem', color: '#1e293b', fontWeight: '700', textAlign: 'left' }}>
                  🔔 Notificări
                </h2>
                <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748b', textAlign: 'left' }}>
                  Configurează cum dorești să primești alertele în aplicație.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#334155', cursor: 'pointer' }}>
                    <input type="checkbox" defaultChecked style={{ width: '16px', height: '16px', accentColor: '#5a3d5c' }} />
                    Notificări pentru task-uri noi primite de la colegi
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#334155', cursor: 'pointer' }}>
                    <input type="checkbox" defaultChecked style={{ width: '16px', height: '16px', accentColor: '#5a3d5c' }} />
                    Invitații la proiecte și roluri noi
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#334155', cursor: 'pointer' }}>
                    <input type="checkbox" defaultChecked style={{ width: '16px', height: '16px', accentColor: '#5a3d5c' }} />
                    Alerte ședințe Google Meet și evenimente calendar
                  </label>
                </div>
              </div>
            )}

            {activeCategory === 'appearance' && (
              <div style={{ textAlign: 'left' }}>
                <h2 style={{ margin: '0 0 6px', fontSize: '1.25rem', color: '#1e293b', fontWeight: '700', textAlign: 'left' }}>
                  🎨 Aspect & Teme
                </h2>
                <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748b', textAlign: 'left' }}>
                  Personalizează aspectul vizual al spațiului tău de lucru.
                </p>
                <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6, textAlign: 'left' }}>
                  Tema activă curentă: <strong>Light Neutral</strong> cu accente mov (brand #5a3d5c).
                  Opțiunile suplimentare de Dark Mode vor fi disponibile în versiunea următoare.
                </div>
              </div>
            )}

            {activeCategory === 'security' && (
              <div style={{ textAlign: 'left' }}>
                <h2 style={{ margin: '0 0 6px', fontSize: '1.25rem', color: '#1e293b', fontWeight: '700', textAlign: 'left' }}>
                  🔒 Securitate
                </h2>
                <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748b', textAlign: 'left' }}>
                  Informații despre securitatea contului tău.
                </p>
                <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6, textAlign: 'left' }}>
                  <div>Autentificare securizată cu parolă criptată BCrypt.</div>
                  <div style={{ marginTop: '8px' }}>
                    Sincronizarea cu Google utilizează protocolul oficial OAuth 2.0 (Google Identity Services).
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* ── Warning Modal: If Google Email differs from account Email ── */}
      {warningModal.isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 0,
              maxWidth: '480px',
              width: '100%',
              padding: '26px 28px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.22)',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <span style={{ fontSize: '24px' }}>⚠️</span>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#b45309', fontWeight: '800' }}>
                Atenție: Emailuri diferite
              </h3>
            </div>

            <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6, margin: '0 0 16px' }}>
              Adresa contului tău Google este <strong>{warningModal.googleEmail}</strong>, diferită de adresa curentă a contului: <strong>{user.email}</strong>.
            </p>

            <div
              style={{
                backgroundColor: '#fef3c7',
                border: '1px solid #fde68a',
                borderRadius: 0,
                padding: '12px 14px',
                fontSize: '12px',
                color: '#92400e',
                lineHeight: 1.5,
                marginBottom: '20px',
              }}
            >
              Prin continuarea sincronizării, <strong>adresa de email a contului tău va fi actualizată la {warningModal.googleEmail}</strong>, conform contului Google asociat.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setWarningModal({ isOpen: false, googleEmail: '', googleId: '', accessToken: '' })}
                style={{
                  padding: '9px 16px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: 0,
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Anulează
              </button>
              <button
                type="button"
                onClick={() => finalizeSync(warningModal.googleEmail, warningModal.googleId, warningModal.accessToken)}
                style={{
                  padding: '9px 18px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 0,
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                Confirmă și Sincronizează
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
