import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function NotesPage({ currentUser }) {
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [loading, setLoading] = useState(true);

  const API_URL = 'http://localhost:8080/api/notes';

  const isNotePinned = (note) => Boolean(note.isPinned ?? note.pinned);

  const fetchNotes = () => {
    if (!currentUser?.id) return;
    setLoading(true);
    fetch(`${API_URL}/creator/${currentUser.id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Eroare la preluarea notițelor');
        return res.json();
      })
      .then((data) => {
        const normalized = Array.isArray(data)
          ? data.map((n) => ({ ...n, isPinned: isNotePinned(n) }))
          : [];
        setNotes(normalized);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchNotes();
  }, [currentUser]);

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' }) + ', ' +
           date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  };

  const handleCreateNote = () => {
    if (!currentUser?.id) return;

    const payload = {
      title: 'Notă Nouă',
      text: '',
      isPinned: false,
      pinned: false,
      creator: { id: currentUser.id }
    };

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then((res) => {
        if (!res.ok) throw new Error('Eroare la crearea notiței');
        return res.json();
      })
      .then((createdNote) => {
        const normalized = { ...createdNote, isPinned: isNotePinned(createdNote) };
        setNotes([normalized, ...notes]);
        setSelectedNote(normalized);
      })
      .catch((err) => alert(err.message));
  };

  const handleContentChange = (e) => {
    const updatedText = e.target.value;
    const lines = updatedText.split('\n');
    const updatedTitle = lines[0].trim() || 'Notă Fără Titlu';

    const updatedNote = {
      ...selectedNote,
      title: updatedTitle,
      text: updatedText
    };

    setSelectedNote(updatedNote);
    setNotes(notes.map((n) => (n.id === updatedNote.id ? updatedNote : n)));

    fetch(`${API_URL}/${updatedNote.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: updatedTitle,
        text: updatedText,
        isPinned: isNotePinned(updatedNote),
        pinned: isNotePinned(updatedNote)
      })
    }).catch((err) => console.error(err));
  };

  const handleTogglePin = (note, e) => {
    e.stopPropagation();
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
        if (!res.ok) throw new Error('Eroare la actualizarea pin-ului');
        return res.json();
      })
      .then(() => {
        setNotes((prevNotes) =>
          prevNotes
            .map((n) => (n.id === note.id ? { ...n, isPinned: newPinnedState, pinned: newPinnedState } : n))
            .sort((a, b) => (isNotePinned(b) ? 1 : 0) - (isNotePinned(a) ? 1 : 0))
        );
        setMenuOpenId(null);
      })
      .catch((err) => alert(err.message));
  };

  const handleDeleteNote = (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Sigur dorești să ștergi această notiță?')) return;

    fetch(`${API_URL}/${id}`, {
      method: 'DELETE'
    })
      .then((res) => {
        if (!res.ok) throw new Error('Eroare la ștergerea notiței');
        setNotes(notes.filter((n) => n.id !== id));
        if (selectedNote?.id === id) setSelectedNote(null);
        setMenuOpenId(null);
      })
      .catch((err) => alert(err.message));
  };

  const sortedNotes = [...notes].sort((a, b) => (isNotePinned(b) ? 1 : 0) - (isNotePinned(a) ? 1 : 0));

  return (
    <div
      style={{ padding: '30px', fontFamily: 'sans-serif', maxWidth: '1100px', margin: '0 auto' }}
      onClick={() => setMenuOpenId(null)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <button
          onClick={() => navigate('/for-me')}
          style={{ padding: '8px 15px', cursor: 'pointer', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          ⬅️ Back to For Me
        </button>
        <h1 style={{ margin: 0, color: '#333', fontSize: '2rem' }}>📝 Notes</h1>
        <div style={{ width: '100px' }}></div>
      </div>

      {selectedNote ? (
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <span style={{ fontSize: '12px', color: '#888' }}>
              Creată: {formatDate(selectedNote.creationDate)} | Ultima modificare: {formatDate(selectedNote.lastModificationDate)}
            </span>
            <button
              onClick={() => {
                setSelectedNote(null);
                fetchNotes();
              }}
              style={{ padding: '6px 14px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              📁 Înapoi la Listă
            </button>
          </div>
          <textarea
            value={selectedNote.text || ''}
            onChange={handleContentChange}
            placeholder="Scrie notița aici... (Prima linie devine titlul)"
            style={{
              width: '100%',
              height: '420px',
              padding: '15px',
              fontSize: '16px',
              borderRadius: '6px',
              border: '1px solid #ccc',
              resize: 'vertical',
              fontFamily: 'sans-serif',
              boxSizing: 'border-box'
            }}
          />
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f8f9fa', padding: '12px 20px', borderRadius: '8px 8px 0 0', border: '1px solid #ddd', borderBottom: 'none' }}>
            <button
              onClick={handleCreateNote}
              style={{ backgroundColor: '#5a3d5c', color: 'white', border: 'none', padding: '8px 18px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              NEW
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '0 0 8px 8px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f3f5', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                <th style={{ padding: '12px 15px', color: '#495057' }}>Title</th>
                <th style={{ padding: '12px 15px', color: '#495057' }}>Last Modified</th>
                <th style={{ padding: '12px 15px', color: '#495057' }}>Creation Date</th>
                <th style={{ padding: '12px 15px', textAlign: 'center', color: '#495057', width: '90px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#666' }}>
                    Se încarcă notițele...
                  </td>
                </tr>
              ) : sortedNotes.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#888' }}>
                    Nu ai nicio notiță salvată. Apasă pe <strong>NEW</strong> pentru a crea una!
                  </td>
                </tr>
              ) : (
                sortedNotes.map((note) => {
                  const pinned = isNotePinned(note);
                  return (
                    <tr
                      key={note.id}
                      onClick={() => setSelectedNote(note)}
                      style={{
                        borderBottom: '1px solid #eee',
                        cursor: 'pointer',
                        backgroundColor: pinned ? '#fff9db' : 'white',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = pinned ? '#fef08a' : '#f8f9fa';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = pinned ? '#fff9db' : 'white';
                      }}
                    >
                      <td style={{ padding: '12px 15px', fontWeight: '500', color: '#212529' }}>
                        {pinned ? '📌 ' : ''}{note.title}
                      </td>
                      <td style={{ padding: '12px 15px', color: '#6c757d', fontSize: '14px' }}>
                        {formatDate(note.lastModificationDate)}
                      </td>
                      <td style={{ padding: '12px 15px', color: '#6c757d', fontSize: '14px' }}>
                        {formatDate(note.creationDate)}
                      </td>
                      <td style={{ padding: '12px 15px', textAlign: 'center', position: 'relative' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(menuOpenId === note.id ? null : note.id);
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', color: '#6c757d', padding: '0 8px' }}
                        >
                          ⋮
                        </button>

                        {menuOpenId === note.id && (
                          <div
                            style={{
                              position: 'absolute',
                              right: '10px',
                              top: '35px',
                              backgroundColor: 'white',
                              border: '1px solid #ccc',
                              borderRadius: '6px',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                              zIndex: 100,
                              textAlign: 'left',
                              minWidth: '105px',
                              overflow: 'hidden'
                            }}
                          >
                            <button
                              onClick={(e) => handleTogglePin(note, e)}
                              style={{ display: 'block', width: '100%', padding: '9px 14px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #eee' }}
                            >
                              {pinned ? '📍 Unpin' : '📌 Pin'}
                            </button>
                            <button
                              onClick={(e) => handleDeleteNote(note.id, e)}
                              style={{ display: 'block', width: '100%', padding: '9px 14px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: '#dc3545' }}
                            >
                              🗑️ Delete
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
    </div>
  );
}

export default NotesPage;