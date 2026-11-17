import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Dashboard({ currentUser }) {
  const navigate = useNavigate();

  // Load workspace module settings to detect disabled modules
  const [settings, setSettings] = useState(() => {
    try {
      const stored = localStorage.getItem('workspace_settings');
      return stored ? JSON.parse(stored) : {};
    } catch (_) {
      return {};
    }
  });

  useEffect(() => {
    const handleSettingsUpdated = (e) => {
      if (e?.detail) {
        setSettings(e.detail);
      } else {
        try {
          const stored = localStorage.getItem('workspace_settings');
          setSettings(stored ? JSON.parse(stored) : {});
        } catch (_) {}
      }
    };

    window.addEventListener('workspace-settings-updated', handleSettingsUpdated);
    window.addEventListener('storage', handleSettingsUpdated);
    return () => {
      window.removeEventListener('workspace-settings-updated', handleSettingsUpdated);
      window.removeEventListener('storage', handleSettingsUpdated);
    };
  }, []);

  const apps = [
    {
      id: 'for-me',
      title: 'For Me',
      icon: '👤',
      description: 'Spațiul tău personal, notițe private și organizare zilnică',
      path: '/for-me'
    },
    {
      id: 'projects',
      title: 'Projects',
      icon: '📁',
      description: 'Spațiul de lucru al echipei, task-uri, feed și planificare',
      path: '/projects'
    },
    {
      id: 'tasks',
      title: 'Task-uri',
      icon: '📋',
      description: 'Panou Kanban de sarcini, stadii de execuție și termene',
      path: '/tasks'
    },
    {
      id: 'calendar',
      title: 'Calendar',
      icon: '📅',
      description: 'Evenimente, ședințe, sincronizare Google Calendar și agendă',
      path: '/calendar'
    },
    {
      id: 'messages',
      title: 'Mesagerie',
      icon: '💬',
      description: 'Conversații și grupuri de comunicare în timp real',
      path: '/messages'
    },
    {
      id: 'knowledge',
      title: 'Knowledge',
      icon: '🧠',
      description: 'Bază de cunoștințe, documentație, foldere și fișiere',
      path: '/knowledge'
    }
  ];

  const isAdmin = Boolean(
    currentUser?.hasAdminAccess === true ||
    (currentUser?.role && currentUser.role.toUpperCase() === 'ADMIN' && currentUser.role.toUpperCase() !== 'USER')
  );

  if (isAdmin) {
    apps.push({
      id: 'admin-panel',
      title: 'Admin Panel',
      icon: '⚙️',
      description: 'Administrare utilizatori, roluri și permisiuni de sistem',
      path: '/admin-panel'
    });
  }

  const isModuleEnabled = (appId) => {
    if (appId === 'admin-panel') return true;
    const settingKey = appId === 'for-me' ? 'forMe' : appId;
    return settings?.[settingKey]?.enabled !== false;
  };

  const handleCardClick = (app) => {
    const enabled = isModuleEnabled(app.id);
    if (!enabled) {
      if (isAdmin) {
        const goToAdmin = window.confirm(
          `Modulul "${app.title}" este dezactivat în setările workspace-ului.\n\nVrei să mergi în Admin Panel pentru a-l reactiva?`
        );
        if (goToAdmin) {
          navigate('/admin-panel');
        }
      } else {
        alert(`Modulul "${app.title}" este momentan oprit de către administratorul workspace-ului.`);
      }
      return;
    }
    navigate(app.path);
  };

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', backgroundColor: '#f8fafc', fontFamily: 'sans-serif', width: '100%', boxSizing: 'border-box' }}>
      <main style={{ width: '100%', boxSizing: 'border-box', padding: '36px 40px' }}>
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ margin: '0 0 6px 0', fontSize: '1.75rem', color: '#0f172a', fontWeight: '700' }}>
            Aplicații & Module
          </h2>
          <p style={{ margin: 0, color: '#64748b', fontSize: '15px' }}>
            Selectează un modul pentru a începe lucrul.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '24px'
          }}
        >
          {apps.map((app) => {
            const enabled = isModuleEnabled(app.id);

            return (
              <div
                key={app.id}
                onClick={() => handleCardClick(app)}
                style={{
                  position: 'relative',
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  cursor: enabled ? 'pointer' : 'not-allowed',
                  border: enabled ? '1px solid #e2e8f0' : '1px dashed #fca5a5',
                  boxShadow: enabled
                    ? '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)'
                    : 'none',
                  opacity: enabled ? 1 : 0.65,
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  userSelect: 'none'
                }}
                onMouseEnter={(e) => {
                  if (enabled) {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 12px 20px -3px rgba(90, 61, 92, 0.15)';
                    e.currentTarget.style.borderColor = '#d8b4e2';
                  }
                }}
                onMouseLeave={(e) => {
                  if (enabled) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }
                }}
              >
                {/* Deactivated Badge */}
                {!enabled && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      fontSize: '11px',
                      fontWeight: '700',
                      backgroundColor: '#fee2e2',
                      color: '#dc2626',
                      border: '1px solid #fca5a5',
                      padding: '2px 8px',
                      borderRadius: '10px'
                    }}
                  >
                    🔴 Oprit de Admin
                  </span>
                )}

                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '12px',
                    backgroundColor: enabled ? '#f6eff7' : '#f1f5f9',
                    color: enabled ? '#5a3d5c' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                    marginBottom: '16px'
                  }}
                >
                  {app.icon}
                </div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: enabled ? '#1e293b' : '#64748b', fontWeight: '600' }}>
                  {app.title}
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.4' }}>
                  {app.description}
                </p>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
