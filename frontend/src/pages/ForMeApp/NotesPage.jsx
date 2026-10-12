import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function NotesPage({ currentUser }) {
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);

  const getFormattedDate = () => {
    const now = new Date();
    return now.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' }) + ', ' + 
           now.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  };

  const handleCreateNote = () => {
    const newNote = {
      id: Date.now(),
      title: 'Notă Nouă',
      content: '',
      creationDate: getFormattedDate(),
      lastModified: getFormattedDate(),
      isPinned: false
    };
    setNotes([newNote, ...notes]);
    setSelectedNote(newNote);
  };

  const handleDeleteNote = (id, e) => {
    e.stopPropagation();
    setNotes(notes.filter(n => n.id !== id));
    if (selectedNote?.id === id) setSelectedNote(null);
    setMenuOpenId(null);
  };

  const handleTogglePin = (id, e) => {
    e.stopPropagation();
    setNotes(notes.map(n => n.id === id ? { ...n, isPinned: !n.isPinned } : n));
    setMenuOpenId(null);
  };

  const handleContentChange = (e) => {
    const updatedContent = e.target.value;
    const lines = updatedContent.split('\n');
    const newTitle = lines[0].trim() || 'Notă Fără Titlu';

    const updatedNote = {
      ...selectedNote,
      title: newTitle,
      content: updatedContent,
      lastModified: getFormattedDate()
    };

    setSelectedNote(updatedNote);
    setNotes(notes.map(n => n.id === updatedNote.id ? updatedNote : n));
  };

  const sortedNotes = [...notes].sort((a, b) => b.isPinned - a.isPinned);

  return (
    <div style={{ padding: '30px', fontFamily: 'sans-serif', maxWidth: '1100px', margin: '0 auto' }} onClick={() => setMenuOpenId(null)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <button onClick={() => navigate('/for-me')} style={{ padding: '8px 15px', cursor: 'pointer', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '5px' }}>
          ⬅️ Back to For Me
        </button>
        <h1 style={{ margin: 0, color: '#333', fontSize: '2rem' }}>📝 Notes</h1>
        <div style={{ width: '100px' }}></div>
      </div>

      {selectedNote ? (
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <span style={{ fontSize: '12px', color: '#888' }}>Creată la: {selectedNote.creationDate} | Ultima modificare: {selectedNote.lastModified}</span>
            <button onClick={() => setSelectedNote(null)} style={{ padding: '6px 12px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              📁 Înapoi la Listă
            </button>
          </div>
          <textarea
            value={selectedNote.content}
            onChange={handleContentChange}
            placeholder="Scrie tot ce ai pe gânduri aici... (Prima linie devine titlul)"
            style={{ width: '100%', height: '400px', padding: '15px', fontSize: '16px', borderRadius: '6px', border: '1px solid #ccc', resize: 'vertical', fontFamily: 'sans-serif' }}
          />
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f8f9fa', padding: '12px 20px', borderRadius: '8px 8px 0 0', border: '1px solid #ddd', borderBottom: 'none' }}>
            <button 
              onClick={handleCreateNote} 
              style={{ backgroundColor: '#5a3d5c', color: 'white', border: 'none', padding: '8px 18px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
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
                <th style={{ padding: '12px 15px', textAlign: 'center', color: '#495057', width: '100px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedNotes.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#888' }}>
                    Nu ai nicio notiță creată. Apasă pe <strong>NEW</strong> pentru a începe!
                  </td>
                </tr>
              ) : (
                sortedNotes.map(note => (
                  <tr 
                    key={note.id} 
                    onClick={() => setSelectedNote(note)}
                    style={{ borderBottom: '1px solid #eee', cursor: 'pointer', backgroundColor: note.isPinned ? '#fff9db' : 'white', transition: 'background 0.2s' }}
                  >
                    <td style={{ padding: '12px 15px', fontWeight: '500', color: '#212529' }}>
                      {note.isPinned ? '📌 ' : ''}{note.title}
                    </td>
                    <td style={{ padding: '12px 15px', color: '#6c757d', fontSize: '14px' }}>{note.lastModified}</td>
                    <td style={{ padding: '12px 15px', color: '#6c757d', fontSize: '14px' }}>{note.creationDate}</td>
                    
                    <td style={{ padding: '12px 15px', textAlign: 'center', position: 'relative' }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === note.id ? null : note.id); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', color: '#6c757d', padding: '0 10px' }}
                      >
                        ⋮
                      </button>

                      {menuOpenId === note.id && (
                        <div style={{ position: 'absolute', right: '10px', top: '40px', backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 100, textAlign: 'left', minWidth: '100px', overflow: 'hidden' }}>
                          <button 
                            onClick={(e) => handleTogglePin(note.id, e)}
                            style={{ display: 'block', width: '100%', padding: '10px 15px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #eee' }}
                          >
                            {note.isPinned ? '📍 Unpin' : '📌 Pin'}
                          </button>
                          <button 
                            onClick={(e) => handleDeleteNote(note.id, e)}
                            style={{ display: 'block', width: '100%', padding: '10px 15px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: '#dc3545' }}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default NotesPage;