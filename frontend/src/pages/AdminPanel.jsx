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

const DEFAULT_WORKSPACE_SETTINGS = {
  projects: {
    enabled: true,
    creationPermission: 'all', // 'all' | 'roles' | 'admin'
    autoTransferOwnership: true,
    membersCanInvite: true,
    autoArchiveDays: '90',
    taskNotification: true,
    defaultPriority: 'Normală',
    restrictedTaskDelete: true,
  },
  tasks: {
    enabled: true,
    allowTaskCreation: true,
    allowDeleteTasks: true,
    notifyOnAssignment: true,
    defaultPriority: 'Normală',
    allowAttachments: true,
  },
  calendar: {
    enabled: true,
    allowGoogleCalendarSync: true,
    allowEventCreation: true,
    defaultEventDuration: '60',
    reminderMinutesBefore: '15',
    allowPublicEvents: true,
  },
  knowledge: {
    enabled: true,
    rootCreationPermission: 'roles_can_create', // 'roles_can_create' | 'admin_only' | 'all_users'
    allowGoogleDocs: true,
    allowGoogleSheets: true,
    allowPdf: true,
    allowWebLinks: true,
    allowNotes: true,
    autoInheritPermissions: true,
    allowFilePermissionOverride: true,
    maxUploadSize: '50MB',
  },
  messages: {
    enabled: true,
    allowDirectMessages: true,
    allowCreateGroups: true,
    showOnlineStatus: true,
    retentionPeriod: 'unlimited',
    allowEditMessages: true,
    allowDeleteMessages: true,
    soundNotifications: true,
    showTextPreview: true,
  },
  forMe: {
    enabled: true,
    strictPrivacy: true,
    autoSaveNotes: true,
    syncWithDashboard: true,
    dailyReminder: true,
  },
  general: {
    workspaceName: 'Workspace IS',
    organizationUrl: 'workspace.is.local',
    description: 'Platformă integrată de colaborare, proiecte și cunoștințe.',
    defaultLanguage: 'ro',
    dateFormat: 'DD/MM/YYYY',
    timezone: 'Europe/Bucharest (UTC+2)',
  },
  security: {
    allowGoogleAuth: true,
    allowGoogleRegistration: true,
    enforceComplexPasswords: true,
    sessionTimeoutHours: '24',
  },
};

// ── Reusable Toggle Component ────────────────────────────────────────────────
function SettingToggle({ label, description, checked, onChange, disabled = false }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', padding: '14px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: '600', fontSize: '14px', color: disabled ? '#94a3b8' : '#1e293b' }}>{label}</div>
        {description && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', lineHeight: '1.4' }}>{description}</div>}
      </div>
      <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', flexShrink: 0, cursor: disabled ? 'not-allowed' : 'pointer' }}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          style={{ opacity: 0, width: 0, height: 0 }}
        />
        <span
          style={{
            position: 'absolute',
            cursor: disabled ? 'not-allowed' : 'pointer',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: checked ? '#5a3d5c' : '#cbd5e1',
            transition: '0.2s',
            borderRadius: '24px',
          }}
        >
          <span
            style={{
              position: 'absolute',
              content: '""',
              height: '18px',
              width: '18px',
              left: checked ? '23px' : '3px',
              bottom: '3px',
              backgroundColor: 'white',
              transition: '0.2s',
              borderRadius: '50%',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }}
          />
        </span>
      </label>
    </div>
  );
}

