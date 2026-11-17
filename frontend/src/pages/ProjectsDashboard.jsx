import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';

function ProjectsDashboard({ currentUser }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'owner' | 'member'

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

  // Filtered & Searched Projects
  const filteredProjects = useMemo(() => {
    return projects.filter((proj) => {
      const isOwner = proj.owner?.id === currentUser?.id;
      if (activeFilter === 'owner' && !isOwner) return false;
      if (activeFilter === 'member' && isOwner) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const matchName = proj.name?.toLowerCase().includes(term);
      const matchDesc = proj.description?.toLowerCase().includes(term);
      const matchOwner = proj.owner?.username?.toLowerCase().includes(term);
      return matchName || matchDesc || matchOwner;
    });
  }, [projects, activeFilter, searchTerm, currentUser?.id]);

  const ownedCount = useMemo(() => projects.filter(p => p.owner?.id === currentUser?.id).length, [projects, currentUser?.id]);
  const memberCount = useMemo(() => projects.filter(p => p.owner?.id !== currentUser?.id).length, [projects, currentUser?.id]);

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 60px)',
        backgroundColor: '#f8fafc',
        width: '100%',
        boxSizing: 'border-box',
        padding: '32px 36px',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '30px' }}>📁</span>
            <h1
              style={{
                margin: 0,
                fontSize: '1.85rem',
                fontWeight: '800',
                color: '#0f172a',
                letterSpacing: '-0.02em',
              }}
            >
              Projects
            </h1>
            <span
              style={{
                backgroundColor: '#f3e8ff',
                color: '#6b21a8',
                padding: '4px 10px',
                borderRadius: '16px',
                fontSize: '12px',
                fontWeight: '700',
              }}
            >
              {projects.length}
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#64748b' }}>
            Gestionează spațiile de lucru și proiectele echipei tale
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '11px 20px',
            backgroundColor: '#5a3d5c',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(90, 61, 92, 0.25)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#472f48';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#5a3d5c';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <span>➕</span>
          <span>Create Project</span>
        </button>
      </div>

      {/* ── Search and Filter Controls Bar ──────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          marginBottom: '20px',
          backgroundColor: '#ffffff',
          padding: '12px 18px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        {/* Search */}
        <div style={{ flex: '1 1 280px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '15px' }}>
            🔍
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Caută proiect după nume sau descriere..."
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: '7px',
              border: '1px solid #cbd5e1',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
              backgroundColor: '#f8fafc',
              transition: 'border-color 0.15s ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#5a3d5c';
              e.currentTarget.style.backgroundColor = '#ffffff';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#cbd5e1';
              e.currentTarget.style.backgroundColor = '#f8fafc';
            }}
          />
        </div>

        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: `Toate (${projects.length})` },
            { id: 'owner', label: `👑 Owner (${ownedCount})` },
            { id: 'member', label: `👥 Membru (${memberCount})` },
          ].map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: isActive ? '1px solid #5a3d5c' : '1px solid #e2e8f0',
                  backgroundColor: isActive ? '#f5eff8' : '#ffffff',
                  color: isActive ? '#5a3d5c' : '#64748b',
                  fontSize: '13px',
                  fontWeight: isActive ? '700' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content Area: List View ─────────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>⏳</div>
          <div style={{ fontWeight: '600', fontSize: '15px' }}>Se încarcă proiectele...</div>
        </div>
      ) : projects.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 24px',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '2px dashed #cbd5e1',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ fontSize: '52px', marginBottom: '14px' }}>📂</div>
          <h2 style={{ color: '#1e293b', marginBottom: '8px', fontSize: '1.25rem', fontWeight: '700' }}>
            Niciun proiect momentan
          </h2>
          <p style={{ color: '#64748b', maxWidth: '440px', margin: '0 auto 24px auto', fontSize: '14px', lineHeight: '1.5' }}>
            Nu ești implicat în niciun proiect. Creează primul tău proiect pentru a începe colaborarea cu echipa.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              padding: '11px 22px',
              backgroundColor: '#5a3d5c',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(90, 61, 92, 0.2)',
            }}
          >
            + Creează primul proiect
          </button>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 20px',
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            color: '#64748b',
          }}
        >
          <div style={{ fontSize: '36px', marginBottom: '10px' }}>🔍</div>
          <div style={{ fontWeight: '600', color: '#1e293b', marginBottom: '6px' }}>Nu a fost găsit niciun proiect</div>
          <div style={{ fontSize: '13px' }}>Încearcă să modifici termenul de căutare sau filtrul selectat.</div>
        </div>
      ) : (
        /* Projects List */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredProjects.map((proj) => {
            const isOwner = proj.owner?.id === currentUser?.id;
            return (
              <div
                key={proj.id}
                onClick={() => navigate(`/projects/${proj.id}`)}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  padding: '16px 20px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  transition: 'all 0.15s ease',
                  flexWrap: 'wrap',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(90, 61, 92, 0.08)';
                  e.currentTarget.style.borderColor = '#c084fc';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.03)';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}
              >
                {/* Left: Icon & Project Details */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: '1 1 300px', minWidth: '220px' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '10px',
                      backgroundColor: '#f5eff8',
                      color: '#5a3d5c',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                      fontWeight: '800',
                      flexShrink: 0,
                    }}
                  >
                    📁
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span
                        style={{
                          fontWeight: '700',
                          fontSize: '16px',
                          color: '#0f172a',
                          wordBreak: 'break-word',
                        }}
                      >
                        {proj.name}
                      </span>

                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '800',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: isOwner ? '#f3e8ff' : '#f1f5f9',
                          color: isOwner ? '#6b21a8' : '#475569',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        {isOwner ? '👑 OWNER' : '👤 MEMBER'}
                      </span>

                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                        🕒 Creat: {formatDate(proj.createdAt)}
                      </span>
                    </div>

                    <p
                      style={{
                        margin: 0,
                        color: proj.description ? '#475569' : '#94a3b8',
                        fontSize: '13px',
                        lineHeight: '1.4',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {proj.description || 'Fără descriere adițională.'}
                    </p>
                  </div>
                </div>

                {/* Right: Action Button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/projects/${proj.id}`);
                    }}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#ffffff',
                      color: '#5a3d5c',
                      border: '1px solid #cbd5e1',
                      borderRadius: '7px',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#5a3d5c';
                      e.currentTarget.style.color = '#ffffff';
                      e.currentTarget.style.borderColor = '#5a3d5c';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                      e.currentTarget.style.color = '#5a3d5c';
                      e.currentTarget.style.borderColor = '#cbd5e1';
                    }}
                  >
                    <span>Deschide</span>
                    <span style={{ fontSize: '14px' }}>→</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal Create Project ────────────────────────────────────────────── */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
            boxSizing: 'border-box',
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              padding: '28px',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '520px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.35rem', fontWeight: '800' }}>
                📁 Proiect Nou
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProject}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontWeight: '700', marginBottom: '6px', fontSize: '13px', color: '#334155' }}>
                  Nume Proiect *
                </label>
                <input
                  type="text"
                  required
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="ex: Redesign Platformă"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#5a3d5c')}
                  onBlur={(e) => (e.target.style.borderColor = '#cbd5e1')}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontWeight: '700', marginBottom: '6px', fontSize: '13px', color: '#334155' }}>
                  Descriere
                </label>
                <textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Obiectivele și contextul proiectului..."
                  rows="3"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    outline: 'none',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#5a3d5c')}
                  onBlur={(e) => (e.target.style.borderColor = '#cbd5e1')}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '9px 16px',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    borderRadius: '7px',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: 'pointer',
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
                    borderRadius: '7px',
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(90, 61, 92, 0.25)',
                  }}
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
