import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext.jsx';
import Modal from '../components/Modal.jsx';
import { formatDate } from '../utils/format.js';
import { colors, shadow } from '../theme.js';
import { API_BASE_URL } from '../config';

const API_URL = `${API_BASE_URL}/api/projects`;

function ProjectsDashboard({ currentUser }) {
  const navigate = useNavigate();
  const toast = useToast();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const loadData = () => {
    if (!currentUser?.id) return;

    setLoading(true);
    setError('');

    fetch(`${API_URL}/user/${currentUser.id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Proiectele nu au putut fi încărcate.');
        return res.json();
      })
      .then((projectsData) => setProjects(Array.isArray(projectsData) ? projectsData : []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = window.setTimeout(loadData, 0);

    // Reîncarcă lista dacă o invitație a fost acceptată din TopBar.
    const handleProjectInviteAccepted = () => loadData();
    window.addEventListener('project-invitation-accepted', handleProjectInviteAccepted);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('project-invitation-accepted', handleProjectInviteAccepted);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const closeModal = () => {
    setIsModalOpen(false);
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
        ownerId: currentUser.id
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
        closeModal();
        toast.success('Proiect creat.');
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setCreating(false));
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => navigate('/dashboard')}
          >
            ⬅️ Înapoi la Dashboard
          </button>
          <div>
            <h1 className="page-title">📁 Projects</h1>
            <p className="page-subtitle">Proiectele în care ești owner sau membru.</p>
          </div>
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

      {loading ? (
        <div className="empty-state">Se încarcă proiectele...</div>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: '44px', marginBottom: '10px' }} aria-hidden="true">📂</div>
          <h2 style={{ margin: '0 0 8px', fontSize: '1.2rem', color: '#334155' }}>
            Niciun proiect deocamdată
          </h2>
          <p style={{ maxWidth: '420px', margin: '0 auto 20px' }}>
            Nu ești implicat în niciun proiect momentan. Creează unul nou pentru a începe colaborarea.
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
                onClick={() => navigate(`/projects/${project.id}`)}
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

          <div className="field" style={{ marginBottom: 0 }}>
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
        </form>
      </Modal>
    </div>
  );
}

export default ProjectsDashboard;
