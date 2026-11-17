import { useNavigate } from 'react-router-dom';
import { isAdminUser } from '../theme.js';

function AppLayout({ currentUser, setCurrentUser, children }) {
  const navigate = useNavigate();
  const isAdmin = isAdminUser(currentUser);

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    if (setCurrentUser) setCurrentUser(null);
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <button
          type="button"
          className="app-brand"
          onClick={() => navigate('/dashboard')}
          aria-label="Mergi la dashboard"
        >
          <span className="app-brand-mark" aria-hidden="true">P</span>
          <span className="app-brand-text">
            <strong>Workspace</strong>
            <span>{currentUser?.username || currentUser?.email || 'Utilizator'}</span>
          </span>
        </button>

        <nav className="app-nav" aria-label="Navigare principală">
          <button type="button" className="app-nav-link" onClick={() => navigate('/dashboard')}>
            🏠 Dashboard
          </button>
          {isAdmin && (
            <button type="button" className="app-nav-link" onClick={() => navigate('/admin-panel')}>
              ⚙️ Admin
            </button>
          )}
        </nav>

        <div className="app-user">
          {isAdmin && <span className="badge badge--admin">Admin</span>}
          <button type="button" className="btn btn--secondary btn--sm" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="app-main">{children}</main>
    </div>
  );
}

export default AppLayout;
