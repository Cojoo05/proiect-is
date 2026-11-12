import { useNavigate } from 'react-router-dom';

function Dashboard({ currentUser }) {
  const navigate = useNavigate();

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
      description: 'Bază de cunoștințe, documentație, imagini și materiale video',
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

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', backgroundColor: '#f8fafc', fontFamily: 'sans-serif' }}>
      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 24px' }}>
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
          {apps.map((app) => (
            <div
              key={app.id}
              onClick={() => navigate(app.path)}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                cursor: 'pointer',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                userSelect: 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 12px 20px -3px rgba(90, 61, 92, 0.15)';
                e.currentTarget.style.borderColor = '#d8b4e2';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '12px',
                  backgroundColor: '#f6eff7',
                  color: '#5a3d5c',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                  marginBottom: '16px'
                }}
              >
                {app.icon}
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#1e293b', fontWeight: '600' }}>
                {app.title}
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.4' }}>
                {app.description}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
