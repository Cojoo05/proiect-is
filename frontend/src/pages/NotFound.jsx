import { useNavigate } from 'react-router-dom';

function NotFound() {
  const navigate = useNavigate();

  return (
    <div
      className="page-container"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}
    >
      <div style={{ fontSize: '56px', marginBottom: '12px' }} aria-hidden="true">🧭</div>
      <h1 className="page-title">Pagina nu există</h1>
      <p className="page-subtitle" style={{ marginBottom: '24px' }}>
        Linkul pe care ai accesat-o nu duce nicăieri.
      </p>
      <button type="button" className="btn btn--primary" onClick={() => navigate('/dashboard')}>
        Înapoi la Dashboard
      </button>
    </div>
  );
}

export default NotFound;
