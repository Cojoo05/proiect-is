import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:8080/api/announcements';

const EMPTY_FORM = { title: '', content: '', pinned: false };

function AnnouncementsPage({ currentUser }) {
  const navigate = useNavigate();

  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const normalizedRole = String(currentUser?.role || '').toUpperCase();
  const isAdmin =
    currentUser?.hasAdminAccess === true ||
    (normalizedRole === 'ADMIN' && normalizedRole !== 'USER');

  const extractMessage = async (res) => {
    try {
      const data = await res.json();
      return data?.message || `Eroare ${res.status}`;
    } catch {
      return `Eroare ${res.status}`;
    }
  };

  const loadAnnouncements = () => {
    setLoading(true);
    setError('');
    fetch(API_URL)
      .then(async (res) => {
        if (!res.ok) throw new Error(await extractMessage(res));
        return res.json();
      })
      .then((data) => setAnnouncements(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message || 'Nu am putut încărca anunțurile.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  };

  const handleNewAnnouncement = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const handleEdit = (announcement) => {
    setForm({
      title: announcement.title || '',
      content: announcement.content || '',
      pinned: Boolean(announcement.pinned)
    });
    setEditingId(announcement.id);
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!currentUser?.id) {
      setError('Trebuie să fii autentificat pentru a publica anunțuri.');
      return;
    }

    const isEdit = editingId !== null;
    const url = isEdit ? `${API_URL}/${editingId}?userId=${currentUser.id}` : API_URL;
    const payload = isEdit
      ? { title: form.title, content: form.content, pinned: form.pinned }
      : {
          title: form.title,
          content: form.content,
          pinned: form.pinned,
          author: { id: currentUser.id }
        };

    setSaving(true);
    setError('');

    fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await extractMessage(res));
        return res.json();
      })
      .then(() => {
        resetForm();
        loadAnnouncements();
      })
      .catch((err) => setError(err.message))
      .finally(() => setSaving(false));
  };

  const handleTogglePin = (announcement) => {
    if (!currentUser?.id) return;

    fetch(`${API_URL}/${announcement.id}?userId=${currentUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: !announcement.pinned })
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await extractMessage(res));
        return res.json();
      })
      .then(() => loadAnnouncements())
      .catch((err) => setError(err.message));
  };

  const handleDelete = (announcement) => {
    if (!currentUser?.id) return;
    if (!window.confirm(`Sigur dorești să ștergi anunțul „${announcement.title}”?`)) return;

    fetch(`${API_URL}/${announcement.id}?userId=${currentUser.id}`, {
      method: 'DELETE'
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await extractMessage(res));
      })
      .then(() => loadAnnouncements())
      .catch((err) => setError(err.message));
  };

  const formatDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return (
      date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' }) +
      ', ' +
      date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
    );
  };

  const wasEdited = (announcement) =>
    Boolean(announcement.updatedAt) && announcement.updatedAt !== announcement.createdAt;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              backgroundColor: '#333',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          >
            ⬅️ Back to Dashboard
          </button>

          {isAdmin && !showForm && (
            <button
              onClick={handleNewAnnouncement}
              style={{
                padding: '10px 20px',
                cursor: 'pointer',
                backgroundColor: '#5a3d5c',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '14px'
              }}
            >
              + Anunț nou
            </button>
          )}
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ margin: '0 0 6px 0', fontSize: '1.9rem', color: '#0f172a', fontWeight: '700' }}>
            📢 Announcements
          </h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '15px' }}>
            Anunțurile echipei. Doar administratorii pot publica.
          </p>
        </div>

        {error && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              padding: '12px 16px',
              borderRadius: '10px',
              marginBottom: '20px',
              fontSize: '14px'
            }}
          >
            <span>{error}</span>
            <button
              onClick={() => setError('')}
              aria-label="Închide mesajul de eroare"
              style={{
                background: 'none',
                border: 'none',
                color: '#b91c1c',
                cursor: 'pointer',
                fontSize: '16px',
                lineHeight: 1,
                padding: 0
              }}
            >
              ✕
            </button>
          </div>
        )}

        {showForm && isAdmin && (
          <form
            onSubmit={handleSubmit}
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '22px',
              marginBottom: '24px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
            }}
          >
            <h2 style={{ margin: '0 0 16px 0', fontSize: '1.15rem', color: '#1e293b' }}>
              {editingId !== null ? '✏️ Editează anunțul' : '➕ Anunț nou'}
            </h2>

            <label style={{ display: 'block', fontSize: '13px', color: '#475569', marginBottom: '6px' }}>
              Titlu
            </label>
            <input
              type="text"
              placeholder="Titlul anunțului"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                marginBottom: '14px',
                boxSizing: 'border-box',
                fontSize: '14px'
              }}
            />

            <label style={{ display: 'block', fontSize: '13px', color: '#475569', marginBottom: '6px' }}>
              Conținut
            </label>
            <textarea
              placeholder="Scrie anunțul..."
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={6}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                marginBottom: '14px',
                boxSizing: 'border-box',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                color: '#334155',
                marginBottom: '18px'
              }}
            >
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
              />
              Fixează anunțul sus (pinned)
            </label>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '10px 20px',
                  backgroundColor: saving ? '#a78ba8' : '#5a3d5c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: saving ? 'default' : 'pointer',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}
              >
                {saving ? 'Se salvează...' : editingId !== null ? 'Salvează modificările' : 'Publică'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Anulează
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '40px',
              textAlign: 'center',
              color: '#64748b'
            }}
          >
            Se încarcă anunțurile...
          </div>
        ) : announcements.length === 0 ? (
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '40px',
              textAlign: 'center',
              color: '#64748b'
            }}
          >
            {isAdmin
              ? 'Nu există anunțuri încă. Apasă pe „+ Anunț nou" pentru a publica primul anunț.'
              : 'Nu există anunțuri deocamdată. Administratorii vor publica noutăți aici.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {announcements.map((announcement) => (
              <article
                key={announcement.id}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderLeft: `4px solid ${announcement.pinned ? '#5a3d5c' : '#e2e8f0'}`,
                  borderRadius: '12px',
                  padding: '22px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                  <div>
                    <h2 style={{ margin: '0 0 6px 0', fontSize: '1.2rem', color: '#1e293b', fontWeight: '600' }}>
                      {announcement.pinned ? '📌 ' : ''}
                      {announcement.title}
                    </h2>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>
                      <span>
                        {announcement.author?.username || announcement.author?.email || 'Autor necunoscut'}
                      </span>
                      {announcement.createdAt && <span> · {formatDate(announcement.createdAt)}</span>}
                      {wasEdited(announcement) && (
                        <span style={{ fontStyle: 'italic' }}> · editat {formatDate(announcement.updatedAt)}</span>
                      )}
                    </div>
                  </div>

                  {isAdmin && (
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button
                        onClick={() => handleTogglePin(announcement)}
                        title={announcement.pinned ? 'Anulează fixarea' : 'Fixează anunțul sus'}
                        style={{
                          padding: '7px 10px',
                          backgroundColor: '#f6eff7',
                          color: '#5a3d5c',
                          border: '1px solid #ebd9eb',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '15px'
                        }}
                      >
                        📌
                      </button>
                      <button
                        onClick={() => handleEdit(announcement)}
                        title="Editează anunțul"
                        style={{
                          padding: '7px 10px',
                          backgroundColor: '#f6eff7',
                          color: '#5a3d5c',
                          border: '1px solid #ebd9eb',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '15px'
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(announcement)}
                        title="Șterge anunțul"
                        style={{
                          padding: '7px 10px',
                          backgroundColor: '#fef2f2',
                          color: '#b91c1c',
                          border: '1px solid #fecaca',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '15px'
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>

                {announcement.content && (
                  <p
                    style={{
                      margin: '14px 0 0 0',
                      color: '#334155',
                      fontSize: '15px',
                      lineHeight: '1.6',
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {announcement.content}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AnnouncementsPage;
