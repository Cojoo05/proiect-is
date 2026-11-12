import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';

// Helper to extract YouTube video ID from various link formats
function extractYouTubeId(url) {
  if (!url) return null;
  const str = url.trim();
  const patterns = [
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/,
    /^([\w-]{11})$/
  ];
  for (const regex of patterns) {
    const match = str.match(regex);
    if (match && match[1]) return match[1];
  }
  return null;
}

export default function KnowledgePage({ currentUser }) {
  const navigate = useNavigate();

  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Toate');

  // Dynamic categories from backend
  const [categories, setCategories] = useState([]);
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [catSaving, setCatSaving] = useState(false);

  // System roles & all users for permission configuration
  const [availableRoles, setAvailableRoles] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [canCreateKnowledge, setCanCreateKnowledge] = useState(true);

  // Modal create / edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('General');
  const [formContent, setFormContent] = useState('');
  const [formYoutubeUrl, setFormYoutubeUrl] = useState('');
  const [formImages, setFormImages] = useState([]);
  const [formIsPinned, setFormIsPinned] = useState(false);

  // Permissions state in modal
  const [formViewOption, setFormViewOption] = useState('ALL'); // 'ALL' or 'CUSTOM'
  const [formSelectedViewRoles, setFormSelectedViewRoles] = useState([]);
  const [formSelectedViewUserIds, setFormSelectedViewUserIds] = useState([]);

  const [formEditOption, setFormEditOption] = useState('CREATOR_ADMIN'); // 'CREATOR_ADMIN' or 'CUSTOM'
  const [formSelectedEditRoles, setFormSelectedEditRoles] = useState([]);
  const [formSelectedEditUserIds, setFormSelectedEditUserIds] = useState([]);

  const [userSearchFilter, setUserSearchFilter] = useState('');
  const [saving, setSaving] = useState(false);

  // Lightbox for enlarged image
  const [lightboxImage, setLightboxImage] = useState(null);

  const fileInputRef = useRef(null);

  const API = `${API_BASE_URL}/api/knowledge`;

  // ── Determine Admin Status ───────────────────────────────────────────────
  const isUserAdmin = Boolean(
    currentUser?.hasAdminAccess === true ||
    (currentUser?.role && currentUser.role.toUpperCase() === 'ADMIN' && currentUser.role.toUpperCase() !== 'USER')
  );

  // ── Load categories ──────────────────────────────────────────────────────
  const fetchCategories = () => {
    fetch(`${API}/categories`)
      .then(r => (r.ok ? r.json() : []))
      .then(data => {
        setCategories(Array.isArray(data) ? data : []);
      })
      .catch(err => {
        console.error("Eroare la încărcarea categoriilor:", err);
      });
  };

  // ── Load notes and permissions ───────────────────────────────────────────
  const fetchNotes = (selectNoteId = null) => {
    if (!currentUser?.id) return;
    setLoading(true);

    fetch(`${API}?userId=${currentUser.id}`)
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setNotes(list);
        setLoading(false);

        if (selectNoteId) {
          const target = list.find(n => n.id === selectNoteId);
          if (target) setSelectedNote(target);
        } else if (selectedNote) {
          const updated = list.find(n => n.id === selectedNote.id);
          setSelectedNote(updated || (list.length > 0 ? list[0] : null));
        } else if (list.length > 0) {
          setSelectedNote(list[0]);
        }
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  const fetchPermissions = () => {
    if (!currentUser?.id) return;
    fetch(`${API}/permissions?userId=${currentUser.id}`)
      .then(r => (r.ok ? r.json() : {}))
      .then(data => {
        if (data && typeof data.canCreate === 'boolean') {
          setCanCreateKnowledge(data.canCreate);
        }
      })
      .catch(err => console.error(err));
  };

  const fetchRoles = () => {
    fetch(`${API_BASE_URL}/api/system-roles`)
      .then(r => (r.ok ? r.json() : []))
      .then(data => {
        const roleNames = Array.isArray(data) ? data.map(r => r.name).filter(Boolean) : [];
        const merged = Array.from(new Set(['Admin', 'User', ...roleNames]));
        setAvailableRoles(merged);
      })
      .catch(() => setAvailableRoles(['Admin', 'User']));
  };

  const fetchUsers = () => {
    fetch(`${API_BASE_URL}/api/users`)
      .then(r => (r.ok ? r.json() : []))
      .then(data => {
        setAllUsers(Array.isArray(data) ? data : []);
      })
      .catch(() => setAllUsers([]));
  };

  useEffect(() => {
    fetchCategories();
    fetchNotes();
    fetchPermissions();
    fetchRoles();
    fetchUsers();
  }, [currentUser?.id]);

  // ── Category Actions (Admin Only) ────────────────────────────────────────
  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim() || !currentUser?.id) return;

    setCatSaving(true);
    try {
      const res = await fetch(`${API}/categories?userId=${currentUser.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Eroare la adăugarea categoriei!');
      }
      setNewCategoryName('');
      setShowAddCatModal(false);
      fetchCategories();
    } catch (err) {
      alert(err.message);
    } finally {
      setCatSaving(false);
    }
  };

  const handleDeleteCategory = async (cat, e) => {
    e.stopPropagation();
    if (!cat?.id || !currentUser?.id) return;
    if (!window.confirm(`Ești sigur că vrei să ștergi categoria "${cat.name}"?`)) return;

    try {
      const res = await fetch(`${API}/categories/${cat.id}?userId=${currentUser.id}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Eroare la ștergerea categoriei!');
      }
      if (selectedCategory === cat.name) {
        setSelectedCategory('Toate');
      }
      fetchCategories();
    } catch (err) {
      alert(err.message);
    }
  };

  // ── Filtering notes ──────────────────────────────────────────────────────
  const filteredNotes = notes.filter(n => {
    const matchesSearch =
      n.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.category?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'Toate' ||
      n.category?.toLowerCase() === selectedCategory.toLowerCase();

    return matchesSearch && matchesCategory;
  });

  // ── Modal handlers ───────────────────────────────────────────────────────
  const openCreateModal = () => {
    setEditingNote(null);
    setFormTitle('');
    setFormCategory(categories.length > 0 ? categories[0].name : 'General');
    setFormContent('');
    setFormYoutubeUrl('');
    setFormImages([]);
    setFormIsPinned(false);

    setFormViewOption('ALL');
    setFormSelectedViewRoles(['Admin', 'User']);
    setFormSelectedViewUserIds([]);

    setFormEditOption('CREATOR_ADMIN');
    setFormSelectedEditRoles([]);
    setFormSelectedEditUserIds([]);

    setUserSearchFilter('');
    setIsModalOpen(true);
  };

  const openEditModal = (note) => {
    setEditingNote(note);
    setFormTitle(note.title || '');
    setFormCategory(note.category || (categories.length > 0 ? categories[0].name : 'General'));
    setFormContent(note.content || '');
    setFormYoutubeUrl(note.youtubeUrl || '');
    setFormIsPinned(Boolean(note.pinned));

    try {
      const imgs = note.imagesJson ? JSON.parse(note.imagesJson) : [];
      setFormImages(Array.isArray(imgs) ? imgs : []);
    } catch (_) {
      setFormImages([]);
    }

    // View permissions
    const viewRoles = (note.allowedRolesToView && note.allowedRolesToView !== 'ALL')
      ? note.allowedRolesToView.split(',').map(r => r.trim()).filter(Boolean)
      : [];
    const viewUserIds = (note.allowedUserIdsToView || '')
      .split(',')
      .map(id => id.trim())
      .filter(Boolean)
      .map(Number);

    if (viewRoles.length > 0 || viewUserIds.length > 0) {
      setFormViewOption('CUSTOM');
      setFormSelectedViewRoles(viewRoles);
      setFormSelectedViewUserIds(viewUserIds);
    } else {
      setFormViewOption('ALL');
      setFormSelectedViewRoles(['Admin', 'User']);
      setFormSelectedViewUserIds([]);
    }

    // Edit permissions
    const editRoles = (note.allowedRolesToEdit && note.allowedRolesToEdit !== 'ADMIN_CREATOR')
      ? note.allowedRolesToEdit.split(',').map(r => r.trim()).filter(Boolean)
      : [];
    const editUserIds = (note.allowedUserIdsToEdit || '')
      .split(',')
      .map(id => id.trim())
      .filter(Boolean)
      .map(Number);

    if (editRoles.length > 0 || editUserIds.length > 0) {
      setFormEditOption('CUSTOM');
      setFormSelectedEditRoles(editRoles);
      setFormSelectedEditUserIds(editUserIds);
    } else {
      setFormEditOption('CREATOR_ADMIN');
      setFormSelectedEditRoles([]);
      setFormSelectedEditUserIds([]);
    }

    setUserSearchFilter('');
    setIsModalOpen(true);
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target.result;
        setFormImages(prev => [...prev, dataUrl]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeFormImage = (index) => {
    setFormImages(prev => prev.filter((_, i) => i !== index));
  };

  const toggleViewRole = (roleName) => {
    setFormSelectedViewRoles(prev =>
      prev.includes(roleName) ? prev.filter(r => r !== roleName) : [...prev, roleName]
    );
  };

  const toggleViewUser = (userId) => {
    setFormSelectedViewUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const toggleEditRole = (roleName) => {
    setFormSelectedEditRoles(prev =>
      prev.includes(roleName) ? prev.filter(r => r !== roleName) : [...prev, roleName]
    );
  };

  const toggleEditUser = (userId) => {
    setFormSelectedEditUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!formTitle.trim() || !currentUser?.id) return;

    setSaving(true);

    const allowedRolesToView =
      formViewOption === 'ALL'
        ? 'ALL'
        : (formSelectedViewRoles.length > 0 ? formSelectedViewRoles.join(',') : '');

    const allowedUserIdsToView =
      formViewOption === 'ALL'
        ? ''
        : formSelectedViewUserIds.join(',');

    const allowedRolesToEdit =
      formEditOption === 'CREATOR_ADMIN'
        ? 'ADMIN_CREATOR'
        : (formSelectedEditRoles.length > 0 ? formSelectedEditRoles.join(',') : '');

    const allowedUserIdsToEdit =
      formEditOption === 'CREATOR_ADMIN'
        ? ''
        : formSelectedEditUserIds.join(',');

    const payload = {
      title: formTitle.trim(),
      category: formCategory.trim() || 'General',
      content: formContent.trim(),
      youtubeUrl: formYoutubeUrl.trim() || null,
      imagesJson: JSON.stringify(formImages),
      isPinned: formIsPinned,
      allowedRolesToView,
      allowedUserIdsToView,
      allowedRolesToEdit,
      allowedUserIdsToEdit,
      creatorId: currentUser.id,
    };

    try {
      if (editingNote) {
        // Update
        const res = await fetch(`${API}/${editingNote.id}?userId=${currentUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'Eroare la actualizarea notiței');
        }
        const updated = await res.json();
        setIsModalOpen(false);
        fetchNotes(updated.id);
      } else {
        // Create
        const res = await fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'Eroare la salvarea notiței');
        }
        const created = await res.json();
        setIsModalOpen(false);
        fetchNotes(created.id);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!noteId || !currentUser?.id) return;
    if (!window.confirm('Ești sigur că dorești să ștergi această notiță?')) return;

    try {
      const res = await fetch(`${API}/${noteId}?userId=${currentUser.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Eroare la ștergerea notiței');
      }
      setSelectedNote(null);
      fetchNotes();
    } catch (err) {
      alert(err.message);
    }
  };

  // ── Selected Note Helpers & Edit Permissions ──────────────────────────────
  const selectedVideoId = selectedNote ? extractYouTubeId(selectedNote.youtubeUrl) : null;

  let selectedNoteImages = [];
  try {
    if (selectedNote?.imagesJson) {
      const parsed = JSON.parse(selectedNote.imagesJson);
      if (Array.isArray(parsed)) selectedNoteImages = parsed;
    }
  } catch (_) {}

  const isCreator = selectedNote?.creator?.id === currentUser?.id;

  // Check if current user is allowed to edit/delete this note
  const canEditSelectedNote = () => {
    if (!selectedNote || !currentUser) return false;
    if (isUserAdmin || isCreator) return true;

    // Check specific user IDs
    if (selectedNote.allowedUserIdsToEdit) {
      const ids = selectedNote.allowedUserIdsToEdit.split(',').map(s => s.trim());
      if (ids.includes(String(currentUser.id))) return true;
    }

    // Check role
    if (selectedNote.allowedRolesToEdit && selectedNote.allowedRolesToEdit !== 'ADMIN_CREATOR') {
      const roles = selectedNote.allowedRolesToEdit.split(',').map(r => r.trim().toLowerCase());
      const userRole = (currentUser.role || 'User').trim().toLowerCase();
      if (roles.includes(userRole)) return true;
    }

    return false;
  };

  const canEdit = canEditSelectedNote();

  // Filter users list for the permission selector in modal
  const filteredUsers = allUsers.filter(u => {
    if (!userSearchFilter.trim()) return true;
    const q = userSearchFilter.toLowerCase();
    return (u.username && u.username.toLowerCase().includes(q)) ||
           (u.email && u.email.toLowerCase().includes(q)) ||
           (u.role && u.role.toLowerCase().includes(q));
  });

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', backgroundColor: '#f8fafc', fontFamily: 'sans-serif' }}>
      {/* ── Top Header ───────────────────────────────────────────────── */}
      <header
        style={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '14px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '24px' }}>🧠</span>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b', fontWeight: '700' }}>
                Knowledge Base
              </h1>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Bază de cunoștințe, documentație, imagini și materiale video
              </span>
            </div>
          </div>
        </div>

        {(isUserAdmin || canCreateKnowledge) && (
          <button
            onClick={openCreateModal}
            style={{
              padding: '9px 18px',
              backgroundColor: '#5a3d5c',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 6px rgba(90,61,92,0.25)',
            }}
          >
            <span>+</span> Notiță Nouă
          </button>
        )}
      </header>

      {/* ── Main Workspace: 2-Column Master-Detail ───────────────────── */}
      <div style={{ display: 'flex', maxWidth: '1440px', margin: '0 auto', height: 'calc(100vh - 127px)', overflow: 'hidden' }}>

        {/* ── Left Sidebar (Notes List) ───────────────────────────────── */}
        <aside
          style={{
            width: '380px',
            borderRight: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
          }}
        >
          {/* Search & Dynamic Categories Filter */}
          <div style={{ padding: '16px 16px 12px 16px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <input
                type="text"
                placeholder="Caută în Knowledge..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 34px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  backgroundColor: '#f8fafc',
                }}
              />
              <span style={{ position: 'absolute', left: '10px', top: '9px', fontSize: '14px', color: '#94a3b8' }}>
                🔍
              </span>
            </div>

            {/* Category Chips Bar with Admin Add/Delete Capability */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
              <button
                onClick={() => setSelectedCategory('Toate')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '99px',
                  fontSize: '11px',
                  fontWeight: '600',
                  border: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  backgroundColor: selectedCategory === 'Toate' ? '#5a3d5c' : '#f1f5f9',
                  color: selectedCategory === 'Toate' ? '#ffffff' : '#64748b',
                  transition: 'all 0.15s',
                }}
              >
                Toate
              </button>

              {categories.map(cat => {
                const isActive = selectedCategory.toLowerCase() === cat.name.toLowerCase();
                return (
                  <div
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.name)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '99px',
                      fontSize: '11px',
                      fontWeight: '600',
                      border: 'none',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      backgroundColor: isActive ? '#5a3d5c' : '#f1f5f9',
                      color: isActive ? '#ffffff' : '#64748b',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span>{cat.name}</span>
                    {isUserAdmin && (
                      <span
                        onClick={(e) => handleDeleteCategory(cat, e)}
                        title={`Șterge categoria "${cat.name}"`}
                        style={{
                          fontSize: '12px',
                          lineHeight: '1',
                          color: isActive ? '#ffffff' : '#94a3b8',
                          padding: '1px 3px',
                          borderRadius: '50%',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={e => (e.currentTarget.style.color = isActive ? '#ffffff' : '#94a3b8')}
                      >
                        ×
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Admin Button to Add Category */}
              {isUserAdmin && (
                <button
                  onClick={() => setShowAddCatModal(true)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '99px',
                    fontSize: '11px',
                    fontWeight: '700',
                    border: '1px dashed #5a3d5c',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    backgroundColor: '#faf5fb',
                    color: '#5a3d5c',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="Adaugă o nouă categorie (doar Administrator)"
                >
                  <span>+</span> Categorie
                </button>
              )}
            </div>
          </div>

          {/* Notes Cards List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8', fontSize: '13px' }}>
                Se încarcă notițele...
              </div>
            ) : filteredNotes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
                <div style={{ fontSize: '36px', marginBottom: '10px' }}>📖</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#475569' }}>Nicio notiță găsită</div>
                <p style={{ fontSize: '12px', marginTop: '6px' }}>
                  {notes.length === 0
                    ? 'Nu există încă notițe în baza de cunoștințe.'
                    : 'Niciun rezultat nu corespunde căutării sau filtrului selectat.'}
                </p>
                {notes.length === 0 && (isUserAdmin || canCreateKnowledge) && (
                  <button
                    onClick={openCreateModal}
                    style={{
                      marginTop: '8px',
                      padding: '8px 16px',
                      backgroundColor: '#5a3d5c',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                    }}
                  >
                    + Adaugă Notiță
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredNotes.map(n => {
                  const isSelected = selectedNote?.id === n.id;
                  const hasVideo = Boolean(n.youtubeUrl);
                  let hasImgs = false;
                  try {
                    const parsed = n.imagesJson ? JSON.parse(n.imagesJson) : [];
                    hasImgs = Array.isArray(parsed) && parsed.length > 0;
                  } catch (_) {}

                  const isRestrictedView =
                    (n.allowedRolesToView && n.allowedRolesToView !== 'ALL') ||
                    (n.allowedUserIdsToView && n.allowedUserIdsToView.trim().length > 0);

                  return (
                    <div
                      key={n.id}
                      onClick={() => setSelectedNote(n)}
                      style={{
                        padding: '14px',
                        borderRadius: '10px',
                        border: isSelected ? '1.5px solid #5a3d5c' : '1px solid #e2e8f0',
                        backgroundColor: isSelected ? '#faf5fb' : '#ffffff',
                        cursor: 'pointer',
                        boxShadow: isSelected ? '0 4px 12px rgba(90,61,92,0.1)' : '0 1px 2px rgba(0,0,0,0.03)',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={e => {
                        if (!isSelected) e.currentTarget.style.borderColor = '#cbd5e1';
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) e.currentTarget.style.borderColor = '#e2e8f0';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {n.category || 'General'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {n.pinned && <span title="Fixat sus">📌</span>}
                          {isRestrictedView && (
                            <span title="Vizibilitate restricționată" style={{ fontSize: '12px' }}>
                              🔒
                            </span>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          fontWeight: '700',
                          fontSize: '14px',
                          color: '#1e293b',
                          marginBottom: '4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {n.title}
                      </div>

                      <div
                        style={{
                          fontSize: '12px',
                          color: '#64748b',
                          lineHeight: '1.4',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          marginBottom: '8px',
                          minHeight: '34px',
                        }}
                      >
                        {n.content || '(Fără conținut text)'}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#94a3b8' }}>
                        <span>👤 {n.creator?.username || n.creator?.email || 'Autor'}</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {hasVideo && <span title="Include video YouTube">🎬</span>}
                          {hasImgs && <span title="Include imagini">🖼️</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* ── Right Main Area (Reader / Selected Note View) ───────────── */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', backgroundColor: '#ffffff' }}>
          {!selectedNote ? (
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '56px', marginBottom: '16px' }}>💡</div>
              <h2 style={{ color: '#334155', margin: '0 0 8px 0', fontSize: '1.4rem' }}>
                Selectează o notiță din listă
              </h2>
              <p style={{ maxWidth: '420px', margin: '0 0 24px 0', fontSize: '14px', lineHeight: '1.5' }}>
                Alege o notiță din panoul din stânga pentru a-i vizualiza conținutul, imaginile și clipul video integrat, sau adaugă un document nou.
              </p>
              {(isUserAdmin || canCreateKnowledge) && (
                <button
                  onClick={openCreateModal}
                  style={{
                    padding: '10px 22px',
                    backgroundColor: '#5a3d5c',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(90,61,92,0.2)',
                  }}
                >
                  + Creează Notiță Nouă
                </button>
              )}
            </div>
          ) : (
            <div style={{ maxWidth: '860px', margin: '0 auto' }}>
              {/* Note Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  borderBottom: '1px solid #f1f5f9',
                  paddingBottom: '20px',
                  marginBottom: '24px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: '700',
                        padding: '3px 10px',
                        borderRadius: '12px',
                        backgroundColor: '#f6eff7',
                        color: '#5a3d5c',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {selectedNote.category || 'General'}
                    </span>
                    {selectedNote.pinned && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: '#fef3c7',
                          color: '#b45309',
                        }}
                      >
                        📌 Fixat
                      </span>
                    )}

                    {/* View permissions badge */}
                    {selectedNote.allowedRolesToView && selectedNote.allowedRolesToView !== 'ALL' && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                        }}
                        title={`Roluri autorizate: ${selectedNote.allowedRolesToView}`}
                      >
                        👁️ Roluri: {selectedNote.allowedRolesToView}
                      </span>
                    )}
                    {selectedNote.allowedUserIdsToView && selectedNote.allowedUserIdsToView.trim().length > 0 && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: '#eff6ff',
                          color: '#2563eb',
                        }}
                        title={`Persoane permise direct (ID-uri): ${selectedNote.allowedUserIdsToView}`}
                      >
                        👤 Persoane specifice ({selectedNote.allowedUserIdsToView.split(',').length})
                      </span>
                    )}

                    {/* Edit permissions badge */}
                    {selectedNote.allowedRolesToEdit && selectedNote.allowedRolesToEdit !== 'ADMIN_CREATOR' && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: '#fdf2f8',
                          color: '#be185d',
                        }}
                        title={`Roluri cu drept de editare: ${selectedNote.allowedRolesToEdit}`}
                      >
                        ✏️ Editabil de: {selectedNote.allowedRolesToEdit}
                      </span>
                    )}
                  </div>

                  <h1 style={{ margin: '0 0 10px 0', fontSize: '2rem', color: '#0f172a', fontWeight: '800' }}>
                    {selectedNote.title}
                  </h1>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#64748b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: '#5a3d5c',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 'bold',
                        }}
                      >
                        {(selectedNote.creator?.username || selectedNote.creator?.email || 'U')[0].toUpperCase()}
                      </div>
                      <span>{selectedNote.creator?.username || selectedNote.creator?.email || 'Autor'}</span>
                    </div>
                    <span>•</span>
                    <span>
                      {selectedNote.createdAt
                        ? new Date(selectedNote.createdAt).toLocaleDateString('ro-RO', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                          })
                        : ''}
                    </span>
                  </div>
                </div>

                {/* Edit & Delete Action Buttons */}
                {canEdit && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => openEditModal(selectedNote)}
                      style={{
                        padding: '7px 14px',
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      ✏️ Editează
                    </button>
                    <button
                      onClick={() => handleDeleteNote(selectedNote.id)}
                      style={{
                        padding: '7px 14px',
                        backgroundColor: '#fee2e2',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      🗑️ Șterge
                    </button>
                  </div>
                )}
              </div>

              {/* ── YouTube Video Player (In-Site Play) ────────────────── */}
              {selectedVideoId && (
                <div style={{ marginBottom: '28px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🎬</span> Video Demonstrativ / Tutorial
                  </div>
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      paddingBottom: '56.25%', // 16:9 Aspect Ratio
                      height: 0,
                      borderRadius: '12px',
                      overflow: 'hidden',
                      backgroundColor: '#000000',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                    }}
                  >
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${selectedVideoId}?rel=0`}
                      title={selectedNote.title || 'YouTube video'}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        border: 'none',
                      }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              )}

              {/* ── Attached Images Gallery ───────────────────────────── */}
              {selectedNoteImages.length > 0 && (
                <div style={{ marginBottom: '28px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🖼️</span> Imagini Atașate ({selectedNoteImages.length})
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
                    {selectedNoteImages.map((src, index) => (
                      <div
                        key={index}
                        onClick={() => setLightboxImage(src)}
                        style={{
                          position: 'relative',
                          borderRadius: '10px',
                          overflow: 'hidden',
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#f8fafc',
                          height: '150px',
                          cursor: 'zoom-in',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                          transition: 'transform 0.15s ease',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.02)')}
                        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1.0)')}
                      >
                        <img
                          src={src}
                          alt={`Atașament ${index + 1}`}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '6px',
                            right: '6px',
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            color: '#ffffff',
                            borderRadius: '4px',
                            padding: '2px 6px',
                            fontSize: '10px',
                            fontWeight: '600',
                          }}
                        >
                          🔍 Mărește
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Note Content Text ─────────────────────────────────── */}
              <div
                style={{
                  fontSize: '15px',
                  lineHeight: '1.75',
                  color: '#334155',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'sans-serif',
                  marginBottom: '40px',
                }}
              >
                {selectedNote.content || '(Notița nu are conținut suplimentar scris)'}
              </div>

              {/* Footer Meta */}
              <div
                style={{
                  borderTop: '1px solid #f1f5f9',
                  paddingTop: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '12px',
                  color: '#94a3b8',
                }}
              >
                <span>ID Notiță: #{selectedNote.id}</span>
                <span>
                  {selectedNote.updatedAt && selectedNote.updatedAt !== selectedNote.createdAt
                    ? `Actualizat: ${new Date(selectedNote.updatedAt).toLocaleDateString('ro-RO')}`
                    : ''}
                </span>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Modal: Create / Edit Note ───────────────────────────────── */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '720px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              padding: '28px',
            }}
          >
            <h2 style={{ margin: '0 0 18px 0', color: '#1e293b', fontSize: '1.4rem', fontWeight: '700' }}>
              {editingNote ? '✏️ Editează Notița' : '🧠 Adaugă Notiță Nouă în Knowledge'}
            </h2>

            <form onSubmit={handleSaveNote}>
              {/* Title */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Titlu Notiță *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Ghid de Instalare și Configurare Sistem"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Dynamic Category & Pinned row */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Categorie
                  </label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    {categories.length === 0 ? (
                      <option value="General">General</option>
                    ) : (
                      categories.map(c => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#334155',
                    userSelect: 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formIsPinned}
                    onChange={e => setFormIsPinned(e.target.checked)}
                  />
                  <span>📌 Fixează Notița (Pinned)</span>
                </label>
              </div>

              {/* YouTube Link */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  🎬 Link Video YouTube (opțional)
                </label>
                <input
                  type="url"
                  placeholder="ex: https://www.youtube.com/watch?v=dQw4w9WgXcQ sau https://youtu.be/..."
                  value={formYoutubeUrl}
                  onChange={e => setFormYoutubeUrl(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
                <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginTop: '4px' }}>
                  ℹ️ Videoclipul va putea fi redat direct în aplicație, fără redirecționare externă.
                </span>
              </div>

              {/* Images Upload */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>
                    🖼️ Imagini Atașate (opțional)
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: '5px 12px',
                      backgroundColor: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      color: '#475569',
                    }}
                  >
                    + Încarcă Imagini
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                </div>

                {formImages.length === 0 ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: '20px',
                      border: '2px dashed #cbd5e1',
                      borderRadius: '8px',
                      textAlign: 'center',
                      color: '#94a3b8',
                      fontSize: '13px',
                      cursor: 'pointer',
                      backgroundColor: '#f8fafc',
                    }}
                  >
                    Apasă aici sau trage fișiere foto (PNG, JPG, WebP) pentru a le atașa notiței.
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#f8fafc' }}>
                    {formImages.map((src, i) => (
                      <div key={i} style={{ position: 'relative', width: '90px', height: '70px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                        <img src={src} alt="Upload preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button
                          type="button"
                          onClick={() => removeFormImage(i)}
                          title="Șterge imagine"
                          style={{
                            position: 'absolute',
                            top: '3px',
                            right: '3px',
                            backgroundColor: 'rgba(239,68,68,0.9)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Content Textarea */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Conținut Notiță *
                </label>
                <textarea
                  required
                  rows={6}
                  placeholder="Scrie instrucțiunile, pașii, descrierea sau informațiile dorite..."
                  value={formContent}
                  onChange={e => setFormContent(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'sans-serif',
                    lineHeight: '1.5',
                  }}
                />
              </div>

              {/* ── PERMISIUNI VIZUALIZARE (Roluri & Persoane) ────────── */}
              <div
                style={{
                  padding: '14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>👁️</span> Cine are acces să VADĂ această notiță?
                </div>

                <div style={{ display: 'flex', gap: '16px', marginBottom: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: '#334155' }}>
                    <input
                      type="radio"
                      name="viewOption"
                      checked={formViewOption === 'ALL'}
                      onChange={() => setFormViewOption('ALL')}
                    />
                    <span>Toată lumea (Public)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: '#334155' }}>
                    <input
                      type="radio"
                      name="viewOption"
                      checked={formViewOption === 'CUSTOM'}
                      onChange={() => setFormViewOption('CUSTOM')}
                    />
                    <span>Restricționat (Roluri sau Persoane)</span>
                  </label>
                </div>

                {formViewOption === 'CUSTOM' && (
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                    {/* View Roles */}
                    <div style={{ marginBottom: '12px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '6px' }}>
                        🏷️ Roluri autorizate să vizualizeze:
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {availableRoles.map(role => (
                          <label
                            key={role}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              backgroundColor: formSelectedViewRoles.includes(role) ? '#f3e8ff' : '#ffffff',
                              border: formSelectedViewRoles.includes(role) ? '1px solid #d8b4e2' : '1px solid #cbd5e1',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={formSelectedViewRoles.includes(role)}
                              onChange={() => toggleViewRole(role)}
                            />
                            <span style={{ fontWeight: formSelectedViewRoles.includes(role) ? '600' : '400', color: formSelectedViewRoles.includes(role) ? '#5a3d5c' : '#334155' }}>
                              {role}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* View Users */}
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '6px' }}>
                        👤 Persoane specifice autorizate să vizualizeze:
                      </span>
                      <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 8px', backgroundColor: '#ffffff' }}>
                        {allUsers.length === 0 ? (
                          <div style={{ fontSize: '12px', color: '#94a3b8' }}>Nu există alți utilizatori</div>
                        ) : (
                          allUsers.map(user => (
                            <label
                              key={user.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '4px 0',
                                cursor: 'pointer',
                                fontSize: '12px',
                                color: '#334155',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={formSelectedViewUserIds.includes(user.id)}
                                onChange={() => toggleViewUser(user.id)}
                              />
                              <span>
                                <strong>{user.username}</strong> ({user.email})
                                <span style={{ color: '#94a3b8', marginLeft: '6px' }}>[{user.role || 'User'}]</span>
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── PERMISIUNI EDITARE / ȘTERGERE (Roluri & Persoane) ──── */}
              <div
                style={{
                  padding: '14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  marginBottom: '22px',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>✏️</span> Cine are acces să EDITEZE sau să ȘTEARGĂ această notiță?
                </div>

                <div style={{ display: 'flex', gap: '16px', marginBottom: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: '#334155' }}>
                    <input
                      type="radio"
                      name="editOption"
                      checked={formEditOption === 'CREATOR_ADMIN'}
                      onChange={() => setFormEditOption('CREATOR_ADMIN')}
                    />
                    <span>Doar autorul și administratorii</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: '#334155' }}>
                    <input
                      type="radio"
                      name="editOption"
                      checked={formEditOption === 'CUSTOM'}
                      onChange={() => setFormEditOption('CUSTOM')}
                    />
                    <span>Personalizat (Permite și altor roluri / persoane)</span>
                  </label>
                </div>

                {formEditOption === 'CUSTOM' && (
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                    {/* Edit Roles */}
                    <div style={{ marginBottom: '12px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '6px' }}>
                        🏷️ Roluri cu drept de editare / ștergere:
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {availableRoles.map(role => (
                          <label
                            key={role}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              backgroundColor: formSelectedEditRoles.includes(role) ? '#fdf2f8' : '#ffffff',
                              border: formSelectedEditRoles.includes(role) ? '1px solid #fbcfe8' : '1px solid #cbd5e1',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={formSelectedEditRoles.includes(role)}
                              onChange={() => toggleEditRole(role)}
                            />
                            <span style={{ fontWeight: formSelectedEditRoles.includes(role) ? '600' : '400', color: formSelectedEditRoles.includes(role) ? '#be185d' : '#334155' }}>
                              {role}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Edit Users */}
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '6px' }}>
                        👤 Persoane specifice cu drept de editare / ștergere:
                      </span>
                      <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 8px', backgroundColor: '#ffffff' }}>
                        {allUsers.length === 0 ? (
                          <div style={{ fontSize: '12px', color: '#94a3b8' }}>Nu există alți utilizatori</div>
                        ) : (
                          allUsers.map(user => (
                            <label
                              key={user.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '4px 0',
                                cursor: 'pointer',
                                fontSize: '12px',
                                color: '#334155',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={formSelectedEditUserIds.includes(user.id)}
                                onChange={() => toggleEditUser(user.id)}
                              />
                              <span>
                                <strong>{user.username}</strong> ({user.email})
                                <span style={{ color: '#94a3b8', marginLeft: '6px' }}>[{user.role || 'User'}]</span>
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '9px 18px',
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
                  disabled={saving}
                  style={{
                    padding: '9px 22px',
                    backgroundColor: '#5a3d5c',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: saving ? 'default' : 'pointer',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Se salvează...' : editingNote ? 'Actualizează Notița' : 'Creează Notița'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Add Category (Admin Only) ────────────────────────── */}
      {showAddCatModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 11000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '420px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              padding: '24px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b', fontWeight: '700' }}>
                ➕ Adaugă Categorie Nouă
              </h3>
              <button
                onClick={() => setShowAddCatModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', color: '#94a3b8', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCategory}>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Nume Categorie *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Design, Marketing, Arhitectură..."
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddCatModal(false)}
                  style={{
                    padding: '8px 16px',
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
                  disabled={catSaving}
                  style={{
                    padding: '8px 18px',
                    backgroundColor: '#5a3d5c',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: catSaving ? 'default' : 'pointer',
                    opacity: catSaving ? 0.7 : 1,
                  }}
                >
                  {catSaving ? 'Se adaugă...' : 'Salvează Categoria'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Lightbox Modal for enlarged image ───────────────────────── */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
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
            zIndex: 20000,
            cursor: 'zoom-out',
            padding: '24px',
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img
              src={lightboxImage}
              alt="Enlarged view"
              style={{
                maxWidth: '100%',
                maxHeight: '90vh',
                borderRadius: '8px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                objectFit: 'contain',
              }}
            />
            <button
              onClick={() => setLightboxImage(null)}
              style={{
                position: 'absolute',
                top: '-14px',
                right: '-14px',
                backgroundColor: '#ffffff',
                color: '#1e293b',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                fontWeight: 'bold',
                fontSize: '18px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
