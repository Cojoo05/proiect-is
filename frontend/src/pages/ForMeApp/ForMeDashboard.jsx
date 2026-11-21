import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

/* ── Storage Keys (sincronizate cu TopBar) ── */
const avatarStorageKey      = (uid) => `profile_avatar_${uid || 'guest'}`;
const statusStorageKey      = (uid) => `profile_status_${uid || 'guest'}`;
const bannerColorKey        = (uid) => `profile_banner_${uid || 'guest'}`;
const displayNameStorageKey = (uid) => `profile_display_name_${uid  || 'guest'}`;
const pronounsStorageKey    = (uid) => `profile_pronouns_${uid  || 'guest'}`;
const bioStorageKey         = (uid) => `profile_bio_${uid || 'guest'}`;
const memberSinceStorageKey = (uid) => `profile_member_since_${uid || 'guest'}`;

const STATUS_LIST = [
  { id: 'online',    emoji: '🟢', label: 'Online',                  dot: '#22c55e', desc: 'Disponibil pentru echipă' },
  { id: 'dnd',       emoji: '🔴', label: 'Nu deranja (Do Not Disturb)', dot: '#ef4444', desc: 'În ședință / Fără notificări' },
  { id: 'idle',      emoji: '🌙', label: 'Away / Inactiv',           dot: '#f59e0b', desc: 'La o pauză / Absent' },
  { id: 'invisible', emoji: '⬜', label: 'Invizibil',                dot: '#94a3b8', desc: 'Apare offline' },
];

const PRESET_BANNERS = [
  { color: '#5865F2', label: 'Blurple' },
  { color: '#5a3d5c', label: 'Purpuriu' },
  { color: '#1d4ed8', label: 'Albastru Regal' },
  { color: '#059669', label: 'Smarald' },
  { color: '#dc2626', label: 'Rubin' },
  { color: '#d97706', label: 'Chihlimbar' },
  { color: '#7c3aed', label: 'Violet Neon' },
  { color: '#0e7490', label: 'Cyan Oceanic' },
  { color: '#db2777', label: 'Roz Magenta' },
  { color: '#0f172a', label: 'Slate Dark' },
];

