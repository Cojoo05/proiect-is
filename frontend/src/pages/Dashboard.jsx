import { useNavigate } from 'react-router-dom';
import { colors, isAdminUser, shadow } from '../theme.js';

function Dashboard({ currentUser }) {
  const navigate = useNavigate();
  const isAdmin = isAdminUser(currentUser);

  const apps = [
    {
      id: 'tasks',
      title: 'Tasks',
      icon: '✅',
      description: 'Gestionează activitățile, termenele limită și prioritățile echipei',
      path: '/tasks'
    },
    {
      id: 'calendar',
      title: 'Calendar',
      icon: '📅',
      description: 'Programează evenimente și sincronizează Google Calendar',
      path: '/calendar'
    },
    {
      id: 'announcements',
      title: 'Announcements',
      icon: '📢',
      description: 'Anunțurile echipei — publicate de administratori, vizibile pentru toți',
      path: '/announcements'
    },
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
      id: 'meeting-rooms',
      title: 'Meeting Rooms',
      icon: '🏢',
      description: 'Delegare și rezervare săli pentru echipe și grupuri',
      path: '/meeting-rooms'
    },
    {
      id: 'messages',
      title: 'Mesagerie',
      icon: '💬',
      description: 'Conversații și grupuri de comunicare în timp real',
      path: '/messages'
    }
  ];

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
    <div className="page-container">
      <div style={{ marginBottom: '28px' }}>
        <h1 className="page-title">
          Bun venit, {currentUser?.username || currentUser?.email || 'utilizator'} 👋
        </h1>
        <p className="page-subtitle">Alege un modul pentru a începe lucrul.</p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '20px'
        }}
      >
        {apps.map((app) => (
          <button
            key={app.id}
            type="button"
            onClick={() => navigate(app.path)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              padding: '24px',
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: '12px',
              boxShadow: shadow.card,
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = shadow.hover;
              e.currentTarget.style.borderColor = '#d8b4e2';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = shadow.card;
              e.currentTarget.style.borderColor = colors.border;
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '60px',
                height: '60px',
                marginBottom: '16px',
                borderRadius: '14px',
                backgroundColor: colors.accentSoft,
                border: `1px solid ${colors.accentBorder}`,
                fontSize: '28px'
              }}
            >
              {app.icon}
            </span>

            <span style={{ marginBottom: '6px', fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
              {app.title}
            </span>

            <span style={{ fontSize: '0.875rem', color: colors.textMuted, lineHeight: 1.45 }}>
              {app.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
