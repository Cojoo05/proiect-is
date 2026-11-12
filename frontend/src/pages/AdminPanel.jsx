import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';

const COLOR_PRESETS = [
  { label: 'Mov (Brand)', value: '#5a3d5c' },
  { label: 'Roșu (Admin)', value: '#dc2626' },
  { label: 'Albastru (Manager)', value: '#2563eb' },
  { label: 'Verde (Membru)', value: '#16a34a' },
  { label: 'Chihlimbar (Editor)', value: '#d97706' },
  { label: 'Indigo (Specialist)', value: '#4f46e5' },
  { label: 'Gri Închis', value: '#334155' },
];

export default function AdminPanel({ currentUser }) {
  const navigate = useNavigate();

  // Active tab: 'users' | 'roles'
  const [activeTab, setActiveTab] = useState('users');

  // Users state
  const [users, setUsers] = useState([]);
  const [userFormData, setUserFormData] = useState({ username: '', email: '', password: '', role: 'User' });
  const [editingUserId, setEditingUserId] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'asc' });
  const [expandedPasswords, setExpandedPasswords] = useState({});

  // Roles state
  const [roles, setRoles] = useState([]);
  const [roleFormData, setRoleFormData] = useState({
    name: '',
    hasFullAccess: false,
    adminLevel: 0,
    color: '#5a3d5c',
    isDefault: false,
    canCreateKnowledge: true,
  });
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [showRoleModal, setShowRoleModal] = useState(false);

  // Project Transfer modal state when deleting an owner
  const [transferModal, setTransferModal] = useState({
    isOpen: false,
    user: null,
    ownedProjects: [],
    transfers: {},
  });

  // Status message
  const [statusMessage, setStatusMessage] = useState(null);

  const showStatus = (text, type = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4500);
  };

  const USERS_API = `${API_BASE_URL}/api/users`;
  const ROLES_API = `${API_BASE_URL}/api/system-roles`;

  // ── Fetch data ─────────────────────────────────────────────────────────────
  const fetchRoles = async () => {
    try {
      const res = await fetch(ROLES_API);
      if (res.ok) {
        const data = await res.json();
        setRoles(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Eroare la încărcarea rolurilor:", err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(USERS_API);
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Eroare la încărcarea utilizatorilor:", err);
    }
  };

  useEffect(() => {
    fetchRoles();
    fetchUsers();
  }, []);

  // Default role name fallback
  const defaultRoleName = useMemo(() => {
    const def = roles.find(r => r.isDefault);
    if (def) return def.name;
    const userRole = roles.find(r => r.name?.toLowerCase() === 'user');
    return userRole ? userRole.name : (roles[0]?.name || 'User');
  }, [roles]);

  // Set initial form role once roles are loaded
  useEffect(() => {
    if (!editingUserId && defaultRoleName && (!userFormData.role || userFormData.role === 'USER')) {
      setUserFormData(prev => ({ ...prev, role: defaultRoleName }));
    }
  }, [defaultRoleName, editingUserId]);

  // ── User CRUD ──────────────────────────────────────────────────────────────
  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!userFormData.username.trim() || !userFormData.email.trim()) {
      return showStatus("Numele de utilizator și emailul sunt obligatorii!", "error");
    }

    const method = editingUserId ? 'PUT' : 'POST';
    const url = editingUserId ? `${USERS_API}/${editingUserId}` : USERS_API;

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userFormData),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "Eroare la salvarea utilizatorului!");
      }

      showStatus(editingUserId ? "Utilizator actualizat cu succes!" : "Utilizator adăugat cu succes!", "success");
      fetchUsers();
      fetchRoles();
      setUserFormData({ username: '', email: '', password: '', role: defaultRoleName });
      setEditingUserId(null);
    } catch (err) {
      showStatus(err.message, "error");
    }
  };

  const handleEditUser = (user) => {
    setUserFormData({
      username: user.username,
      email: user.email,
      password: '',
      role: user.role || defaultRoleName,
    });
    setEditingUserId(user.id);
    setActiveTab('users');
  };

  const handleDeleteUser = async (id, username) => {
    try {
      // 1. Verificăm dacă utilizatorul deține proiecte
      const summaryRes = await fetch(`${USERS_API}/${id}/projects-summary`);
      const ownedProjects = summaryRes.ok ? await summaryRes.json() : [];

      if (Array.isArray(ownedProjects) && ownedProjects.length > 0) {
        // Pre-selectăm administratorul curent ca opțiune implicită
        const initialTransfers = {};
        ownedProjects.forEach(p => {
          initialTransfers[p.id] = currentUser?.id || '';
        });

        setTransferModal({
          isOpen: true,
          user: { id, username },
          ownedProjects,
          transfers: initialTransfers,
        });
        return;
      }

      // Dacă nu deține proiecte, confirmare simplă
      if (!window.confirm(`Ești sigur că vrei să ștergi utilizatorul "${username}"?`)) return;

      await executeDeleteUser(id, {});
    } catch (err) {
      showStatus(err.message, "error");
    }
  };

  const executeDeleteUser = async (id, projectTransfers) => {
    try {
      const res = await fetch(`${USERS_API}/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminUserId: currentUser?.id,
          projectTransfers: projectTransfers || {},
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "Eroare la ștergerea utilizatorului!");
      }

      showStatus("Utilizator arhivat și date curățate cu succes!", "success");
      setTransferModal({ isOpen: false, user: null, ownedProjects: [], transfers: {} });
      fetchUsers();
      fetchRoles();
    } catch (err) {
      showStatus(err.message, "error");
    }
  };

  const handleQuickChangeRole = async (userId, newRole) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;

    try {
      const res = await fetch(`${USERS_API}/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: targetUser.username,
          email: targetUser.email,
          role: newRole,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Eroare la schimbarea rolului!");
      }

      showStatus(`Rolul utilizatorului ${targetUser.username} a fost schimbat în "${newRole}".`, "success");
      fetchUsers();
      fetchRoles();
    } catch (err) {
      showStatus(err.message, "error");
      fetchUsers();
    }
  };

  // ── Desincronizare Google (Admin only) ──────────────────────────────────────
  const handleDesyncGoogle = async (targetUser) => {
    if (!window.confirm(`Ești sigur că vrei să desincronizezi contul Google al utilizatorului "${targetUser.username}"?`)) {
      return;
    }
    try {
      const res = await fetch(`${USERS_API}/${targetUser.id}/desync-google?adminId=${currentUser?.id}`, {
        method: 'POST',
      });
      if (res.ok) {
        showStatus(`Contul Google al utilizatorului ${targetUser.username} a fost desincronizat cu succes!`, "success");
        fetchUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        showStatus(err.message || "Eroare la desincronizarea contului Google.", "error");
      }
    } catch (err) {
      showStatus("Eroare la comunicarea cu serverul.", "error");
    }
  };

  // ── Role CRUD ──────────────────────────────────────────────────────────────
  const handleOpenNewRoleModal = () => {
    setRoleFormData({
      name: '',
      hasFullAccess: false,
      adminLevel: 0,
      color: '#5a3d5c',
      isDefault: false,
      canCreateKnowledge: true,
    });
    setEditingRoleId(null);
    setShowRoleModal(true);
  };

  const handleOpenEditRoleModal = (role) => {
    setRoleFormData({
      name: role.name,
      hasFullAccess: Boolean(role.hasFullAccess),
      adminLevel: role.adminLevel || 0,
      color: role.color || '#5a3d5c',
      isDefault: Boolean(role.isDefault),
      canCreateKnowledge: role.canCreateKnowledge !== false,
    });
    setEditingRoleId(role.id);
    setShowRoleModal(true);
  };

  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!roleFormData.name.trim()) {
      return showStatus("Numele rolului este obligatoriu!", "error");
    }

    const method = editingRoleId ? 'PUT' : 'POST';
    const url = editingRoleId ? `${ROLES_API}/${editingRoleId}` : ROLES_API;

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roleFormData),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "Eroare la salvarea rolului!");
      }

      showStatus(editingRoleId ? "Rol actualizat cu succes!" : "Rol nou creat cu succes!", "success");
      setShowRoleModal(false);
      fetchRoles();
      fetchUsers();
    } catch (err) {
      showStatus(err.message, "error");
    }
  };

  const handleDeleteRole = async (role) => {
    if (!window.confirm(`Ești sigur că vrei să ștergi rolul "${role.name}"?\n(Dacă există utilizatori asociați, aceștia vor fi transferați pe rolul implicit)`)) {
      return;
    }

    try {
      const res = await fetch(`${ROLES_API}/${role.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "Eroare la ștergerea rolului!");
      }

      showStatus(`Rolul "${role.name}" a fost șters cu succes!`, "success");
      fetchRoles();
      fetchUsers();
    } catch (err) {
      showStatus(err.message, "error");
    }
  };

  // ── Sort users ─────────────────────────────────────────────────────────────
  const handleSort = (key) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc',
    });
  };

  const sortedUsers = [...users].sort((a, b) => {
    const valA = a[sortConfig.key] ?? '';
    const valB = b[sortConfig.key] ?? '';
    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', backgroundColor: '#f8fafc', padding: '30px 24px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* ── Top Bar / Header ───────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Conectat ca Admin:</span>{' '}
            <strong style={{ color: '#1e293b' }}>{currentUser?.username || 'Admin'}</strong>
          </div>
        </div>

        {/* ── Title & Intro ──────────────────────────────────────────────── */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ margin: '0 0 6px 0', fontSize: '1.85rem', color: '#0f172a', fontWeight: '800' }}>
            ⚙️ Admin Panel
          </h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '15px' }}>
            Gestionează utilizatorii sistemului, nivelurile de acces și configurează rolurile disponibile.
          </p>
        </div>

        {/* ── Status Banner ──────────────────────────────────────────────── */}
        {statusMessage && (
          <div
            style={{
              padding: '12px 18px',
              borderRadius: '8px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: statusMessage.type === 'error' ? '#fee2e2' : '#dcfce7',
              color: statusMessage.type === 'error' ? '#991b1b' : '#166534',
              border: `1px solid ${statusMessage.type === 'error' ? '#f87171' : '#86efac'}`,
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            <span>{statusMessage.type === 'error' ? '⚠️ ' : '✅ '}{statusMessage.text}</span>
            <button
              onClick={() => setStatusMessage(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: 'inherit' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Navigation Tabs ────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #e2e8f0', marginBottom: '24px' }}>
          <button
            onClick={() => setActiveTab('users')}
            style={{
              padding: '12px 20px',
              backgroundColor: activeTab === 'users' ? '#ffffff' : 'transparent',
              color: activeTab === 'users' ? '#5a3d5c' : '#64748b',
              border: 'none',
              borderBottom: activeTab === 'users' ? '3px solid #5a3d5c' : '3px solid transparent',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '-2px',
              borderRadius: '6px 6px 0 0',
              transition: 'all 0.15s',
            }}
          >
            👥 Utilizatori ({users.length})
          </button>

          <button
            onClick={() => setActiveTab('roles')}
            style={{
              padding: '12px 20px',
              backgroundColor: activeTab === 'roles' ? '#ffffff' : 'transparent',
              color: activeTab === 'roles' ? '#5a3d5c' : '#64748b',
              border: 'none',
              borderBottom: activeTab === 'roles' ? '3px solid #5a3d5c' : '3px solid transparent',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '-2px',
              borderRadius: '6px 6px 0 0',
              transition: 'all 0.15s',
            }}
          >
            🛡️ Management Roluri ({roles.length})
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: USERS                                                        */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'users' && (
          <div>
            {/* Create / Edit User Form */}
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '20px 24px',
                marginBottom: '24px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
              }}
            >
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#1e293b', fontWeight: '700' }}>
                {editingUserId ? "✏️ Editare Utilizator" : "➕ Adaugă Utilizator Nou"}
              </h3>

              <form onSubmit={handleSaveUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr)) auto', gap: '12px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Username *"
                  value={userFormData.username}
                  onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                  style={inputStyle}
                  required
                />
                <input
                  type="email"
                  placeholder="Email *"
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                  style={inputStyle}
                  required
                />
                <input
                  type="password"
                  placeholder={editingUserId ? "Parolă nouă (opțional)" : "Parolă *"}
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                  style={inputStyle}
                  required={!editingUserId}
                />

                <select
                  value={userFormData.role}
                  onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.name}>
                      {r.name} {r.hasFullAccess ? '(Admin)' : ''}
                    </option>
                  ))}
                </select>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="submit"
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#5a3d5c',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '700',
                      fontSize: '14px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {editingUserId ? "Salvează" : "Adaugă"}
                  </button>

                  {editingUserId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingUserId(null);
                        setUserFormData({ username: '', email: '', password: '', role: defaultRoleName });
                      }}
                      style={{
                        padding: '10px 16px',
                        backgroundColor: '#f1f5f9',
                        color: '#64748b',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                      }}
                    >
                      Anulează
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Users Table */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                    <th onClick={() => handleSort('id')} style={{ ...thStyle, cursor: 'pointer' }}>ID ↕</th>
                    <th onClick={() => handleSort('username')} style={{ ...thStyle, cursor: 'pointer' }}>Username ↕</th>
                    <th onClick={() => handleSort('email')} style={{ ...thStyle, cursor: 'pointer' }}>Email ↕</th>
                    <th style={thStyle}>Parolă</th>
                    <th onClick={() => handleSort('role')} style={{ ...thStyle, cursor: 'pointer' }}>Rol Atribuit ↕</th>
                    <th style={thStyle}>Google Sync</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Acțiuni</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.map(user => {
                    const userRoleObj = roles.find(r => r.name?.toLowerCase() === user.role?.toLowerCase());
                    const roleColor = userRoleObj?.color || (user.hasAdminAccess ? '#dc2626' : '#5a3d5c');

                    return (
                      <tr key={user.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={tdStyle}><span style={{ color: '#94a3b8' }}>#{user.id}</span></td>
                        <td style={{ ...tdStyle, fontWeight: '600', color: '#1e293b' }}>{user.username}</td>
                        <td style={tdStyle}>{user.email}</td>
                        <td style={{ ...tdStyle, maxWidth: '180px' }}>
                          <span style={{ display: 'inline-block', width: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: expandedPasswords[user.id] ? 'normal' : 'nowrap', color: '#64748b', fontSize: '12px' }}>
                            {user.password || '••••••••'}
                          </span>
                          {user.password?.length > 25 && (
                            <button
                              onClick={() => setExpandedPasswords(p => ({ ...p, [user.id]: !p[user.id] }))}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#5a3d5c', fontSize: '11px', marginLeft: '4px' }}
                            >
                              {expandedPasswords[user.id] ? '▲' : '▼'}
                            </button>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <select
                            value={user.role || defaultRoleName}
                            onChange={(e) => handleQuickChangeRole(user.id, e.target.value)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: `1px solid ${roleColor}`,
                              backgroundColor: '#ffffff',
                              color: roleColor,
                              fontWeight: '700',
                              fontSize: '12px',
                              cursor: 'pointer',
                            }}
                          >
                            {roles.map(r => (
                              <option key={r.id} value={r.name}>
                                {r.name} {r.hasFullAccess ? '👑' : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={tdStyle}>
                          {(user.googleSynced || Boolean(user.googleId)) ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  padding: '3px 8px',
                                  borderRadius: '12px',
                                  backgroundColor: '#dcfce7',
                                  color: '#166534',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                🟢 {user.email || 'Sincronizat'}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDesyncGoogle(user)}
                                style={{
                                  padding: '3px 8px',
                                  backgroundColor: '#fee2e2',
                                  color: '#dc2626',
                                  border: '1px solid #fca5a5',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                }}
                                title="Desincronizează contul de Google"
                              >
                                🔗 Desincronizează
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                              Nesincronizat
                            </span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <button
                            onClick={() => handleEditUser(user)}
                            style={{
                              padding: '5px 12px',
                              backgroundColor: '#f1f5f9',
                              color: '#334155',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '600',
                              marginRight: '6px',
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id, user.username)}
                            style={{
                              padding: '5px 12px',
                              backgroundColor: '#fee2e2',
                              color: '#dc2626',
                              border: '1px solid #fecaca',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '600',
                            }}
                          >
                            🗑️ Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {sortedUsers.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                        Niciun utilizator găsit.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: ROLES MANAGEMENT                                            */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'roles' && (
          <div>
            {/* Header with Add Role button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', color: '#1e293b', fontWeight: '700' }}>
                  Niveluri și Roluri de Sistem
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  Definește denumirile rolurilor, drepturile depline de administrator și rolul de bază.
                </p>
              </div>

              <button
                onClick={handleOpenNewRoleModal}
                style={{
                  padding: '10px 18px',
                  backgroundColor: '#5a3d5c',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(90, 61, 92, 0.2)',
                }}
              >
                ➕ Creează Rol Nou
              </button>
            </div>

            {/* Roles Grid / Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '18px' }}>
              {roles.map(role => (
                <div
                  key={role.id}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderTop: `4px solid ${role.color || '#5a3d5c'}`,
                    borderRadius: '12px',
                    padding: '20px',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    {/* Role header with badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span
                        style={{
                          backgroundColor: `${role.color || '#5a3d5c'}15`,
                          color: role.color || '#5a3d5c',
                          border: `1px solid ${role.color || '#5a3d5c'}40`,
                          padding: '4px 12px',
                          borderRadius: '99px',
                          fontWeight: '800',
                          fontSize: '14px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: role.color || '#5a3d5c' }} />
                        {role.name}
                      </span>

                      {role.isDefault && (
                        <span style={{ fontSize: '11px', fontWeight: '700', backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '4px' }}>
                          Implicit (Nou-veniți)
                        </span>
                      )}
                    </div>

                    {/* Level / Status */}
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: role.hasFullAccess ? '#dc2626' : '#1e293b', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        {role.hasFullAccess ? '👑 Nivel: Drepturi Depline (Admin)' : '👤 Nivel: Standard / Fără Drepturi'}
                      </div>
                      <div style={{ fontSize: '13px', color: '#64748b' }}>
                        👥 Utilizatori alocați: <strong style={{ color: '#1e293b' }}>{role.userCount ?? 0}</strong>
                      </div>
                      <div style={{ fontSize: '12px', color: role.canCreateKnowledge !== false ? '#16a34a' : '#64748b', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '6px' }}>
                        <span>{role.canCreateKnowledge !== false ? '✅' : '❌'}</span>
                        <span>{role.canCreateKnowledge !== false ? 'Poate crea notițe în Knowledge' : 'Fără drept de creare în Knowledge'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Role actions */}
                  <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                    <button
                      onClick={() => handleOpenEditRoleModal(role)}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        backgroundColor: '#f8fafc',
                        color: '#334155',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '600',
                      }}
                    >
                      ✏️ Editează
                    </button>

                    <button
                      onClick={() => handleDeleteRole(role)}
                      style={{
                        padding: '8px 14px',
                        backgroundColor: '#fee2e2',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '600',
                      }}
                      title="Șterge rolul (protejat de regula de siguranță)"
                    >
                      🗑️ Șterge
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* MODAL: CREATE / EDIT ROLE                                           */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {showRoleModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.55)',
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
                borderRadius: '16px',
                width: '100%',
                maxWidth: '460px',
                padding: '24px 28px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b', fontWeight: '800' }}>
                  {editingRoleId ? "✏️ Editare Rol" : "➕ Creează Rol Nou"}
                </h3>
                <button
                  onClick={() => setShowRoleModal(false)}
                  style={{ background: 'none', border: 'none', fontSize: '20px', color: '#94a3b8', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveRole}>
                {/* Role Name */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>Numele Rolului *</label>
                  <input
                    type="text"
                    placeholder="ex: Manager, SuperAdmin, Editor..."
                    value={roleFormData.name}
                    onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })}
                    style={inputStyle}
                    required
                  />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Numele ales liber pentru acest nivel de utilizator.</span>
                </div>

                {/* Full Access Checkbox */}
                <div style={{ marginBottom: '18px', padding: '12px 14px', backgroundColor: roleFormData.hasFullAccess ? '#fef2f2' : '#f8fafc', borderRadius: '8px', border: `1px solid ${roleFormData.hasFullAccess ? '#fecaca' : '#e2e8f0'}` }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={roleFormData.hasFullAccess}
                      onChange={(e) => setRoleFormData({
                        ...roleFormData,
                        hasFullAccess: e.target.checked,
                        adminLevel: e.target.checked ? 2 : 0,
                        color: e.target.checked && roleFormData.color === '#5a3d5c' ? '#dc2626' : roleFormData.color,
                      })}
                      style={{ marginTop: '3px', cursor: 'pointer' }}
                    />
                    <div>
                      <strong style={{ fontSize: '13px', color: roleFormData.hasFullAccess ? '#991b1b' : '#1e293b' }}>
                        👑 Nivel cu Drepturi Depline de Administrator
                      </strong>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        Utilizatorii cu acest rol au acces complet la Admin Panel și gestionarea întregului sistem.
                      </div>
                    </div>
                  </label>
                </div>

                {/* Can Create Knowledge Checkbox */}
                <div style={{ marginBottom: '18px', padding: '12px 14px', backgroundColor: roleFormData.canCreateKnowledge ? '#f0fdf4' : '#f8fafc', borderRadius: '8px', border: `1px solid ${roleFormData.canCreateKnowledge ? '#bbf7d0' : '#e2e8f0'}` }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={roleFormData.canCreateKnowledge}
                      onChange={(e) => setRoleFormData({ ...roleFormData, canCreateKnowledge: e.target.checked })}
                      style={{ marginTop: '3px', cursor: 'pointer' }}
                    />
                    <div>
                      <strong style={{ fontSize: '13px', color: roleFormData.canCreateKnowledge ? '#166534' : '#1e293b' }}>
                        🧠 Poate crea notițe în Knowledge
                      </strong>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        Permite utilizatorilor cu acest rol să creeze notițe noi în aplicația Knowledge.
                      </div>
                    </div>
                  </label>
                </div>

                {/* Color Selection */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>Culoare Rol</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    {COLOR_PRESETS.map(preset => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setRoleFormData({ ...roleFormData, color: preset.value })}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          backgroundColor: preset.value,
                          border: roleFormData.color === preset.value ? '3px solid #0f172a' : '2px solid transparent',
                          cursor: 'pointer',
                        }}
                        title={preset.label}
                      />
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="color"
                      value={roleFormData.color}
                      onChange={(e) => setRoleFormData({ ...roleFormData, color: e.target.value })}
                      style={{ width: '38px', height: '34px', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', padding: 0 }}
                    />
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Cod hex: {roleFormData.color}</span>
                  </div>
                </div>

                {/* Default for new users */}
                <div style={{ marginBottom: '22px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={roleFormData.isDefault}
                      onChange={(e) => setRoleFormData({ ...roleFormData, isDefault: e.target.checked })}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '13px', color: '#1e293b', fontWeight: '500' }}>
                      Setează ca rol implicit pentru utilizatorii noi la înregistrare
                    </span>
                  </label>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowRoleModal(false)}
                    style={{
                      padding: '9px 16px',
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                    }}
                  >
                    Anulează
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '9px 20px',
                      backgroundColor: '#5a3d5c',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '700',
                    }}
                  >
                    {editingRoleId ? "Actualizează Rol" : "Creează Rol"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Transfer Ownership Proiecte */}
        {transferModal.isOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(4px)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '560px',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                border: '1px solid #e2e8f0',
                padding: '28px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                    👑 Transferă Proprietatea Proiectelor
                  </h3>
                  <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748b' }}>
                    Utilizatorul <strong>{transferModal.user?.username}</strong> deține următoarele proiecte.
                    Selectează persoana care va prelua ownership-ul fiecărui proiect:
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTransferModal({ isOpen: false, user: null, ownedProjects: [], transfers: {} })}
                  style={{ background: 'none', border: 'none', fontSize: '20px', color: '#94a3b8', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', margin: '20px 0' }}>
                {transferModal.ownedProjects.map(proj => (
                  <div
                    key={proj.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '16px',
                      backgroundColor: '#f8fafc',
                    }}
                  >
                    <div style={{ fontWeight: '600', fontSize: '14px', color: '#1e293b', marginBottom: '8px' }}>
                      📁 {proj.name}
                    </div>
                    <label style={{ fontSize: '12px', fontWeight: '500', color: '#475569', display: 'block', marginBottom: '6px' }}>
                      Noul Proprietar (Owner):
                    </label>
                    <select
                      value={transferModal.transfers[proj.id] || currentUser?.id || ''}
                      onChange={e => {
                        const val = Number(e.target.value);
                        setTransferModal(prev => ({
                          ...prev,
                          transfers: { ...prev.transfers, [proj.id]: val },
                        }));
                      }}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        fontSize: '13px',
                        backgroundColor: '#ffffff',
                        color: '#0f172a',
                        fontWeight: '500',
                      }}
                    >
                      <option value={currentUser?.id}>
                        ⭐ Tu ({currentUser?.username || 'Administrator'}) {proj.members.some(m => m.id === currentUser?.id) ? '(deja membru)' : '(vei fi adăugat automat)'}
                      </option>
                      {proj.members.map(m => (
                        <option key={m.id} value={m.id}>
                          👤 {m.username} ({m.email})
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={() => setTransferModal({ isOpen: false, user: null, ownedProjects: [], transfers: {} })}
                  style={{
                    padding: '9px 16px',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600',
                  }}
                >
                  Anulează
                </button>
                <button
                  type="button"
                  onClick={() => executeDeleteUser(transferModal.user?.id, transferModal.transfers)}
                  style={{
                    padding: '9px 20px',
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '700',
                  }}
                >
                  Transferă și Șterge Contul
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Shared Mini Styles ────────────────────────────────────────────────────────
const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: '700',
  color: '#334155',
  marginBottom: '6px',
};

const thStyle = {
  padding: '12px 16px',
  fontWeight: '700',
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const tdStyle = {
  padding: '14px 16px',
  verticalAlign: 'middle',
};