export default function ForMeDashboard({ currentUser }) {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const modalFileInputRef = useRef(null);

  const uid      = currentUser?.id;
  const username = currentUser?.username || currentUser?.email || 'User';
  const email    = currentUser?.email || '';
  const role     = currentUser?.role  || 'Membru';
  const initial  = username[0].toUpperCase();

  // Date profil persistate
  const [displayName, setDisplayName] = useState(() => localStorage.getItem(displayNameStorageKey(uid)) || username);
  const [pronouns,    setPronouns]    = useState(() => localStorage.getItem(pronounsStorageKey(uid)) || '');
  const [bio,         setBio]         = useState(() => localStorage.getItem(bioStorageKey(uid)) || '');
  const [bannerColor, setBannerColor] = useState(() => localStorage.getItem(bannerColorKey(uid)) || '#5865F2');
  const [avatar,      setAvatar]      = useState(() => localStorage.getItem(avatarStorageKey(uid)) || null);
  const [status,      setStatus]      = useState(() => {
    try { return JSON.parse(localStorage.getItem(statusStorageKey(uid))) || STATUS_LIST[0]; } catch { return STATUS_LIST[0]; }
  });
  const [memberSince]                 = useState(() => localStorage.getItem(memberSinceStorageKey(uid)) || '14 Oct 2026');
  const [activeTab,   setActiveTab]   = useState('about'); // 'about' | 'connections'

  // Pop-up modals & flyouts
  const [isEditModalOpen,   setIsEditModalOpen]   = useState(false);
  const [isStatusFlyoutOpen, setIsStatusFlyoutOpen] = useState(false);
  const [avatarHover,        setAvatarHover]        = useState(false);

  // Refs pentru outside click
  const statusFlyoutRef = useRef(null);

  // State temporar pentru modalul de editare
  const [tempDisplayName, setTempDisplayName] = useState(displayName);
  const [tempPronouns,    setTempPronouns]    = useState(pronouns);
  const [tempBio,         setTempBio]         = useState(bio);
  const [tempBannerColor, setTempBannerColor] = useState(bannerColor);
  const [tempAvatar,      setTempAvatar]      = useState(avatar);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState('');

  // Blocare scroll pagină când este deschis modalul de editare
  useEffect(() => {
    if (isEditModalOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isEditModalOpen]);

  // Outside click listener pentru status flyout
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (statusFlyoutRef.current && !statusFlyoutRef.current.contains(e.target)) {
        setIsStatusFlyoutOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Schimbare directă status
  const handleQuickStatus = (s) => {
    setStatus(s);
    setIsStatusFlyoutOpen(false);
    try {
      localStorage.setItem(statusStorageKey(uid), JSON.stringify(s));
      window.dispatchEvent(new Event('profile_updated'));
      showToast(`Status actualizat: ${s.label}`);
    } catch (_) {}
  };

  // Upload avatar direct
  const handleDirectAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target.result;
      setAvatar(url);
      setTempAvatar(url);
      try {
        localStorage.setItem(avatarStorageKey(uid), url);
        window.dispatchEvent(new Event('profile_updated'));
        showToast('Avatar actualizat cu succes!');
      } catch (_) {}
    };
    reader.readAsDataURL(file);
  };

  // Deschidere modal editare
  const openEditModal = () => {
    setTempDisplayName(displayName);
    setTempPronouns(pronouns);
    setTempBio(bio);
    setTempBannerColor(bannerColor);
    setTempAvatar(avatar);
    setIsEditModalOpen(true);
  };

  // Salvare din modal
  const handleSaveModal = () => {
    setDisplayName(tempDisplayName.trim());
    setPronouns(tempPronouns.trim());
    setBio(tempBio.trim());
    setBannerColor(tempBannerColor);
    setAvatar(tempAvatar);

    try {
      localStorage.setItem(displayNameStorageKey(uid), tempDisplayName.trim());
      localStorage.setItem(pronounsStorageKey(uid), tempPronouns.trim());
      localStorage.setItem(bioStorageKey(uid), tempBio.trim());
      localStorage.setItem(bannerColorKey(uid), tempBannerColor);
      if (tempAvatar) {
        localStorage.setItem(avatarStorageKey(uid), tempAvatar);
      } else {
        localStorage.removeItem(avatarStorageKey(uid));
      }
      window.dispatchEvent(new Event('profile_updated'));
      showToast('Profil actualizat cu succes!');
    } catch (_) {}

    setIsEditModalOpen(false);
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 60px)',
      backgroundColor: '#f1f5f9',
      padding: '24px 20px 36px',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      color: '#0f172a',
      position: 'relative'
    }}>

      {/* Stiluri de animație */}
      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes modalPopIn {
          0%   { opacity: 0; transform: scale(0.92) translateY(-14px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes flyoutPop {
          from { opacity: 0; transform: translateY(-8px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .profile-hero-card {
          animation: fadeInScale 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .hover-lift {
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        }
        .hover-lift:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 25px rgba(0,0,0,0.08);
        }
      `}</style>

      {/* Bara superioară de navigare */}
      <div style={{
        maxWidth: '780px',
        margin: '0 auto 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            padding: '8px 16px',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '13px',
            color: '#475569',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            transition: 'all 0.15s'
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}
        >
          ← Înapoi la Dashboard
        </button>

        <button
          onClick={openEditModal}
          style={{
            padding: '9px 20px',
            backgroundColor: '#5865F2',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontWeight: '700',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(88,101,242,0.35)',
            transition: 'transform 0.15s, background-color 0.15s'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          ✏️ Editează Profilul
        </button>
      </div>

      {/* Toast Feedback animat */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          fontWeight: '600',
          fontSize: '13px',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'flyoutPop 0.2s ease'
        }}>
          <span>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          CARDUL DE PROFIL PRINCIPAL (Centrat, fără split-screen)
      ════════════════════════════════════════════════════════════════════ */}
      <div
        className="profile-hero-card"
        style={{
          maxWidth: '780px',
          margin: '0 auto',
          backgroundColor: '#ffffff',
          borderRadius: '22px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 16px 40px rgba(0,0,0,0.07)',
          overflow: 'hidden',
          position: 'relative'
        }}
      >

        {/* ── BANNER MARE ── */}
        <div
          style={{
            height: '200px',
            backgroundColor: bannerColor,
            position: 'relative',
            transition: 'background-color 0.2s ease',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-end',
            padding: '16px'
          }}
        >
          {/* Badge colț Workspace */}
          <div style={{
            backgroundColor: 'rgba(0,0,0,0.35)',
            backdropFilter: 'blur(4px)',
            color: '#ffffff',
            fontSize: '11px',
            padding: '4px 10px',
            borderRadius: '8px',
            fontWeight: '700',
            letterSpacing: '0.04em'
          }}>
            Proiect IS Workspace
          </div>
        </div>

        {/* ── ZONA AVATAR & ACȚIUNI RAPIDE ── */}
        <div style={{
          padding: '0 28px',
          marginTop: '-56px',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          {/* Avatar rotund mare cu status */}
          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => setAvatarHover(true)}
            onMouseLeave={() => setAvatarHover(false)}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleDirectAvatarUpload}
              style={{ display: 'none' }}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              title="Apasă pentru a schimba avatarul"
              style={{
                width: '108px',
                height: '108px',
                borderRadius: '50%',
                backgroundColor: bannerColor,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '44px',
                fontWeight: '800',
                border: '6px solid #ffffff',
                boxShadow: '0 6px 18px rgba(0,0,0,0.14)',
                overflow: 'hidden',
                cursor: 'pointer',
                position: 'relative'
              }}
            >
              {avatar
                ? <img src={avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initial
              }

              {/* Overlay la hover pentru upload */}
              <div style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: avatarHover ? 1 : 0,
                transition: 'opacity 0.15s ease'
              }}>
                <span style={{ fontSize: '24px' }}>📷</span>
              </div>
            </div>

            {/* Dot mare status pe avatar - Schimbare directă din poză */}
            <div
              onClick={() => setIsStatusFlyoutOpen(o => !o)}
              title={`Status: ${status.label} (Apasă pentru a schimba direct)`}
              style={{
                position: 'absolute',
                bottom: '4px',
                right: '4px',
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                backgroundColor: status.dot,
                border: '4px solid #ffffff',
                boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                cursor: 'pointer',
                transition: 'transform 0.15s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            />

            {/* Flyout Pop-up cu Statusuri atașat direct de avatar/poză */}
            {isStatusFlyoutOpen && (
              <div
                ref={statusFlyoutRef}
                onClick={e => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: '114px',
                  left: 0,
                  width: '230px',
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  boxShadow: '0 12px 36px rgba(0,0,0,0.2)',
                  padding: '6px',
                  zIndex: 200,
                  animation: 'flyoutPop 0.15s ease'
                }}
              >
                <div style={{ padding: '6px 10px', fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Schimbă Statusul
                </div>
                {STATUS_LIST.map(s => {
                  const isSel = status.id === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleQuickStatus(s)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        backgroundColor: isSel ? '#f1f5f9' : 'transparent',
                        transition: 'background 0.1s ease'
                      }}
                      onMouseEnter={e => { if (!isSel) e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                      onMouseLeave={e => { if (!isSel) e.currentTarget.style.backgroundColor = isSel ? '#f1f5f9' : 'transparent'; }}
                    >
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: s.dot, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: isSel ? '700' : '600', fontSize: '13px', color: isSel ? '#0f172a' : '#334155' }}>
                          {s.label}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>
                          {s.desc}
                        </div>
                      </div>
                      {isSel && <span style={{ color: '#5865F2', fontWeight: '800', fontSize: '12px' }}>✓</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Butoane acțiune dreapta */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <button
              onClick={() => navigate('/messages')}
              style={{
                padding: '9px 16px',
                backgroundColor: '#f1f5f9',
                color: '#334155',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e2e8f0'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
            >
              💬 Mesagerie
            </button>
            <button
              onClick={() => navigate('/settings')}
              style={{
                padding: '9px 16px',
                backgroundColor: '#f1f5f9',
                color: '#334155',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e2e8f0'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
            >
              ⚙️ Setări
            </button>
          </div>
        </div>

        {/* ── DETALII UTILIZATOR & STATUS FLYOUT ── */}
        <div style={{ padding: '16px 28px 28px' }}>

          {/* Rând Nume + Identitate */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                {displayName || username}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '14px', color: '#64748b', fontWeight: '500' }}>@{username}</span>
                {pronouns && (
                  <>
                    <span style={{ fontSize: '12px', color: '#cbd5e1' }}>•</span>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>{pronouns}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Badges de rol & sistem */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              color: '#5865F2',
              backgroundColor: '#eef2ff',
              border: '1px solid #c7d2fe',
              padding: '3px 10px',
              borderRadius: '8px'
            }}>
              🛡️ {role.toUpperCase()}
            </span>
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              color: '#059669',
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              padding: '3px 10px',
              borderRadius: '8px'
            }}>
              ✓ Cont Verificat
            </span>
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              color: '#d97706',
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              padding: '3px 10px',
              borderRadius: '8px'
            }}>
              ⭐ Core Team Member
            </span>
          </div>

          {/* Separator fin */}
          <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '20px 0 16px' }} />

          {/* ── DISCORD NAVIGATION TABS ── */}
          <div style={{
            display: 'flex',
            gap: '8px',
            borderBottom: '2px solid #f1f5f9',
            paddingBottom: '2px',
            marginBottom: '20px',
            overflowX: 'auto'
          }}>
            {[
              { id: 'about',       icon: '📌', label: 'Despre & Profil' },
              { id: 'connections', icon: '🔗', label: 'Conexiuni Cont' },
            ].map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '9px 16px',
                    border: 'none',
                    borderBottom: isActive ? '3px solid #5865F2' : '3px solid transparent',
                    backgroundColor: isActive ? '#f8fafc' : 'transparent',
                    color: isActive ? '#5865F2' : '#64748b',
                    fontWeight: isActive ? '800' : '600',
                    fontSize: '13px',
                    borderRadius: '8px 8px 0 0',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = '#0f172a'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = '#64748b'; }}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* ── TAB 1: DESPRE & PROFIL ── */}
          {activeTab === 'about' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', animation: 'fadeInScale 0.2s ease' }}>
              {/* Grid 4 Informații Cheie */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div style={{ padding: '14px 16px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Member Since
                  </div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>📅</span>
                    <span>{memberSince}</span>
                  </div>
                </div>

                <div style={{ padding: '14px 16px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Email Asociat
                  </div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span>✉️</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email || 'Fără email'}</span>
                  </div>
                </div>

                <div style={{ padding: '14px 16px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Rol în Echipă
                  </div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>💼</span>
                    <span>{role} (Lead Dev)</span>
                  </div>
                </div>

                <div style={{ padding: '14px 16px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Stare Cont
                  </div>
                  <div style={{ fontSize: '14px', color: '#16a34a', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🌐</span>
                    <span>Verificat & Activ</span>
                  </div>
                </div>
              </div>

              {/* Despre Mine (Bio) dacă este completat */}
              {bio && (
                <div style={{
                  padding: '16px 18px',
                  backgroundColor: '#ffffff',
                  borderRadius: '14px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Despre Mine
                  </div>
                  <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {bio}
                  </div>
                </div>
              )}


            </div>
          )}

          {/* ── TAB 2: CONEXIUNI CONT (GitHub & Google) ── */}
          {activeTab === 'connections' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', animation: 'fadeInScale 0.2s ease' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Servicii & Conexiuni Integrate
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                {/* GitHub */}
                <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '28px' }}>🐙</span>
                    <div>
                      <div style={{ fontWeight: '800', fontSize: '14px', color: '#0f172a' }}>GitHub</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>@{username}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#059669', backgroundColor: '#ecfdf5', padding: '3px 10px', borderRadius: '12px' }}>
                    Conectat ✓
                  </span>
                </div>

                {/* Google Calendar */}
                <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '28px' }}>📅</span>
                    <div>
                      <div style={{ fontWeight: '800', fontSize: '14px', color: '#0f172a' }}>Google Workspace</div>
                      <div style={{ fontSize: '12px', color: '#64748b', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email || 'Gmail'}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#2563eb', backgroundColor: '#eff6ff', padding: '3px 10px', borderRadius: '12px' }}>
                    Sincronizat 🟢
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* ════════════════════════════════════════════════════════════════════
          MODAL EDITEAZĂ PROFILUL (2 Coloane Light Mode)
      ════════════════════════════════════════════════════════════════════ */}
      {isEditModalOpen && (
        <div
          onClick={() => setIsEditModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '820px',
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              boxShadow: '0 24px 60px rgba(0,0,0,0.2)',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              animation: 'modalPopIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Header modal light */}
            <div style={{
              padding: '16px 24px',
              borderBottom: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  backgroundColor: '#5865F2', color: '#ffffff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px'
                }}>
                  ✏️
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                    Profil Utilizator
                  </h3>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    Personalizează modul în care apari în echipă și pe platformă
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                style={{
                  background: 'none', border: 'none', fontSize: '18px',
                  color: '#94a3b8', cursor: 'pointer', padding: '4px 8px',
                  borderRadius: '6px', transition: 'color 0.15s, background 0.15s'
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#0f172a'; e.currentTarget.style.backgroundColor = '#e2e8f0'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                ✕
              </button>
            </div>

            {/* Corp formular light 2 coloane */}
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              gap: '24px',
              padding: '24px',
              overflowY: 'auto',
              backgroundColor: '#ffffff',
              color: '#0f172a',
              flexWrap: 'wrap'
            }}>

              {/* COLOANA STÂNGA: CONTROALE EDITARE */}
              <div style={{ flex: '1.1', display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '280px' }}>

                {/* Nume afișat */}
                <div>
                  <label style={lightModalLabelStyle}>Nume Afișat (Display Name)</label>
                  <input
                    type="text"
                    value={tempDisplayName}
                    onChange={e => setTempDisplayName(e.target.value)}
                    placeholder="Ex: Alex C."
                    maxLength={32}
                    style={lightModalInputStyle}
                  />
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                    Numele principal văzut de colegii tăi în mesagerie și workspace.
                  </div>
                </div>

                {/* Pronume / Titlu */}
                <div>
                  <label style={lightModalLabelStyle}>Pronume sau Titlu (Opțional)</label>
                  <input
                    type="text"
                    value={tempPronouns}
                    onChange={e => setTempPronouns(e.target.value)}
                    placeholder="Ex: he/him • Frontend Lead"
                    maxLength={40}
                    style={lightModalInputStyle}
                  />
                </div>

                {/* Despre Mine (Bio) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ ...lightModalLabelStyle, marginBottom: 0 }}>Despre Mine (Bio)</label>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>{tempBio.length}/200</span>
                  </div>
                  <textarea
                    value={tempBio}
                    onChange={e => setTempBio(e.target.value)}
                    placeholder="Scrie o scurtă descriere sau motto despre tine..."
                    maxLength={200}
                    rows={3}
                    style={{
                      ...lightModalInputStyle,
                      resize: 'vertical',
                      minHeight: '64px',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                {/* Schimbare Avatar */}
                <div>
                  <label style={lightModalLabelStyle}>Avatar & Imagine Profil</label>
                  <input
                    ref={modalFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = ev => setTempAvatar(ev.target.result);
                      reader.readAsDataURL(file);
                    }}
                    style={{ display: 'none' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={() => modalFileInputRef.current?.click()}
                      style={{
                        padding: '9px 16px',
                        backgroundColor: '#5865F2',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: '700',
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#4752c4'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = '#5865F2'}
                    >
                      <span>📷</span>
                      <span>Schimbă Avatar</span>
                    </button>
                    {tempAvatar && (
                      <button
                        type="button"
                        onClick={() => setTempAvatar(null)}
                        style={{
                          padding: '9px 14px',
                          backgroundColor: '#fee2e2',
                          color: '#dc2626',
                          border: '1px solid #fca5a5',
                          borderRadius: '8px',
                          fontWeight: '700',
                          fontSize: '13px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fecaca'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fee2e2'}
                      >
                        <span>🗑️</span>
                        <span>Șterge</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Culoare Banner */}
                <div>
                  <label style={lightModalLabelStyle}>Culoare Banner Profil</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '6px 0 10px' }}>
                    {PRESET_BANNERS.map(b => (
                      <div
                        key={b.color}
                        onClick={() => setTempBannerColor(b.color)}
                        title={b.label}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          backgroundColor: b.color,
                          cursor: 'pointer',
                          boxShadow: tempBannerColor === b.color
                            ? '0 0 0 2px #ffffff, 0 0 0 4px #5865F2'
                            : '0 1px 3px rgba(0,0,0,0.15)',
                          transform: tempBannerColor === b.color ? 'scale(1.15)' : 'scale(1)',
                          transition: 'all 0.12s ease'
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="color"
                      value={tempBannerColor}
                      onChange={e => setTempBannerColor(e.target.value)}
                      style={{
                        width: '32px', height: '28px', borderRadius: '4px',
                        border: '1px solid #cbd5e1', cursor: 'pointer', backgroundColor: 'transparent'
                      }}
                    />
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Custom HEX: <strong style={{ color: '#0f172a' }}>{tempBannerColor}</strong></span>
                  </div>
                </div>

              </div>

              {/* COLOANA DREAPTA: PREVIEW CARD LIVE DISCORD */}
              <div style={{ flex: '0.9', minWidth: '280px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  Previzualizare Card Live
                </div>

                {/* Card Discord Styled (Light Theme) */}
                <div style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
                }}>
                  {/* Banner */}
                  <div style={{
                    height: '84px',
                    backgroundColor: tempBannerColor,
                    position: 'relative',
                    transition: 'background-color 0.15s ease'
                  }}>
                    <div style={{
                      position: 'absolute', top: '8px', right: '8px',
                      padding: '2px 8px', borderRadius: '4px',
                      backgroundColor: 'rgba(0,0,0,0.35)', color: '#fff',
                      fontSize: '10px', fontWeight: '700'
                    }}>
                      Workspace IS
                    </div>
                  </div>

                  {/* Avatar suprapus */}
                  <div style={{ padding: '0 16px', marginTop: '-36px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    <div style={{ position: 'relative' }}>
                      <div style={{
                        width: '68px', height: '68px', borderRadius: '50%',
                        backgroundColor: tempBannerColor, color: '#ffffff',
                        border: '4px solid #ffffff',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                        overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '26px', fontWeight: '800'
                      }}>
                        {tempAvatar
                          ? <img src={tempAvatar} alt="prev" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : initial
                        }
                      </div>
                      {/* Dot status pe preview */}
                      <div style={{
                        position: 'absolute', bottom: '2px', right: '2px',
                        width: '18px', height: '18px', borderRadius: '50%',
                        backgroundColor: status.dot,
                        border: '3px solid #ffffff',
                      }} />
                    </div>

                    <div style={{
                      padding: '4px 10px', borderRadius: '12px',
                      backgroundColor: '#f1f5f9', color: '#475569',
                      fontSize: '10px', fontWeight: '700', marginBottom: '6px'
                    }}>
                      LIVE PREVIEW
                    </div>
                  </div>

                  {/* Card details */}
                  <div style={{ padding: '10px 16px 16px' }}>
                    <div style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a', lineHeight: 1.2 }}>
                      {tempDisplayName || username}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>@{username}</span>
                      {tempPronouns && (
                        <>
                          <span style={{ fontSize: '10px', color: '#cbd5e1' }}>•</span>
                          <span style={{ fontSize: '11px', color: '#475569', backgroundColor: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>{tempPronouns}</span>
                        </>
                      )}
                    </div>

                    {/* Badges line */}
                    <div style={{ display: 'flex', gap: '6px', margin: '10px 0 12px', alignItems: 'center' }}>
                      <span title="Administrator Workspace" style={{ fontSize: '14px' }}>🛡️</span>
                      <span title="Cont Verificat" style={{ fontSize: '14px' }}>✓</span>
                      <span title="Developer IS" style={{ fontSize: '14px' }}>💻</span>
                      <span title="Core Team Member" style={{ fontSize: '14px' }}>⭐</span>
                    </div>

                    <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '8px 0 12px' }} />

                    {/* About Me preview */}
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                        Despre Mine
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: tempBio ? '#334155' : '#94a3b8',
                        lineHeight: 1.4,
                        whiteSpace: 'pre-wrap',
                        backgroundColor: '#f8fafc',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: '1px solid #f1f5f9'
                      }}>
                        {tempBio || 'Scrie o scurtă descriere în formularul din stânga...'}
                      </div>
                    </div>

                    {/* Member Since */}
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>
                        Membru Din
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>📅</span>
                        <span>{memberSince}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Butoane acțiune modal footer */}
            <div style={{
              padding: '14px 24px',
              backgroundColor: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                style={{
                  padding: '9px 18px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '13px',
                  color: '#64748b',
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s'
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.color = '#64748b'; }}
              >
                Anulează
              </button>
              <button
                type="button"
                onClick={handleSaveModal}
                style={{
                  padding: '9px 22px',
                  backgroundColor: '#5865F2',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(88,101,242,0.35)',
                  transition: 'background 0.15s, transform 0.15s'
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#4752c4'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#5865F2'; e.currentTarget.style.transform = 'scale(1)'; }}
              >
                Salvează Modificările
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

/* ── Stiluri refolosibile modal Discord Studio (Light Theme) ── */
const lightModalLabelStyle = {
  display: 'block',
  fontSize: '11px',
  fontWeight: '700',
  color: '#475569',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em'
};

const lightModalInputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 14px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '14px',
  color: '#0f172a',
  outline: 'none',
  fontFamily: 'inherit',
  backgroundColor: '#ffffff',
  transition: 'border-color 0.15s'
};
