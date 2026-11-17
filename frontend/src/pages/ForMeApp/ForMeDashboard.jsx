import { useNavigate } from 'react-router-dom';

function ForMeDashboard() {
  const navigate = useNavigate();

  const activeCardStyle = {
    backgroundColor: '#fff', border: '2px solid #007bff', borderRadius: '15px', padding: '30px',
    width: '220px', cursor: 'pointer', boxShadow: '0 4px 8px rgba(0,0,0,0.1)', display: 'flex',
    flexDirection: 'column', alignItems: 'center', transition: '0.2s'
  };

  const disabledCardStyle = {
    backgroundColor: '#f8f9fa', border: '2px dashed #ccc', borderRadius: '15px', padding: '30px',
    width: '220px', cursor: 'not-allowed', opacity: 0.6, display: 'flex',
    flexDirection: 'column', alignItems: 'center'
  };

  return (
    <div className="page-container" style={{ textAlign: 'center' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 className="page-title">🌙 For Me</h1>
      </div>

      <p className="page-subtitle" style={{ marginBottom: '40px' }}>
        Spațiul tău personal de organizare și reflecție.
      </p>
      
      <div style={{ display: 'flex', justifyContent: 'center', gap: '25px', flexWrap: 'wrap', maxWidth: '1100px', margin: '0 auto' }}>
        
        <div onClick={() => navigate('/for-me/notes')} style={activeCardStyle}>
          <div style={{ fontSize: '40px', marginBottom: '15px' }}>📝</div>
          <h3 style={{ margin: 0, color: '#007bff' }}>Notes</h3>
          <p style={{ fontSize: '12px', color: '#555', marginTop: '10px' }}>Gânduri și însemnări rapide</p>
        </div>

        {/* Opțiuni dezactivate */}
        <div style={disabledCardStyle} title="În curând">
          <div style={{ fontSize: '40px', marginBottom: '15px', filter: 'grayscale(100%)' }}>⏰</div>
          <h3 style={{ margin: 0, color: '#777' }}>Reminders</h3>
          <p style={{ fontSize: '12px', color: '#999', marginTop: '10px', fontStyle: 'italic' }}>Coming soon...</p>
        </div>

        <div style={disabledCardStyle} title="În curând">
          <div style={{ fontSize: '40px', marginBottom: '15px', filter: 'grayscale(100%)' }}>🎯</div>
          <h3 style={{ margin: 0, color: '#777' }}>Milestones & Goals</h3>
          <p style={{ fontSize: '12px', color: '#999', marginTop: '10px', fontStyle: 'italic' }}>Coming soon...</p>
        </div>

        <div style={disabledCardStyle} title="În curând">
          <div style={{ fontSize: '40px', marginBottom: '15px', filter: 'grayscale(100%)' }}>📁</div>
          <h3 style={{ margin: 0, color: '#777' }}>Secure Vault</h3>
          <p style={{ fontSize: '12px', color: '#999', marginTop: '10px', fontStyle: 'italic' }}>Coming soon...</p>
        </div>

        <div style={disabledCardStyle} title="În curând">
          <div style={{ fontSize: '40px', marginBottom: '15px', filter: 'grayscale(100%)' }}>🖼️</div>
          <h3 style={{ margin: 0, color: '#777' }}>Vision Board</h3>
          <p style={{ fontSize: '12px', color: '#999', marginTop: '10px', fontStyle: 'italic' }}>Coming soon...</p>
        </div>

        <div style={disabledCardStyle} title="În curând">
          <div style={{ fontSize: '40px', marginBottom: '15px', filter: 'grayscale(100%)' }}>💭</div>
          <h3 style={{ margin: 0, color: '#777' }}>Brain Dump</h3>
          <p style={{ fontSize: '12px', color: '#999', marginTop: '10px', fontStyle: 'italic' }}>Coming soon...</p>
        </div>

        <div style={disabledCardStyle} title="În curând">
          <div style={{ fontSize: '40px', marginBottom: '15px', filter: 'grayscale(100%)' }}>✉️</div>
          <h3 style={{ margin: 0, color: '#777' }}>Future Letters</h3>
          <p style={{ fontSize: '12px', color: '#999', marginTop: '10px', fontStyle: 'italic' }}>Coming soon...</p>
        </div>

      </div>
    </div>
  );
}

export default ForMeDashboard;