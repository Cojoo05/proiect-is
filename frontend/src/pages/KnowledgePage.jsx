import { useState, useEffect, useRef, useMemo } from 'react';
import { API_BASE_URL } from '../config';

// Extract YouTube ID from text or link
function extractYouTubeId(text) {
  if (!text) return null;
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{11})/,
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/,
    /^([\w-]{11})$/
  ];
  for (const regex of patterns) {
    const match = text.match(regex);
    if (match && match[1]) return match[1];
  }
  return null;
}

function getFileMeta(fileName, fileType) {
  const name = (fileName || '').toLowerCase();
  if (name.endsWith('.doc') || name.endsWith('.docx') || (fileType && fileType.includes('word'))) {
    return { icon: '📄', label: 'Word', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' };
  }
  if (name.endsWith('.xls') || name.endsWith('.xlsx') || (fileType && (fileType.includes('excel') || fileType.includes('spreadsheet')))) {
    return { icon: '📊', label: 'Excel', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' };
  }
  if (name.endsWith('.pdf') || (fileType && fileType.includes('pdf'))) {
    return { icon: '📑', label: 'PDF', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' };
  }
  if (name.endsWith('.ppt') || name.endsWith('.pptx')) {
    return { icon: '📊', label: 'PowerPoint', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' };
  }
  return { icon: '📁', label: 'Document', color: '#475569', bg: '#f8fafc', border: '#e2e8f0' };
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function KnowledgePage({ currentUser }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'DRIVE' | 'NOTE'
  const [search, setSearch] = useState('');

  // Modals
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);
  const [lightboxImg, setLightboxImg] = useState(null);

  // Note Form
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteImages, setNoteImages] = useState([]);
  const [noteSaving, setNoteSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Drive Form
  const [driveTitle, setDriveTitle] = useState('');
  const [driveFile, setDriveFile] = useState(null); // { name, type, size, base64 }
  const [driveSaving, setDriveSaving] = useState(false);

  const fileInputRef = useRef(null);
  const addMenuRef = useRef(null);

  const API = `${API_BASE_URL}/api/knowledge`;

  // Fetch all items
  const fetchItems = () => {
    setLoading(true);
    const userIdParam = currentUser?.id ? `?userId=${currentUser.id}` : '';
    fetch(`${API}${userIdParam}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setItems(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Eroare la încărcarea Knowledge:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchItems();
  }, [currentUser?.id]);

  // Click outside add menu
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target)) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Live detected YouTube ID from note content
  const detectedYouTubeId = useMemo(() => {
    return extractYouTubeId(noteContent);
  }, [noteContent]);

  // Handle image upload for note
  const handleNoteImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        setNoteImages(prev => [...prev, ev.target.result]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeNoteImage = (index) => {
    setNoteImages(prev => prev.filter((_, idx) => idx !== index));
  };

  // Submit Note (Create or Edit)
  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!noteTitle.trim()) return;

    setNoteSaving(true);
    try {
      const ytId = extractYouTubeId(noteContent);
      const payload = {
        title: noteTitle.trim(),
        content: noteContent.trim(),
        itemType: 'NOTE',
        youtubeUrl: ytId ? `https://www.youtube.com/watch?v=${ytId}` : null,
        imagesJson: noteImages.length > 0 ? JSON.stringify(noteImages) : null,
        creatorId: currentUser?.id,
        category: 'Notițe'
      };

      const url = editingId ? `${API}/${editingId}?userId=${currentUser?.id}` : API;
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsNoteModalOpen(false);
        setNoteTitle('');
        setNoteContent('');
        setNoteImages([]);
        setEditingId(null);
        fetchItems();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Eroare la salvarea notiței!');
      }
    } catch (err) {
      console.error(err);
      alert('Eroare de conexiune!');
    } finally {
      setNoteSaving(false);
    }
  };

  // Handle Drive File Select
  const handleDriveFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64Data = ev.target.result.split(',')[1] || '';
      setDriveFile({
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        base64: base64Data
      });
      if (!driveTitle) {
        setDriveTitle(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  // Submit Drive File
  const handleSaveDrive = async (e) => {
    e.preventDefault();
    if (!driveFile || !driveTitle.trim()) return;

    setDriveSaving(true);
    try {
      const payload = {
        title: driveTitle.trim(),
        content: `Document Drive: ${driveFile.name}`,
        itemType: 'DRIVE',
        fileName: driveFile.name,
        fileType: driveFile.type,
        fileSize: driveFile.size,
        fileData: driveFile.base64,
        creatorId: currentUser?.id,
        category: 'Drive'
      };

      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsDriveModalOpen(false);
        setDriveTitle('');
        setDriveFile(null);
        fetchItems();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Eroare la încărcarea fișierului!');
      }
    } catch (err) {
      console.error(err);
      alert('Eroare de conexiune la încărcarea fișierului!');
    } finally {
      setDriveSaving(false);
    }
  };

  // Direct download
  const handleDownload = (item) => {
    if (item.fileData) {
      const byteCharacters = atob(item.fileData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: item.fileType || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.fileName || item.title || 'document';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      window.open(`${API}/${item.id}/download`, '_blank');
    }
  };

  // Delete item
  const handleDelete = async (item, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Ești sigur că vrei să ștergi "${item.title}"?`)) return;

    try {
      const res = await fetch(`${API}/${item.id}?userId=${currentUser?.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        if (viewingItem?.id === item.id) setViewingItem(null);
        setItems(prev => prev.filter(i => i.id !== item.id));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Nu ai permisiunea de a șterge.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Open Edit Note
  const handleEditNote = (note) => {
    setEditingId(note.id);
    setNoteTitle(note.title || '');
    setNoteContent(note.content || '');
    let imgs = [];
    try {
      imgs = note.imagesJson ? JSON.parse(note.imagesJson) : [];
    } catch (_) {}
    setNoteImages(imgs);
    setIsNoteModalOpen(true);
  };

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter(it => {
      const isDrive = it.itemType === 'DRIVE';
      if (activeTab === 'DRIVE' && !isDrive) return false;
      if (activeTab === 'NOTE' && isDrive) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = it.title?.toLowerCase().includes(q);
        const matchesContent = it.content?.toLowerCase().includes(q);
        const matchesFile = it.fileName?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesContent && !matchesFile) return false;
      }
      return true;
    });
  }, [items, activeTab, search]);

  const counts = useMemo(() => {
    return {
      all: items.length,
      drive: items.filter(i => i.itemType === 'DRIVE').length,
      note: items.filter(i => i.itemType !== 'DRIVE').length
    };
  }, [items]);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px', fontFamily: 'sans-serif', textAlign: 'left' }}>
      
      {/* ── Top Header Bar ─────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', color: '#1e293b', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🧠</span> Knowledge App
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>
            Documente Drive (Word, Excel) și notițe bogate cu suport YouTube și poze.
          </p>
        </div>

        {/* ➕ Adaugă Menu */}
        <div ref={addMenuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowAddMenu(prev => !prev)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              backgroundColor: '#5a3d5c',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(90, 61, 92, 0.3)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#472f49')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#5a3d5c')}
          >
            <span>➕</span>
            <span>Adaugă</span>
            <span style={{ fontSize: '11px' }}>▼</span>
          </button>

          {showAddMenu && (
            <div
              style={{
                position: 'absolute',
                top: '110%',
                right: 0,
                width: '240px',
                backgroundColor: '#ffffff',
                borderRadius: '10px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                border: '1px solid #e2e8f0',
                zIndex: 100,
                padding: '6px 0',
                animation: 'fadeIn 0.15s ease',
              }}
            >
              <button
                onClick={() => {
                  setShowAddMenu(false);
                  setIsDriveModalOpen(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '10px 16px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#1e293b',
                  transition: 'background-color 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <span style={{ fontSize: '18px' }}>📁</span>
                <div>
                  <div>Încarcă fișier Drive</div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '400' }}>Word, Excel, PDF etc.</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowAddMenu(false);
                  setEditingId(null);
                  setNoteTitle('');
                  setNoteContent('');
                  setNoteImages([]);
                  setIsNoteModalOpen(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '10px 16px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#1e293b',
                  transition: 'background-color 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <span style={{ fontSize: '18px' }}>📝</span>
                <div>
                  <div>Creează Notiță</div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '400' }}>Text, YouTube & poze</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Filters & Search Bar ───────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          marginBottom: '24px',
          backgroundColor: '#ffffff',
          padding: '12px 18px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { key: 'ALL', label: `Toate (${counts.all})` },
            { key: 'DRIVE', label: `📁 Drive (${counts.drive})` },
            { key: 'NOTE', label: `📝 Notițe (${counts.note})` },
          ].map(tab => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: active ? '#5a3d5c' : 'transparent',
                  backgroundColor: active ? '#f3e8ff' : '#f8fafc',
                  color: active ? '#5a3d5c' : '#64748b',
                  fontSize: '13px',
                  fontWeight: active ? '700' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div style={{ minWidth: '240px', flex: '1 1 240px', maxWidth: '380px' }}>
          <input
            type="text"
            placeholder="🔍 Caută documente, notițe..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* ── Grid of Items ─────────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>Se încarcă resursele...</div>
      ) : filteredItems.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '2px dashed #cbd5e1',
            color: '#64748b',
          }}
        >
          <div style={{ fontSize: '36px', marginBottom: '10px' }}>📂</div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>Nicio resursă găsită</div>
          <p style={{ margin: '6px 0 0', fontSize: '13px' }}>
            {items.length === 0
              ? 'Folosește butonul „➕ Adaugă” pentru a încărca fișiere Drive sau a crea prima notiță!'
              : 'Niciun element nu se potrivește căutării sau filtrului ales.'}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '16px',
          }}
        >
          {filteredItems.map(item => {
            const isDrive = item.itemType === 'DRIVE';
            const meta = isDrive ? getFileMeta(item.fileName, item.fileType) : null;
            const ytId = !isDrive ? extractYouTubeId(item.content || item.youtubeUrl) : null;

            let imgs = [];
            if (!isDrive && item.imagesJson) {
              try { imgs = JSON.parse(item.imagesJson); } catch (_) {}
            }

            return (
              <div
                key={item.id}
                onClick={() => setViewingItem(item)}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                }}
              >
                <div>
                  {/* Top Badge & Delete Button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    {isDrive ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '700',
                          backgroundColor: meta.bg,
                          color: meta.color,
                          border: `1px solid ${meta.border}`,
                        }}
                      >
                        <span>{meta.icon}</span>
                        <span>{meta.label}</span>
                      </span>
                    ) : (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '700',
                          backgroundColor: '#f3e8ff',
                          color: '#6b21a8',
                          border: '1px solid #e9d5ff',
                        }}
                      >
                        <span>📝</span>
                        <span>Notiță</span>
                      </span>
                    )}

                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={(e) => handleDelete(item, e)}
                        title="Șterge"
                        style={{
                          border: 'none',
                          backgroundColor: 'transparent',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '4px',
                          fontSize: '14px',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Title */}
                  <h3
                    style={{
                      margin: '0 0 8px 0',
                      fontSize: '1.05rem',
                      fontWeight: '700',
                      color: '#1e293b',
                      wordBreak: 'break-word',
                      lineHeight: 1.3,
                    }}
                  >
                    {item.title}
                  </h3>

                  {/* Content snippet / file info */}
                  {isDrive ? (
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px' }}>
                      <div style={{ fontWeight: '600', color: '#334155', wordBreak: 'break-all' }}>
                        📄 {item.fileName}
                      </div>
                      <div style={{ marginTop: '4px' }}>
                        Mărime: <strong>{formatBytes(item.fileSize)}</strong>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        fontSize: '13px',
                        color: '#64748b',
                        marginBottom: '14px',
                        maxHeight: '60px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        lineHeight: 1.4,
                      }}
                    >
                      {item.content || 'Fără conținut text'}
                    </div>
                  )}

                  {/* Badges for YouTube / Images in Note */}
                  {!isDrive && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                      {ytId && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: '600',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            backgroundColor: '#fee2e2',
                            color: '#dc2626',
                            border: '1px solid #fca5a5',
                          }}
                        >
                          🎬 Video YouTube
                        </span>
                      )}
                      {imgs.length > 0 && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: '600',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            backgroundColor: '#e0f2fe',
                            color: '#0284c7',
                            border: '1px solid #bae6fd',
                          }}
                        >
                          📷 {imgs.length} {imgs.length === 1 ? 'poză' : 'poze'}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Info / Action */}
                <div
                  style={{
                    borderTop: '1px solid #f1f5f9',
                    paddingTop: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '11px',
                    color: '#94a3b8',
                  }}
                >
                  <span>👤 {item.creator?.username || 'User'}</span>

                  {isDrive ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(item);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        backgroundColor: '#f1f5f9',
                        color: '#334155',
                        border: '1px solid #cbd5e1',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.12s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.backgroundColor = '#e2e8f0';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.backgroundColor = '#f1f5f9';
                      }}
                    >
                      <span>⬇️</span> Descarcă
                    </button>
                  ) : (
                    <span style={{ fontWeight: '600', color: '#6b21a8' }}>Deschide ➔</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── View / Read Note Modal ─────────────────────────────────── */}
      {viewingItem && viewingItem.itemType !== 'DRIVE' && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px',
              boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
              textAlign: 'left',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '700',
                    backgroundColor: '#f3e8ff',
                    color: '#6b21a8',
                    marginBottom: '8px',
                  }}
                >
                  📝 Notiță
                </span>
                <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: '800', color: '#1e293b' }}>
                  {viewingItem.title}
                </h2>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                  Autor: <strong>{viewingItem.creator?.username || 'Utilizator'}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    const it = viewingItem;
                    setViewingItem(null);
                    handleEditNote(it);
                  }}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#f1f5f9',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  ✏️ Editează
                </button>
                <button
                  onClick={() => setViewingItem(null)}
                  style={{
                    border: 'none',
                    backgroundColor: 'transparent',
                    fontSize: '20px',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '0 6px',
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Note Content */}
            <div
              style={{
                fontSize: '14px',
                color: '#334155',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                marginBottom: '20px',
              }}
            >
              {viewingItem.content || 'Fără conținut'}
            </div>

            {/* Embedded YouTube Player if detected */}
            {(() => {
              const ytId = extractYouTubeId(viewingItem.content || viewingItem.youtubeUrl);
              if (!ytId) return null;
              return (
                <div style={{ marginBottom: '22px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#dc2626', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🎬</span> Videoclip YouTube atașat (Play direct)
                  </div>
                  <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    <iframe
                      src={`https://www.youtube.com/embed/${ytId}`}
                      title="YouTube video player"
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              );
            })()}

            {/* Images Gallery */}
            {(() => {
              let imgs = [];
              try {
                imgs = viewingItem.imagesJson ? JSON.parse(viewingItem.imagesJson) : [];
              } catch (_) {}
              if (!imgs || imgs.length === 0) return null;

              return (
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>
                    📷 Poze atașate ({imgs.length})
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                    {imgs.map((img, i) => (
                      <div
                        key={i}
                        onClick={() => setLightboxImg(img)}
                        style={{
                          height: '110px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          border: '1px solid #e2e8f0',
                          cursor: 'pointer',
                          backgroundColor: '#f1f5f9',
                        }}
                      >
                        <img
                          src={img}
                          alt="Notiță"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button
                onClick={() => setViewingItem(null)}
                style={{
                  padding: '9px 20px',
                  backgroundColor: '#5a3d5c',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Închide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit Note Modal (Simple Menu) ────────────────── */}
      {isNoteModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '26px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b', fontWeight: '800' }}>
                {editingId ? '✏️ Editează Notița' : '📝 Notiță Nouă'}
              </h3>
              <button
                onClick={() => setIsNoteModalOpen(false)}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: '18px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNote}>
              {/* Titlu */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Titlu Notiță *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="ex: Notițe ședință, idei proiect..."
                  value={noteTitle}
                  onChange={e => setNoteTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Conținut */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Conținut (lipește link YouTube direct în text)
                </label>
                <textarea
                  rows={5}
                  placeholder="Scrie notița aici... (dacă lipești un link YouTube va fi afișat automat videoclipul)"
                  value={noteContent}
                  onChange={e => setNoteContent(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    lineHeight: 1.5,
                  }}
                />
              </div>

              {/* YouTube Live Detection Preview */}
              {detectedYouTubeId && (
                <div
                  style={{
                    marginBottom: '16px',
                    padding: '12px 14px',
                    backgroundColor: '#fef2f2',
                    borderRadius: '8px',
                    border: '1px solid #fecaca',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#dc2626', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🎬</span> Videoclip YouTube detectat automat:
                  </div>
                  <div style={{ position: 'relative', paddingBottom: '45%', height: 0, overflow: 'hidden', borderRadius: '8px' }}>
                    <iframe
                      src={`https://www.youtube.com/embed/${detectedYouTubeId}`}
                      title="YouTube Preview"
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                      allowFullScreen
                    />
                  </div>
                </div>
              )}

              {/* Images Preview & Upload */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>
                    📷 Poze atașate ({noteImages.length})
                  </label>
                  <label
                    style={{
                      padding: '5px 12px',
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    + Adaugă poze
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleNoteImageSelect}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>

                {noteImages.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {noteImages.map((img, i) => (
                      <div key={i} style={{ position: 'relative', width: '70px', height: '70px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                        <img src={img} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button
                          type="button"
                          onClick={() => removeNoteImage(i)}
                          style={{
                            position: 'absolute',
                            top: '2px',
                            right: '2px',
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '50%',
                            width: '18px',
                            height: '18px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsNoteModalOpen(false)}
                  style={{
                    padding: '9px 16px',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  disabled={noteSaving}
                  style={{
                    padding: '9px 20px',
                    backgroundColor: '#5a3d5c',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: noteSaving ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 4px rgba(90, 61, 92, 0.25)',
                  }}
                >
                  {noteSaving ? 'Se salvează...' : 'Salvează Notița'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Upload Drive File Modal ─────────────────────────────────── */}
      {isDriveModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '500px',
              padding: '26px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b', fontWeight: '800' }}>
                📁 Încarcă fișier Drive (Word, Excel)
              </h3>
              <button
                onClick={() => setIsDriveModalOpen(false)}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: '18px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDrive}>
              {/* File Select */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
                  Selectează documentul de pe disc *
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed #cbd5e1',
                    borderRadius: '8px',
                    padding: '24px 16px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    backgroundColor: driveFile ? '#f0fdf4' : '#f8fafc',
                    borderColor: driveFile ? '#86efac' : '#cbd5e1',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,.txt"
                    onChange={handleDriveFileSelect}
                    style={{ display: 'none' }}
                  />
                  {driveFile ? (
                    <div>
                      <div style={{ fontSize: '28px', marginBottom: '4px' }}>
                        {getFileMeta(driveFile.name, driveFile.type).icon}
                      </div>
                      <div style={{ fontWeight: '700', color: '#166534', fontSize: '14px', wordBreak: 'break-all' }}>
                        {driveFile.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#4ade80', marginTop: '2px' }}>
                        {formatBytes(driveFile.size)} · Click pentru a alege alt fișier
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '32px', marginBottom: '6px' }}>📤</div>
                      <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '13px' }}>
                        Click pentru a alege fișierul
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                        Word (.docx, .doc), Excel (.xlsx, .xls), PDF etc.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Titlu Document */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Titlu afișat în platformă *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Raport Financiar T4, Caiet de sarcini..."
                  value={driveTitle}
                  onChange={e => setDriveTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsDriveModalOpen(false)}
                  style={{
                    padding: '9px 16px',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  disabled={driveSaving || !driveFile}
                  style={{
                    padding: '9px 20px',
                    backgroundColor: '#5a3d5c',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: driveSaving || !driveFile ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 4px rgba(90, 61, 92, 0.25)',
                    opacity: driveFile ? 1 : 0.6,
                  }}
                >
                  {driveSaving ? 'Se încarcă...' : 'Încarcă în Drive'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Image Lightbox ─────────────────────────────────────────── */}
      {lightboxImg && (
        <div
          onClick={() => setLightboxImg(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
            cursor: 'zoom-out',
          }}
        >
          <img
            src={lightboxImg}
            alt="Enlarged"
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '8px', objectFit: 'contain' }}
          />
        </div>
      )}

    </div>
  );
}
