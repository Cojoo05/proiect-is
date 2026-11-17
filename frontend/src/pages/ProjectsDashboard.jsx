import { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import Modal from '../components/Modal.jsx';
import { formatDate, formatTimeLeft } from '../utils/format.js';
import { colors, shadow } from '../theme.js';

const API_URL = 'http://localhost:8080/api/projects';
const USERS_API_URL = 'http://localhost:8080/api/users';

function ProjectsDashboard({ currentUser }) {
  const toast = useToast();

  const [projects, setProjects] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const loadData = () => {
    if (!currentUser?.id) return;

    setLoading(true);
    setError('');

    Promise.all([
      fetch(`${API_URL}/user/${currentUser.id}`).then((res) => res.json()),
      fetch(`${API_URL}/invitations/user/${currentUser.id}`).then((res) => res.json()),
      fetch(USERS_API_URL).then((res) => res.json()).catch(() => [])
    ])
      .then(([projectsData, invitationsData, usersData]) => {
        setProjects(Array.isArray(projectsData) ? projectsData : []);
        setInvitations(Array.isArray(invitationsData) ? invitationsData : []);
        setAllUsers(Array.isArray(usersData) ? usersData.filter((user) => user.id !== currentUser.id) : []);
      })
      .catch(() => setError('Proiectele nu au putut fi încărcate. Verifică conexiunea la server.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = window.setTimeout(loadData, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const closeModal = () => {
    setIsModalOpen(false);
    setUserSearch('');
  };

  const handleCreateProject = (event) => {
    event.preventDefault();

    if (!projectName.trim() || !currentUser?.id) {
      toast.error('Completează numele proiectului.');
      return;
    }

    setCreating(true);

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: projectName.trim(),
        description: projectDescription.trim(),
        ownerId: currentUser.id,
        invitedUserIds: selectedUserIds
      })
    })
      .then((res) => {
        if (!res.ok) throw new Error('Proiectul nu a putut fi creat.');
        return res.json();
      })
      .then((newProject) => {
        setProjects((prev) => [newProject, ...prev]);
        setProjectName('');
        setProjectDescription('');
        setSelectedUserIds([]);
        closeModal();
        toast.success('Proiect creat. Invitațiile au fost trimise.');
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setCreating(false));
  };

  const handleAcceptInvitation = (invitationId) => {
    fetch(`${API_URL}/invitations/${invitationId}/accept`, { method: 'POST' })
      .then((res) => {
        if (!res.ok) throw new Error('Invitația a expirat sau nu mai este validă.');
        toast.success('Ai intrat în proiect.');
        loadData();
      })
      .catch((err) => toast.error(err.message));
  };

  const handleDeclineInvitation = (invitationId) => {
    fetch(`${API_URL}/invitations/${invitationId}/decline`, { method: 'POST' })
      .then((res) => {
        if (!res.ok) throw new Error('Invitația nu a putut fi refuzată.');
        setInvitations((prev) => prev.filter((invitation) => invitation.id !== invitationId));
        toast.success('Invitație refuzată.');
      })
      .catch((err) => toast.error(err.message));
  };

  const toggleUserSelection = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const visibleUsers = allUsers.filter((user) => {
    const query = userSearch.trim().toLowerCase();
    if (!query) return true;
    return `${user.username || ''} ${user.email || ''}`.toLowerCase().includes(query);
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">📁 Projects</h1>
          <p className="page-subtitle">Proiectele în care ești owner sau membru.</p>
        </div>

        <button type="button" className="btn btn--primary" onClick={() => setIsModalOpen(true)}>
          + Proiect nou
        </button>
      </div>

      {error && (
        <div className="alert alert--error" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn--secondary btn--sm" onClick={loadData}>
            Reîncearcă
          </button>
        </div>
      )}

      {invitations.length > 0 && (
        <section className="alert alert--warning" style={{ display: 'block', marginBottom: '24px' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: '1rem', color: '#92400e' }}>
            📬 Invitații în așteptare ({invitations.length})
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '10px',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #fcd34d',
                  borderRadius: '8px'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>{invitation.project?.name}</div>
                  <div style={{ fontSize: '13px', color: colors.textMuted }}>
                    Invitat de{' '}
                    <strong>
                      {invitation.project?.owner?.username || invitation.project?.owner?.email || 'owner'}
                    </strong>{' '}
                    · {formatTimeLeft(invitation.expiresAt)}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() => handleAcceptInvitation(invitation.id)}
                  >
                    Acceptă
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => handleDeclineInvitation(invitation.id)}
                  >
                    Refuză
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <div className="empty-state">Se încarcă proiectele...</div>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: '44px', marginBottom: '10px' }} aria-hidden="true">📂</div>
          <h2 style={{ margin: '0 0 8px', fontSize: '1.2rem', color: '#334155' }}>
            Niciun proiect deocamdată
          </h2>
          <p style={{ maxWidth: '420px', margin: '0 auto 20px' }}>
            Nu ești implicat în niciun proiect. Creează unul nou pentru a începe colaborarea.
          </p>
          <button type="button" className="btn btn--primary" onClick={() => setIsModalOpen(true)}>
            Creează primul proiect
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '18px' }}>
          {projects.map((project) => {
            const isOwner = project.owner?.id === currentUser?.id;

            return (
              <article
                key={project.id}
                onClick={() =>
                  toast.info('Pagina de detalii a proiectului nu este încă disponibilă.')
                }
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '20px',
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '12px',
                  boxShadow: shadow.card,
                  cursor: 'pointer',
                  transition: 'transform 0.15s, box-shadow 0.15s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = shadow.hover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = shadow.card;
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '10px',
                    marginBottom: '10px'
                  }}
                >
                  <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>{project.name}</h2>
                  <span
                    style={{
                      padding: '3px 9px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: isOwner ? colors.accentSoft : '#f1f5f9',
                      color: isOwner ? colors.accent : '#475569',
                      border: `1px solid ${isOwner ? colors.accentBorder : colors.border}`
                    }}
                  >
                    {isOwner ? 'OWNER' : 'MEMBER'}
                  </span>
                </div>

                <p style={{ margin: '0 0 14px', fontSize: '14px', color: colors.textMuted, flex: 1 }}>
                  {project.description || 'Fără descriere.'}
                </p>

                <div style={{ paddingTop: '10px', borderTop: `1px solid ${colors.border}`, fontSize: '12px', color: colors.textSoft }}>
                  Creat: {formatDate(project.createdAt)}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={isModalOpen}
        title="Proiect nou"
        onClose={closeModal}
        footer={
          <>
            <button type="button" className="btn btn--secondary" onClick={closeModal} disabled={creating}>
              Anulează
            </button>
            <button type="submit" form="create-project-form" className="btn btn--primary" disabled={creating}>
              {creating ? 'Se creează...' : 'Creează proiectul'}
            </button>
          </>
        }
      >
        <form id="create-project-form" onSubmit={handleCreateProject}>
          <div className="field">
            <label className="label" htmlFor="project-name">Nume proiect *</label>
            <input
              id="project-name"
              className="input"
              type="text"
              autoFocus
              placeholder="ex: Redesign platformă"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="project-description">Descriere</label>
            <textarea
              id="project-description"
              className="textarea"
              rows={3}
              placeholder="Obiectivele proiectului..."
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="project-user-search">
              Invită utilizatori (opțional, invitația expiră în 48h)
            </label>

            <input
              id="project-user-search"
              className="input"
              type="search"
              placeholder="Caută după nume sau email..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              style={{ marginBottom: '8px' }}
            />

            <div
              style={{
                maxHeight: '180px',
                overflowY: 'auto',
                padding: '10px',
                border: `1px solid ${colors.border}`,
                borderRadius: '8px'
              }}
            >
              {visibleUsers.length === 0 ? (
                <p style={{ margin: 0, fontSize: '13px', color: colors.textSoft }}>
                  {allUsers.length === 0 ? 'Nu există alți utilizatori disponibili.' : 'Niciun utilizator găsit.'}
                </p>
              ) : (
                visibleUsers.map((user) => (
                  <label
                    key={user.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '6px 0',
                      fontSize: '14px',
                      color: '#334155',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(user.id)}
                      onChange={() => toggleUserSelection(user.id)}
                    />
                    <span>{user.username || user.email}</span>
                  </label>
                ))
              )}
            </div>

            {selectedUserIds.length > 0 && (
              <p className="field-hint">{selectedUserIds.length} utilizator(i) selectat(i).</p>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default ProjectsDashboard;
