import { useState, useEffect } from 'react';

const COLORS = ['#5a3d5c', '#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#4b5563'];
const avatarColor = (name) => COLORS[(name?.charCodeAt(0) || 0) % COLORS.length];

function MembersTab({ projectId, currentUser, isOwner, members, onMembersChange, onOpenInvite, channels = [] }) {
  const [subTab, setSubTab] = useState('members'); // 'members' | 'roles'
  const [roles, setRoles] = useState([]);
  const [editingRole, setEditingRole] = useState(null); // role object or null
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [roleForm, setRoleForm] = useState({
    name: '',
    description: '',
    color: '#5a3d5c',
    canCreateTasks: true,
    canManageTasks: true,
    canCreateChannels: false,
    canSendMessages: true,
    canCreatePolls: true,
    canVotePolls: true,
    canManageFiles: true,
    canInviteMembers: false,
    allowedChannels: 'ALL',
    selectedChannelIds: []
  });

  const API = `http://localhost:8080/api/projects/${projectId}`;

  const fetchRoles = () => {
    fetch(`${API}/roles`)
      .then(r => r.json())
      .then(data => setRoles(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  useEffect(() => {
    fetchRoles();
  }, [projectId]);

  const handleAssignRole = (memberId, roleId) => {
    fetch(`${API}/members/${memberId}/role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleId: roleId ? parseInt(roleId) : null })
    })
      .then(r => {
        if (!r.ok) throw new Error('Eroare la atribuirea rolului');
        return r.json();
      })
      .then(() => {
        if (onMembersChange) onMembersChange();
      })
      .catch(err => alert(err.message));
  };

  const handleRemoveMember = (memberId, memberName) => {
    if (!window.confirm(`Sigur dorești să elimini utilizatorul "${memberName}" din proiect?`)) return;

    fetch(`${API}/members/${memberId}`, { method: 'DELETE' })
      .then(r => {
        if (!r.ok) throw new Error('Nu s-a putut elimina membrul');
        if (onMembersChange) onMembersChange();
      })
      .catch(err => alert(err.message));
  };

  const openNewRoleModal = () => {
    setIsCreatingRole(true);
    setEditingRole(null);
    setRoleForm({
      name: '',
      description: '',
      color: '#5a3d5c',
      canCreateTasks: true,
      canManageTasks: true,
      canCreateChannels: false,
      canSendMessages: true,
      canCreatePolls: true,
      canVotePolls: true,
      canManageFiles: true,
      canInviteMembers: false,
      allowedChannels: 'ALL',
      selectedChannelIds: channels.map(c => c.id)
    });
  };

  const openEditRoleModal = (role) => {
    setEditingRole(role);
    setIsCreatingRole(false);
    const isAll = !role.allowedChannels || role.allowedChannels === 'ALL';
    const selectedIds = isAll
      ? channels.map(c => c.id)
      : role.allowedChannels.split(',').map(id => parseInt(id.trim())).filter(Boolean);

    setRoleForm({
      name: role.name,
      description: role.description || '',
      color: role.color || '#5a3d5c',
      canCreateTasks: role.canCreateTasks,
      canManageTasks: role.canManageTasks,
      canCreateChannels: role.canCreateChannels,
      canSendMessages: role.canSendMessages,
      canCreatePolls: role.canCreatePolls,
      canVotePolls: role.canVotePolls,
      canManageFiles: role.canManageFiles,
      canInviteMembers: role.canInviteMembers,
      allowedChannels: role.allowedChannels || 'ALL',
      selectedChannelIds: selectedIds
    });
  };

  const handleSaveRole = (e) => {
    e.preventDefault();
    if (!roleForm.name.trim()) return;

    const allowedChannelsValue = roleForm.allowedChannels === 'ALL'
      ? 'ALL'
      : roleForm.selectedChannelIds.join(',');

    const payload = {
      name: roleForm.name.trim(),
      description: roleForm.description.trim(),
      color: roleForm.color,
      canCreateTasks: roleForm.canCreateTasks,
      canManageTasks: roleForm.canManageTasks,
      canCreateChannels: roleForm.canCreateChannels,
      canSendMessages: roleForm.canSendMessages,
      canCreatePolls: roleForm.canCreatePolls,
      canVotePolls: roleForm.canVotePolls,
      canManageFiles: roleForm.canManageFiles,
      canInviteMembers: roleForm.canInviteMembers,
      allowedChannels: allowedChannelsValue
    };

    const isEdit = Boolean(editingRole);
    const endpoint = isEdit ? `${API}/roles/${editingRole.id}` : `${API}/roles`;
    const method = isEdit ? 'PUT' : 'POST';

    fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(r => {
        if (!r.ok) throw new Error('Eroare la salvarea rolului');
        return r.json();
      })
      .then(() => {
        fetchRoles();
        if (onMembersChange) onMembersChange();
        setEditingRole(null);
        setIsCreatingRole(false);
      })
      .catch(err => alert(err.message));
  };

  const handleDeleteRole = (roleId, roleName) => {
    if (!window.confirm(`Sigur dorești să ștergi rolul "${roleName}"? Membrii asociați vor reveni la rolul generic de membru.`)) return;

    fetch(`${API}/roles/${roleId}`, { method: 'DELETE' })
      .then(r => {
        if (!r.ok) throw new Error('Nu s-a putut șterge rolul');
        fetchRoles();
        if (onMembersChange) onMembersChange();
      })
      .catch(err => alert(err.message));
  };

  const toggleChannelSelection = (channelId) => {
    setRoleForm(prev => {
      const exists = prev.selectedChannelIds.includes(channelId);
      const next = exists
        ? prev.selectedChannelIds.filter(id => id !== channelId)
        : [...prev.selectedChannelIds, channelId];
      return { ...prev, selectedChannelIds: next };
    });
  };

  return (
    <div>
      {/* Sub-header navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
          <button
            onClick={() => setSubTab('members')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: subTab === 'members' ? '700' : '500',
              backgroundColor: subTab === 'members' ? 'white' : 'transparent',
              color: subTab === 'members' ? '#1e293b' : '#64748b',
              boxShadow: subTab === 'members' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              fontSize: '13px',
              transition: 'all 0.15s'
            }}
          >
            👥 Membri Proiect ({members.length})
          </button>
          <button
            onClick={() => setSubTab('roles')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: subTab === 'roles' ? '700' : '500',
              backgroundColor: subTab === 'roles' ? 'white' : 'transparent',
              color: subTab === 'roles' ? '#1e293b' : '#64748b',
              boxShadow: subTab === 'roles' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              fontSize: '13px',
              transition: 'all 0.15s'
            }}
          >
            🛡️ Roluri & Permisiuni ({roles.length})
          </button>
        </div>

        {subTab === 'members' && isOwner && (
          <button
            onClick={onOpenInvite}
            style={{
              padding: '9px 18px',
              backgroundColor: '#5a3d5c',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            + Invită Membru Nou
          </button>
        )}

        {subTab === 'roles' && isOwner && (
          <button
            onClick={openNewRoleModal}
            style={{
              padding: '9px 18px',
              backgroundColor: '#5a3d5c',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            + Creează Rol Nou
          </button>
        )}
      </div>

      {/* --- SUBTAB 1: MEMBERS LIST --- */}
      {subTab === 'members' && (
        <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Membru & Contact
            </span>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Rol pe Proiect & Acțiuni
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {members.map(member => {
              const u = member.user;
              const name = u?.username || u?.email || 'User';
              const isMemberOwner = member.role === 'OWNER';
              const assignedRole = member.projectRole;
              const roleBadgeColor = isMemberOwner ? '#7c3aed' : (assignedRole?.color || '#5a3d5c');

              return (
                <div
                  key={member.id}
                  style={{
                    padding: '16px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #f1f5f9',
                    flexWrap: 'wrap',
                    gap: '14px'
                  }}
                >
                  {/* User info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        backgroundColor: avatarColor(name),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '16px',
                        flexShrink: 0
                      }}
                    >
                      {name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: '700', fontSize: '15px', color: '#1e293b' }}>{name}</span>
                        {isMemberOwner && (
                          <span style={{ fontSize: '11px', fontWeight: 'bold', backgroundColor: '#f3e8ff', color: '#6b21a8', padding: '2px 8px', borderRadius: '10px' }}>
                            OWNER PROIECT
                          </span>
                        )}
                        {u?.id === currentUser?.id && (
                          <span style={{ fontSize: '11px', color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                            (Tu)
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                        {u?.email} · Alăturat la {new Date(member.joinedAt || Date.now()).toLocaleDateString('ro-RO')}
                      </div>
                    </div>
                  </div>

                  {/* Role picker and actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {isMemberOwner ? (
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: '700',
                          padding: '6px 14px',
                          borderRadius: '20px',
                          backgroundColor: '#f3e8ff',
                          color: '#6b21a8',
                          border: '1px solid #d8b4e2'
                        }}
                      >
                        👑 Creator (Full Access)
                      </span>
                    ) : isOwner ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <select
                          value={assignedRole?.id || ''}
                          onChange={(e) => handleAssignRole(member.id, e.target.value)}
                          style={{
                            padding: '7px 12px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '13px',
                            fontWeight: '600',
                            color: '#1e293b',
                            backgroundColor: '#ffffff',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="">Fără rol specific ({member.role || 'MEMBER'})</option>
                          {roles.map(r => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>

                        <button
                          onClick={() => handleRemoveMember(member.id, name)}
                          title="Elimină din proiect"
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#fee2e2',
                            color: '#ef4444',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}
                        >
                          Elimină
                        </button>
                      </div>
                    ) : (
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: '700',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          backgroundColor: `${roleBadgeColor}15`,
                          color: roleBadgeColor,
                          border: `1px solid ${roleBadgeColor}30`
                        }}
                      >
                        {assignedRole?.name || member.role}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- SUBTAB 2: ROLES & PERMISSIONS --- */}
      {subTab === 'roles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px 20px' }}>
            <h4 style={{ margin: '0 0 6px 0', color: '#1e293b' }}>🛡️ Roluri create strict pentru acest proiect</h4>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              Rolurile permit definirea granulară a permisiunilor: cine poate crea taskuri, adăuga fișiere, iniția sondaje sau trimite mesaje pe canale specifice.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
            {roles.map(role => {
              const membersWithThisRole = members.filter(m => m.projectRole?.id === role.id);
              const allowedText = (!role.allowedChannels || role.allowedChannels === 'ALL')
                ? 'Toate canalele'
                : `${role.allowedChannels.split(',').length} canale specifice`;

              return (
                <div
                  key={role.id}
                  style={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '20px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            backgroundColor: role.color || '#5a3d5c'
                          }}
                        />
                        <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>{role.name}</h3>
                      </div>
                      <span style={{ fontSize: '12px', color: '#64748b', backgroundColor: '#f1f5f9', padding: '3px 8px', borderRadius: '12px' }}>
                        {membersWithThisRole.length} {membersWithThisRole.length === 1 ? 'membru' : 'membri'}
                      </span>
                    </div>

                    <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0', minHeight: '36px' }}>
                      {role.description || 'Fără descriere specificată.'}
                    </p>

                    {/* Permissions tags list */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                      <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: role.canCreateTasks ? '#dcfce7' : '#f1f5f9', color: role.canCreateTasks ? '#15803d' : '#94a3b8', fontWeight: '500' }}>
                        {role.canCreateTasks ? '✓ Dă Taskuri' : '✕ Fără Taskuri'}
                      </span>
                      <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: role.canCreateChannels ? '#dcfce7' : '#f1f5f9', color: role.canCreateChannels ? '#15803d' : '#94a3b8', fontWeight: '500' }}>
                        {role.canCreateChannels ? '✓ Creează Canale' : '✕ Fără Canale'}
                      </span>
                      <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: role.canSendMessages ? '#dcfce7' : '#fee2e2', color: role.canSendMessages ? '#15803d' : '#b91c1c', fontWeight: '500' }}>
                        {role.canSendMessages ? '✓ Mesaje Feed' : '✕ Doar Citire'}
                      </span>
                      <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: role.canCreatePolls ? '#dcfce7' : '#f1f5f9', color: role.canCreatePolls ? '#15803d' : '#94a3b8', fontWeight: '500' }}>
                        {role.canCreatePolls ? '✓ Fă Poll-uri' : '✕ Fără Poll-uri'}
                      </span>
                      <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: role.canManageFiles ? '#dcfce7' : '#f1f5f9', color: role.canManageFiles ? '#15803d' : '#94a3b8', fontWeight: '500' }}>
                        {role.canManageFiles ? '✓ Google Drive' : '✕ Fără Fișiere'}
                      </span>
                      <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: role.canInviteMembers ? '#dcfce7' : '#f1f5f9', color: role.canInviteMembers ? '#15803d' : '#94a3b8', fontWeight: '500' }}>
                        {role.canInviteMembers ? '✓ Invită Membri' : '✕ Fără Invitații'}
                      </span>
                      <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#e0e7ff', color: '#4338ca', fontWeight: '500' }}>
                        💬 {allowedText}
                      </span>
                    </div>
                  </div>

                  {/* Actions for role */}
                  {isOwner && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                      <button
                        onClick={() => openEditRoleModal(role)}
                        style={{
                          padding: '6px 14px',
                          backgroundColor: '#f1f5f9',
                          color: '#334155',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}
                      >
                        ✏️ Editează Permisiuni
                      </button>
                      <button
                        onClick={() => handleDeleteRole(role.id, role.name)}
                        style={{
                          padding: '6px 10px',
                          backgroundColor: '#fee2e2',
                          color: '#ef4444',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}
                      >
                        Șterge
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- MODAL: CREATE / EDIT ROLE WITH DETAILED PERMISSIONS --- */}
      {(isCreatingRole || editingRole) && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto', padding: '28px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '6px', color: '#1e293b' }}>
              {editingRole ? `✏️ Editează Rolul: ${editingRole.name}` : '🛡️ Creează Rol Nou pe Proiect'}
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>
              Definește rolul și bifează exact accesele permise membrilor care primesc acest rol.
            </p>

            <form onSubmit={handleSaveRole}>
              {/* Role Name & Color */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px', color: '#334155' }}>
                    Nume Rol *
                  </label>
                  <input
                    required
                    value={roleForm.name}
                    onChange={e => setRoleForm({ ...roleForm, name: e.target.value })}
                    placeholder="ex: Tech Lead, QA Engineer, Designer"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ width: '90px' }}>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px', color: '#334155' }}>
                    Culoare
                  </label>
                  <input
                    type="color"
                    value={roleForm.color}
                    onChange={e => setRoleForm({ ...roleForm, color: e.target.value })}
                    style={{ width: '100%', height: '40px', padding: '2px', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                  />
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px', color: '#334155' }}>
                  Descriere rol
                </label>
                <textarea
                  value={roleForm.description}
                  onChange={e => setRoleForm({ ...roleForm, description: e.target.value })}
                  placeholder="Responsabilitățile acestui rol în echipă..."
                  rows={2}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>

              {/* Permissions Section */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginBottom: '18px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#1e293b' }}>
                  ⚙️ Accese & Permisiuni
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Task Permissions */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={roleForm.canCreateTasks}
                      onChange={e => setRoleForm({ ...roleForm, canCreateTasks: e.target.checked })}
                    />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>📋 Poate crea și asigna task-uri</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Permite deschiderea formularului de adăugare task nou</div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={roleForm.canManageTasks}
                      onChange={e => setRoleForm({ ...roleForm, canManageTasks: e.target.checked })}
                    />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>🔄 Poate schimba statusul task-urilor (Drag & Drop)</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Permite mutarea task-urilor între coloanele Kanban</div>
                    </div>
                  </label>

                  {/* Channel / Feed Permissions */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={roleForm.canCreateChannels}
                      onChange={e => setRoleForm({ ...roleForm, canCreateChannels: e.target.checked })}
                    />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>💬 Poate crea canale de discuție noi</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Permite adăugarea de noi canale în sidebar-ul Feed</div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={roleForm.canSendMessages}
                      onChange={e => setRoleForm({ ...roleForm, canSendMessages: e.target.checked })}
                    />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>✉️ Poate trimite mesaje în feed</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Dacă e debifat, utilizatorul are acces doar în modul citire</div>
                    </div>
                  </label>

                  {/* Poll Permissions */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={roleForm.canCreatePolls}
                      onChange={e => setRoleForm({ ...roleForm, canCreatePolls: e.target.checked })}
                    />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>📊 Poate crea sondaje (Polls)</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Permite inițierea de noi întrebări și opțiuni de vot</div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={roleForm.canVotePolls}
                      onChange={e => setRoleForm({ ...roleForm, canVotePolls: e.target.checked })}
                    />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>🗳️ Poate vota în sondaje</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Permite participarea la voturile active</div>
                    </div>
                  </label>

                  {/* File & Member Permissions */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={roleForm.canManageFiles}
                      onChange={e => setRoleForm({ ...roleForm, canManageFiles: e.target.checked })}
                    />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>📁 Poate adăuga fișiere Google Drive</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Permite conectarea și partajarea de documente în tab-ul Files</div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={roleForm.canInviteMembers}
                      onChange={e => setRoleForm({ ...roleForm, canInviteMembers: e.target.checked })}
                    />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>👥 Poate trimite invitații membrilor noi</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Permite extinderea echipei proiectului</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Channel Visibility Restriction */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginBottom: '24px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#1e293b' }}>
                  🔒 Canale de discuții accesibile
                </h4>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="radio"
                      name="channelAccess"
                      checked={roleForm.allowedChannels === 'ALL'}
                      onChange={() => setRoleForm({ ...roleForm, allowedChannels: 'ALL' })}
                    />
                    <span>Toate canalele proiectului</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="radio"
                      name="channelAccess"
                      checked={roleForm.allowedChannels === 'CUSTOM'}
                      onChange={() => setRoleForm({ ...roleForm, allowedChannels: 'CUSTOM' })}
                    />
                    <span>Doar canale selectate</span>
                  </label>
                </div>

                {roleForm.allowedChannels === 'CUSTOM' && (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', maxHeight: '120px', overflowY: 'auto', backgroundColor: '#f8fafc' }}>
                    {channels.length === 0 ? (
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>Nu există canale create încă.</div>
                    ) : (
                      channels.map(ch => (
                        <label key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: 'pointer', fontSize: '13px' }}>
                          <input
                            type="checkbox"
                            checked={roleForm.selectedChannelIds.includes(ch.id)}
                            onChange={() => toggleChannelSelection(ch.id)}
                          />
                          <span>#{ch.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setEditingRole(null); setIsCreatingRole(false); }}
                  style={{ padding: '9px 16px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  style={{ padding: '9px 20px', backgroundColor: '#5a3d5c', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {editingRole ? 'Salvează Modificările' : 'Creează Rolul'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MembersTab;
