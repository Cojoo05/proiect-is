import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { formatDateTime } from '../utils/format.js';
import { isAdminUser } from '../theme.js';
import { API_BASE_URL } from '../config';

const API_URL = `${API_BASE_URL}/api/announcements`;

const EMPTY_FORM = { title: '', content: '', pinned: false };

function AnnouncementsPage({ currentUser }) {
  const navigate = useNavigate();
  const toast = useToast();

  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = isAdminUser(currentUser);

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
    const timer = window.setTimeout(loadAnnouncements, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setError('');
  };

  const handleEdit = (announcement) => {
    setForm({
      title: announcement.title || '',
      content: announcement.content || '',
      pinned: Boolean(announcement.pinned)
    });
    setEditingId(announcement.id);
    setShowForm(true);
    setError('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!currentUser?.id) {
      toast.error('Trebuie să fii autentificat pentru a publica anunțuri.');
      return;
    }

    if (!form.title.trim()) {
      setError('Completează titlul anunțului.');
      return;
    }

    const isEdit = editingId !== null;
    const url = isEdit ? `${API_URL}/${editingId}?userId=${currentUser.id}` : API_URL;
    const payload = isEdit
      ? { title: form.title.trim(), content: form.content.trim(), pinned: form.pinned }
      : {
          title: form.title.trim(),
          content: form.content.trim(),
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
        toast.success(isEdit ? 'Anunț actualizat.' : 'Anunț publicat.');
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
      .then(() => {
        loadAnnouncements();
        toast.success(announcement.pinned ? 'Anunț defixat.' : 'Anunț fixat sus.');
      })
      .catch((err) => toast.error(err.message));
  };

  const confirmDelete = () => {
    if (!pendingDelete || !currentUser?.id) return;

    setDeleting(true);

    fetch(`${API_URL}/${pendingDelete.id}?userId=${currentUser.id}`, {
      method: 'DELETE'
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await extractMessage(res));
        setPendingDelete(null);
        loadAnnouncements();
        toast.success('Anunț șters.');
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setDeleting(false));
  };

  const wasEdited = (announcement) =>
    Boolean(announcement.updatedAt) && announcement.updatedAt !== announcement.createdAt;

  return (
    <div className="page-container">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => navigate('/dashboard')}
          >
            ⬅️ Înapoi la Dashboard
          </button>
          <div>
            <h1 className="page-title">📢 Anunțuri</h1>
            <p className="page-subtitle">Anunțurile echipei. Doar administratorii pot publica.</p>
          </div>
        </div>

        {isAdmin && !showForm && (
          <button type="button" className="btn btn--primary" onClick={handleNewAnnouncement}>
            + Anunț nou
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert--error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => setError('')}
            aria-label="Închide mesajul de eroare"
          >
            ✕
          </button>
        </div>
      )}

      {showForm && isAdmin && (
        <form onSubmit={handleSubmit} className="card" style={{ marginBottom: '24px' }} noValidate>
          <h2 style={{ margin: '0 0 16px', fontSize: '1.1rem', color: '#1e293b' }}>
            {editingId !== null ? '✏️ Editează anunțul' : '➕ Anunț nou'}
          </h2>

          <div className="field">
            <label className="label" htmlFor="announcement-title">Titlu</label>
            <input
              id="announcement-title"
              className="input"
              type="text"
              placeholder="Titlul anunțului"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="announcement-content">Conținut</label>
            <textarea
              id="announcement-content"
              className="textarea"
              placeholder="Scrie anunțul..."
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={6}
            />
          </div>

          <label className="checkbox-row" style={{ marginBottom: '18px' }}>
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
            />
            Fixează anunțul sus
          </label>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Se salvează...' : editingId !== null ? 'Salvează modificările' : 'Publică'}
            </button>
            <button type="button" className="btn btn--secondary" onClick={resetForm} disabled={saving}>
              Anulează
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="empty-state">Se încarcă anunțurile...</div>
      ) : announcements.length === 0 ? (
        <div className="empty-state">
          {isAdmin
            ? 'Nu există anunțuri încă. Apasă pe „+ Anunț nou" pentru a publica primul anunț.'
            : 'Nu există anunțuri deocamdată. Administratorii vor publica noutăți aici.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {announcements.map((announcement) => (
            <article
              key={announcement.id}
              className="card"
              style={{ borderLeft: `4px solid ${announcement.pinned ? '#5a3d5c' : '#e2e8f0'}` }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                <div>
                  <h2 style={{ margin: '0 0 6px', fontSize: '1.15rem', color: '#1e293b' }}>
                    {announcement.pinned ? '📌 ' : ''}
                    {announcement.title}
                  </h2>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>
                    <span>
                      {announcement.author?.username || announcement.author?.email || 'Autor necunoscut'}
                    </span>
                    {announcement.createdAt && <span> · {formatDateTime(announcement.createdAt)}</span>}
                    {wasEdited(announcement) && (
                      <span style={{ fontStyle: 'italic' }}>
                        {' '}· editat {formatDateTime(announcement.updatedAt)}
                      </span>
                    )}
                  </div>
                </div>

                {isAdmin && (
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button
                      type="button"
                      className="btn btn--icon btn--sm"
                      onClick={() => handleTogglePin(announcement)}
                      aria-label={announcement.pinned ? 'Anulează fixarea' : 'Fixează anunțul sus'}
                      title={announcement.pinned ? 'Anulează fixarea' : 'Fixează anunțul sus'}
                    >
                      📌
                    </button>
                    <button
                      type="button"
                      className="btn btn--icon btn--sm"
                      onClick={() => handleEdit(announcement)}
                      aria-label="Editează anunțul"
                      title="Editează anunțul"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger btn--sm"
                      onClick={() => setPendingDelete(announcement)}
                      aria-label="Șterge anunțul"
                      title="Șterge anunțul"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>

              {announcement.content && (
                <p style={{ margin: '14px 0 0', color: '#334155', fontSize: '15px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {announcement.content}
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Ștergi anunțul?"
        message={pendingDelete ? `„${pendingDelete.title}" va fi șters definitiv.` : ''}
        confirmLabel="Șterge anunțul"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

export default AnnouncementsPage;
