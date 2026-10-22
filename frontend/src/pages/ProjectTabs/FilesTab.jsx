import { useState, useEffect, useRef } from 'react';

function FilesTab({ projectId, currentUser, permissions = {} }) {
  const [gapiLoaded, setGapiLoaded] = useState(false);
  const [gisLoaded, setGisLoaded] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [savedLinks, setSavedLinks] = useState([]);
  const tokenClientRef = useRef(null);

  const canManage = permissions.canManageFiles !== false;

  const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
  const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';
  const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

  // Load saved links from backend
  useEffect(() => {
    fetch(`http://localhost:8080/api/projects/${projectId}/links`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setSavedLinks(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [projectId]);

  // Load Google APIs
  useEffect(() => {
    const loadGapi = () => {
      window.gapi.load('client:picker', async () => {
        await window.gapi.client.init({ apiKey: API_KEY, discoveryDocs: [DISCOVERY_DOC] });
        setGapiLoaded(true);
      });
    };

    if (window.gapi) { loadGapi(); }
    else {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = loadGapi;
      document.body.appendChild(script);
    }

    const initGis = () => {
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (resp) => {
          if (resp.error) return;
          setAccessToken(resp.access_token);
        }
      });
      setGisLoaded(true);
    };

    if (window.google?.accounts) { initGis(); }
    else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = initGis;
      document.body.appendChild(script);
    }
  }, []);

  const handleAuthAndPick = () => {
    if (!CLIENT_ID || !API_KEY) {
      alert('Configurați VITE_GOOGLE_CLIENT_ID și VITE_GOOGLE_API_KEY în fișierul .env');
      return;
    }
    if (accessToken) {
      openPicker(accessToken);
    } else {
      tokenClientRef.current?.requestAccessToken({ prompt: 'consent' });
    }
  };

  useEffect(() => {
    if (accessToken && gapiLoaded) openPicker(accessToken);
  }, [accessToken]);

  const openPicker = (token) => {
    if (!window.google?.picker) return;
    const view = new window.google.picker.DocsView()
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false);

    const picker = new window.google.picker.PickerBuilder()
      .addView(view)
      .addView(new window.google.picker.DocsUploadView())
      .setOAuthToken(token)
      .setDeveloperKey(API_KEY)
      .setCallback((data) => {
        if (data.action === window.google.picker.Action.PICKED) {
          const docs = data[window.google.picker.Response.DOCUMENTS];
          docs.forEach(doc => {
            const link = {
              url: doc[window.google.picker.Document.URL],
              label: doc[window.google.picker.Document.NAME],
              mimeType: doc[window.google.picker.Document.MIME_TYPE]
            };
            // Save to backend
            fetch(`http://localhost:8080/api/projects/${projectId}/links`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...link, addedById: currentUser.id })
            }).then(r => r.ok ? r.json() : null)
              .then(saved => { if (saved) setSavedLinks(prev => [saved, ...prev]); })
              .catch(console.error);
          });
        }
      })
      .build();
    picker.setVisible(true);
  };

  const removeLink = (linkId) => {
    fetch(`http://localhost:8080/api/projects/${projectId}/links/${linkId}`, { method: 'DELETE' })
      .then(r => { if (r.ok) setSavedLinks(prev => prev.filter(l => l.id !== linkId)); })
      .catch(console.error);
  };

  const getFileIcon = (mimeType) => {
    if (!mimeType) return '📄';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️';
    if (mimeType.includes('document') || mimeType.includes('word')) return '📝';
    if (mimeType.includes('pdf')) return '📕';
    if (mimeType.includes('folder')) return '📁';
    if (mimeType.includes('image')) return '🖼️';
    return '📄';
  };

  const isConfigured = CLIENT_ID && API_KEY;

  return (
    <div>
      {!isConfigured && (
        <div style={{ backgroundColor: '#fef9c3', border: '1px solid #fde047', borderRadius: '8px', padding: '14px 18px', marginBottom: '20px' }}>
          <strong>⚠️ Configurare necesară:</strong> Adaugă în <code>frontend/.env</code>:<br />
          <code>VITE_GOOGLE_CLIENT_ID=your_client_id</code><br />
          <code>VITE_GOOGLE_API_KEY=your_api_key</code>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
        {canManage ? (
          <button
            onClick={handleAuthAndPick}
            style={{ padding: '9px 18px', backgroundColor: '#4285f4', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span>☁️</span> Adaugă din Google Drive
          </button>
        ) : (
          <span style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic', alignSelf: 'center' }}>
            ℹ️ Nu ai permisiunea de a adăuga fișiere pe acest proiect
          </span>
        )}
      </div>

      {savedLinks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📁</div>
          <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>Niciun fișier adăugat</div>
          <div style={{ fontSize: '14px' }}>Conectează Google Drive pentru a partaja fișiere cu echipa.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
          {savedLinks.map(link => (
            <div
              key={link.id}
              style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}
            >
              <span style={{ fontSize: '28px', flexShrink: 0 }}>{getFileIcon(link.mimeType)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontWeight: '600', color: '#1e293b', fontSize: '14px', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {link.label}
                </a>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  Adăugat de {link.addedBy?.username || 'N/A'}
                </div>
              </div>
              <button
                onClick={() => removeLink(link.id)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '16px', flexShrink: 0, padding: '0' }}
                title="Șterge"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default FilesTab;
