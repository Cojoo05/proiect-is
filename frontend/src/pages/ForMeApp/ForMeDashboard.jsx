import { useNavigate } from 'react-router-dom';

function ForMeDashboard() {
  const navigate = useNavigate();

  const activeCardStyle = {
    backgroundColor: '#fff',
    border: '2px solid #5a3d5c',
    borderRadius: '16px',
    padding: '30px',
    width: '220px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(90, 61, 92, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
  };

  const disabledCardStyle = {
    backgroundColor: '#f8f9fa',
    border: '2px dashed #cbd5e1',
    borderRadius: '16px',
    padding: '30px',
    width: '220px',
    cursor: 'not-allowed',
    opacity: 0.6,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1000px', margin: '0 auto', marginBottom: '20px' }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{ padding: '8px 16px', cursor: 'pointer', backgroundColor: '#334155', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600' }}
        >
          ⬅️ Back to Dashboard
        </button>
        <h1 style={{ fontSize: '2.5rem', margin: 0, color: '#1e293b' }}>🌙 For Me</h1>
        <div style={{ width: '100px' }}></div>
      </div>
      
      <p style={{ color: '#64748b', marginBottom: '40px', fontSize: '15px' }}>
        Spațiul tău personal de organizare, notițe și alerte zilnice:
      </p>
      
      <div style={{ display: 'flex', justifyContent: 'center', gap: '25px', flexWrap: 'wrap', maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Notes */}
        <div
          onClick={() => navigate('/for-me/notes')}
          style={activeCardStyle}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 10px 20px rgba(90, 61, 92, 0.15)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(90, 61, 92, 0.08)'; }}
        >
          <div style={{ fontSize: '42px', marginBottom: '14px' }}>📝</div>
          <h3 style={{ margin: 0, color: '#5a3d5c', fontWeight: '800' }}>Notes</h3>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '8px', textAlign: 'center' }}>Gânduri și însemnări rapide</p>
        </div>

        {/* Reminders - NOW ACTIVE! */}
        <div
          onClick={() => navigate('/for-me/reminders')}
          style={activeCardStyle}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 10px 20px rgba(90, 61, 92, 0.15)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(90, 61, 92, 0.08)'; }}
        >
          <div style={{ fontSize: '42px', marginBottom: '14px' }}>⏰</div>
          <h3 style={{ margin: 0, color: '#5a3d5c', fontWeight: '800' }}>Reminders</h3>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '8px', textAlign: 'center' }}>Alerte, termene și sarcini zilnice</p>
        </div>

        {/* Opțiuni dezactivate (Coming soon) */}
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
