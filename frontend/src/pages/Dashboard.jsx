function Dashboard({ setCurrentView }) {
  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1000px', margin: '0 auto', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '2.5rem', margin: 0 }}>Project IS Dashboard</h1>
        <button onClick={() => setCurrentView('login')} style={{ padding: '8px 15px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Logout</button>
      </div>
      
      <p style={{ color: '#666', marginBottom: '40px' }}>Select an application from the menu:</p>
      
      <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', flexWrap: 'wrap' }}>
        <div onClick={() => setCurrentView('admin')} style={{ backgroundColor: '#f8f9fa', border: '2px solid #007bff', borderRadius: '15px', padding: '30px', width: '200px', cursor: 'pointer', transition: '0.2s', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '40px', marginBottom: '15px' }}>⚙️</div>
          <h3 style={{ margin: 0, color: '#007bff' }}>Admin Panel</h3>
          <p style={{ fontSize: '12px', color: '#555', marginTop: '10px' }}>Manage users</p>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;