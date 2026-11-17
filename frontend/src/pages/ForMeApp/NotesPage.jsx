import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { formatShortDateTime } from '../../utils/format.js';
import { colors } from '../../theme.js';
import { API_BASE_URL } from '../../config';

const API_URL = `${API_BASE_URL}/api/notes`;

const isNotePinned = (note) => Boolean(note.isPinned ?? note.pinned);

function NotesPage({ currentUser }) {
  const navigate = useNavigate();
  const toast = useToast();

  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState('idle');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const debounceRef = useRef(null);
  const pendingRef = useRef(null);

  const loadNotes = () => {
    if (!currentUser?.id) return;

    setLoading(true);
    setError('');

    fetch(`${API_URL}/creator/${currentUser.id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Notițele nu au putut fi încărcate.');
        return res.json();
      })
      .then((data) => {
        const normalized = Array.isArray(data)
          ? data.map((note) => ({ ...note, isPinned: isNotePinned(note) }))
          : [];
        setNotes(normalized);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = window.setTimeout(loadNotes, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  const persistNote = (note, onDone) => {
    setSaveState('saving');

    fetch(`${API_URL}/${note.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: note.title,
        text: note.text,
        isPinned: isNotePinned(note),
        pinned: isNotePinned(note)
      })
    })
      .then((res) => {
        if (!res.ok) throw new Error('Notița nu a putut fi salvată.');
        setSaveState('saved');
        window.setTimeout(() => setSaveState('idle'), 1500);
        onDone?.();
      })
      .catch((err) => {
        setSaveState('idle');
        toast.error(err.message);
      });
  };

  const scheduleSave = (note) => {
    pendingRef.current = note;
    setSaveState('saving');

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      pendingRef.current = null;
      persistNote(note);
    }, 600);
  };

  const flushSave = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (pendingRef.current) {
      const note = pendingRef.current;
      pendingRef.current = null;
      persistNote(note);
    }
  };

  const handleCreateNote = () => {
    if (!currentUser?.id) return;

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Notă nouă',
        text: '',
        isPinned: false,
        pinned: false,
        creator: { id: currentUser.id }
      })
    })
      .then((res) => {
        if (!res.ok) throw new Error('Notița nu a putut fi creată.');
        return res.json();
      })
      .then((createdNote) => {
        const normalized = { ...createdNote, isPinned: isNotePinned(createdNote) };
        setNotes((prev) => [normalized, ...prev]);
        setSelectedNote(normalized);
      })
      .catch((err) => toast.error(err.message));
  };

  const handleContentChange = (event) => {
    const updatedText = event.target.value;
    const updatedTitle = updatedText.split('\n')[0].trim() || 'Notă fără titlu';

    const updatedNote = { ...selectedNote, title: updatedTitle, text: updatedText };

    setSelectedNote(updatedNote);
    setNotes((prev) => prev.map((note) => (note.id === updatedNote.id ? updatedNote : note)));
    scheduleSave(updatedNote);
  };

  const handleTogglePin = (note, event) => {
    event.stopPropagation();
    const newPinnedState = !isNotePinned(note);

    fetch(`${API_URL}/${note.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: note.title,
        text: note.text,
        isPinned: newPinnedState,
        pinned: newPinnedState
      })
    })
      .then((res) => {
        if (!res.ok) throw new Error('Fixarea notiței nu a putut fi schimbată.');
        return res.json();
      })
      .then(() => {
        setNotes((prev) =>
          prev
            .map((item) =>
              item.id === note.id ? { ...item, isPinned: newPinnedState, pinned: newPinnedState } : item
            )
            .sort((a, b) => (isNotePinned(b) ? 1 : 0) - (isNotePinned(a) ? 1 : 0))
        );
        if (selectedNote?.id === note.id) {
          setSelectedNote((prev) => ({ ...prev, isPinned: newPinnedState, pinned: newPinnedState }));
        }
        setMenuOpenId(null);
        toast.success(newPinnedState ? 'Notiță fixată sus.' : 'Notiță defixată.');
      })
      .catch((err) => toast.error(err.message));
  };

  const confirmDeleteNote = () => {
    if (!pendingDelete) return;

    setDeleting(true);

    fetch(`${API_URL}/${pendingDelete.id}`, { method: 'DELETE' })
      .then((res) => {
        if (!res.ok) throw new Error('Notița nu a putut fi ștearsă.');
        setNotes((prev) => prev.filter((note) => note.id !== pendingDelete.id));
        if (selectedNote?.id === pendingDelete.id) setSelectedNote(null);
        setPendingDelete(null);
        setMenuOpenId(null);
        toast.success('Notiță ștearsă.');
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setDeleting(false));
  };

  const sortedNotes = [...notes].sort((a, b) => (isNotePinned(b) ? 1 : 0) - (isNotePinned(a) ? 1 : 0));

  return (
    <div className="page-container" onClick={() => setMenuOpenId(null)}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => navigate('/for-me')}
          >
            ⬅️ Înapoi la For Me
          </button>
          <div>
            <h1 className="page-title">📝 Notes</h1>
            <p className="page-subtitle">Notițele tale personale. Salvare automată, prima linie devine titlul.</p>
          </div>
        </div>

        {!selectedNote && (
          <button type="button" className="btn btn--primary" onClick={handleCreateNote}>
            + Notiță nouă
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert--error" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn--secondary btn--sm" onClick={loadNotes}>
            Reîncearcă
          </button>
        </div>
      )}

      {selectedNote ? (
        <div className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '14px',
              flexWrap: 'wrap'
            }}
          >
            <span style={{ fontSize: '12px', color: colors.textMuted }}>
              Creată: {formatShortDateTime(selectedNote.creationDate)} · Modificată:{' '}
              {formatShortDateTime(selectedNote.lastModificationDate)}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span
                aria-live="polite"
                style={{ fontSize: '12px', fontWeight: 600, color: saveState === 'saving' ? '#b45309' : '#047857' }}
              >
                {saveState === 'saving' ? 'Se salvează...' : saveState === 'saved' ? 'Salvat ✓' : ''}
              </span>

              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => {
                  flushSave();
                  setSelectedNote(null);
                  loadNotes();
                }}
              >
                ← Înapoi la listă
              </button>
            </div>
          </div>

          <label className="label" htmlFor="note-content">Conținut notiță</label>
          <textarea
            id="note-content"
            className="textarea"
            value={selectedNote.text || ''}
            onChange={handleContentChange}
            placeholder="Scrie notița aici... (prima linie devine titlul)"
            style={{ height: '420px', fontSize: '15px', lineHeight: 1.6 }}
          />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Titlu</th>
                <th>Ultima modificare</th>
                <th>Creată</th>
                <th style={{ textAlign: 'center', width: '90px' }}>Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: colors.textMuted }}>
                    Se încarcă notițele...
                  </td>
                </tr>
              ) : sortedNotes.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: colors.textMuted }}>
                    Nu ai nicio notiță încă. Apasă pe <strong>+ Notiță nouă</strong> pentru a începe.
                  </td>
                </tr>
              ) : (
                sortedNotes.map((note) => {
                  const pinned = isNotePinned(note);

                  return (
                    <tr
                      key={note.id}
                      onClick={() => setSelectedNote(note)}
                      style={{ cursor: 'pointer', backgroundColor: pinned ? '#fffbeb' : undefined }}
                    >
                      <td style={{ fontWeight: 500, color: '#1e293b' }}>
                        {pinned ? '📌 ' : ''}
                        {note.title}
                      </td>
                      <td style={{ color: colors.textMuted }}>{formatShortDateTime(note.lastModificationDate)}</td>
                      <td style={{ color: colors.textMuted }}>{formatShortDateTime(note.creationDate)}</td>
                      <td style={{ textAlign: 'center', position: 'relative' }}>
                        <button
                          type="button"
                          aria-label={`Acțiuni pentru notița ${note.title}`}
                          aria-expanded={menuOpenId === note.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            setMenuOpenId(menuOpenId === note.id ? null : note.id);
                          }}
                          style={{
                            padding: '2px 10px',
                            background: 'none',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '18px',
                            fontWeight: 700,
                            color: colors.textMuted,
                            cursor: 'pointer'
                          }}
                        >
                          ⋮
                        </button>

                        {menuOpenId === note.id && (
                          <div
                            onClick={(event) => event.stopPropagation()}
                            style={{
                              position: 'absolute',
                              right: '10px',
                              top: '36px',
                              zIndex: 100,
                              minWidth: '120px',
                              overflow: 'hidden',
                              textAlign: 'left',
                              backgroundColor: '#ffffff',
                              border: `1px solid ${colors.border}`,
                              borderRadius: '8px',
                              boxShadow: '0 8px 20px rgba(15, 23, 42, 0.15)'
                            }}
                          >
                            <button
                              type="button"
                              onClick={(event) => handleTogglePin(note, event)}
                              style={{
                                display: 'block',
                                width: '100%',
                                padding: '9px 14px',
                                background: 'none',
                                border: 'none',
                                borderBottom: `1px solid ${colors.border}`,
                                textAlign: 'left',
                                fontSize: '13px',
                                cursor: 'pointer'
                              }}
                            >
                              {pinned ? '📍 Defixează' : '📌 Fixează sus'}
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setPendingDelete(note);
                                setMenuOpenId(null);
                              }}
                              style={{
                                display: 'block',
                                width: '100%',
                                padding: '9px 14px',
                                background: 'none',
                                border: 'none',
                                textAlign: 'left',
                                fontSize: '13px',
                                color: '#b91c1c',
                                cursor: 'pointer'
                              }}
                            >
                              🗑️ Șterge
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Ștergi notița?"
        message={pendingDelete ? `„${pendingDelete.title}" va fi ștearsă definitiv.` : ''}
        confirmLabel="Șterge notița"
        loading={deleting}
        onConfirm={confirmDeleteNote}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

export default NotesPage;
