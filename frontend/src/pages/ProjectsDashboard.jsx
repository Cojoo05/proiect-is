import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';

function ProjectsDashboard({ currentUser }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');

  const API_URL = `${API_BASE_URL}/api/projects`;

  const loadData = () => {
    if (!currentUser?.id) return;
    setLoading(true);

    fetch(`${API_URL}/user/${currentUser.id}`)
      .then((r) => r.json())
      .then((projectsData) => {
        setProjects(Array.isArray(projectsData) ? projectsData : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();

    // Auto-refresh projects if an invitation was accepted in TopBar
    const handleProjectInviteAccepted = () => {
      loadData();
    };
    window.addEventListener('project-invitation-accepted', handleProjectInviteAccepted);
    return () => {
      window.removeEventListener('project-invitation-accepted', handleProjectInviteAccepted);
    };
  }, [currentUser]);

  const handleCreateProject = (e) => {
    e.preventDefault();
    if (!projectName.trim() || !currentUser?.id) return;

    const payload = {
      name: projectName.trim(),
      description: projectDescription.trim(),
      ownerId: currentUser.id
    };

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then((res) => {
        if (!res.ok) throw new Error('Eroare la crearea proiectului');
        return res.json();
      })
      .then((newProject) => {
        setProjects([newProject, ...projects]);
        setIsModalOpen(false);
        setProjectName('');
        setProjectDescription('');
      })
      .catch((err) => alert(err.message));
  };

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div style={{ padding: '30px', fontFamily: 'sans-serif', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{ padding: '8px 16px', cursor: 'pointer', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          ⬅️ Back
        </button>
        <h1 style={{ margin: 0, color: '#1e293b', fontSize: '2rem' }}>📁 Projects</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          style={{ padding: '10px 18px', backgroundColor: '#5a3d5c', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          + Create Project
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px', color: '#64748b' }}>Se încarcă proiectele...</div>
      ) : projects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: '#fafafa', borderRadius: '12px', border: '2px dashed #cbd5e1', marginTop: '10px' }}>
          <div style={{ fontSize: '48px', marginBottom: '15px' }}>📂</div>
          <h2 style={{ color: '#334155', marginBottom: '8px' }}>Empty, waiting for new projects</h2>
          <p style={{ color: '#64748b', maxWidth: '420px', margin: '0 auto 25px auto', fontSize: '15px' }}>
            Nu ești implicat în niciun proiect momentan. Creează unul nou pentru a începe colaborarea.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            style={{ padding: '11px 22px', backgroundColor: '#5a3d5c', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Create your first project
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {projects.map((proj) => {
            const isOwner = proj.owner?.id === currentUser?.id;
            return (
              <div
                key={proj.id}
                onClick={() => navigate(`/projects/${proj.id}`)}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  padding: '20px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                  transition: 'transform 0.15s, box-shadow 0.15s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 6px 14px rgba(90, 61, 92, 0.1)';
                  e.currentTarget.style.borderColor = '#d8b4e2';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.03)';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.2rem' }}>{proj.name}</h3>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 'bold',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      backgroundColor: isOwner ? '#f3e8ff' : '#f1f5f9',
                      color: isOwner ? '#6b21a8' : '#475569'
                    }}
                  >
                    {isOwner ? 'OWNER' : 'MEMBER'}
                  </span>
                </div>
                <p style={{ color: '#64748b', fontSize: '14px', minHeight: '40px', margin: '0 0 15px 0' }}>
                  {proj.description || 'Fără descriere.'}
                </p>
                <div style={{ fontSize: '12px', color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                  Creat: {formatDate(proj.createdAt)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#1e293b' }}>Proiect Nou</h2>
            <form onSubmit={handleCreateProject}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '14px', color: '#334155' }}>
                  Nume Proiect *
                </label>
                <input
                  type="text"
                  required
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="ex: Redesign Platformă"
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '14px', color: '#334155' }}>
                  Descriere
                </label>
                <textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Obiectivele proiectului..."
                  rows="3"
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ padding: '9px 16px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  style={{ padding: '9px 18px', backgroundColor: '#5a3d5c', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Creează Proiectul
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectsDashboard;