// ── Reusable Module Status & Deactivation Card ──────────────────────────────
function ModuleStatusBanner({ moduleName, isEnabled, onToggle }) {
  return (
    <div
      style={{
        ...cardStyle,
        backgroundColor: isEnabled ? '#f0fdf4' : '#fef2f2',
        border: `1px solid ${isEnabled ? '#86efac' : '#fca5a5'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        padding: '18px 24px',
        flexWrap: 'wrap',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: '800',
              padding: '3px 9px',
              borderRadius: '12px',
              backgroundColor: isEnabled ? '#dcfce7' : '#fee2e2',
              color: isEnabled ? '#166534' : '#991b1b',
              border: `1px solid ${isEnabled ? '#86efac' : '#fca5a5'}`,
            }}
          >
            {isEnabled ? '🟢 MODUL ACTIV' : '🔴 MODUL DEZACTIVAT'}
          </span>
        </div>
        <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', marginTop: '6px' }}>
          {isEnabled ? `Modulul ${moduleName} este activ în workspace` : `Modulul ${moduleName} este oprit`}
        </div>
        <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
          {isEnabled
            ? 'Utilizatorii pot accesa și folosi acest modul conform rolului și permisiunilor stabilite.'
            : 'Modulul este marcat ca oprit pe Dashboard și indisponibil pentru toți membrii workspace-ului.'}
        </div>
      </div>

      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          backgroundColor: '#ffffff',
          padding: '8px 14px',
          borderRadius: '8px',
          border: '1px solid #cbd5e1',
          fontWeight: '700',
          fontSize: '13px',
          color: isEnabled ? '#166534' : '#991b1b',
          whiteSpace: 'nowrap',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        }}
      >
        <input
          type="checkbox"
          checked={isEnabled}
          onChange={(e) => onToggle(e.target.checked)}
          style={{ width: '18px', height: '18px', accentColor: '#5a3d5c', cursor: 'pointer' }}
        />
        <span>{isEnabled ? 'Modul Pornit' : 'Modul Oprit'}</span>
      </label>
    </div>
  );
}

export default function AdminPanel({ currentUser }) {
  const navigate = useNavigate();

  // Active settings section
  // 'users-roles' | 'projects' | 'knowledge' | 'messages' | 'for-me' | 'general' | 'security'
  const [activeSection, setActiveSection] = useState('users-roles');

  // Sub-tab inside Users & Roles: 'users' | 'roles'
  const [usersRolesTab, setUsersRolesTab] = useState('users');

  // Search filter for users
  const [userSearchTerm, setUserSearchTerm] = useState('');

  // Workspace & module settings
  const [settings, setSettings] = useState(() => {
    try {
      const stored = localStorage.getItem('workspace_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...DEFAULT_WORKSPACE_SETTINGS,
          ...parsed,
          projects: { ...DEFAULT_WORKSPACE_SETTINGS.projects, ...(parsed.projects || {}) },
          tasks: { ...DEFAULT_WORKSPACE_SETTINGS.tasks, ...(parsed.tasks || {}) },
          calendar: { ...DEFAULT_WORKSPACE_SETTINGS.calendar, ...(parsed.calendar || {}) },
          knowledge: { ...DEFAULT_WORKSPACE_SETTINGS.knowledge, ...(parsed.knowledge || {}) },
          messages: { ...DEFAULT_WORKSPACE_SETTINGS.messages, ...(parsed.messages || {}) },
          forMe: { ...DEFAULT_WORKSPACE_SETTINGS.forMe, ...(parsed.forMe || {}) },
          general: { ...DEFAULT_WORKSPACE_SETTINGS.general, ...(parsed.general || {}) },
          security: { ...DEFAULT_WORKSPACE_SETTINGS.security, ...(parsed.security || {}) },
        };
      }
      return DEFAULT_WORKSPACE_SETTINGS;
    } catch (_) {
      return DEFAULT_WORKSPACE_SETTINGS;
    }
  });

  // Users state
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState(null);
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
    setUsersLoading(true);
    setUsersError(null);
    try {
      const res = await fetch(USERS_API);
      if (res.ok) {
        const data = await res.json();
        const userList = Array.isArray(data) ? data : [];
        setUsers(userList);
        try {
          localStorage.setItem('cached_admin_users', JSON.stringify(userList));
        } catch (_) {}
      } else {
        const errorMsg = `Serverul a returnat codul ${res.status} (${res.statusText || 'Eroare'}).`;
        setUsersError(errorMsg);
        // Fallback la utilizatorii stocați în cache dacă există
        const cached = localStorage.getItem('cached_admin_users');
        if (cached) {
          try {
            setUsers(JSON.parse(cached));
          } catch (_) {}
        }
      }
    } catch (err) {
      console.error("Eroare la încărcarea utilizatorilor:", err);
      setUsersError(`Nu s-a putut conecta la ${USERS_API}. Verifică dacă serverul Spring Boot rulează pe portul 8080.`);
      const cached = localStorage.getItem('cached_admin_users');
      if (cached) {
        try {
          setUsers(JSON.parse(cached));
        } catch (_) {}
      }
    } finally {
      setUsersLoading(false);
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

  // ── Save Module Settings ───────────────────────────────────────────────────
  const handleSaveModuleSettings = (moduleKey, moduleLabel) => {
    try {
      localStorage.setItem('workspace_settings', JSON.stringify(settings));
      window.dispatchEvent(new CustomEvent('workspace-settings-updated', { detail: settings }));
      showStatus(`Setările pentru modulul ${moduleLabel} au fost salvate cu succes!`, 'success');
    } catch (err) {
      showStatus(`Eroare la salvarea setărilor: ${err.message}`, 'error');
    }
  };

  const updateSetting = (moduleKey, key, value) => {
    setSettings(prev => ({
      ...prev,
      [moduleKey]: {
        ...prev[moduleKey],
        [key]: value,
      },
    }));
  };

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
    setActiveSection('users-roles');
    setUsersRolesTab('users');
  };

  const handleDeleteUser = async (id, username) => {
    try {
      const summaryRes = await fetch(`${USERS_API}/${id}/projects-summary`);
      const ownedProjects = summaryRes.ok ? await summaryRes.json() : [];

      if (Array.isArray(ownedProjects) && ownedProjects.length > 0) {
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

  // ── Desincronizare Google ──────────────────────────────────────────────────
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

  // ── Sort & Filter users ────────────────────────────────────────────────────
  const handleSort = (key) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc',
    });
  };

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      if (!userSearchTerm.trim()) return true;
      const term = userSearchTerm.toLowerCase();
      return (
        user.username?.toLowerCase().includes(term) ||
        user.email?.toLowerCase().includes(term) ||
        user.role?.toLowerCase().includes(term)
      );
    });
  }, [users, userSearchTerm]);

  const sortedUsers = useMemo(() => {
    return [...filteredUsers].sort((a, b) => {
      const valA = a[sortConfig.key] ?? '';
      const valB = b[sortConfig.key] ?? '';
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredUsers, sortConfig]);

  // ── Navigation Items Definition ───────────────────────────────────────────
  const navSections = [
    {
      group: 'ACCES & UTILIZATORI',
      items: [
        { id: 'users-roles', label: 'Users & Roles', icon: '👥', badge: `${users.length}` },
      ],
    },
    {
      group: 'SETĂRI MODULE',
      items: [
        { id: 'projects', label: 'Projects', icon: '📁', desc: 'Reguli proiecte, feed & transfer' },
        { id: 'tasks', label: 'Tasks', icon: '📋', desc: 'Panou Kanban, sarcini & asignări' },
        { id: 'calendar', label: 'Calendar', icon: '📅', desc: 'Evenimente, alerte & Google Calendar' },
        { id: 'knowledge', label: 'Knowledge', icon: '🧠', desc: 'Permisiuni rădăcină, formate & foldere' },
        { id: 'messages', label: 'Mesagerie', icon: '💬', desc: 'Canale, mesaje directe & retenție' },
        { id: 'for-me', label: 'For Me', icon: '👤', desc: 'Confidențialitate spațiu personal & notițe' },
      ],
    },
    {
      group: 'PREFERINȚE SISTEM',
      items: [
        { id: 'general', label: 'General & Workspace', icon: '🏢', desc: 'Nume workspace & date regionale' },
        { id: 'security', label: 'Securitate & Google Sync', icon: '🔒', desc: 'Autentificare Google & parole' },
      ],
    },
  ];

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 60px)',
        backgroundColor: '#f8fafc',
        width: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* LEFT SETTINGS SIDEBAR                                               */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      <aside
        style={{
          width: '280px',
          minWidth: '240px',
          backgroundColor: '#ffffff',
          borderRight: '1px solid #e2e8f0',
          boxSizing: 'border-box',
          padding: '24px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          flexShrink: 0,
        }}
      >
        {/* Sidebar Header */}
        <div style={{ paddingBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '26px' }}>⚙️</span>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>
              Admin Panel
            </h2>
          </div>
        </div>

        {/* Navigation Groups */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {navSections.map(sec => (
            <div key={sec.group}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: '800',
                  color: '#94a3b8',
                  letterSpacing: '0.05em',
                  marginBottom: '8px',
                  paddingLeft: '8px',
                }}
              >
                {sec.group}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {sec.items.map(item => {
                  const isActive = activeSection === item.id;
                  const settingKey = item.id === 'for-me' ? 'forMe' : item.id;
                  const isModuleActive = settings[settingKey]?.enabled !== false;

                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: isActive ? '#f5eff8' : 'transparent',
                        color: isActive ? '#5a3d5c' : '#334155',
                        fontWeight: isActive ? '700' : '500',
                        fontSize: '13.5px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.12s ease',
                      }}
                      onMouseEnter={e => {
                        if (!isActive) e.currentTarget.style.backgroundColor = '#f8fafc';
                      }}
                      onMouseLeave={e => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '16px' }}>{item.icon}</span>
                        <span>{item.label}</span>
                      </div>

                      {item.badge ? (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            backgroundColor: isActive ? '#5a3d5c' : '#f1f5f9',
                            color: isActive ? '#ffffff' : '#64748b',
                            padding: '2px 8px',
                            borderRadius: '12px',
                          }}
                        >
                          {item.badge}
                        </span>
                      ) : sec.group === 'SETĂRI MODULE' ? (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            backgroundColor: isModuleActive
                              ? (isActive ? '#5a3d5c' : '#dcfce7')
                              : '#fee2e2',
                            color: isModuleActive
                              ? (isActive ? '#ffffff' : '#166534')
                              : '#991b1b',
                            border: `1px solid ${isModuleActive
                              ? (isActive ? '#5a3d5c' : '#bbf7d0')
                              : '#fca5a5'}`,
                            padding: '2px 7px',
                            borderRadius: '12px',
                          }}
                        >
                          {isModuleActive ? '🟢 Activ' : '🔴 Oprit'}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* RIGHT MAIN CONTENT AREA                                             */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          padding: '32px 40px',
          boxSizing: 'border-box',
          overflowY: 'auto',
        }}
      >
        {/* Status Toast Banner */}
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
              boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
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

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* SECTION 1: USERS & ROLES                                            */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeSection === 'users-roles' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h1 style={{ margin: '0 0 6px 0', fontSize: '1.75rem', color: '#0f172a', fontWeight: '800' }}>
                👥 Users & Roles Management
              </h1>
              <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
                Administrează conturile de utilizator, rolurile de sistem, sincronizarea Google și nivelurile de acces.
              </p>
            </div>

            {/* Sub-Navigation Switch */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #e2e8f0', marginBottom: '24px' }}>
              <button
                onClick={() => setUsersRolesTab('users')}
                style={{
                  padding: '10px 18px',
                  backgroundColor: usersRolesTab === 'users' ? '#ffffff' : 'transparent',
                  color: usersRolesTab === 'users' ? '#5a3d5c' : '#64748b',
                  border: 'none',
                  borderBottom: usersRolesTab === 'users' ? '3px solid #5a3d5c' : '3px solid transparent',
                  cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '-2px',
                  borderRadius: '6px 6px 0 0',
                  transition: 'all 0.15s',
                }}
              >
                👤 Utilizatori ({users.length})
              </button>

              <button
                onClick={() => setUsersRolesTab('roles')}
                style={{
                  padding: '10px 18px',
                  backgroundColor: usersRolesTab === 'roles' ? '#ffffff' : 'transparent',
                  color: usersRolesTab === 'roles' ? '#5a3d5c' : '#64748b',
                  border: 'none',
                  borderBottom: usersRolesTab === 'roles' ? '3px solid #5a3d5c' : '3px solid transparent',
                  cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '-2px',
                  borderRadius: '6px 6px 0 0',
                  transition: 'all 0.15s',
                }}
              >
                🛡️ Roluri de Sistem ({roles.length})
              </button>
            </div>

            {/* SUB-VIEW: USERS */}
            {usersRolesTab === 'users' && (
              <div>
                {/* Create / Edit User Form */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '20px 24px',
                    marginBottom: '20px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                  }}
                >
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '1.05rem', color: '#1e293b', fontWeight: '700' }}>
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

                {/* Search Bar for Users & Error Banner */}
                {usersError && (
                  <div
                    style={{
                      padding: '14px 18px',
                      backgroundColor: '#fffbeb',
                      border: '1px solid #fcd34d',
                      borderRadius: '10px',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: '#92400e' }}>
                      <span style={{ fontSize: '20px' }}>⚠️</span>
                      <div>
                        <strong>Atenție la încărcarea utilizatorilor:</strong> {usersError}
                        <div style={{ fontSize: '12px', color: '#b45309', marginTop: '2px' }}>
                          Dacă ai repornit sau modificat codul Java recent, asigură-te că ai dat <strong>Restart la aplicația Spring Boot în IntelliJ IDEA</strong> pentru maparea rutei <code>/api/users</code>.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={fetchUsers}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#d97706',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: '700',
                        fontSize: '12.5px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      🔄 Reîncearcă
                    </button>
                  </div>
                )}

                <div style={{ marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div style={{ position: 'relative', maxWidth: '340px', width: '100%' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '14px' }}>
                      🔍
                    </span>
                    <input
                      type="text"
                      value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                      placeholder="Filtrează utilizatori..."
                      style={{
                        width: '100%',
                        padding: '8px 12px 8px 34px',
                        borderRadius: '7px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                        outline: 'none',
                        backgroundColor: '#ffffff',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={fetchUsers}
                      title="Reîmprospătează lista de utilizatori"
                      style={{
                        padding: '7px 12px',
                        backgroundColor: '#ffffff',
                        color: '#5a3d5c',
                        border: '1px solid #cbd5e1',
                        borderRadius: '7px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      🔄 Reîmprospătează
                    </button>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>
                      Afișare: <strong>{sortedUsers.length}</strong> din {users.length} utilizatori
                    </span>
                  </div>
                </div>

                {/* Users Table */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    overflowX: 'auto',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)',
                  }}
                >
                  <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                        <th onClick={() => handleSort('id')} style={{ ...thStyle, cursor: 'pointer' }}>ID ↕</th>
                        <th onClick={() => handleSort('username')} style={{ ...thStyle, cursor: 'pointer' }}>Username ↕</th>
                        <th onClick={() => handleSort('email')} style={{ ...thStyle, cursor: 'pointer' }}>Email ↕</th>
                        <th style={thStyle}>Parolă</th>
                        <th onClick={() => handleSort('role')} style={{ ...thStyle, cursor: 'pointer' }}>Rol Atribuit ↕</th>
                        <th style={{ ...thStyle, minWidth: '160px' }}>Google Sync</th>
                        <th style={{ ...thStyle, textAlign: 'right', minWidth: '160px' }}>Acțiuni</th>
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
                            <td style={{ ...tdStyle, minWidth: '160px' }}>
                              {(user.googleSynced || Boolean(user.googleId)) ? (
                                <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                  <span
                                    title={user.email}
                                    style={{
                                      fontSize: '11px',
                                      fontWeight: '700',
                                      padding: '2px 8px',
                                      borderRadius: '12px',
                                      backgroundColor: '#dcfce7',
                                      color: '#166534',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      maxWidth: '180px',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    🟢 Sincronizat
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDesyncGoogle(user)}
                                    style={{
                                      padding: '2px 6px',
                                      backgroundColor: '#fee2e2',
                                      color: '#dc2626',
                                      border: '1px solid #fca5a5',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '10px',
                                      fontWeight: '600',
                                      whiteSpace: 'nowrap',
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
                            <td style={{ ...tdStyle, textAlign: 'right', minWidth: '160px', whiteSpace: 'nowrap' }}>
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
                      {usersLoading && users.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '26px' }}>⏳</span>
                              <span style={{ fontWeight: '600', fontSize: '14px' }}>Se încarcă lista de utilizatori...</span>
                            </div>
                          </td>
                        </tr>
                      ) : sortedUsers.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                            {userSearchTerm.trim()
                              ? `Niciun utilizator nu corespunde căutării "${userSearchTerm}".`
                              : 'Niciun utilizator găsit în baza de date.'}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-VIEW: ROLES */}
            {usersRolesTab === 'roles' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', color: '#1e293b', fontWeight: '700' }}>
                      Niveluri și Roluri de Sistem
                    </h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                      Definește denumirile rolurilor, drepturile depline de administrator și permisiunea de adăugare în Knowledge.
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

                {/* Roles Cards Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '18px' }}>
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
                            <span>{role.canCreateKnowledge !== false ? 'Poate crea conținut în Knowledge' : 'Fără drept de creare în Knowledge'}</span>
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
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* SECTION 2: PROJECTS MODULE SETTINGS                                 */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeSection === 'projects' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h1 style={{ margin: '0 0 6px 0', fontSize: '1.75rem', color: '#0f172a', fontWeight: '800' }}>
                  📁 Setări Modul Projects
                </h1>
                <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
                  Reguli globale de creare proiecte, politici de colaborare și managementul task-urilor.
                </p>
              </div>

              <button
                onClick={() => handleSaveModuleSettings('projects', 'Projects')}
                style={primaryBtnStyle}
              >
                💾 Salvează Setările Projects
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Deactivation / Status Card */}
              <ModuleStatusBanner
                moduleName="Projects"
                isEnabled={settings.projects.enabled !== false}
                onToggle={(v) => updateSetting('projects', 'enabled', v)}
              />

              {/* Card 1: Creare Proiecte */}
              <div style={cardStyle}>
                <h3 style={cardTitleStyle}>👑 Permisiuni de Creare Proiecte</h3>
                <p style={cardSubtitleStyle}>Stabilește cine are dreptul să inițieze noi spații de lucru și proiecte în companie.</p>

                <div style={{ margin: '14px 0' }}>
                  <label style={labelStyle}>Cine poate crea proiecte noi:</label>
                  <select
                    value={settings.projects.creationPermission}
                    onChange={(e) => updateSetting('projects', 'creationPermission', e.target.value)}
                    style={{ ...inputStyle, maxWidth: '400px', cursor: 'pointer' }}
                  >
                    <option value="all">🌐 Toți utilizatorii înregistrați</option>
                    <option value="roles">🛡️ Doar rolurile cu drepturi administrative sau moderator</option>
                    <option value="admin">🔒 Exclusiv Administratorii de sistem</option>
                  </select>
                </div>
              </div>

              {/* Card 2: Reguli de Proprietate & Membri */}
              <div style={cardStyle}>
                <h3 style={cardTitleStyle}>👥 Reguli de Proprietate & Colaborare</h3>
                <p style={cardSubtitleStyle}>Controlul transferului de proiecte și drepturile de invitație ale membrilor.</p>

                <SettingToggle
                  label="Transfer automat de proprietate la ștergerea unui cont"
                  description="Când un cont de proprietar de proiect este șters, proiectele sale sunt transferate automat administratorului."
                  checked={settings.projects.autoTransferOwnership}
                  onChange={(v) => updateSetting('projects', 'autoTransferOwnership', v)}
                />

                <SettingToggle
                  label="Permite membrilor să trimită invitații"
                  description="Membrii existenți ai unui proiect pot invita alți colegi direct, fără a necesita aprobarea prealabilă a owner-ului."
                  checked={settings.projects.membersCanInvite}
                  onChange={(v) => updateSetting('projects', 'membersCanInvite', v)}
                />

                <SettingToggle
                  label="Arhivare automată proiecte inactive"
                  description="Proiectele fără activitate pe feed sau task-uri timp de 90 de zile sunt arhivate automat."
                  checked={Boolean(settings.projects.autoArchiveDays !== 'none')}
                  onChange={(v) => updateSetting('projects', 'autoArchiveDays', v ? '90' : 'none')}
                />
              </div>

              {/* Card 3: Task-uri */}
              <div style={cardStyle}>
                <h3 style={cardTitleStyle}>📋 Notificări & Alocare Task-uri</h3>
                <p style={cardSubtitleStyle}>Configurarea alertelor și a priorităților pentru sarcinile echipei.</p>

                <SettingToggle
                  label="Notificare instant pe clopoțel la alocarea unui task"
                  description="Trimite o alertă în timp real utilizatorului atunci când este numit responsabil pe un task."
                  checked={settings.projects.taskNotification}
                  onChange={(v) => updateSetting('projects', 'taskNotification', v)}
                />

                <SettingToggle
                  label="Restricționează ștergerea task-urilor"
                  description="Doar creatorul task-ului sau Owner-ul proiectului pot elimina sarcini existente."
                  checked={settings.projects.restrictedTaskDelete}
                  onChange={(v) => updateSetting('projects', 'restrictedTaskDelete', v)}
                />

                <div style={{ marginTop: '14px' }}>
                  <label style={labelStyle}>Prioritate implicită pentru task-uri noi:</label>
                  <select
                    value={settings.projects.defaultPriority}
                    onChange={(e) => updateSetting('projects', 'defaultPriority', e.target.value)}
                    style={{ ...inputStyle, maxWidth: '280px', cursor: 'pointer' }}
                  >
                    <option value="Scăzută">🟢 Scăzută</option>
                    <option value="Normală">🟡 Normală (Implicit)</option>
                    <option value="Ridicată">🔴 Ridicată</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* SECTION: TASKS MODULE SETTINGS                                      */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeSection === 'tasks' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h1 style={{ margin: '0 0 6px 0', fontSize: '1.75rem', color: '#0f172a', fontWeight: '800' }}>
                  📋 Setări Modul Tasks
                </h1>
                <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
                  Organizarea fluxului de lucru, panoul Kanban, politicile de alocare sarcini și priorități.
                </p>
              </div>

              <button
                onClick={() => handleSaveModuleSettings('tasks', 'Tasks')}
                style={primaryBtnStyle}
              >
                💾 Salvează Setările Tasks
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Deactivation / Status Card */}
              <ModuleStatusBanner
                moduleName="Tasks (Task-uri)"
                isEnabled={settings.tasks.enabled !== false}
                onToggle={(v) => updateSetting('tasks', 'enabled', v)}
              />

              {/* Card 1: Permisiuni Gestionare Sarcini */}
              <div style={cardStyle}>
                <h3 style={cardTitleStyle}>📌 Permisiuni & Creare Sarcini</h3>
                <p style={cardSubtitleStyle}>Controlul fluxului de creare și ștergere a sarcinilor pe panoul de lucru.</p>

                <SettingToggle
                  label="Permite tuturor membrilor crearea de task-uri"
                  description="Orice utilizator din proiect poate adăuga sarcini noi pe panoul Kanban."
                  checked={settings.tasks.allowTaskCreation}
                  onChange={(v) => updateSetting('tasks', 'allowTaskCreation', v)}
                />

                <SettingToggle
                  label="Restricționează ștergerea task-urilor"
                  description="Doar creatorul task-ului sau un utilizator cu rol administrativ poate șterge definitiv o sarcină."
                  checked={settings.tasks.allowDeleteTasks}
                  onChange={(v) => updateSetting('tasks', 'allowDeleteTasks', v)}
                />

                <SettingToggle
                  label="Permite atașarea de fișiere și link-uri la sarcini"
                  description="Utilizatorii pot atașa resurse, documente sau imagini direct în detaliul unui task."
                  checked={settings.tasks.allowAttachments}
                  onChange={(v) => updateSetting('tasks', 'allowAttachments', v)}
                />
              </div>

              {/* Card 2: Alerte & Priorități */}
              <div style={cardStyle}>
                <h3 style={cardTitleStyle}>⚡ Priorități & Notificări Echipă</h3>
                <p style={cardSubtitleStyle}>Comportamentul alertelor și valorile predefinite pentru noile sarcini.</p>

                <SettingToggle
                  label="Notificare pe clopoțel la asignarea unei sarcini"
                  description="Trimite o alertă în timp real utilizatorului atunci când este numit responsabil pe un task."
                  checked={settings.tasks.notifyOnAssignment}
                  onChange={(v) => updateSetting('tasks', 'notifyOnAssignment', v)}
                />

                <div style={{ marginTop: '14px' }}>
                  <label style={labelStyle}>Prioritate implicită la adăugarea unei sarcini:</label>
                  <select
                    value={settings.tasks.defaultPriority || 'Normală'}
                    onChange={(e) => updateSetting('tasks', 'defaultPriority', e.target.value)}
                    style={{ ...inputStyle, maxWidth: '280px', cursor: 'pointer' }}
                  >
                    <option value="Scăzută">🟢 Scăzută</option>
                    <option value="Normală">🟡 Normală (Implicit)</option>
                    <option value="Ridicată">🟠 Ridicată</option>
                    <option value="Urgentă">🔴 Urgentă</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* SECTION: CALENDAR MODULE SETTINGS                                   */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeSection === 'calendar' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h1 style={{ margin: '0 0 6px 0', fontSize: '1.75rem', color: '#0f172a', fontWeight: '800' }}>
                  📅 Setări Modul Calendar
                </h1>
                <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
                  Planificarea ședințelor, agendă comună a echipei și integrarea cu Google Calendar.
                </p>
              </div>

              <button
                onClick={() => handleSaveModuleSettings('calendar', 'Calendar')}
                style={primaryBtnStyle}
              >
                💾 Salvează Setările Calendar
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Deactivation / Status Card */}
              <ModuleStatusBanner
                moduleName="Calendar"
                isEnabled={settings.calendar.enabled !== false}
                onToggle={(v) => updateSetting('calendar', 'enabled', v)}
              />

              {/* Card 1: Sincronizare Google */}
              <div style={cardStyle}>
                <h3 style={cardTitleStyle}>🌐 Integrare Google Calendar</h3>
                <p style={cardSubtitleStyle}>Conectarea evenimentelor workspace-ului cu contul Google personal al membrilor.</p>

                <SettingToggle
                  label="Permite sincronizarea bidirecțională cu Google Calendar"
                  description="Utilizatorii cu Google Sync activat pot importa și exporta evenimentele automat."
                  checked={settings.calendar.allowGoogleCalendarSync}
                  onChange={(v) => updateSetting('calendar', 'allowGoogleCalendarSync', v)}
                />

                <SettingToggle
                  label="Permite crearea de evenimente publice de echipă"
                  description="Evenimentele marcate ca publice apar automat în calendarul tuturor colegilor din workspace."
                  checked={settings.calendar.allowPublicEvents}
                  onChange={(v) => updateSetting('calendar', 'allowPublicEvents', v)}
                />
              </div>

              {/* Card 2: Planificare & Alerte */}
              <div style={cardStyle}>
                <h3 style={cardTitleStyle}>⏱️ Parametri Planificare & Alerte</h3>
                <p style={cardSubtitleStyle}>Durata standard a întâlnirilor și timpul de trimitere a alertelor.</p>

                <SettingToggle
                  label="Permite tuturor utilizatorilor programarea de evenimente"
                  description="Dacă este dezactivat, doar administratorii sau moderatorii pot adăuga ședințe pe calendar."
                  checked={settings.calendar.allowEventCreation}
                  onChange={(v) => updateSetting('calendar', 'allowEventCreation', v)}
                />

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '16px' }}>
                  <div>
                    <label style={labelStyle}>Durată implicită eveniment:</label>
                    <select
                      value={settings.calendar.defaultEventDuration || '60'}
                      onChange={(e) => updateSetting('calendar', 'defaultEventDuration', e.target.value)}
                      style={{ ...inputStyle, cursor: 'pointer' }}
                    >
                      <option value="30">30 de minute</option>
                      <option value="60">60 de minute (1 oră)</option>
                      <option value="90">90 de minute</option>
                      <option value="120">120 de minute (2 ore)</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Reminder înainte de eveniment:</label>
                    <select
                      value={settings.calendar.reminderMinutesBefore || '15'}
                      onChange={(e) => updateSetting('calendar', 'reminderMinutesBefore', e.target.value)}
                      style={{ ...inputStyle, cursor: 'pointer' }}
                    >
                      <option value="15">15 minute înainte</option>
                      <option value="30">30 de minute înainte</option>
                      <option value="60">1 oră înainte</option>
                      <option value="1440">1 zi înainte</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* SECTION 3: KNOWLEDGE MODULE SETTINGS                                */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeSection === 'knowledge' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h1 style={{ margin: '0 0 6px 0', fontSize: '1.75rem', color: '#0f172a', fontWeight: '800' }}>
                  🧠 Setări Modul Knowledge
                </h1>
                <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
                  Gestionarea drepturilor de adăugare în rădăcină, a formatelor permise și a politicilor de foldere.
                </p>
              </div>

              <button
                onClick={() => handleSaveModuleSettings('knowledge', 'Knowledge')}
                style={primaryBtnStyle}
              >
                💾 Salvează Setările Knowledge
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Deactivation / Status Card */}
              <ModuleStatusBanner
                moduleName="Knowledge"
                isEnabled={settings.knowledge.enabled !== false}
                onToggle={(v) => updateSetting('knowledge', 'enabled', v)}
              />

              {/* Card 1: Drepturi Rădăcină */}
              <div style={cardStyle}>
                <h3 style={cardTitleStyle}>📁 Permisiuni pe Rădăcină (Nivelul de Bază)</h3>
                <p style={cardSubtitleStyle}>
                  Stabilește cine are dreptul să creeze foldere și fișiere la rădăcina bazei de cunoștințe.
                </p>

                <div style={{ margin: '14px 0' }}>
                  <label style={labelStyle}>Cine poate adăuga elemente în Rădăcină:</label>
                  <select
                    value={settings.knowledge.rootCreationPermission}
                    onChange={(e) => updateSetting('knowledge', 'rootCreationPermission', e.target.value)}
                    style={{ ...inputStyle, maxWidth: '440px', cursor: 'pointer' }}
                  >
                    <option value="roles_can_create">🛡️ Rolurile cu dreptul "canCreateKnowledge" activat (Recomandat)</option>
                    <option value="admin_only">🔒 Exclusiv Administratorii de sistem</option>
                    <option value="all_users">🌐 Toți utilizatorii înregistrați</option>
                  </select>
                </div>

                <div style={{ padding: '12px 14px', backgroundColor: '#f5eff8', borderRadius: '8px', border: '1px solid #d8b4e2', fontSize: '13px', color: '#5a3d5c' }}>
                  💡 <strong>Indiciu:</strong> Poți activa sau dezactiva dreptul <code>canCreateKnowledge</code> pentru fiecare rol în secțiunea <strong>Users & Roles → Roluri de Sistem</strong>.
                </div>
              </div>

              {/* Card 2: Formate & Documente Permise */}
              <div style={cardStyle}>
                <h3 style={cardTitleStyle}>📄 Formate & Documente Permise</h3>
                <p style={cardSubtitleStyle}>Selectează ce tipuri de resurse pot fi adăugate și organizate în Knowledge.</p>

                <SettingToggle
                  label="Documente Google Docs (docs.google.com/document)"
                  description="Permite salvarea și deschiderea directă de link-uri Google Docs."
                  checked={settings.knowledge.allowGoogleDocs}
                  onChange={(v) => updateSetting('knowledge', 'allowGoogleDocs', v)}
                />

                <SettingToggle
                  label="Tabele Google Sheets / Spreadsheet (docs.google.com/spreadsheets)"
                  description="Permite indexarea și accesul rapid la foi de calcul Sheets."
                  checked={settings.knowledge.allowGoogleSheets}
                  onChange={(v) => updateSetting('knowledge', 'allowGoogleSheets', v)}
                />

                <SettingToggle
                  label="Documente PDF (Upload & Link-uri)"
                  description="Permite vizualizarea și atașarea de documente în format PDF."
                  checked={settings.knowledge.allowPdf}
                  onChange={(v) => updateSetting('knowledge', 'allowPdf', v)}
                />

                <SettingToggle
                  label="Resurse Web & Link-uri Externe"
                  description="Permite adăugarea oricărui link web extern ca document indexat."
                  checked={settings.knowledge.allowWebLinks}
                  onChange={(v) => updateSetting('knowledge', 'allowWebLinks', v)}
                />

                <SettingToggle
                  label="Notițe Rapide Text / Markdown"
                  description="Permite crearea de notițe text interne cu editor simplu."
                  checked={settings.knowledge.allowNotes}
                  onChange={(v) => updateSetting('knowledge', 'allowNotes', v)}
                />
              </div>

              {/* Card 3: Moștenire & Limite */}
              <div style={cardStyle}>
                <h3 style={cardTitleStyle}>🔐 Ierarhie & Moștenire Permisiuni</h3>
                <p style={cardSubtitleStyle}>Regulile de securitate aplicate conținutului din interiorul folderelor.</p>

                <SettingToggle
                  label="Moștenire automată a drepturilor de folder"
                  description="Toate fișierele și sub-folderele adăugate într-un folder preiau automat permisiunile rolurilor setate pe folderul părinte."
                  checked={settings.knowledge.autoInheritPermissions}
                  onChange={(v) => updateSetting('knowledge', 'autoInheritPermissions', v)}
                />

                <SettingToggle
                  label="Permite creatorului să restrângă accesul pe fișier individual"
                  description="Creatorul unui fișier poate acorda sau restricționa drepturi specifice doar pe acel document."
                  checked={settings.knowledge.allowFilePermissionOverride}
                  onChange={(v) => updateSetting('knowledge', 'allowFilePermissionOverride', v)}
                />

                <div style={{ marginTop: '16px' }}>
                  <label style={labelStyle}>Limită maximă dimensiune fișiere încărcate:</label>
                  <select
                    value={settings.knowledge.maxUploadSize}
                    onChange={(e) => updateSetting('knowledge', 'maxUploadSize', e.target.value)}
                    style={{ ...inputStyle, maxWidth: '240px', cursor: 'pointer' }}
                  >
                    <option value="25MB">25 MB</option>
                    <option value="50MB">50 MB (Recomandat)</option>
                    <option value="100MB">100 MB</option>
                    <option value="250MB">250 MB</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* SECTION 4: MESSAGES MODULE SETTINGS                                 */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeSection === 'messages' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h1 style={{ margin: '0 0 6px 0', fontSize: '1.75rem', color: '#0f172a', fontWeight: '800' }}>
                  💬 Setări Modul Mesagerie
                </h1>
                <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
                  Politici de chat în timp real, crearea de grupuri și confidențialitatea conversațiilor.
                </p>
              </div>

              <button
                onClick={() => handleSaveModuleSettings('messages', 'Mesagerie')}
                style={primaryBtnStyle}
              >
                💾 Salvează Setările Mesagerie
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Deactivation / Status Card */}
              <ModuleStatusBanner
                moduleName="Mesagerie"
                isEnabled={settings.messages.enabled !== false}
                onToggle={(v) => updateSetting('messages', 'enabled', v)}
              />

              {/* Card 1: Permisiuni Conversații */}
              <div style={cardStyle}>
                <h3 style={cardTitleStyle}>🤝 Politici de Comunicare</h3>
                <p style={cardSubtitleStyle}>Stabilește cine și cum poate interacționa prin mesageria internă.</p>

                <SettingToggle
                  label="Permite mesaje directe 1-la-1 între toți membrii"
                  description="Orice utilizator înregistrat poate iniția o conversație privată cu alt coleg."
                  checked={settings.messages.allowDirectMessages}
                  onChange={(v) => updateSetting('messages', 'allowDirectMessages', v)}
                />

                <SettingToggle
                  label="Permite crearea de grupuri de discuție noi"
                  description="Utilizatorii pot crea grupuri dedicate pe proiecte sau subiecte de echipă."
                  checked={settings.messages.allowCreateGroups}
                  onChange={(v) => updateSetting('messages', 'allowCreateGroups', v)}
                />

                <SettingToggle
                  label="Afișează indicatorul de activitate Online / Offline"
                  description="Arată starea de prezență în timp real pentru utilizatorii conectați."
                  checked={settings.messages.showOnlineStatus}
                  onChange={(v) => updateSetting('messages', 'showOnlineStatus', v)}
                />
              </div>

              {/* Card 2: Retenție & Editare */}
              <div style={cardStyle}>
                <h3 style={cardTitleStyle}>🕒 Retenție & Reguli Mesaje</h3>
                <p style={cardSubtitleStyle}>Gestionarea ciclului de viață al mesajelor și istoricului de chat.</p>

                <div style={{ margin: '14px 0' }}>
                  <label style={labelStyle}>Păstrare istoric mesaje:</label>
                  <select
                    value={settings.messages.retentionPeriod}
                    onChange={(e) => updateSetting('messages', 'retentionPeriod', e.target.value)}
                    style={{ ...inputStyle, maxWidth: '300px', cursor: 'pointer' }}
                  >
                    <option value="unlimited">♾️ Permanent (Nelimitat)</option>
                    <option value="365">📅 1 An (365 zile)</option>
                    <option value="90">🗓️ 3 Luni (90 zile)</option>
                    <option value="30">⏳ 1 Lună (30 zile)</option>
                  </select>
                </div>

                <SettingToggle
                  label="Permite editarea mesajelor trimise"
                  description="Autorul poate corecta mesajele transmise în primele 15 minute."
                  checked={settings.messages.allowEditMessages}
                  onChange={(v) => updateSetting('messages', 'allowEditMessages', v)}
                />

                <SettingToggle
                  label="Permite ștergerea mesajelor proprii"
                  description="Utilizatorii își pot șterge definitiv mesajele trimise dintr-o conversație."
                  checked={settings.messages.allowDeleteMessages}
                  onChange={(v) => updateSetting('messages', 'allowDeleteMessages', v)}
                />
              </div>

              {/* Card 3: Sunete & WebSocket */}
              <div style={cardStyle}>
                <h3 style={cardTitleStyle}>🔔 Notificări & Serviciu WebSocket</h3>
                <p style={cardSubtitleStyle}>Alerte sonore și starea canalului STOMP / SockJS.</p>

                <SettingToggle
                  label="Sunet discret la primirea unui mesaj nou"
                  description="Redă un semnal sonor atunci când sosește un mesaj în timp ce ești activ în altă fereastră."
                  checked={settings.messages.soundNotifications}
                  onChange={(v) => updateSetting('messages', 'soundNotifications', v)}
                />

                <SettingToggle
                  label="Afișează textul mesajului în notificarea pop-up"
                  description="Include primele cuvinte ale mesajului în alerta afișată pe ecran."
                  checked={settings.messages.showTextPreview}
                  onChange={(v) => updateSetting('messages', 'showTextPreview', v)}
                />

                <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#166534', backgroundColor: '#f0fdf4', padding: '10px 14px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                  <span>🟢</span>
                  <span><strong>Conexiune WebSocket Activă:</strong> Endpoint configurat la <code>/ws</code> cu protocol STOMP.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* SECTION 5: FOR ME MODULE SETTINGS                                   */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeSection === 'for-me' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h1 style={{ margin: '0 0 6px 0', fontSize: '1.75rem', color: '#0f172a', fontWeight: '800' }}>
                  👤 Setări Modul For Me
                </h1>
                <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
                  Garanția confidențialității spațiului personal, salvare automată și organizare individuală.
                </p>
              </div>

              <button
                onClick={() => handleSaveModuleSettings('forMe', 'For Me')}
                style={primaryBtnStyle}
              >
                💾 Salvează Setările For Me
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Deactivation / Status Card */}
              <ModuleStatusBanner
                moduleName="For Me"
                isEnabled={settings.forMe.enabled !== false}
                onToggle={(v) => updateSetting('forMe', 'enabled', v)}
              />

              <div style={cardStyle}>
                <h3 style={cardTitleStyle}>🔒 Confidențialitate Strictă Spațiu Personal</h3>
                <p style={cardSubtitleStyle}>Protejarea intimității și a datelor private ale fiecărui angajat.</p>

                <SettingToggle
                  label="Confidențialitate absolută pentru notițe private"
                  description="Notițele din For Me sunt criptate și accesibile exclusiv autorului lor. Niciun administrator nu le poate vizualiza sau interoga."
                  checked={settings.forMe.strictPrivacy}
                  onChange={(v) => updateSetting('forMe', 'strictPrivacy', v)}
                />

                <SettingToggle
                  label="Salvare automată în timp real (Auto-save)"
                  description="Notițele personale sunt salvate automat la fiecare 2 secunde în timp ce utilizatorul tastează."
                  checked={settings.forMe.autoSaveNotes}
                  onChange={(v) => updateSetting('forMe', 'autoSaveNotes', v)}
                />
              </div>

              <div style={cardStyle}>
                <h3 style={cardTitleStyle}>⚡ Organizare Zilnică</h3>
                <p style={cardSubtitleStyle}>Integrarea spațiului personal cu restul uneltelor de lucru.</p>

                <SettingToggle
                  label="Sincronizare cu widget-ul Dashboard"
                  description="Afișează scurtătura rapidă către notițele For Me direct din ecranul principal."
                  checked={settings.forMe.syncWithDashboard}
                  onChange={(v) => updateSetting('forMe', 'syncWithDashboard', v)}
                />

                <SettingToggle
                  label="Reminder zilnic de organizare dimineața"
                  description="Trimite o alertă discretă cu notițele și obiectivele zilei curente."
                  checked={settings.forMe.dailyReminder}
                  onChange={(v) => updateSetting('forMe', 'dailyReminder', v)}
                />
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* SECTION 6: GENERAL & WORKSPACE SETTINGS                             */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeSection === 'general' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h1 style={{ margin: '0 0 6px 0', fontSize: '1.75rem', color: '#0f172a', fontWeight: '800' }}>
                  🏢 General & Workspace Settings
                </h1>
                <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
                  Personalizează denumirea spațiului de lucru, fusul orar și setările regionale ale companiei.
                </p>
              </div>

              <button
                onClick={() => handleSaveModuleSettings('general', 'General')}
                style={primaryBtnStyle}
              >
                💾 Salvează Datele Workspace
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={cardStyle}>
                <h3 style={cardTitleStyle}>🏷️ Identitate Workspace</h3>
                <p style={cardSubtitleStyle}>Informațiile publice afișate în antet și pe dashboard-ul echipei.</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginTop: '14px' }}>
                  <div>
                    <label style={labelStyle}>Nume Workspace / Companie *</label>
                    <input
                      type="text"
                      value={settings.general.workspaceName}
                      onChange={(e) => updateSetting('general', 'workspaceName', e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Domeniu Intern</label>
                    <input
                      type="text"
                      value={settings.general.organizationUrl}
                      onChange={(e) => updateSetting('general', 'organizationUrl', e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <label style={labelStyle}>Descriere Workspace</label>
                  <textarea
                    rows="3"
                    value={settings.general.description}
                    onChange={(e) => updateSetting('general', 'description', e.target.value)}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </div>
              </div>

              <div style={cardStyle}>
                <h3 style={cardTitleStyle}>🌍 Setări Regionale & Limbă</h3>
                <p style={cardSubtitleStyle}>Fusul orar și formatul de afișare al datelor calendaristice.</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '14px' }}>
                  <div>
                    <label style={labelStyle}>Limbă Implicită</label>
                    <select
                      value={settings.general.defaultLanguage}
                      onChange={(e) => updateSetting('general', 'defaultLanguage', e.target.value)}
                      style={{ ...inputStyle, cursor: 'pointer' }}
                    >
                      <option value="ro">🇷🇴 Română (Implicit)</option>
                      <option value="en">🇬🇧 English</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Format Dată</label>
                    <select
                      value={settings.general.dateFormat}
                      onChange={(e) => updateSetting('general', 'dateFormat', e.target.value)}
                      style={{ ...inputStyle, cursor: 'pointer' }}
                    >
                      <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2026)</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD (2026-12-31)</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Fus Orar</label>
                    <select
                      value={settings.general.timezone}
                      onChange={(e) => updateSetting('general', 'timezone', e.target.value)}
                      style={{ ...inputStyle, cursor: 'pointer' }}
                    >
                      <option value="Europe/Bucharest (UTC+2)">Europe/Bucharest (UTC+2)</option>
                      <option value="UTC">UTC (GMT+0)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* SECTION 7: SECURITY & GOOGLE SYNC SETTINGS                          */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeSection === 'security' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h1 style={{ margin: '0 0 6px 0', fontSize: '1.75rem', color: '#0f172a', fontWeight: '800' }}>
                  🔒 Securitate & Google Sync
                </h1>
                <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
                  Politici de autentificare, complexitate parole și integrarea cu conturile Google Workspace.
                </p>
              </div>

              <button
                onClick={() => handleSaveModuleSettings('security', 'Securitate')}
                style={primaryBtnStyle}
              >
                💾 Salvează Politicile de Securitate
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={cardStyle}>
                <h3 style={cardTitleStyle}>🌐 Integrare Google Workspace & OAuth2</h3>
                <p style={cardSubtitleStyle}>Permite utilizatorilor să se conecteze rapid cu contul lor Google de companie.</p>

                <SettingToggle
                  label="Permite autentificarea cu Google (Sign in with Google)"
                  description="Utilizatorii își pot sincroniza contul cu Google și se pot autentifica cu un singur clic."
                  checked={settings.security.allowGoogleAuth}
                  onChange={(v) => updateSetting('security', 'allowGoogleAuth', v)}
                />

                <SettingToggle
                  label="Permite înregistrarea utilizatorilor noi prin Google"
                  description="Utilizatorii noi își pot crea cont automat prin fluxul 'Register with Google'."
                  checked={settings.security.allowGoogleRegistration}
                  onChange={(v) => updateSetting('security', 'allowGoogleRegistration', v)}
                />

                <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#166534', backgroundColor: '#f0fdf4', padding: '10px 14px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                  <span>🟢</span>
                  <span><strong>Google OAuth2 Configurat:</strong> Client ID și secret active pe serverul Spring Boot.</span>
                </div>
              </div>

              <div style={cardStyle}>
                <h3 style={cardTitleStyle}>🔑 Cerințe Parole & Sesiuni</h3>
                <p style={cardSubtitleStyle}>Reguli stricte pentru protejarea conturilor împotriva accesului neautorizat.</p>

                <SettingToggle
                  label="Impune parole complexe pentru conturile locale"
                  description="Parolele trebuie să aibă minim 8 caractere, cel puțin o literă mare și o cifră."
                  checked={settings.security.enforceComplexPasswords}
                  onChange={(v) => updateSetting('security', 'enforceComplexPasswords', v)}
                />

                <div style={{ margin: '14px 0' }}>
                  <label style={labelStyle}>Expirare automată a sesiunilor inactive:</label>
                  <select
                    value={settings.security.sessionTimeoutHours}
                    onChange={(e) => updateSetting('security', 'sessionTimeoutHours', e.target.value)}
                    style={{ ...inputStyle, maxWidth: '280px', cursor: 'pointer' }}
                  >
                    <option value="12">12 Ore</option>
                    <option value="24">24 Ore (Recomandat)</option>
                    <option value="72">3 Zile</option>
                    <option value="168">7 Zile</option>
                  </select>
                </div>
              </div>
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
                        🧠 Poate crea conținut în Knowledge
                      </strong>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        Permite utilizatorilor cu acest rol să creeze foldere și documente în Knowledge.
                      </div>
                    </div>
                  </label>
                </div>

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

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* MODAL: TRANSFER OWNERSHIP PROIECTE                                  */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
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
      </main>
    </div>
  );
}

// ── Shared UI Styles ──────────────────────────────────────────────────────────
const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
  backgroundColor: '#ffffff',
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

const cardStyle = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  padding: '22px 26px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
};

const cardTitleStyle = {
  margin: '0 0 6px 0',
  fontSize: '1.1rem',
  color: '#0f172a',
  fontWeight: '700',
};

const cardSubtitleStyle = {
  margin: '0 0 16px 0',
  fontSize: '13px',
  color: '#64748b',
  lineHeight: '1.4',
};

const primaryBtnStyle = {
  padding: '10px 20px',
  backgroundColor: '#5a3d5c',
  color: '#ffffff',
  border: 'none',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: '700',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  boxShadow: '0 2px 6px rgba(90, 61, 92, 0.25)',
  transition: 'all 0.15s ease',
};
