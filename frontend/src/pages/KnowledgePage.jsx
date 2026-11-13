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

// Inspect item or URL to detect Google Docs, Google Sheets, PDF or Drive links
function getDriveItemMeta(itemOrUrl, rawFileName, rawFileType) {
  const url = typeof itemOrUrl === 'string'
    ? itemOrUrl
    : (itemOrUrl?.fileData || itemOrUrl?.content || '');
  const lowerUrl = (url || '').trim().toLowerCase();
  const name = (typeof itemOrUrl === 'object' ? itemOrUrl?.fileName : rawFileName) || '';
  const lowerName = name.toLowerCase();
  const fType = ((typeof itemOrUrl === 'object' ? itemOrUrl?.fileType : rawFileType) || '').toLowerCase();

  // Google Docs
  if (lowerUrl.includes('docs.google.com/document') || fType === 'google_docs') {
    return {
      icon: '📄',
      label: 'Google Docs',
      type: 'GOOGLE_DOCS',
      color: '#2563eb',
      bg: '#eff6ff',
      border: '#bfdbfe',
      actionText: 'Deschide Docs',
      isLink: true,
      url: url,
    };
  }

  // Google Sheets / Spreadsheet
  if (lowerUrl.includes('docs.google.com/spreadsheets') || lowerUrl.includes('spreadsheet') || fType === 'google_sheets') {
    return {
      icon: '📊',
      label: 'Spreadsheet',
      type: 'GOOGLE_SHEETS',
      color: '#16a34a',
      bg: '#f0fdf4',
      border: '#bbf7d0',
      actionText: 'Deschide Sheets',
      isLink: true,
      url: url,
    };
  }

  // PDF (Link or Uploaded file)
  if (lowerName.endsWith('.pdf') || lowerUrl.endsWith('.pdf') || lowerUrl.includes('/pdf') || fType.includes('pdf')) {
    const isLink = lowerUrl.startsWith('http://') || lowerUrl.startsWith('https://');
    return {
      icon: '📑',
      label: 'PDF Document',
      type: 'PDF',
      color: '#dc2626',
      bg: '#fef2f2',
      border: '#fecaca',
      actionText: isLink ? 'Deschide PDF' : 'Vizualizează PDF',
      isLink: isLink,
      url: isLink ? url : null,
    };
  }

  // Google Drive generic folder / file
  if (lowerUrl.includes('drive.google.com')) {
    return {
      icon: '📁',
      label: 'Google Drive',
      type: 'GOOGLE_DRIVE',
      color: '#0284c7',
      bg: '#f0f9ff',
      border: '#bae6fd',
      actionText: 'Deschide în Drive',
      isLink: true,
      url: url,
    };
  }

  // Any other web link
  if (lowerUrl.startsWith('http://') || lowerUrl.startsWith('https://')) {
    return {
      icon: '🔗',
      label: 'Document Web',
      type: 'WEB_LINK',
      color: '#475569',
      bg: '#f8fafc',
      border: '#e2e8f0',
      actionText: 'Deschide Link',
      isLink: true,
      url: url,
    };
  }

  return {
    icon: '📁',
    label: 'Document',
    type: 'DOCUMENT',
    color: '#475569',
    bg: '#f8fafc',
    border: '#e2e8f0',
    actionText: 'Descarcă',
    isLink: false,
    url: null,
  };
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
  const [folders, setFolders] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(null); // null = Root
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Permissions state
  const [permissions, setPermissions] = useState({
    canCreateRoot: false,
    canWrite: false,
    canEdit: false,
    isAdmin: false,
    isCreator: false,
    role: 'User',
    systemRoles: ['Admin', 'User'],
  });

  // Folder Permissions Form State
  const [folderViewMode, setFolderViewMode] = useState('ALL'); // 'ALL' | 'CUSTOM'
  const [folderViewRoles, setFolderViewRoles] = useState(['Admin']);
  const [folderWriteRoles, setFolderWriteRoles] = useState(['Admin']);
  const [folderEditRoles, setFolderEditRoles] = useState(['Admin']);

  // Note / Drive Item Permissions State
  const [itemRestrictedView, setItemRestrictedView] = useState(false);
  const [itemAllowedRoles, setItemAllowedRoles] = useState(['Admin']);

  // Modals
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState(null);
  const [folderNameInput, setFolderNameInput] = useState('');
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

  // Drive Form: 'LINK' vs 'FILE'
  const [driveMode, setDriveMode] = useState('LINK'); // 'LINK' | 'FILE'
  const [driveUrl, setDriveUrl] = useState('');
  const [driveTitle, setDriveTitle] = useState('');
  const [driveFile, setDriveFile] = useState(null); // { name, type, size, base64 }
  const [driveSaving, setDriveSaving] = useState(false);

  const fileInputRef = useRef(null);
  const addMenuRef = useRef(null);

  // Drag and Drop States
  const [draggedElement, setDraggedElement] = useState(null); // { type: 'FOLDER' | 'ITEM', id, name, parentId?, folderId? }
  const [activeDropTargetId, setActiveDropTargetId] = useState(null); // folderId or 'ROOT'
  const [toast, setToast] = useState(null); // { text, type: 'success' | 'error' | 'info' }
  const toastTimerRef = useRef(null);
  const dropOccurredAtRef = useRef(0);

  const API = `${API_BASE_URL}/api/knowledge`;

  // Fetch permissions for current user and current folder level
  const fetchPermissions = async () => {
    if (!currentUser?.id) return;
    try {
      const folderParam = currentFolderId ? `&folderId=${currentFolderId}` : '';
      const res = await fetch(`${API}/permissions?userId=${currentUser.id}${folderParam}`);
      if (res.ok) {
        const data = await res.json();
        setPermissions(data);
      }
    } catch (err) {
      console.error('Eroare la încărcarea permisiunilor:', err);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, [currentUser?.id, currentFolderId]);

  // Fetch all items and folders accessible to user
  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    const userIdParam = currentUser?.id ? `?userId=${currentUser.id}` : '';
    try {
      const [itemsRes, foldersRes] = await Promise.all([
        fetch(`${API}${userIdParam}`).then(r => r.ok ? r.json() : []),
        fetch(`${API}/folders${userIdParam}`).then(r => r.ok ? r.json() : []),
      ]);
      setItems(Array.isArray(itemsRes) ? itemsRes : []);
      setFolders(Array.isArray(foldersRes) ? foldersRes : []);
    } catch (err) {
      console.error('Eroare la încărcarea Knowledge:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser?.id]);

  // Permission helpers
  const canEditFolder = (f) => {
    if (!f || !currentUser) return false;
    if (permissions.isAdmin) return true;
    if (f.creator?.id === currentUser.id) return true;
    const allowedEdit = f.allowedRolesToEdit;
    if (allowedEdit === 'ALL') return true;
    if (!allowedEdit || allowedEdit === 'ADMIN_CREATOR') return false;
    const userRole = (currentUser.role || 'User').trim().toLowerCase();
    return allowedEdit.split(',').some(r => r.trim().toLowerCase() === userRole);
  };

  const canEditItem = (item) => {
    if (!item || !currentUser) return false;
    if (permissions.isAdmin) return true;
    if (item.creator?.id === currentUser.id) return true;
    const allowedEdit = item.allowedRolesToEdit;
    if (allowedEdit === 'ALL') return true;
    if (!allowedEdit || allowedEdit === 'ADMIN_CREATOR') return false;
    const userRole = (currentUser.role || 'User').trim().toLowerCase();
    return allowedEdit.split(',').some(r => r.trim().toLowerCase() === userRole);
  };

  const toggleRoleInList = (roleName, currentList, setList) => {
    if (roleName === 'Admin') return; // Admin always included
    if (currentList.includes(roleName)) {
      setList(currentList.filter(r => r !== roleName));
    } else {
      setList([...currentList, roleName]);
    }
  };

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

  // Compute breadcrumbs path from currentFolderId
  const breadcrumbs = useMemo(() => {
    if (currentFolderId == null) return [];
    const path = [];
    let curr = folders.find(f => Number(f.id) === Number(currentFolderId));
    while (curr) {
      path.unshift(curr);
      curr = curr.parentId != null ? folders.find(f => Number(f.id) === Number(curr.parentId)) : null;
    }
    return path;
  }, [currentFolderId, folders]);

  const currentFolder = useMemo(() => {
    if (currentFolderId == null) return null;
    return folders.find(f => Number(f.id) === Number(currentFolderId)) || null;
  }, [currentFolderId, folders]);

  // Folders at current level
  const displayedFolders = useMemo(() => {
    if (search.trim()) {
      const q = search.toLowerCase();
      return folders.filter(f => (f.name || '').toLowerCase().includes(q));
    }
    return folders.filter(f => {
      if (currentFolderId != null) {
        return f.parentId != null && Number(f.parentId) === Number(currentFolderId);
      }
      return f.parentId == null;
    });
  }, [folders, currentFolderId, search]);

  // Items at current level (or all matching search)
  const displayedItems = useMemo(() => {
    if (search.trim()) {
      const q = search.toLowerCase();
      return items.filter(it => {
        const inTitle = (it.title || '').toLowerCase().includes(q);
        const inContent = (it.content || '').toLowerCase().includes(q);
        const inFile = (it.fileName || '').toLowerCase().includes(q);
        return inTitle || inContent || inFile;
      });
    }
    return items.filter(it => {
      if (currentFolderId != null) {
        return it.folderId != null && Number(it.folderId) === Number(currentFolderId);
      }
      return it.folderId == null;
    });
  }, [items, currentFolderId, search]);

  // Helper to count items inside folder
  const getFolderCounts = (folderId) => {
    const subCount = folders.filter(f => f.parentId != null && Number(f.parentId) === Number(folderId)).length;
    const itCount = items.filter(it => it.folderId != null && Number(it.folderId) === Number(folderId)).length;
    return { subCount, itCount, total: subCount + itCount };
  };

  // Live detected YouTube ID from note content
  const detectedYouTubeId = useMemo(() => {
    return extractYouTubeId(noteContent);
  }, [noteContent]);

  // Live detected Drive metadata from entered URL in Drive Modal
  const liveDriveMeta = useMemo(() => {
    if (!driveUrl.trim()) return null;
    return getDriveItemMeta(driveUrl.trim(), '', '');
  }, [driveUrl]);

  // Toast feedback
  const showToast = (text, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ text, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  // Helper: check if targetFolder is a descendant of candidateAncestor
  const isDescendantFolder = (targetFolderId, candidateAncestorId) => {
    if (targetFolderId == null || candidateAncestorId == null) return false;
    if (Number(targetFolderId) === Number(candidateAncestorId)) return true;
    let curr = folders.find(f => Number(f.id) === Number(targetFolderId));
    while (curr && curr.parentId != null) {
      if (Number(curr.parentId) === Number(candidateAncestorId)) return true;
      curr = folders.find(f => Number(f.id) === Number(curr.parentId));
    }
    return false;
  };

  // Drag & Drop Handlers
  const handleDragStart = (e, elementInfo) => {
    setDraggedElement(elementInfo);
    try {
      e.dataTransfer.setData('text/plain', JSON.stringify(elementInfo));
      e.dataTransfer.effectAllowed = 'move';
    } catch (_) {}
  };

  const handleDragEnd = () => {
    setDraggedElement(null);
    setActiveDropTargetId(null);
  };

  const handleDragOverTarget = (e, targetId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedElement) return;

    const actualTargetId = targetId === 'ROOT' ? null : (targetId != null ? Number(targetId) : null);

    if (draggedElement.type === 'FOLDER') {
      const draggedId = Number(draggedElement.id);
      if (actualTargetId != null && draggedId === actualTargetId) return;
      if (actualTargetId != null && isDescendantFolder(actualTargetId, draggedId)) return;
      const draggedParentId = draggedElement.parentId != null ? Number(draggedElement.parentId) : null;
      if (draggedParentId === actualTargetId) return;
    } else if (draggedElement.type === 'ITEM') {
      const draggedFolderId = draggedElement.folderId != null ? Number(draggedElement.folderId) : null;
      if (draggedFolderId === actualTargetId) return;
    }

    e.dataTransfer.dropEffect = 'move';
    if (activeDropTargetId !== targetId) {
      setActiveDropTargetId(targetId);
    }
  };

  const handleDragLeaveTarget = (e, targetId) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) {
      return;
    }
    if (activeDropTargetId === targetId) {
      setActiveDropTargetId(null);
    }
  };

  const handleDropOnTarget = async (e, targetFolderId, targetFolderName) => {
    e.preventDefault();
    e.stopPropagation();
    dropOccurredAtRef.current = Date.now();
    setActiveDropTargetId(null);

    const actualTargetId = targetFolderId === 'ROOT' ? null : (targetFolderId != null ? Number(targetFolderId) : null);
    let element = draggedElement;
    if (!element) {
      try {
        const raw = e.dataTransfer.getData('text/plain');
        if (raw) element = JSON.parse(raw);
      } catch (_) {}
    }
    setDraggedElement(null);
    if (!element) return;

    const elId = Number(element.id);

    // 1. Move Item (Docs, Sheets, PDF, Notes)
    if (element.type === 'ITEM') {
      const curFolderId = element.folderId != null ? Number(element.folderId) : null;
      if (curFolderId === actualTargetId) {
        showToast(`Elementul este deja în "${targetFolderName}"`, 'info');
        return;
      }

      setItems(prev => prev.map(it => Number(it.id) === elId ? { ...it, folderId: actualTargetId } : it));

      try {
        const res = await fetch(`${API}/${elId}/move`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderId: actualTargetId }),
        });

        if (res.ok) {
          showToast(`"${element.name}" a fost mutat în "${targetFolderName}"!`, 'success');
          fetchData(true);
        } else {
          const errData = await res.json().catch(() => ({}));
          showToast(errData.message || 'Eroare la mutarea elementului!', 'error');
          fetchData(true);
        }
      } catch (err) {
        console.error(err);
        showToast('Eroare de conexiune la mutare!', 'error');
        fetchData(true);
      }
    }

    // 2. Move Folder
    if (element.type === 'FOLDER') {
      if (actualTargetId != null && elId === actualTargetId) {
        showToast('Nu poți muta un folder în el însuși!', 'error');
        return;
      }
      const curParentId = element.parentId != null ? Number(element.parentId) : null;
      if (curParentId === actualTargetId) {
        showToast(`Folderul este deja în "${targetFolderName}"`, 'info');
        return;
      }
      if (actualTargetId != null && isDescendantFolder(actualTargetId, elId)) {
        showToast('Nu poți muta un folder într-unul dintre subfolderele sale!', 'error');
        return;
      }

      setFolders(prev => prev.map(f => Number(f.id) === elId ? { ...f, parentId: actualTargetId } : f));

      try {
        const res = await fetch(`${API}/folders/${elId}/move`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentId: actualTargetId }),
        });

        if (res.ok) {
          showToast(`Folderul "${element.name}" a fost mutat în "${targetFolderName}"!`, 'success');
          fetchData(true);
        } else {
          const errData = await res.json().catch(() => ({}));
          showToast(errData.message || 'Eroare la mutarea folderului!', 'error');
          fetchData(true);
        }
      } catch (err) {
        console.error(err);
        showToast('Eroare de conexiune la mutare!', 'error');
        fetchData(true);
      }
    }
  };

  // Open New Folder Modal
  const openNewFolderModal = () => {
    setFolderNameInput('');
    setRenamingFolder(null);
    if (currentFolder && currentFolder.allowedRolesToView && currentFolder.allowedRolesToView !== 'ALL') {
      setFolderViewMode('CUSTOM');
      setFolderViewRoles(currentFolder.allowedRolesToView.split(',').map(r => r.trim()).filter(Boolean));
    } else {
      setFolderViewMode('ALL');
      setFolderViewRoles(permissions.systemRoles || ['Admin', 'User']);
    }
    setFolderWriteRoles(['Admin']);
    setFolderEditRoles(['Admin']);
    setIsFolderModalOpen(true);
  };

  // Open Edit Folder Modal
  const openEditFolderModal = (folder) => {
    setRenamingFolder(folder);
    setFolderNameInput(folder.name || '');
    if (folder.allowedRolesToView === 'ALL' || !folder.allowedRolesToView) {
      setFolderViewMode('ALL');
      setFolderViewRoles(permissions.systemRoles || ['Admin', 'User']);
    } else {
      setFolderViewMode('CUSTOM');
      setFolderViewRoles(folder.allowedRolesToView.split(',').map(r => r.trim()).filter(Boolean));
    }

    if (folder.allowedRolesToWrite === 'ADMIN_CREATOR' || !folder.allowedRolesToWrite) {
      setFolderWriteRoles(['Admin']);
    } else if (folder.allowedRolesToWrite === 'ALL') {
      setFolderWriteRoles(permissions.systemRoles || ['Admin', 'User']);
    } else {
      setFolderWriteRoles(folder.allowedRolesToWrite.split(',').map(r => r.trim()).filter(Boolean));
    }

    if (folder.allowedRolesToEdit === 'ADMIN_CREATOR' || !folder.allowedRolesToEdit) {
      setFolderEditRoles(['Admin']);
    } else if (folder.allowedRolesToEdit === 'ALL') {
      setFolderEditRoles(permissions.systemRoles || ['Admin', 'User']);
    } else {
      setFolderEditRoles(folder.allowedRolesToEdit.split(',').map(r => r.trim()).filter(Boolean));
    }
  };

  // Create Folder
  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!folderNameInput.trim()) return;

    const payload = {
      name: folderNameInput.trim(),
      parentId: currentFolderId,
      allowedRolesToView: folderViewMode === 'ALL' ? 'ALL' : (folderViewRoles.length > 0 ? folderViewRoles.join(',') : 'Admin'),
      allowedRolesToWrite: folderWriteRoles.length > 0 ? folderWriteRoles.join(',') : 'ADMIN_CREATOR',
      allowedRolesToEdit: folderEditRoles.length > 0 ? folderEditRoles.join(',') : 'ADMIN_CREATOR',
    };

    try {
      const res = await fetch(`${API}/folders?userId=${currentUser?.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsFolderModalOpen(false);
        setFolderNameInput('');
        fetchData(true);
        fetchPermissions();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Eroare la crearea folderului!');
      }
    } catch (err) {
      console.error(err);
      alert('Eroare de conexiune la crearea folderului!');
    }
  };

  // Rename / Update Folder Permissions
  const handleRenameFolder = async (e) => {
    e.preventDefault();
    if (!renamingFolder || !folderNameInput.trim()) return;

    const payload = {
      name: folderNameInput.trim(),
      allowedRolesToView: folderViewMode === 'ALL' ? 'ALL' : (folderViewRoles.length > 0 ? folderViewRoles.join(',') : 'Admin'),
      allowedRolesToWrite: folderWriteRoles.length > 0 ? folderWriteRoles.join(',') : 'ADMIN_CREATOR',
      allowedRolesToEdit: folderEditRoles.length > 0 ? folderEditRoles.join(',') : 'ADMIN_CREATOR',
    };

    try {
      const res = await fetch(`${API}/folders/${renamingFolder.id}?userId=${currentUser?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setRenamingFolder(null);
        setFolderNameInput('');
        fetchData(true);
        fetchPermissions();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Eroare la salvarea modificărilor folderului!');
      }
    } catch (err) {
      console.error(err);
      alert('Eroare de conexiune!');
    }
  };

  // Delete Folder (recursive)
  const handleDeleteFolder = async (folder, e) => {
    if (e) e.stopPropagation();
    const counts = getFolderCounts(folder.id);
    const warning = counts.total > 0
      ? `Ești sigur că vrei să ștergi folderul "${folder.name}"? Acesta conține ${counts.subCount} subfoldere și ${counts.itCount} documente/notițe care vor fi șterse de asemenea.`
      : `Ești sigur că vrei să ștergi folderul "${folder.name}"?`;

    if (!window.confirm(warning)) return;

    try {
      const res = await fetch(`${API}/folders/${folder.id}?userId=${currentUser?.id}`, { method: 'DELETE' });
      if (res.ok) {
        if (currentFolderId === folder.id) {
          setCurrentFolderId(folder.parentId || null);
        }
        fetchData(true);
        fetchPermissions();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Eroare la ștergerea folderului!');
      }
    } catch (err) {
      console.error(err);
      alert('Eroare de conexiune!');
    }
  };

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
        category: 'Notițe',
        folderId: currentFolderId,
        allowedRolesToView: itemRestrictedView
          ? (itemAllowedRoles.length > 0 ? itemAllowedRoles.join(',') : 'Admin')
          : (currentFolder ? null : 'ALL'),
      };

      const url = editingId ? `${API}/${editingId}?userId=${currentUser?.id}` : API;
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsNoteModalOpen(false);
        setNoteTitle('');
        setNoteContent('');
        setNoteImages([]);
        setEditingId(null);
        setItemRestrictedView(false);
        fetchData(true);
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

  // Handle Drive File Select (PDF upload)
  const handleDriveFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64Data = ev.target.result.split(',')[1] || '';
      setDriveFile({
        name: file.name,
        type: file.type || 'application/pdf',
        size: file.size,
        base64: base64Data,
      });
      if (!driveTitle) {
        setDriveTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    };
    reader.readAsDataURL(file);
  };

  // Submit Drive Resource (Docs link, Spreadsheet link, or PDF)
  const handleSaveDrive = async (e) => {
    e.preventDefault();
    if (!driveTitle.trim()) return;

    if (driveMode === 'LINK' && !driveUrl.trim()) {
      alert('Te rugăm să introduci link-ul documentului (Docs, Sheets sau PDF)!');
      return;
    }

    if (driveMode === 'FILE' && !driveFile) {
      alert('Te rugăm să selectezi un fișier PDF!');
      return;
    }

    setDriveSaving(true);
    try {
      let payload;

      if (driveMode === 'LINK') {
        const meta = getDriveItemMeta(driveUrl.trim(), driveTitle, '');
        payload = {
          title: driveTitle.trim(),
          content: driveUrl.trim(),
          itemType: 'DRIVE',
          fileName: meta.label,
          fileType: meta.type,
          fileSize: null,
          fileData: driveUrl.trim(),
          creatorId: currentUser?.id,
          category: 'Drive',
          folderId: currentFolderId,
          allowedRolesToView: itemRestrictedView
            ? (itemAllowedRoles.length > 0 ? itemAllowedRoles.join(',') : 'Admin')
            : (currentFolder ? null : 'ALL'),
        };
      } else {
        payload = {
          title: driveTitle.trim(),
          content: `Document PDF: ${driveFile.name}`,
          itemType: 'DRIVE',
          fileName: driveFile.name,
          fileType: driveFile.type || 'application/pdf',
          fileSize: driveFile.size,
          fileData: driveFile.base64,
          creatorId: currentUser?.id,
          category: 'Drive',
          folderId: currentFolderId,
          allowedRolesToView: itemRestrictedView
            ? (itemAllowedRoles.length > 0 ? itemAllowedRoles.join(',') : 'Admin')
            : (currentFolder ? null : 'ALL'),
        };
      }

      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsDriveModalOpen(false);
        setDriveTitle('');
        setDriveUrl('');
        setDriveFile(null);
        setItemRestrictedView(false);
        fetchData(true);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Eroare la salvarea resursei Drive!');
      }
    } catch (err) {
      console.error(err);
      alert('Eroare de conexiune la salvare!');
    } finally {
      setDriveSaving(false);
    }
  };

  // Open Drive resource (Link or PDF)
  const handleOpenDriveItem = (item, e) => {
    if (e) e.stopPropagation();
    const meta = getDriveItemMeta(item);

    // If it's a web link (Google Docs, Google Sheets, PDF link)
    if (meta.isLink && meta.url) {
      window.open(meta.url, '_blank', 'noopener,noreferrer');
      return;
    }

    // If it's an uploaded PDF with base64 data
    if (item.fileData) {
      if (item.fileData.startsWith('http://') || item.fileData.startsWith('https://')) {
        window.open(item.fileData, '_blank', 'noopener,noreferrer');
        return;
      }
      try {
        const byteCharacters = atob(item.fileData);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: item.fileType || 'application/pdf' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        return;
      } catch (err) {
        console.error('Error opening blob:', err);
      }
    }

    // Fallback to download endpoint
    window.open(`${API}/${item.id}/download`, '_blank');
  };

  // Direct download for uploaded files
  const handleDownloadFile = (item, e) => {
    if (e) e.stopPropagation();
    if (item.fileData && !item.fileData.startsWith('http')) {
      try {
        const byteCharacters = atob(item.fileData);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: item.fileType || 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = item.fileName || item.title || 'document.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      } catch (_) {}
    }
    window.open(`${API}/${item.id}/download`, '_blank');
  };

  // Delete item
  const handleDelete = async (item, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Ești sigur că vrei să ștergi "${item.title}"?`)) return;

    try {
      const res = await fetch(`${API}/${item.id}?userId=${currentUser?.id}`, {
        method: 'DELETE',
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
    if (note.allowedRolesToView && note.allowedRolesToView !== 'ALL') {
      setItemRestrictedView(true);
      setItemAllowedRoles(note.allowedRolesToView.split(',').map(r => r.trim()).filter(Boolean));
    } else {
      setItemRestrictedView(false);
      setItemAllowedRoles(permissions.systemRoles || ['Admin']);
    }
    setIsNoteModalOpen(true);
  };

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 60px)',
        backgroundColor: '#f8fafc',
        padding: '28px 32px 60px',
        textAlign: 'left',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* ── Top Header ────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '30px' }}>📚</span>
            <h1
              style={{
                margin: 0,
                fontSize: '1.75rem',
                fontWeight: '800',
                color: '#1e293b',
                letterSpacing: '-0.02em',
              }}
            >
              Knowledge App
            </h1>
          </div>
          <p style={{ margin: '4px 0 0 40px', fontSize: '13px', color: '#64748b' }}>
            Organizează documentele Google Docs, Sheets, PDF și notițele tale în foldere ierarhice
          </p>
        </div>

        {/* Action Button: Add dropdown */}
        <div style={{ position: 'relative' }} ref={addMenuRef}>
          {permissions.canWrite ? (
            <button
              onClick={() => setShowAddMenu(prev => !prev)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                backgroundColor: '#5a3d5c',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(90, 61, 92, 0.25)',
                transition: 'background-color 0.15s ease, transform 0.1s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#472f48')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#5a3d5c')}
            >
              <span>➕ Adaugă</span>
              <span style={{ fontSize: '11px' }}>▼</span>
            </button>
          ) : (
            <div
              title={currentFolder ? "Nu ai permisiunea de a adăuga conținut în acest folder." : "Doar rolurile cu drept de creare pot adăuga elemente în Rădăcină."}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                backgroundColor: '#f1f5f9',
                color: '#94a3b8',
                border: '1px dashed #cbd5e1',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'not-allowed',
                userSelect: 'none',
              }}
            >
              <span>🔒 Fără drept de adăugare</span>
            </div>
          )}

          {showAddMenu && permissions.canWrite && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: '270px',
                backgroundColor: '#ffffff',
                borderRadius: '10px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                border: '1px solid #e2e8f0',
                zIndex: 100,
                padding: '6px 0',
                animation: 'fadeIn 0.15s ease',
              }}
            >
              {/* Folder Nou */}
              <button
                onClick={() => {
                  setShowAddMenu(false);
                  openNewFolderModal();
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
                <span style={{ fontSize: '20px' }}>📁</span>
                <div>
                  <div>Folder Nou</div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '400' }}>
                    {currentFolder ? `În "${currentFolder.name}"` : 'În Rădăcină'}
                  </div>
                </div>
              </button>

              <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '4px 0' }} />

              {/* Docs / Sheets / PDF */}
              <button
                onClick={() => {
                  setShowAddMenu(false);
                  setDriveMode('LINK');
                  setDriveUrl('');
                  setDriveTitle('');
                  setDriveFile(null);
                  setItemRestrictedView(false);
                  setItemAllowedRoles(permissions.systemRoles || ['Admin']);
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
                <span style={{ fontSize: '20px' }}>📄</span>
                <div>
                  <div>Adaugă Docs, Sheets sau PDF</div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '400' }}>
                    Link Docs/Spreadsheet sau fișier PDF
                  </div>
                </div>
              </button>

              {/* Notiță */}
              <button
                onClick={() => {
                  setShowAddMenu(false);
                  setEditingId(null);
                  setNoteTitle('');
                  setNoteContent('');
                  setNoteImages([]);
                  setItemRestrictedView(false);
                  setItemAllowedRoles(permissions.systemRoles || ['Admin']);
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
                <span style={{ fontSize: '20px' }}>📝</span>
                <div>
                  <div>Creează Notiță</div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '400' }}>
                    Text, YouTube video & poze
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Breadcrumb Navigation & Search Bar ─────────────────────── */}
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
        {/* Breadcrumb Trail */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {currentFolderId && (() => {
            const backTargetId = currentFolder?.parentId || 'ROOT';
            const backTargetName = currentFolder?.parentId
              ? (folders.find(f => f.id === currentFolder.parentId)?.name || 'Folder părinte')
              : 'Rădăcină';
            const isBackDropTarget = activeDropTargetId === backTargetId;

            return (
              <button
                onClick={() => setCurrentFolderId(currentFolder?.parentId || null)}
                onDragOver={(e) => handleDragOverTarget(e, backTargetId)}
                onDragLeave={(e) => handleDragLeaveTarget(e, backTargetId)}
                onDrop={(e) => handleDropOnTarget(e, backTargetId, backTargetName)}
                title={draggedElement ? `Plasează aici pentru a muta în "${backTargetName}"` : 'Mergi înapoi'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: isBackDropTarget ? '2px dashed #7c3aed' : '1px solid #cbd5e1',
                  backgroundColor: isBackDropTarget ? '#f3e8ff' : '#f8fafc',
                  color: isBackDropTarget ? '#7c3aed' : '#334155',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  marginRight: '6px',
                  transform: isBackDropTarget ? 'scale(1.06)' : 'none',
                  transition: 'all 0.12s',
                }}
              >
                <span>←</span>
                <span>{isBackDropTarget ? `Mută în "${backTargetName}"` : 'Înapoi'}</span>
              </button>
            );
          })()}

          {(() => {
            const isRootDropTarget = activeDropTargetId === 'ROOT';
            return (
              <button
                onClick={() => {
                  setCurrentFolderId(null);
                  setSearch('');
                }}
                onDragOver={(e) => handleDragOverTarget(e, 'ROOT')}
                onDragLeave={(e) => handleDragLeaveTarget(e, 'ROOT')}
                onDrop={(e) => handleDropOnTarget(e, 'ROOT', 'Rădăcină')}
                title={draggedElement ? 'Plasează aici pentru a muta în Rădăcină' : 'Mergi la Rădăcină'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: isRootDropTarget ? '2px dashed #7c3aed' : 'none',
                  backgroundColor: isRootDropTarget ? '#f3e8ff' : (currentFolderId === null ? '#f3e8ff' : 'transparent'),
                  color: isRootDropTarget ? '#7c3aed' : (currentFolderId === null ? '#5a3d5c' : '#64748b'),
                  fontSize: '13px',
                  fontWeight: (currentFolderId === null || isRootDropTarget) ? '700' : '500',
                  cursor: 'pointer',
                  transform: isRootDropTarget ? 'scale(1.08)' : 'none',
                  boxShadow: isRootDropTarget ? '0 0 10px rgba(124, 58, 237, 0.25)' : 'none',
                  transition: 'all 0.12s',
                }}
              >
                <span>🏠</span>
                <span>{isRootDropTarget ? 'Mută în Rădăcină' : 'Rădăcină'}</span>
              </button>
            );
          })()}

          {breadcrumbs.map((b, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            const isBreadcrumbDropTarget = activeDropTargetId === b.id;

            return (
              <span key={b.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#cbd5e1', fontSize: '13px' }}>/</span>
                <button
                  onClick={() => {
                    setCurrentFolderId(b.id);
                    setSearch('');
                  }}
                  onDragOver={(e) => !isLast && handleDragOverTarget(e, b.id)}
                  onDragLeave={(e) => !isLast && handleDragLeaveTarget(e, b.id)}
                  onDrop={(e) => !isLast && handleDropOnTarget(e, b.id, b.name)}
                  title={!isLast && draggedElement ? `Plasează aici pentru a muta în "${b.name}"` : undefined}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: isBreadcrumbDropTarget ? '2px dashed #7c3aed' : 'none',
                    backgroundColor: isBreadcrumbDropTarget
                      ? '#f3e8ff'
                      : (isLast ? '#f3e8ff' : 'transparent'),
                    color: isBreadcrumbDropTarget
                      ? '#7c3aed'
                      : (isLast ? '#5a3d5c' : '#64748b'),
                    fontSize: '13px',
                    fontWeight: (isLast || isBreadcrumbDropTarget) ? '700' : '500',
                    cursor: 'pointer',
                    transform: isBreadcrumbDropTarget ? 'scale(1.08)' : 'none',
                    boxShadow: isBreadcrumbDropTarget ? '0 0 10px rgba(124, 58, 237, 0.25)' : 'none',
                    transition: 'all 0.12s',
                  }}
                >
                  <span>📁</span>
                  <span>{isBreadcrumbDropTarget ? `Mută în "${b.name}"` : b.name}</span>
                </button>
              </span>
            );
          })}
        </div>

        {/* Search */}
        <div style={{ minWidth: '240px', flex: '1 1 240px', maxWidth: '380px', position: 'relative' }}>
          <input
            type="text"
            placeholder="🔍 Caută foldere, documente, notițe..."
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
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                border: 'none',
                background: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>Se încarcă resursele...</div>
      ) : (
        <div>
          {/* ── SECTION 1: FOLDERS ──────────────────────────────────── */}
          {displayedFolders.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: '#475569',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>📁</span>
                <span>Foldere ({displayedFolders.length})</span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: '14px',
                }}
              >
                {displayedFolders.map(folder => {
                  const counts = getFolderCounts(folder.id);
                  const isDraggingThis = draggedElement?.type === 'FOLDER' && draggedElement.id === folder.id;
                  const isDropTarget = activeDropTargetId === folder.id;

                  return (
                    <div
                      key={folder.id}
                      draggable={true}
                      onDragStart={(e) => {
                        handleDragStart(e, {
                          type: 'FOLDER',
                          id: folder.id,
                          name: folder.name,
                          parentId: folder.parentId,
                        });
                      }}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOverTarget(e, folder.id)}
                      onDragLeave={(e) => handleDragLeaveTarget(e, folder.id)}
                      onDrop={(e) => handleDropOnTarget(e, folder.id, folder.name)}
                      onClick={() => {
                        if (draggedElement) return;
                        if (Date.now() - dropOccurredAtRef.current < 250) return;
                        setCurrentFolderId(folder.id);
                        setSearch('');
                      }}
                      style={{
                        backgroundColor: isDropTarget ? '#faf5ff' : '#ffffff',
                        border: isDropTarget
                          ? '2px dashed #7c3aed'
                          : isDraggingThis
                          ? '2px dashed #cbd5e1'
                          : '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '14px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'grab',
                        boxShadow: isDropTarget
                          ? '0 10px 25px rgba(124, 58, 237, 0.22)'
                          : isDraggingThis
                          ? 'none'
                          : '0 1px 3px rgba(0,0,0,0.03)',
                        transform: isDropTarget ? 'scale(1.02)' : 'none',
                        opacity: isDraggingThis ? 0.35 : 1,
                        transition: 'all 0.15s ease',
                        position: 'relative',
                        userSelect: 'none',
                      }}
                      onMouseEnter={e => {
                        if (!draggedElement) {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.borderColor = '#c084fc';
                          e.currentTarget.style.boxShadow = '0 6px 14px rgba(90, 61, 92, 0.08)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!draggedElement) {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.borderColor = '#e2e8f0';
                          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.03)';
                        }
                      }}
                    >
                      {/* Drop overlay badge */}
                      {isDropTarget && (
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundColor: 'rgba(250, 245, 255, 0.95)',
                            borderRadius: '9px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            color: '#7c3aed',
                            fontWeight: '700',
                            fontSize: '13px',
                            zIndex: 10,
                            pointerEvents: 'none',
                          }}
                        >
                          <span>📥</span>
                          <span>Plasează în „{folder.name}”</span>
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                        <span style={{ fontSize: '32px', color: '#a855f7' }}>📁</span>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: '700',
                              fontSize: '14px',
                              color: '#1e293b',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={folder.name}
                          >
                            {folder.name}
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{counts.subCount > 0 ? `${counts.subCount} foldere · ` : ''}{counts.itCount} {counts.itCount === 1 ? 'element' : 'elemente'}</span>
                            {folder.allowedRolesToView && folder.allowedRolesToView !== 'ALL' && (
                              <span
                                title={`Vizibilitate restrânsă doar pentru: ${folder.allowedRolesToView}`}
                                style={{
                                  backgroundColor: '#fef3c7',
                                  color: '#b45309',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  fontSize: '10px',
                                  fontWeight: '700',
                                }}
                              >
                                🔒 {folder.allowedRolesToView}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Folder Actions & Drag Handle */}
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}
                        onClick={e => e.stopPropagation()}
                        onMouseDown={e => e.stopPropagation()}
                      >
                        <span
                          title="Trage acest folder pentru a-l muta în alt folder"
                          style={{
                            color: '#cbd5e1',
                            fontSize: '16px',
                            cursor: 'grab',
                            padding: '2px 4px',
                            userSelect: 'none',
                          }}
                        >
                          ⋮⋮
                        </span>
                        {canEditFolder(folder) && (
                          <>
                            <button
                              draggable={false}
                              onMouseDown={e => e.stopPropagation()}
                              onClick={() => openEditFolderModal(folder)}
                              title="Editează nume și permisiuni folder"
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                padding: '4px',
                                fontSize: '13px',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#5a3d5c')}
                              onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
                            >
                              ✏️
                            </button>
                            <button
                              draggable={false}
                              onMouseDown={e => e.stopPropagation()}
                              onClick={(e) => handleDeleteFolder(folder, e)}
                              title="Șterge folderul"
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                padding: '4px',
                                fontSize: '13px',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
                              onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
                            >
                              🗑️
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── SECTION 2: ITEMS (Docs, Sheets, PDF, Notes) ─────────── */}
          <div>
            <div
              style={{
                fontSize: '14px',
                fontWeight: '700',
                color: '#475569',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>📄</span>
              <span>Fișiere & Notițe ({displayedItems.length})</span>
            </div>

            {displayedItems.length === 0 && displayedFolders.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '50px 20px',
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  border: '2px dashed #cbd5e1',
                  color: '#64748b',
                }}
              >
                <div style={{ fontSize: '36px', marginBottom: '10px' }}>📂</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>
                  {currentFolder ? `Folderul "${currentFolder.name}" este gol` : 'Nicio resursă încă'}
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '13px' }}>
                  Apasă pe butonul „➕ Adaugă” de sus pentru a crea un folder sau a adăuga Google Docs, Sheets, PDF sau o notiță!
                </p>
              </div>
            ) : displayedItems.length === 0 ? (
              <div
                style={{
                  padding: '24px',
                  backgroundColor: '#ffffff',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  color: '#64748b',
                  fontSize: '13px',
                  textAlign: 'center',
                }}
              >
                Nu există fișiere sau notițe directe aici. Poți explora subfolderele de mai sus sau adăuga unul nou!
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '16px',
                }}
              >
                {displayedItems.map(item => {
                  const isDrive = item.itemType === 'DRIVE';
                  const driveMeta = isDrive ? getDriveItemMeta(item) : null;
                  const ytId = !isDrive ? extractYouTubeId(item.content || item.youtubeUrl) : null;
                  const isDraggingThis = draggedElement?.type === 'ITEM' && draggedElement.id === item.id;

                  // Folder tag if in search mode
                  const parentF = search.trim() && item.folderId
                    ? folders.find(f => f.id === item.folderId)
                    : null;

                  let imgs = [];
                  if (!isDrive && item.imagesJson) {
                    try { imgs = JSON.parse(item.imagesJson); } catch (_) {}
                  }

                  return (
                    <div
                      key={item.id}
                      draggable={true}
                      onDragStart={(e) => {
                        handleDragStart(e, {
                          type: 'ITEM',
                          id: item.id,
                          name: item.title,
                          folderId: item.folderId,
                        });
                      }}
                      onDragEnd={handleDragEnd}
                      onClick={() => {
                        if (draggedElement) return;
                        if (Date.now() - dropOccurredAtRef.current < 250) return;
                        setViewingItem(item);
                      }}
                      style={{
                        backgroundColor: '#ffffff',
                        border: isDraggingThis ? '2px dashed #7c3aed' : '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '18px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: isDraggingThis ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
                        cursor: 'grab',
                        opacity: isDraggingThis ? 0.35 : 1,
                        transition: 'all 0.15s ease',
                        position: 'relative',
                        userSelect: 'none',
                      }}
                      onMouseEnter={e => {
                        if (!draggedElement) {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.08)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!draggedElement) {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                        }
                      }}
                    >
                      <div>
                        {/* Top Badge, Drag Handle & Delete Button */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
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
                                  backgroundColor: driveMeta.bg,
                                  color: driveMeta.color,
                                  border: `1px solid ${driveMeta.border}`,
                                }}
                              >
                                <span>{driveMeta.icon}</span>
                                <span>{driveMeta.label}</span>
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

                            {item.allowedRolesToView && item.allowedRolesToView !== 'ALL' && (
                              <span
                                title={`Vizibilitate restrânsă doar pentru: ${item.allowedRolesToView}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  backgroundColor: '#fef3c7',
                                  color: '#b45309',
                                  border: '1px solid #fde68a',
                                }}
                              >
                                🔒 {item.allowedRolesToView}
                              </span>
                            )}

                            {parentF && (
                              <span
                                draggable={false}
                                onMouseDown={e => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCurrentFolderId(parentF.id);
                                  setSearch('');
                                }}
                                title="Mergi la folder"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  backgroundColor: '#f1f5f9',
                                  color: '#475569',
                                  border: '1px solid #cbd5e1',
                                  cursor: 'pointer',
                                }}
                              >
                                <span>📁</span>
                                <span>{parentF.name}</span>
                              </span>
                            )}
                          </div>

                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={e => e.stopPropagation()}
                            onMouseDown={e => e.stopPropagation()}
                          >
                            <span
                              title="Trage acest card pentru a-l muta în alt folder"
                              style={{
                                color: '#cbd5e1',
                                fontSize: '16px',
                                cursor: 'grab',
                                padding: '2px 4px',
                                userSelect: 'none',
                              }}
                            >
                              ⋮⋮
                            </span>
                        {canEditItem(item) && (
                          <button
                            draggable={false}
                            onMouseDown={e => e.stopPropagation()}
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
                        )}
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

                        {/* Content snippet / Drive info */}
                        {isDrive ? (
                          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px' }}>
                            {driveMeta.isLink ? (
                              <div
                                style={{
                                  fontWeight: '500',
                                  color: '#2563eb',
                                  wordBreak: 'break-all',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: '#f8fafc',
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #e2e8f0',
                                }}
                              >
                                <span>🔗</span>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {item.fileData || item.content}
                                </span>
                              </div>
                            ) : (
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  background: '#f8fafc',
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #e2e8f0',
                                }}
                              >
                                <span style={{ fontWeight: '600', color: '#334155' }}>📑 {item.fileName}</span>
                                <span>{formatBytes(item.fileSize)}</span>
                              </div>
                            )}
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
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={(e) => handleOpenDriveItem(item, e)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '5px 12px',
                                borderRadius: '6px',
                                backgroundColor: driveMeta.bg,
                                color: driveMeta.color,
                                border: `1px solid ${driveMeta.border}`,
                                fontSize: '12px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                transition: 'all 0.12s',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(0.95)')}
                              onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
                            >
                              <span>{driveMeta.icon}</span>
                              <span>{driveMeta.actionText}</span>
                            </button>

                            {!driveMeta.isLink && item.fileData && (
                              <button
                                onClick={(e) => handleDownloadFile(item, e)}
                                title="Descarcă fișierul"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  backgroundColor: '#f1f5f9',
                                  color: '#475569',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                }}
                              >
                                ⬇️
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#5a3d5c', fontWeight: '600' }}>Citește notița →</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── View Item Modal (Note or Drive) ────────────────────────── */}
      {viewingItem && (
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
              maxWidth: viewingItem.itemType === 'DRIVE' ? '760px' : '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px',
              boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
              textAlign: 'left',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                {viewingItem.itemType === 'DRIVE' ? (
                  (() => {
                    const m = getDriveItemMeta(viewingItem);
                    return (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700',
                          backgroundColor: m.bg,
                          color: m.color,
                          border: `1px solid ${m.border}`,
                          marginBottom: '8px',
                        }}
                      >
                        <span>{m.icon}</span>
                        <span>{m.label}</span>
                      </span>
                    );
                  })()
                ) : (
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
                )}
                <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: '800', color: '#1e293b' }}>
                  {viewingItem.title}
                </h2>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                  Adăugat de: <strong>{viewingItem.creator?.username || 'Utilizator'}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {canEditItem(viewingItem) && viewingItem.itemType !== 'DRIVE' && (
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
                )}
                {canEditItem(viewingItem) && (
                  <button
                    onClick={() => {
                      const it = viewingItem;
                      handleDelete(it);
                    }}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#fef2f2',
                      color: '#dc2626',
                      border: '1px solid #fecaca',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    🗑️ Șterge
                  </button>
                )}
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

            {/* Content: Drive View vs Note View */}
            {viewingItem.itemType === 'DRIVE' ? (
              <div>
                {(() => {
                  const m = getDriveItemMeta(viewingItem);
                  return (
                    <div style={{ marginBottom: '20px' }}>
                      <div
                        style={{
                          padding: '16px 20px',
                          backgroundColor: m.bg,
                          border: `1px solid ${m.border}`,
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '16px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '32px' }}>{m.icon}</span>
                          <div>
                            <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '14px' }}>
                              {m.label}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b', wordBreak: 'break-all' }}>
                              {viewingItem.fileData || viewingItem.content}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleOpenDriveItem(viewingItem)}
                          style={{
                            padding: '10px 18px',
                            backgroundColor: m.color,
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: '700',
                            fontSize: '13px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                          }}
                        >
                          <span>🔗</span>
                          <span>Deschide în filă nouă ↗</span>
                        </button>
                      </div>

                      {/* If it's a PDF with base64 data, embed preview */}
                      {viewingItem.fileData && !viewingItem.fileData.startsWith('http') && (
                        <div style={{ marginTop: '20px' }}>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
                            Previzualizare PDF:
                          </div>
                          <iframe
                            src={`data:application/pdf;base64,${viewingItem.fileData}`}
                            title="PDF Preview"
                            style={{
                              width: '100%',
                              height: '480px',
                              border: '1px solid #cbd5e1',
                              borderRadius: '8px',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div>
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
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: '700',
                          color: '#dc2626',
                          marginBottom: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span>🎬</span> Videoclip YouTube atașat (Play direct)
                      </div>
                      <div
                        style={{
                          position: 'relative',
                          paddingBottom: '56.25%',
                          height: 0,
                          overflow: 'hidden',
                          borderRadius: '10px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        }}
                      >
                        <iframe
                          src={`https://www.youtube.com/embed/${ytId}`}
                          title="YouTube video player"
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
                  );
                })()}

                {/* Images Gallery */}
                {(() => {
                  let imgs = [];
                  if (viewingItem.imagesJson) {
                    try { imgs = JSON.parse(viewingItem.imagesJson); } catch (_) {}
                  }
                  if (imgs.length === 0) return null;
                  return (
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>
                        📷 Poze atașate ({imgs.length})
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                          gap: '10px',
                        }}
                      >
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
              </div>
            )}

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

      {/* ── Create / Edit Folder Modal ─────────────────────────────── */}
      {(isFolderModalOpen || renamingFolder) && (
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
              maxWidth: '520px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b', fontWeight: '800' }}>
                {renamingFolder ? '✏️ Editează Folder & Permisiuni' : '📁 Creează Folder Nou'}
              </h3>
              <button
                onClick={() => {
                  setIsFolderModalOpen(false);
                  setRenamingFolder(null);
                  setFolderNameInput('');
                }}
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

            <form onSubmit={renamingFolder ? handleRenameFolder : handleCreateFolder}>
              {!renamingFolder && (
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                  Locație: <strong>{currentFolder ? `📁 ${currentFolder.name}` : '🏠 Rădăcină'}</strong>
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Nume folder *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="ex: Documentație Tehnică, Sprint 1, Ghiduri..."
                  value={folderNameInput}
                  onChange={e => setFolderNameInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Permission Settings */}
              <div style={{ marginTop: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '16px' }}>🔐</span>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#1e293b' }}>
                    Permisiuni & Drepturi pe Roluri
                  </span>
                </div>

                {/* 1. View Permission */}
                <div style={{ marginBottom: '14px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    👁️ Cine poate vedea folderul și conținutul său?
                  </label>
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '8px', fontSize: '13px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="folderViewMode"
                        checked={folderViewMode === 'ALL'}
                        onChange={() => setFolderViewMode('ALL')}
                      />
                      <span>Toate rolurile</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="folderViewMode"
                        checked={folderViewMode === 'CUSTOM'}
                        onChange={() => setFolderViewMode('CUSTOM')}
                      />
                      <span>Doar rolurile selectate</span>
                    </label>
                  </div>
                  {folderViewMode === 'CUSTOM' && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                      {permissions.systemRoles.map(role => {
                        const isAdminRole = role.toLowerCase() === 'admin';
                        const isChecked = isAdminRole || folderViewRoles.includes(role);
                        return (
                          <label
                            key={role}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              backgroundColor: isChecked ? '#eff6ff' : '#ffffff',
                              border: `1px solid ${isChecked ? '#93c5fd' : '#cbd5e1'}`,
                              fontSize: '12px',
                              cursor: isAdminRole ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isAdminRole}
                              onChange={() => toggleRoleInList(role, folderViewRoles, setFolderViewRoles)}
                            />
                            <span>{role}</span>
                            {isAdminRole && <span style={{ fontSize: '10px', color: '#64748b' }}>(Implicit)</span>}
                          </label>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                    * Utilizatorii fără acces nu vor vedea deloc acest folder sau fișierele din interior.
                  </div>
                </div>

                {/* 2. Write Permission */}
                <div style={{ marginBottom: '14px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    ✍️ Cine poate adăuga conținut (fișiere / subfoldere)?
                  </label>
                  <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#64748b' }}>
                    Rolurile selectate pot adăuga conținut în acest folder chiar dacă nu au drept de creare în sistem.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {permissions.systemRoles.map(role => {
                      const isAdminRole = role.toLowerCase() === 'admin';
                      const isChecked = isAdminRole || folderWriteRoles.includes(role);
                      return (
                        <label
                          key={role}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            backgroundColor: isChecked ? '#f0fdf4' : '#ffffff',
                            border: `1px solid ${isChecked ? '#86efac' : '#cbd5e1'}`,
                            fontSize: '12px',
                            cursor: isAdminRole ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isAdminRole}
                            onChange={() => toggleRoleInList(role, folderWriteRoles, setFolderWriteRoles)}
                          />
                          <span>{role}</span>
                          {isAdminRole && <span style={{ fontSize: '10px', color: '#64748b' }}>(Implicit)</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Edit Permission */}
                <div style={{ marginBottom: '16px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    ⚙️ Cine poate edita sau șterge folderul?
                  </label>
                  <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#64748b' }}>
                    Creatorul și Administratorii au întotdeauna acces de editare și administrare.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {permissions.systemRoles.map(role => {
                      const isAdminRole = role.toLowerCase() === 'admin';
                      const isChecked = isAdminRole || folderEditRoles.includes(role);
                      return (
                        <label
                          key={role}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            backgroundColor: isChecked ? '#faf5ff' : '#ffffff',
                            border: `1px solid ${isChecked ? '#d8b4fe' : '#cbd5e1'}`,
                            fontSize: '12px',
                            cursor: isAdminRole ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isAdminRole}
                            onChange={() => toggleRoleInList(role, folderEditRoles, setFolderEditRoles)}
                          />
                          <span>{role}</span>
                          {isAdminRole && <span style={{ fontSize: '10px', color: '#64748b' }}>(Implicit)</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsFolderModalOpen(false);
                    setRenamingFolder(null);
                    setFolderNameInput('');
                  }}
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
                  style={{
                    padding: '8px 18px',
                    backgroundColor: '#5a3d5c',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  {renamingFolder ? 'Salvează Modificările' : 'Creează Folder'}
                </button>
              </div>
            </form>
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
                {editingId ? '✏️ Editează Notița' : '📝 Creează Notiță Simplă'}
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
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                Locație: <strong>{currentFolder ? `📁 ${currentFolder.name}` : '🏠 Rădăcină'}</strong>
              </div>

              {/* Titlu */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Titlu Notiță *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Idei proiect, Notițe ședință..."
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
                  Conținut (linkurile YouTube sunt detectate automat)
                </label>
                <textarea
                  rows={5}
                  placeholder="Scrie notița aici... Poți include un link YouTube (ex: https://youtube.com/watch?v=...) și se va genera automat player-ul video!"
                  value={noteContent}
                  onChange={e => setNoteContent(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    lineHeight: 1.5,
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* YouTube Preview if detected */}
              {detectedYouTubeId && (
                <div
                  style={{
                    marginBottom: '16px',
                    padding: '12px',
                    backgroundColor: '#fef2f2',
                    borderRadius: '8px',
                    border: '1px solid #fecaca',
                  }}
                >
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#dc2626',
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
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
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#5a3d5c',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: '#f3e8ff',
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
                    {noteImages.map((img, idx) => (
                      <div
                        key={idx}
                        style={{
                          position: 'relative',
                          width: '70px',
                          height: '70px',
                          borderRadius: '6px',
                          overflow: 'hidden',
                          border: '1px solid #cbd5e1',
                        }}
                      >
                        <img src={img} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button
                          type="button"
                          onClick={() => removeNoteImage(idx)}
                          style={{
                            position: 'absolute',
                            top: '2px',
                            right: '2px',
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '18px',
                            height: '18px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Optional Visibility Restriction */}
              <div style={{ marginBottom: '18px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="checkbox"
                      checked={itemRestrictedView}
                      onChange={e => setItemRestrictedView(e.target.checked)}
                    />
                    <span>🔒 Restrânge vizibilitatea doar pentru anumite roluri (opțional)</span>
                  </label>
                </div>
                {!itemRestrictedView && (
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', marginLeft: '22px' }}>
                    {currentFolder
                      ? `Implicit: Moștenește automat drepturile folderului "${currentFolder.name}"`
                      : 'Implicit: Vizibil pentru toate rolurile autorizate'}
                  </div>
                )}
                {itemRestrictedView && (
                  <div style={{ marginTop: '10px', marginLeft: '22px' }}>
                    <div style={{ fontSize: '11px', color: '#475569', marginBottom: '6px' }}>
                      Bifează rolurile care vor putea vedea acest fișier / document:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {permissions.systemRoles.map(role => {
                        const isAdminRole = role.toLowerCase() === 'admin';
                        const isChecked = isAdminRole || itemAllowedRoles.includes(role);
                        return (
                          <label
                            key={role}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              backgroundColor: isChecked ? '#eff6ff' : '#ffffff',
                              border: `1px solid ${isChecked ? '#93c5fd' : '#cbd5e1'}`,
                              fontSize: '12px',
                              cursor: isAdminRole ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isAdminRole}
                              onChange={() => toggleRoleInList(role, itemAllowedRoles, setItemAllowedRoles)}
                            />
                            <span>{role}</span>
                            {isAdminRole && <span style={{ fontSize: '10px', color: '#64748b' }}>(Implicit)</span>}
                          </label>
                        );
                      })}
                    </div>
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

      {/* ── Add Drive Resource Modal (Docs, Sheets, PDF) ───────────── */}
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
              maxWidth: '520px',
              padding: '26px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b', fontWeight: '800' }}>
                📁 Adaugă resursă Drive (Docs, Sheets, PDF)
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

            {/* Mode Selector Tabs: LINK vs PDF FILE */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '18px',
                padding: '4px',
                backgroundColor: '#f1f5f9',
                borderRadius: '8px',
              }}
            >
              <button
                type="button"
                onClick={() => setDriveMode('LINK')}
                style={{
                  flex: 1,
                  padding: '8px',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: driveMode === 'LINK' ? '#ffffff' : 'transparent',
                  color: driveMode === 'LINK' ? '#1e293b' : '#64748b',
                  fontWeight: driveMode === 'LINK' ? '700' : '500',
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: driveMode === 'LINK' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.12s',
                }}
              >
                🔗 Link Docs / Sheets / PDF
              </button>
              <button
                type="button"
                onClick={() => setDriveMode('FILE')}
                style={{
                  flex: 1,
                  padding: '8px',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: driveMode === 'FILE' ? '#ffffff' : 'transparent',
                  color: driveMode === 'FILE' ? '#1e293b' : '#64748b',
                  fontWeight: driveMode === 'FILE' ? '700' : '500',
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: driveMode === 'FILE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.12s',
                }}
              >
                📤 Încarcă fișier PDF
              </button>
            </div>

            <form onSubmit={handleSaveDrive}>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                Locație: <strong>{currentFolder ? `📁 ${currentFolder.name}` : '🏠 Rădăcină'}</strong>
              </div>

              {driveMode === 'LINK' ? (
                /* ── Mode 1: URL input ── */
                <div>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                      Link resursă Google Docs, Spreadsheet sau PDF *
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="ex: https://docs.google.com/document/d/... sau /spreadsheets/d/... sau link .pdf"
                      value={driveUrl}
                      onChange={e => {
                        const val = e.target.value;
                        setDriveUrl(val);
                        if (!driveTitle && val) {
                          if (val.includes('document')) setDriveTitle('Document Google Docs');
                          else if (val.includes('spreadsheets')) setDriveTitle('Centralizator Google Sheets');
                          else if (val.toLowerCase().endsWith('.pdf')) setDriveTitle('Document PDF');
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                      }}
                    />

                    {/* Detected Type Badge */}
                    {liveDriveMeta && (
                      <div
                        style={{
                          marginTop: '8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          backgroundColor: liveDriveMeta.bg,
                          color: liveDriveMeta.color,
                          border: `1px solid ${liveDriveMeta.border}`,
                        }}
                      >
                        <span>{liveDriveMeta.icon}</span>
                        <span>{liveDriveMeta.label} detectat</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* ── Mode 2: PDF File Upload ── */
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
                    Selectează fișierul PDF *
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
                      accept=".pdf,application/pdf"
                      onChange={handleDriveFileSelect}
                      style={{ display: 'none' }}
                    />
                    {driveFile ? (
                      <div>
                        <div style={{ fontSize: '28px', marginBottom: '4px' }}>📑</div>
                        <div style={{ fontWeight: '700', color: '#166534', fontSize: '14px', wordBreak: 'break-all' }}>
                          {driveFile.name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#4ade80', marginTop: '2px' }}>
                          {formatBytes(driveFile.size)} · Click pentru a schimba fișierul
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: '32px', marginBottom: '6px' }}>📄</div>
                        <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '13px' }}>
                          Click pentru a alege un fișier PDF
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                          Doar fișiere .pdf (max 15MB)
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Titlu Resursă */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Titlu afișat în platformă *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Specificații Tehnice, Centralizator Buget, Manual..."
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

              {/* Optional Visibility Restriction */}
              <div style={{ marginBottom: '18px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="checkbox"
                      checked={itemRestrictedView}
                      onChange={e => setItemRestrictedView(e.target.checked)}
                    />
                    <span>🔒 Restrânge vizibilitatea doar pentru anumite roluri (opțional)</span>
                  </label>
                </div>
                {!itemRestrictedView && (
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', marginLeft: '22px' }}>
                    {currentFolder
                      ? `Implicit: Moștenește automat drepturile folderului "${currentFolder.name}"`
                      : 'Implicit: Vizibil pentru toate rolurile autorizate'}
                  </div>
                )}
                {itemRestrictedView && (
                  <div style={{ marginTop: '10px', marginLeft: '22px' }}>
                    <div style={{ fontSize: '11px', color: '#475569', marginBottom: '6px' }}>
                      Bifează rolurile care vor putea vedea acest fișier / document:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {permissions.systemRoles.map(role => {
                        const isAdminRole = role.toLowerCase() === 'admin';
                        const isChecked = isAdminRole || itemAllowedRoles.includes(role);
                        return (
                          <label
                            key={role}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              backgroundColor: isChecked ? '#eff6ff' : '#ffffff',
                              border: `1px solid ${isChecked ? '#93c5fd' : '#cbd5e1'}`,
                              fontSize: '12px',
                              cursor: isAdminRole ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isAdminRole}
                              onChange={() => toggleRoleInList(role, itemAllowedRoles, setItemAllowedRoles)}
                            />
                            <span>{role}</span>
                            {isAdminRole && <span style={{ fontSize: '10px', color: '#64748b' }}>(Implicit)</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
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
                  disabled={driveSaving || (driveMode === 'LINK' ? !driveUrl.trim() : !driveFile)}
                  style={{
                    padding: '9px 20px',
                    backgroundColor: '#5a3d5c',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: driveSaving || (driveMode === 'LINK' ? !driveUrl.trim() : !driveFile) ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 4px rgba(90, 61, 92, 0.25)',
                    opacity: (driveMode === 'LINK' ? driveUrl.trim() : driveFile) ? 1 : 0.6,
                  }}
                >
                  {driveSaving ? 'Se salvează...' : 'Adaugă resursa'}
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

      {/* ── Drag & Drop Floating Helper Bar ──────────────────────────── */}
      {draggedElement && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#1e293b',
            color: '#ffffff',
            padding: '12px 22px',
            borderRadius: '50px',
            boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '13px',
            fontWeight: '600',
            animation: 'fadeIn 0.15s ease',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          <span style={{ fontSize: '18px' }}>
            {draggedElement.type === 'FOLDER' ? '📁' : '📄'}
          </span>
          <span>
            Tragi <strong>„{draggedElement.name}”</strong> — plasează-l peste un folder sau în bara de navigare de sus
          </span>
          <button
            onClick={() => {
              setDraggedElement(null);
              setActiveDropTargetId(null);
            }}
            style={{
              backgroundColor: 'rgba(255,255,255,0.18)',
              border: 'none',
              color: '#ffffff',
              borderRadius: '20px',
              padding: '5px 12px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '700',
              marginLeft: '6px',
              transition: 'background-color 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.28)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.18)')}
          >
            Anulează
          </button>
        </div>
      )}

      {/* ── Toast Notifications ──────────────────────────────────────── */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: toast.type === 'error' ? '#ef4444' : toast.type === 'info' ? '#3b82f6' : '#10b981',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13px',
            fontWeight: '600',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <span style={{ fontSize: '16px' }}>{toast.type === 'error' ? '❌' : toast.type === 'info' ? 'ℹ️' : '✅'}</span>
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
}
