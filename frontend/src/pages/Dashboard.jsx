import { useNavigate } from 'react-router-dom';

function Dashboard({ currentUser, setCurrentUser }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    navigate('/login');
  };

  const activeCardStyle = {
    backgroundColor: '#fff', border: '2px solid #007bff', borderRadius: '15px', padding: '30px',
    width: '200px', cursor: 'pointer', boxShadow: '0 4px 8px rgba(0,0,0,0.1)', display: 'flex',
    flexDirection: 'column', alignItems: 'center', transition: '0.2s'
  };

  const disabledCardStyle = {
    backgroundColor: '#f8f9fa', border: '2px dashed #ccc', borderRadius: '15px', padding: '30px',
    width: '200px', cursor: 'not-allowed', opacity: 0.6, display: 'flex',
    flexDirection: 'column', alignItems: 'center'
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1000px', margin: '0 auto', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '2.5rem', margin: 0, color: '#333' }}>Platform Dashboard</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontWeight: '500', color: '#555' }}>Salut, {currentUser?.username}!</span>
          <button onClick={handleLogout} style={{ padding: '8px 15px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>Logout</button>
        </div>
      </div>
      
      <p style={{ color: '#666', marginBottom: '40px' }}>Select an application from the menu:</p>
      
      <div style={{ display: 'flex', justifyContent: 'center', gap: '25px', flexWrap: 'wrap', maxWidth: '1000px', margin: '0 auto' }}>
        <div onClick={() => navigate('/admin-panel')} style={activeCardStyle}>
          <div style={{ fontSize: '40px', marginBottom: '15px' }}>⚙️</div>
          <h3 style={{ margin: 0, color: '#007bff' }}>Admin Panel</h3>
          <p style={{ fontSize: '12px', color: '#555', marginTop: '10px' }}>Manage users & roles</p>
        </div>

        <div style={disabledCardStyle} title="Aplicație în dezvoltare">
          <div style={{ fontSize: '40px', marginBottom: '15px', filter: 'grayscale(100%)' }}>🤝</div>
          <h3 style={{ margin: 0, color: '#777' }}>Meetings</h3>
        </div>

        <div style={disabledCardStyle} title="Aplicație în dezvoltare">
          <div style={{ fontSize: '40px', marginBottom: '15px', filter: 'grayscale(100%)' }}>💬</div>
          <h3 style={{ margin: 0, color: '#777' }}>Messages</h3>
        </div>

        <div style={disabledCardStyle} title="Aplicație în dezvoltare">
          <div style={{ fontSize: '40px', marginBottom: '15px', filter: 'grayscale(100%)' }}>📅</div>
          <h3 style={{ margin: 0, color: '#777' }}>Calendar</h3>
        </div>

        <div onClick={() => navigate('/tasks')} style={activeCardStyle}>
            <div style={{ fontSize: '40px', marginBottom: '15px' }}>✅</div>
             <h3 style={{ margin: 0, color: '#007bff' }}>Tasks</h3>
            <p style={{ fontSize: '12px', color: '#555', marginTop: '10px' }}>Kanban Board</p>
        </div>

        <div onClick={() => navigate('/for-me')} style={activeCardStyle}>
            <div style={{ fontSize: '40px', marginBottom: '15px' }}>🌙</div>
             <h3 style={{ margin: 0, color: '#007bff' }}>For Me</h3>
            <p style={{ fontSize: '12px', color: '#555', marginTop: '10px' }}>Personal space</p>
        </div>

      </div>
    </div>
  );
}

export default Dashboard;