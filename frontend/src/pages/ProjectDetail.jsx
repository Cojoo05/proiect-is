import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import FeedTab from './ProjectTabs/FeedTab';
import TasksTab from './ProjectTabs/TasksTab';
import FilesTab from './ProjectTabs/FilesTab';
import PollsTab from './ProjectTabs/PollsTab';

const TABS = [
  { key: 'feed', label: '💬 Feed' },
  { key: 'tasks', label: '✅ Tasks' },
  { key: 'files', label: '📁 Files' },
  { key: 'polls', label: '📊 Polls' },
];

function ProjectDetail({ currentUser }) {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [activeTab, setActiveTab] = useState('feed');
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedInviteUser, setSelectedInviteUser] = useState('');

  const API = `http://localhost:8080/api/projects`;

  useEffect(() => {
    if (!projectId) return;
    Promise.all([
      fetch(`${API}/${projectId}`).then(r => r.json()),
      fetch(`${API}/${projectId}/members`).then(r => r.json()),
      fetch(`http://localhost:8080/api/users`).then(r => r.json()).catch(() => [])
    ]).then(([proj, mems, users]) => {
      setProject(proj);
      setMembers(Array.isArray(mems) ? mems : []);
      setAllUsers(Array.isArray(users) ? users : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [projectId]);

  const isOwner = project?.owner?.id === currentUser?.id;

  const handleInvite = () => {
    if (!selectedInviteUser) return;
    fetch(`${API}/${projectId}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: parseInt(selectedInviteUser) })
    }).then(r => {
      if (r.ok) { setShowInviteModal(false); setSelectedInviteUser(''); alert('Invitație trimisă!'); }
      else alert('Utilizatorul este deja în proiect sau invitația a eșuat.');
    }).catch(console.error);
  };

  const memberIds = new Set(members.map(m => m.user?.id));
  const uninvitedUsers = allUsers.filter(u => !memberIds.has(u.id) && u.id !== currentUser?.id);

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
            <span style={{ fontSize: '12px', fontWeight: '600', padding: '3px 10px', borderRadius: '12px', backgroundColor: isOwner ? '#f3e8ff' : '#f1f5f9', color: isOwner ? '#6b21a8' : '#475569' }}>
              {isOwner ? 'OWNER' : 'MEMBER'}
            </span>
          </h1>
          {project.description && <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>{project.description}</p>}
        </div>

        {/* Members avatars */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ display: 'flex' }}>
            {members.slice(0, 5).map((m, i) => {
              const name = m.user?.username || m.user?.email || '?';
              const colors = ['#5a3d5c', '#2563eb', '#059669', '#d97706', '#dc2626'];
              return (
                <div
                  key={m.id}
                  title={`${name} (${m.role})`}
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
          {isOwner && (
            <button
              onClick={() => setShowInviteModal(true)}
              style={{ padding: '6px 12px', backgroundColor: '#5a3d5c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', marginLeft: '6px' }}
            >
              + Invită
            </button>
          )}
        </div>
      </div>

      {/* Tab Nav */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid #e2e8f0', marginBottom: '24px' }}>
        {TABS.map(tab => (
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
      {activeTab === 'feed' && <FeedTab projectId={projectId} currentUser={currentUser} members={members} isOwner={isOwner} />}
      {activeTab === 'tasks' && <TasksTab projectId={projectId} currentUser={currentUser} members={members} />}
      {activeTab === 'files' && <FilesTab projectId={projectId} currentUser={currentUser} />}
      {activeTab === 'polls' && <PollsTab projectId={projectId} currentUser={currentUser} />}

      {/* Invite Modal */}
      {showInviteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '28px', borderRadius: '12px', width: '100%', maxWidth: '400px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Invită un utilizator</h3>
            <select
              value={selectedInviteUser}
              onChange={e => setSelectedInviteUser(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', marginBottom: '16px' }}
            >
              <option value="">Selectează utilizator...</option>
              {uninvitedUsers.map(u => <option key={u.id} value={u.id}>{u.username || u.email}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowInviteModal(false)} style={{ padding: '9px 16px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#475569' }}>Anulează</button>
              <button onClick={handleInvite} style={{ padding: '9px 18px', backgroundColor: '#5a3d5c', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Trimite Invitație</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectDetail;
