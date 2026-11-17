import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API_BASE_URL, WS_BASE_URL } from '../config';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client/dist/sockjs.min.js';
import FeedTab from './ProjectTabs/FeedTab';
import TasksTab from './ProjectTabs/TasksTab';
import FilesTab from './ProjectTabs/FilesTab';
import PollsTab from './ProjectTabs/PollsTab';
import MembersTab from './ProjectTabs/MembersTab';
import DecisionGraphTab from './ProjectTabs/DecisionGraphTab';
import CalendarTab from './ProjectTabs/CalendarTab';

const TABS = [
  { key: 'feed', label: '💬 Feed' },
  { key: 'tasks', label: '✅ Tasks' },
  { key: 'calendar', label: '📅 Calendar' },
  { key: 'files', label: '📁 Files' },
  { key: 'polls', label: '📊 Polls' },
  { key: 'graph', label: '🌳 Graf Decizie' },
  { key: 'members', label: '👥 Membri' },
];

function ProjectDetail({ currentUser }) {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [channels, setChannels] = useState([]);
  const [activeTab, setActiveTab] = useState('feed');
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedInviteUser, setSelectedInviteUser] = useState('');
  const stompClientRef = useRef(null);

  const API = `${API_BASE_URL}/api/projects`;

  const fetchMembers = useCallback(() => {
    fetch(`${API}/${projectId}/members`)
      .then(r => r.json())
      .then(mems => setMembers(Array.isArray(mems) ? mems : []))
      .catch(console.error);
  }, [projectId, API]);

  const fetchChannels = useCallback(() => {
    fetch(`${API}/${projectId}/feed/channels`)
      .then(r => r.json())
      .then(chans => setChannels(Array.isArray(chans) ? chans : []))
      .catch(console.error);
  }, [projectId, API]);

  const fetchProject = useCallback(() => {
    fetch(`${API}/${projectId}`)
      .then(r => r.json())
      .then(proj => setProject(proj))
      .catch(console.error);
  }, [projectId, API]);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);

    Promise.all([
      fetch(`${API}/${projectId}`).then(r => r.json()),
      fetch(`${API}/${projectId}/members`).then(r => r.json()),
      fetch(`${API}/${projectId}/feed/channels`).then(r => r.json()).catch(() => []),
      fetch(`${API_BASE_URL}/api/users`).then(r => r.json()).catch(() => [])
    ])
      .then(([proj, mems, chans, users]) => {
        setProject(proj);
        setMembers(Array.isArray(mems) ? mems : []);
        setChannels(Array.isArray(chans) ? chans : []);
        setAllUsers(Array.isArray(users) ? users : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectId, API]);

  // Real-time WebSocket updates for members, roles, and channels
  useEffect(() => {
    if (!projectId) return;
    let client = null;
    try {
      client = new Client({
        webSocketFactory: () => new SockJS(WS_BASE_URL),
        reconnectDelay: 5000,
        onConnect: () => {
          client.subscribe(`/topic/projects/${projectId}/members`, () => {
            fetchMembers();
            fetchProject();
          });
          client.subscribe(`/topic/projects/${projectId}/roles`, () => {
            fetchMembers();
          });
          client.subscribe(`/topic/projects/${projectId}/channels`, () => {
            fetchChannels();
          });
        }
      });
      client.activate();
      stompClientRef.current = client;
    } catch (_) {}

    return () => {
      try { stompClientRef.current?.deactivate(); } catch (_) {}
    };
  }, [projectId, fetchMembers, fetchChannels, fetchProject]);

  // Polling fallback to keep project state synced live
  useEffect(() => {
    if (!projectId) return;
    const timer = setInterval(() => {
      fetchMembers();
      fetchChannels();
    }, 10_000);
    return () => clearInterval(timer);
  }, [projectId, fetchMembers, fetchChannels]);

  const isOwner = project?.owner?.id === currentUser?.id;
  const currentMember = members.find(m => m.user?.id === currentUser?.id);
  const assignedRole = currentMember?.projectRole;

  // Calculare permisiuni stricte pe proiect
  const permissions = isOwner ? {
    canCreateTasks: true,
    canManageTasks: true,
    canCreateChannels: true,
    canSendMessages: true,
    canCreatePolls: true,
    canVotePolls: true,
    canManageFiles: true,
    canInviteMembers: true,
    allowedChannels: 'ALL'
  } : {
    canCreateTasks: assignedRole ? Boolean(assignedRole.canCreateTasks) : false,
    canManageTasks: assignedRole ? Boolean(assignedRole.canManageTasks) : false,
    canCreateChannels: assignedRole ? assignedRole.canCreateChannels : false,
    canSendMessages: assignedRole ? assignedRole.canSendMessages : true,
    canCreatePolls: assignedRole ? assignedRole.canCreatePolls : true,
    canVotePolls: assignedRole ? assignedRole.canVotePolls : true,
    canManageFiles: assignedRole ? assignedRole.canManageFiles : true,
    canInviteMembers: assignedRole ? assignedRole.canInviteMembers : false,
    allowedChannels: assignedRole ? assignedRole.allowedChannels : 'ALL'
  };

  const canGiveTasks = isOwner || Boolean(permissions.canCreateTasks);

  const visibleTabs = TABS.filter(tab => {
    if (tab.key === 'tasks') return canGiveTasks;
    return true;
  });

  useEffect(() => {
    if (activeTab === 'tasks' && !canGiveTasks && !loading) {
      setActiveTab('feed');
    }
  }, [activeTab, canGiveTasks, loading]);

  const handleInvite = async () => {
    if (!selectedInviteUser) return;
    try {
      const res = await fetch(`${API}/${projectId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: parseInt(selectedInviteUser) })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setShowInviteModal(false);
        setSelectedInviteUser('');
        alert('Invitație trimisă cu succes!');
      } else {
        alert(data.message || 'Eroare la trimiterea invitației.');
      }
    } catch (err) {
      console.error(err);
      alert('Eroare de conexiune la server.');
    }
  };

  const memberIds = new Set(members.map(m => m.user?.id));
  const uninvitedUsers = allUsers.filter(u => !memberIds.has(u.id) && u.id !== currentUser?.id);

  const handleDeleteProject = () => {
    if (!currentUser?.id || !projectId) return;
    if (!window.confirm(`Ești sigur că vrei să ștergi definitiv proiectul "${project?.name}"?\nToate task-urile, canalele, sondajele și datele asociate vor fi șterse ireversibil.`)) {
      return;
    }

    fetch(`${API}/${projectId}?userId=${currentUser.id}`, { method: 'DELETE' })
      .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Eroare la ștergerea proiectului');
        alert('Proiectul a fost șters cu succes!');
        navigate('/projects');
      })
      .catch(err => alert(err.message));
  };

  const handleLeaveProject = () => {
    if (!currentUser?.id || !projectId) return;
    if (!window.confirm(`Ești sigur că vrei să părăsești proiectul "${project?.name}"?`)) {
      return;
    }

    fetch(`${API}/${projectId}/leave?userId=${currentUser.id}`, { method: 'POST' })
      .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Eroare la părăsirea proiectului');
        alert('Ai părăsit proiectul.');
        navigate('/projects');
      })
      .catch(err => alert(err.message));
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Se încarcă proiectul...</div>;
  if (!project) return <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>Proiectul nu a fost găsit.</div>;

  return (
    <div style={{ padding: '24px', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button
          onClick={() => navigate('/projects')}
          style={{ padding: '8px 14px', cursor: 'pointer', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px' }}
        >
          ← Projects
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, color: '#1e293b', fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            📁 {project.name}
            <span
              style={{
                fontSize: '12px',
                fontWeight: '600',
                padding: '3px 10px',
                borderRadius: '12px',
                backgroundColor: isOwner ? '#f3e8ff' : '#f1f5f9',
                color: isOwner ? '#6b21a8' : '#475569'
              }}
            >
              {isOwner ? '👑 OWNER' : (assignedRole?.name || currentMember?.role || 'MEMBER')}
            </span>
          </h1>
          {project.description && <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>{project.description}</p>}
        </div>

        {/* Members avatars */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ cursor: 'pointer', display: 'flex' }} onClick={() => setActiveTab('members')} title="Vezi toți membrii">
            {members.slice(0, 5).map((m, i) => {
              const name = m.user?.username || m.user?.email || '?';
              const colors = ['#5a3d5c', '#2563eb', '#059669', '#d97706', '#dc2626'];
              return (
                <div
                  key={m.id}
                  title={`${name} (${m.projectRole?.name || m.role})`}
                  style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: colors[i % colors.length], border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '13px', marginLeft: i > 0 ? '-8px' : '0', zIndex: 5 - i }}
                >
                  {name[0]?.toUpperCase()}
                </div>
              );
            })}
            {members.length > 5 && (
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#94a3b8', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '11px', fontWeight: 'bold', marginLeft: '-8px' }}>
                +{members.length - 5}
              </div>
            )}
          </div>
          {(isOwner || permissions.canInviteMembers) && (
            <button
              onClick={() => setShowInviteModal(true)}
              style={{ padding: '6px 12px', backgroundColor: '#5a3d5c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', marginLeft: '6px' }}
            >
              + Invită
            </button>
          )}

          {isOwner ? (
            <button
              onClick={handleDeleteProject}
              style={{
                padding: '6px 12px',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                marginLeft: '8px',
              }}
              title="Șterge definitiv proiectul (doar Owner)"
            >
              🗑️ Șterge Proiectul
            </button>
          ) : (
            <button
              onClick={handleLeaveProject}
              style={{
                padding: '6px 12px',
                backgroundColor: '#fff1f2',
                color: '#e11d48',
                border: '1px solid #fecdd3',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                marginLeft: '8px',
              }}
              title="Părăsește acest proiect"
            >
              🚪 Părăsește Proiectul
            </button>
          )}
        </div>
      </div>

      {/* Tab Nav */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid #e2e8f0', marginBottom: '24px' }}>
        {visibleTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: activeTab === tab.key ? '700' : '500',
              color: activeTab === tab.key ? '#5a3d5c' : '#64748b',
              borderBottom: activeTab === tab.key ? '2px solid #5a3d5c' : '2px solid transparent',
              marginBottom: '-2px',
              fontSize: '14px',
              transition: 'all 0.15s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'feed' && (
        <FeedTab
          projectId={projectId}
          currentUser={currentUser}
          members={members}
          isOwner={isOwner}
          onSwitchTab={setActiveTab}
          permissions={permissions}
        />
      )}
      {activeTab === 'tasks' && canGiveTasks && (
        <TasksTab
          projectId={projectId}
          currentUser={currentUser}
          members={members}
          isOwner={isOwner}
          permissions={permissions}
        />
      )}
      {activeTab === 'calendar' && (
        <CalendarTab
          projectId={projectId}
          currentUser={currentUser}
          members={members}
        />
      )}
      {activeTab === 'files' && (
        <FilesTab
          projectId={projectId}
          currentUser={currentUser}
          permissions={permissions}
        />
      )}
      {activeTab === 'polls' && (
        <PollsTab
          projectId={projectId}
          currentUser={currentUser}
          permissions={permissions}
        />
      )}
      {activeTab === 'graph' && (
        <DecisionGraphTab
          projectId={projectId}
          currentUser={currentUser}
          permissions={permissions}
        />
      )}
      {activeTab === 'members' && (
        <MembersTab
          projectId={projectId}
          currentUser={currentUser}
          isOwner={isOwner}
          members={members}
          onMembersChange={fetchMembers}
          onOpenInvite={() => setShowInviteModal(true)}
          channels={channels}
        />
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: 'white', padding: '28px', borderRadius: '12px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '6px', color: '#1e293b' }}>📬 Invită un utilizator în proiect</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
              Invitația va apărea în panoul de notificări al utilizatorului și este valabilă pe termen nedeterminat până la acceptare sau refuz.
            </p>
            <select
              value={selectedInviteUser}
              onChange={e => setSelectedInviteUser(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', marginBottom: '20px', boxSizing: 'border-box' }}
            >
              <option value="">Alege utilizator din platformă...</option>
              {uninvitedUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.username} ({u.email})
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowInviteModal(false)}
                style={{ padding: '9px 16px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#475569', fontWeight: '500' }}
              >
                Anulează
              </button>
              <button
                onClick={handleInvite}
                disabled={!selectedInviteUser}
                style={{
                  padding: '9px 18px',
                  backgroundColor: '#5a3d5c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: selectedInviteUser ? 'pointer' : 'default',
                  opacity: selectedInviteUser ? 1 : 0.5
                }}
              >
                Trimite Invitația
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectDetail;
