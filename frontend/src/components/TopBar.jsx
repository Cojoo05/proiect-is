import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_BASE_URL, WS_BASE_URL } from '../config.js';
import SockJS from 'sockjs-client/dist/sockjs.min.js';
import { Client } from '@stomp/stompjs';

const POLL_INTERVAL = 15_000;

/* ── Paleta culori avatar deterministă ── */
const AVATAR_COLORS = ['#5a3d5c','#1d4ed8','#065f46','#991b1b','#92400e','#5b21b6','#0e7490','#9d174d'];
function getUserColor(str) {
  if (!str) return AVATAR_COLORS[0];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

const avatarStorageKey = (uid) => `profile_avatar_${uid || 'guest'}`;
const statusStorageKey = (uid) => `profile_status_${uid || 'guest'}`;
const bannerColorKey   = (uid) => `profile_banner_${uid || 'guest'}`;
const displayNameStorageKey  = (uid) => `profile_display_name_${uid  || 'guest'}`;
const bioStorageKey          = (uid) => `profile_bio_${uid || 'guest'}`;
const memberSinceStorageKey  = (uid) => `profile_member_since_${uid || 'guest'}`;

const STATUS_LIST = [
  { id: 'online',    emoji: '🟢', label: 'Online',                  dot: '#22c55e', desc: 'Disponibil pentru echipă' },
  { id: 'idle',      emoji: '🌙', label: 'Away / Inactiv',           dot: '#f59e0b', desc: 'La o pauză / Absent' },
  { id: 'dnd',       emoji: '🔴', label: 'Nu deranja (Do Not Disturb)', dot: '#ef4444', desc: 'Fără notificări de lucru' },
  { id: 'invisible', emoji: '⬜', label: 'Invizibil',                dot: '#94a3b8', desc: 'Vei apărea offline' },
];

const BANNER_COLORS = ['#5a3d5c','#1d4ed8','#065f46','#991b1b','#7c3aed','#0e7490','#9d174d','#92400e','#0f172a'];

export default function TopBar({ currentUser, setCurrentUser }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [open,        setOpen]        = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [invitations,          setInvitations]          = useState([]);
  const [recentConversations,  setRecentConversations]  = useState([]);
  const [calendarNotifs,       setCalendarNotifs]       = useState([]);

  const [readMsgIds, setReadMsgIds] = useState(() => {
    try { const s = localStorage.getItem(`read_conv_msgs_${currentUser?.id}`); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });

  const dropdownRef = useRef(null);
  const profileRef  = useRef(null);
  const stompClientRef = useRef(null);

  /* ── Profile state ── */
  const uid      = currentUser?.id;
  const username = currentUser?.username || currentUser?.email || 'User';
  const email    = currentUser?.email || '';
  const role     = currentUser?.role  || 'Membru';
  const initial  = username[0].toUpperCase();
  const accentColor = getUserColor(username);

  const [avatar,       setAvatar]       = useState(() => { try { return localStorage.getItem(avatarStorageKey(uid)) || null; } catch { return null; } });
  const [status,       setStatus]       = useState(() => { try { return JSON.parse(localStorage.getItem(statusStorageKey(uid))) || STATUS_LIST[0]; } catch { return STATUS_LIST[0]; } });
  const [bannerColor,  setBannerColor]  = useState(() => { try { return localStorage.getItem(bannerColorKey(uid)) || accentColor; } catch { return accentColor; } });
  const [displayName,  setDisplayName]  = useState(() => { try { return localStorage.getItem(displayNameStorageKey(uid)) || ''; } catch { return ''; } });
  const [bio,          setBio]          = useState(() => { try { return localStorage.getItem(bioStorageKey(uid)) || ''; } catch { return ''; } });
  const [memberSince]                   = useState(() => { try { return localStorage.getItem(memberSinceStorageKey(uid)) || '14 Oct 2026'; } catch { return '14 Oct 2026'; } });
  const [showStatus,   setShowStatus]   = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);

  // Sync profile when updated from the full profile page
  useEffect(() => {
    const handleProfileSync = () => {
      try { setAvatar(localStorage.getItem(avatarStorageKey(uid)) || null); } catch {}
      try { setStatus(JSON.parse(localStorage.getItem(statusStorageKey(uid))) || STATUS_LIST[0]); } catch {}
      try { setBannerColor(localStorage.getItem(bannerColorKey(uid)) || accentColor); } catch {}
      try { setDisplayName(localStorage.getItem(displayNameStorageKey(uid)) || ''); } catch {}
      try { setBio(localStorage.getItem(bioStorageKey(uid)) || ''); } catch {}
    };
    window.addEventListener('profile_updated', handleProfileSync);
    return () => window.removeEventListener('profile_updated', handleProfileSync);
  }, [uid, accentColor]);

  const pickStatus = (s) => {
    setStatus(s); setShowStatus(false);
    try { localStorage.setItem(statusStorageKey(uid), JSON.stringify(s)); } catch {}
    window.dispatchEvent(new Event('profile_updated'));
  };

  const markConvAsRead = useCallback((convId, lastMsgId) => {
    if (!currentUser?.id || !convId) return;
    setReadMsgIds(prev => {
      const next = { ...prev, [convId]: lastMsgId || true };
      try { localStorage.setItem(`read_conv_msgs_${currentUser.id}`, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [currentUser?.id]);

  const isConvUnread = useCallback((conv) => {
    const last = conv?.lastMessage || conv?.lastMsg;
    if (!last) return false;
    const senderId = last.senderId ?? last.sender?.id;
    if (senderId && Number(senderId) === Number(currentUser?.id)) return false;
    if (readMsgIds[conv.id] && (readMsgIds[conv.id] === last.id || readMsgIds[conv.id] === true)) return false;
    if (conv.unreadCount !== undefined && conv.unreadCount !== null) return Number(conv.unreadCount) > 0;
    if (last.isRead !== undefined) return !last.isRead;
    return true;
  }, [currentUser?.id, readMsgIds]);

  const unreadMsgCount = recentConversations.filter(isConvUnread).length;
  const totalCount     = invitations.length + unreadMsgCount + calendarNotifs.length;

  const fetchCalendarNotifs = useCallback(async () => {
    if (!currentUser?.id) return;
    try { const res = await fetch(`${API_BASE_URL}/api/notifications/user/${currentUser.id}/unread`); if (res.ok) { const d = await res.json(); setCalendarNotifs(Array.isArray(d) ? d : []); } } catch {}
  }, [currentUser?.id]);

  const handleMarkNotifRead = async (notifId) => {
    try { await fetch(`${API_BASE_URL}/api/notifications/${notifId}/read`, { method: 'PUT' }); setCalendarNotifs(prev => prev.filter(n => n.id !== notifId)); } catch {}
  };

  const fetchInvitations = useCallback(async () => {
    if (!currentUser?.id) return;
    try { const res = await fetch(`${API_BASE_URL}/api/projects/invitations/user/${currentUser.id}`); if (res.ok) { const d = await res.json(); setInvitations(Array.isArray(d) ? d : []); } } catch {}
  }, [currentUser?.id]);

  const fetchRecentMessages = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/conversations?userId=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        const convsWithMessages = (Array.isArray(data) ? data : [])
          .filter(conv => Boolean(conv.lastMessage || conv.lastMsg))
          .sort((a, b) => new Date(b.lastMessage?.sentAt || 0) - new Date(a.lastMessage?.sentAt || 0));
        setRecentConversations(convsWithMessages);
      }
    } catch {}
  }, [currentUser?.id]);

  // ── Listen for custom event when messages are read in MessagesPage ─────────
  useEffect(() => {
    const handleMessagesReadEvent = (e) => {
      if (e.detail?.conversationId) {
        markConvAsRead(e.detail.conversationId, e.detail.lastMessageId);
      }
    };
    window.addEventListener('messages-read', handleMessagesReadEvent);
    return () => window.removeEventListener('messages-read', handleMessagesReadEvent);
  }, [markConvAsRead]);

  // ── Polling ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.id) return;
    fetchInvitations();
    fetchRecentMessages();
    fetchCalendarNotifs();
    const timer = setInterval(() => {
      fetchInvitations();
      fetchRecentMessages();
      fetchCalendarNotifs();
    }, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchInvitations, fetchRecentMessages, fetchCalendarNotifs, currentUser?.id]);

  // ── WebSocket for real-time message events ─────────────────────────────────
  useEffect(() => {
    if (!currentUser?.id) return;
    let client = null;
    try {
      client = new Client({
        webSocketFactory: () => new SockJS(WS_BASE_URL),
        reconnectDelay: 5000,
        onConnect: () => {
          client.subscribe(`/topic/chat/users/${currentUser.id}/notifications`, () => {
            fetchRecentMessages();
          });
          client.subscribe(`/topic/users/${currentUser.id}/invitations`, () => {
            fetchInvitations();
          });
          client.subscribe(`/topic/users/${currentUser.id}/notifications`, () => {
            fetchCalendarNotifs();
          });
        },
        onStompError: () => {},
      });
      client.activate();
      stompClientRef.current = client;
    } catch (_) {}
    return () => {
      try { stompClientRef.current?.deactivate(); } catch (_) {}
    };
  }, [currentUser?.id, fetchRecentMessages, fetchInvitations, fetchCalendarNotifs]);

  // ── Close dropdowns on outside click ─────────────────────────────────────
  useEffect(() => {
    const handleOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
        setShowStatus(false);
        setShowAccounts(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // ── Prevent background scroll when profile popup is open ───────────────────
  useEffect(() => {
    if (profileOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [profileOpen]);

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    setProfileOpen(false);
    localStorage.removeItem('currentUser');
    if (setCurrentUser) setCurrentUser(null);
    navigate('/login');
  };

  // ── Accept / Decline invitation ───────────────────────────────────────────
  const handleAccept = async (invitationId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/projects/invitations/${invitationId}/accept`, { method: 'POST' });
      if (res.ok) {
        setInvitations(prev => prev.filter(i => i.id !== invitationId));
        // Auto-refresh Projects list if user is currently on the Projects page
        window.dispatchEvent(new CustomEvent('project-invitation-accepted', { detail: { invitationId } }));
      }
    } catch (_) {}
  };

  const handleDecline = async (invitationId) => {
    try {
      await fetch(`${API_BASE_URL}/api/projects/invitations/${invitationId}/decline`, { method: 'POST' });
      setInvitations(prev => prev.filter(i => i.id !== invitationId));
    } catch (_) {}
  };

  // ── Navigate to conversation and mark as read ──────────────────────────────
  const handleOpenConversation = (conv) => {
    const last = conv.lastMessage || conv.lastMsg;
    markConvAsRead(conv.id, last?.id);

    // Call backend mark as read
    fetch(`${API_BASE_URL}/api/chat/conversations/${conv.id}/read?userId=${currentUser?.id}`, {
      method: 'POST',
    }).catch(() => {});

    setOpen(false);

    const otherId =
      conv.participants?.find(p => Number(p.id) !== Number(currentUser?.id))?.id
      ?? conv.otherUserId;

    if (conv.id) {
      navigate(`/messages?convId=${conv.id}${otherId ? `&userId=${otherId}` : ''}`);
    } else if (otherId) {
      navigate(`/messages?userId=${otherId}`);
    } else {
      navigate('/messages');
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      const now = new Date();
      const diffMs = now - d;
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'acum';
      if (diffMins < 60) return `${diffMins}m`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h`;
      return d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' });
    } catch (_) {
      return '';
    }
  };

  return (
    <>
    {/* Spacer: keeps page content below the fixed bar */}
    <div style={{ height: '60px' }} />
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '60px',
        boxSizing: 'border-box',
        padding: '0 24px',
        backgroundColor: '#e5e7eb',
        borderBottom: '1px solid #cbd5e1',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      {/* ── Left Branding Badge & Back to Dashboard ──────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div
          onClick={() => navigate('/dashboard')}
          title="Mergi la Dashboard"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: '#5a3d5c',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '18px',
              boxShadow: '0 2px 5px rgba(90, 61, 92, 0.25)',
              flexShrink: 0,
            }}
          >
            P
          </div>
          <span
            style={{
              margin: 0,
              fontSize: '1.2rem',
              color: '#0f172a',
              fontWeight: '700',
              lineHeight: '1.2',
              letterSpacing: '-0.01em',
            }}
          >
            Workspace
          </span>
        </div>

        {location.pathname !== '/dashboard' && (
          <button
            onClick={() => navigate('/dashboard')}
            title="Înapoi la Dashboard"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              backgroundColor: '#ffffff',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = '#f1f5f9';
              e.currentTarget.style.borderColor = '#94a3b8';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
          >
            <span style={{ fontSize: '13px' }}>⬅️</span>
            <span>Dashboard</span>
          </button>
        )}
      </div>

      {/* ── Right Actions (Bell + Profile) ─────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      {/* ── Bell ───────────────────────────────────────────────────────── */}
      <div ref={dropdownRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen(o => !o)}
          title="Notificări"
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            border: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            position: 'relative',
            padding: 0,
          }}
        >
          🔔
          {totalCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-3px',
                right: '-3px',
                backgroundColor: '#ef4444',
                color: '#fff',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                fontSize: '10px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              {totalCount > 9 ? '9+' : totalCount}
            </span>
          )}
        </button>

        {/* ── Dropdown ───────────────────────────────────────────────────── */}
        {open && (
          <div
            style={{
              position: 'absolute',
              top: '46px',
              right: 0,
              width: '350px',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              fontFamily: 'sans-serif',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontWeight: '700', fontSize: '14px', color: '#1e293b' }}>
                Notificări
              </span>
              {totalCount > 0 ? (
                <span
                  style={{
                    backgroundColor: '#f6eff7',
                    color: '#5a3d5c',
                    borderRadius: '99px',
                    padding: '2px 8px',
                    fontSize: '12px',
                    fontWeight: '600',
                  }}
                >
                  {totalCount} {totalCount === 1 ? 'nouă' : 'noi'}
                </span>
              ) : (
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Toate citite</span>
              )}
            </div>

            {/* Body */}
            <div style={{ maxHeight: '420px', overflowY: 'auto' }}>

                            {/* Notifications */}
              {calendarNotifs.length > 0 && (
                <div>
                  {calendarNotifs.filter(n => n.type === 'announcement').length > 0 && (
                    <div>
                      <div style={sectionLabelStyle}>Anunțuri</div>
                      {calendarNotifs.filter(n => n.type === 'announcement').map(n => (
                        <div key={n.id} style={notifRowStyle}>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '20px', flexShrink: 0 }}>📢</span>
                            <div style={{ flex: 1 }}>
                              <div style={notifTitleStyle}>{n.title}</div>
                              <div style={notifSubStyle}>{n.message}</div>
                              {n.createdAt && (
                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                                  🕒 {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', paddingLeft: '30px' }}>
                            <button
                              onClick={() => {
                                handleMarkNotifRead(n.id);
                                setOpen(false);
                                navigate('/announcements');
                              }}
                              style={acceptBtnStyle}
                            >
                              📢 Vezi anunțul
                            </button>
                            <button
                              onClick={() => handleMarkNotifRead(n.id)}
                              style={declineBtnStyle}
                            >
                              Marchează citit
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {calendarNotifs.filter(n => n.type === 'task_assigned').length > 0 && (
                    <div>
                      <div style={sectionLabelStyle}>Task-uri Atribuite</div>
                      {calendarNotifs.filter(n => n.type === 'task_assigned').map(n => (
                        <div key={n.id} style={notifRowStyle}>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '20px', flexShrink: 0 }}>📋</span>
                            <div style={{ flex: 1 }}>
                              <div style={notifTitleStyle}>{n.title}</div>
                              <div style={notifSubStyle}>{n.message}</div>
                              {n.createdAt && (
                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                                  🕒 {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', paddingLeft: '30px' }}>
                            <button
                              onClick={() => {
                                handleMarkNotifRead(n.id);
                                setOpen(false);
                                navigate('/tasks');
                              }}
                              style={acceptBtnStyle}
                            >
                              📋 Vezi Task-uri
                            </button>
                            <button
                              onClick={() => handleMarkNotifRead(n.id)}
                              style={declineBtnStyle}
                            >
                              Marchează citit
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {calendarNotifs.filter(n => n.type !== 'task_assigned' && n.type !== 'announcement').length > 0 && (
                    <div>
                      <div style={sectionLabelStyle}>Invitații Ședințe Google Meet</div>
                      {calendarNotifs.filter(n => n.type !== 'task_assigned' && n.type !== 'announcement').map(n => (
                        <div key={n.id} style={notifRowStyle}>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '20px', flexShrink: 0 }}>🎥</span>
                            <div style={{ flex: 1 }}>
                              <div style={notifTitleStyle}>{n.title}</div>
                              <div style={notifSubStyle}>{n.message}</div>
                              {n.eventDate && (
                                <div style={{ fontSize: '11px', color: '#2563eb', fontWeight: '700', marginTop: '3px' }}>
                                  📅 {n.eventDate} {n.eventStartTime ? `la ${n.eventStartTime}` : ''}
                                </div>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', paddingLeft: '30px' }}>
                            {n.meetLink && (
                              <a
                                href={n.meetLink}
                                target="_blank"
                                rel="noreferrer"
                                style={{ ...acceptBtnStyle, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                onClick={() => handleMarkNotifRead(n.id)}
                              >
                                🎥 Intră în Meet
                              </a>
                            )}
                            <button
                              onClick={() => handleMarkNotifRead(n.id)}
                              style={declineBtnStyle}
                            >
                              Marchează citit
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Invitations */}
              {invitations.length > 0 && (
                <div>
                  <div style={sectionLabelStyle}>Invitații la proiect</div>
                  {invitations.map(inv => (
                    <div key={inv.id} style={notifRowStyle}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '20px', flexShrink: 0 }}>📁</span>
                        <div>
                          <div style={notifTitleStyle}>{inv.project?.name ?? 'Proiect'}</div>
                          <div style={notifSubStyle}>Ai fost invitat să te alături acestui proiect.</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', paddingLeft: '30px' }}>
                        <button
                          onClick={() => handleAccept(inv.id)}
                          style={acceptBtnStyle}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#4a3050')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#5a3d5c')}
                        >
                          Acceptă
                        </button>
                        <button
                          onClick={() => handleDecline(inv.id)}
                          style={declineBtnStyle}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#e2e8f0')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                        >
                          Refuză
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Messages list (keeps both unread and read recent messages) */}
              {recentConversations.length > 0 && (
                <div>
                  <div style={sectionLabelStyle}>Mesaje</div>
                  {recentConversations.map(conv => {
                    const last = conv.lastMessage || conv.lastMsg;
                    const otherUser = conv.participants?.find(
                      p => Number(p.id) !== Number(currentUser?.id)
                    );
                    const rawSenderName =
                      last?.senderName ||
                      last?.senderUsername ||
                      last?.sender?.username ||
                      otherUser?.username ||
                      otherUser?.email?.split('@')[0] ||
                      (conv.name ? conv.name : 'Utilizator');

                    const displayName = conv.type === 'GROUP' && conv.name && rawSenderName !== conv.name
                      ? `${rawSenderName} (${conv.name})`
                      : (conv.type === 'GROUP' && conv.name ? conv.name : rawSenderName);

                    const preview = last?.content ?? last?.text ?? '';
                    const unread = isConvUnread(conv);
                    const timeStr = formatTime(last?.sentAt);

                    return (
                      <div
                        key={conv.id}
                        onClick={() => handleOpenConversation(conv)}
                        style={{
                          ...notifRowStyle,
                          cursor: 'pointer',
                          display: 'flex',
                          gap: '10px',
                          alignItems: 'center',
                          backgroundColor: unread ? '#faf5fb' : 'transparent',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = unread ? '#f5eef7' : '#f8fafc')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = unread ? '#faf5fb' : 'transparent')}
                      >
                        <span style={{ fontSize: '20px', flexShrink: 0, opacity: unread ? 1 : 0.6 }}>💬</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span
                              style={{
                                fontSize: '13px',
                                fontWeight: unread ? '700' : '500',
                                color: unread ? '#1e293b' : '#64748b',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {displayName}
                            </span>
                            {timeStr && (
                              <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '6px', flexShrink: 0 }}>
                                {timeStr}
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: '12px',
                              color: unread ? '#334155' : '#94a3b8',
                              fontWeight: unread ? '600' : '400',
                              marginTop: '2px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {preview || '(mesaj)'}
                          </div>
                        </div>
                        {unread && (
                          <span
                            title="Necitit"
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: '#5a3d5c',
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Empty state */}
              {invitations.length === 0 && recentConversations.length === 0 && (
                <div style={{ padding: '36px 18px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                  <div style={{ fontSize: '30px', marginBottom: '10px' }}>🎉</div>
                  Nicio notificare disponibilă.
                </div>
              )}
            </div>
          </div>
        )}
      </div>


      {/* ── Avatar + Discord-style profile card ──────────────────────── */}
      <div ref={profileRef} style={{ position: 'relative' }}>
        {/* Avatar button */}
        <div
          onClick={() => setProfileOpen(o => !o)}
          title="Profilul meu"
          style={{
            width: '38px', height: '38px', borderRadius: '50%',
            overflow: 'hidden', cursor: 'pointer', flexShrink: 0,
            border: profileOpen ? `2px solid ${accentColor}` : '2px solid #d8b4e2',
            boxShadow: profileOpen ? `0 0 0 3px ${accentColor}33` : '0 2px 6px rgba(90,61,92,0.2)',
            position: 'relative', transition: 'all 0.15s',
          }}
        >
          {avatar
            ? <img src={avatar} alt="avatar" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            : <div style={{ width:'100%', height:'100%', backgroundColor: accentColor, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'15px', fontWeight:'700', userSelect:'none' }}>{initial}</div>
          }
          {/* Status dot mic pe avatar */}
          <div style={{
            position:'absolute', bottom:'1px', right:'1px',
            width:'11px', height:'11px', borderRadius:'50%',
            backgroundColor: status.dot, border:'2px solid #e5e7eb',
          }} />
        </div>

        {/* ── Discord-style profile card popup ── */}
        {profileOpen && (
          <div style={{
            position: 'absolute', top: '50px', right: 0,
            width: '300px', borderRadius: '16px',
            backgroundColor: '#ffffff',
            boxShadow: '0 20px 50px rgba(0,0,0,0.18), 0 0 1px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0',
            overflow: 'visible', zIndex: 10000,
            animation: 'profileCardIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            <style>{`
              @keyframes profileCardIn {
                from { opacity: 0; transform: translateY(-8px) scale(0.97); }
                to   { opacity: 1; transform: translateY(0)   scale(1); }
              }
              @keyframes flyoutIn {
                from { opacity: 0; transform: translateX(8px) scale(0.96); }
                to   { opacity: 1; transform: translateX(0) scale(1); }
              }
            `}</style>

            {/* Banner color - click enters profile */}
            <div
              onClick={() => { setProfileOpen(false); navigate('/for-me'); }}
              title="Apasă pentru a deschide profilul"
              style={{
                height: '76px', backgroundColor: bannerColor, position: 'relative', cursor: 'pointer',
                borderTopLeftRadius: '15px', borderTopRightRadius: '15px',
              }}
            />

            {/* Avatar overlapping banner — click → profil mare */}
            <div style={{ padding: '0 16px', marginTop: '-38px', marginBottom: '8px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <div style={{ position: 'relative', cursor: 'pointer' }}
                onClick={() => { setProfileOpen(false); navigate('/for-me'); }}
                title="Deschide profilul"
              >
                <div style={{
                  width: '74px', height: '74px', borderRadius: '50%',
                  overflow: 'hidden', border: '4px solid #ffffff',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                  backgroundColor: accentColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {avatar
                    ? <img src={avatar} alt="av" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: '28px', fontWeight: '800', color: '#fff', userSelect: 'none' }}>{initial}</span>
                  }
                </div>
                {/* Status dot pe avatar - Deschide selectorul în stânga */}
                <div
                  onClick={e => {
                    e.stopPropagation();
                    setShowStatus(s => !s);
                    setShowAccounts(false);
                  }}
                  style={{
                    position: 'absolute', bottom: '3px', right: '3px',
                    width: '22px', height: '22px', borderRadius: '50%',
                    backgroundColor: status.dot, border: '3px solid #ffffff',
                    cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'transform 0.15s ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  title={`Status: ${status.label} (Apasă pentru a alege statusul)`}
                />
              </div>

              {/* Tag subtil profil dreapta */}
              <div
                onClick={() => { setProfileOpen(false); navigate('/for-me'); }}
                style={{
                  padding: '5px 12px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginBottom: '6px',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#475569'; }}
                title="Deschide profilul complet"
              >
                <span>Profil</span>
                <span style={{ fontSize: '10px' }}>↗</span>
              </div>
            </div>

            {/* Name + username + badges */}
            <div style={{ padding: '0 16px 12px' }}>
              <div
                onClick={() => { setProfileOpen(false); navigate('/for-me'); }}
                style={{ fontWeight: '800', fontSize: '16px', color: '#0f172a', letterSpacing: '-0.01em', cursor: 'pointer' }}
                title="Deschide profilul complet"
              >
                {displayName || username}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>@{username}</span>
                <span style={{ fontSize: '11px', color: '#cbd5e1' }}>•</span>
                <span style={{ fontSize: '10px', color: accentColor, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', backgroundColor: `${accentColor}15`, padding: '1px 6px', borderRadius: '8px' }}>
                  {role}
                </span>
              </div>

              {/* Badges line ca pe Discord */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px', alignItems: 'center' }}>
                <span title="Administrator Workspace" style={{ fontSize: '14px', cursor: 'default' }}>🛡️</span>
                <span title="Cont Verificat" style={{ fontSize: '14px', cursor: 'default' }}>✓</span>
                <span title="Developer IS" style={{ fontSize: '14px', cursor: 'default' }}>💻</span>
                <span title="Membru Activ Echipă" style={{ fontSize: '14px', cursor: 'default' }}>⭐</span>
                <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: 'auto', fontWeight: '600' }}>
                  📅 {memberSince}
                </span>
              </div>

              {/* Bio motto dacă există */}
              {bio && (
                <div style={{
                  marginTop: '8px',
                  fontSize: '11px',
                  color: '#475569',
                  fontStyle: 'italic',
                  lineHeight: 1.3,
                  backgroundColor: '#f8fafc',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #f1f5f9',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  💬 {bio}
                </div>
              )}
            </div>

            {/* Divider */}
            <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '0 16px' }} />

            {/* Menu items (Discord style cu acordion inline fără ferestre plutitoare în stânga) */}
            <div style={{ padding: '8px', borderBottomLeftRadius: '15px', borderBottomRightRadius: '15px' }}>

              {/* Edit Profile button */}
              <button
                onClick={() => { setProfileOpen(false); navigate('/for-me'); }}
                style={discordMenuItemStyle}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <span style={{ fontSize: '15px', width: '20px', textAlign: 'center' }}>✏️</span>
                <span style={{ flex: 1, fontWeight: '600' }}>Editează Profilul</span>
                <span style={{ color: '#cbd5e1', fontSize: '14px' }}>›</span>
              </button>

              {/* Status row trigger cu flyout în STÂNGA (ca pe Discord) */}
              <div
                style={{ position: 'relative' }}
                onMouseEnter={() => setShowStatus(true)}
                onMouseLeave={() => setShowStatus(false)}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowStatus(s => !s);
                    setShowAccounts(false);
                  }}
                  style={{
                    ...discordMenuItemStyle,
                    backgroundColor: showStatus ? '#f8fafc' : 'transparent',
                  }}
                >
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: status.dot, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontWeight: '600' }}>{status.label}</span>
                  <span style={{ color: showStatus ? '#5865F2' : '#cbd5e1', fontSize: '13px', fontWeight: '700' }}>‹</span>
                </button>

                {/* Sub-menu Flyout Status la STÂNGA (Stil Discord) */}
                {showStatus && (
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      top: '-10px',
                      right: '100%',
                      paddingRight: '6px', // Bridge ca mouse-ul să nu piardă hover-ul când trece în stânga
                      zIndex: 10005,
                      animation: 'flyoutIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  >
                    <div style={{
                      width: '230px',
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #cbd5e1',
                      boxShadow: '0 12px 36px rgba(0,0,0,0.18)',
                      padding: '6px',
                    }}>
                      <div style={{ padding: '6px 10px', fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Schimbă Statusul
                      </div>
                      {STATUS_LIST.map(s => {
                        const isSel = status.id === s.id;
                        return (
                          <div
                            key={s.id}
                            onClick={() => {
                              pickStatus(s);
                              setShowStatus(false);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              backgroundColor: isSel ? '#f1f5f9' : 'transparent',
                              transition: 'background 0.1s ease',
                            }}
                            onMouseEnter={e => { if (!isSel) e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                            onMouseLeave={e => { if (!isSel) e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: s.dot, flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: isSel ? '700' : '600', fontSize: '12px', color: isSel ? '#0f172a' : '#334155' }}>
                                {s.label}
                              </div>
                              <div style={{ fontSize: '10px', color: '#94a3b8' }}>{s.desc}</div>
                            </div>
                            {isSel && <span style={{ color: '#5865F2', fontWeight: '800', fontSize: '12px' }}>✓</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Switch Accounts row trigger (inline, curat) */}
              <div>
                <button
                  onClick={() => {
                    setShowAccounts(a => !a);
                    setShowStatus(false);
                  }}
                  style={{
                    ...discordMenuItemStyle,
                    backgroundColor: showAccounts ? '#f8fafc' : 'transparent',
                  }}
                >
                  <span style={{ fontSize: '14px', width: '20px', textAlign: 'center' }}>👥</span>
                  <span style={{ flex: 1, fontWeight: '600' }}>Schimbă Cont</span>
                  <span style={{ color: showAccounts ? '#5865F2' : '#94a3b8', fontSize: '11px', fontWeight: '700' }}>
                    {showAccounts ? '▴' : '▾'}
                  </span>
                </button>

                {/* Sub-menu Switch Accounts Expandat INLINE */}
                {showAccounts && (
                  <div style={{
                    backgroundColor: '#f8fafc',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    padding: '6px',
                    margin: '4px 0 6px',
                  }}>
                    <div style={{ padding: '4px 8px 6px', fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Conturi Active
                    </div>
                    {/* Cont curent */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      backgroundColor: '#ffffff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    }}>
                      <div style={{
                        width: '26px', height: '26px', borderRadius: '50%',
                        overflow: 'hidden', backgroundColor: accentColor,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: '11px', fontWeight: '700', flexShrink: 0
                      }}>
                        {avatar
                          ? <img src={avatar} alt="av" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : initial
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '700', fontSize: '12px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {username}
                        </div>
                        <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: '600' }}>
                          ● Conectat
                        </div>
                      </div>
                      <span style={{ color: '#5865F2', fontWeight: '800', fontSize: '12px' }}>✓</span>
                    </div>

                    <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '6px 0' }} />

                    <button
                      onClick={handleLogout}
                      style={{
                        ...discordMenuItemStyle,
                        fontSize: '12px',
                        padding: '6px 8px',
                        color: '#475569',
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ffffff'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <span style={{ fontSize: '13px' }}>➕</span>
                      <span style={{ flex: 1 }}>Conectează alt cont</span>
                    </button>
                  </div>
                )}
              </div>

              <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '4px 0' }} />

              {/* Nav links */}
              {[
                { icon: '📅', label: 'Calendar & Ședințe', path: '/calendar' },
                { icon: '✅', label: 'Task-uri Kanban',    path: '/tasks' },
                { icon: '⚙️', label: 'Setări Workspace',   path: '/settings' },
              ].map(item => (
                <button
                  key={item.path}
                  onClick={() => { setProfileOpen(false); navigate(item.path); }}
                  style={discordMenuItemStyle}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <span style={{ fontSize: '14px', width: '20px', textAlign: 'center' }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                </button>
              ))}

              <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '4px 0' }} />

              {/* Logout */}
              <button
                onClick={handleLogout}
                style={{
                  ...discordMenuItemStyle,
                  color: '#ef4444',
                  fontWeight: '600'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fef2f2'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <span style={{ fontSize: '14px', width: '20px', textAlign: 'center' }}>🚪</span>
                <span>Deconectare</span>
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
    </>
  );
}

// ── Shared mini styles ────────────────────────────────────────────────────────
const sectionLabelStyle = {
  padding: '8px 18px 4px',
  fontSize: '11px',
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#94a3b8',
};

const notifRowStyle = {
  padding: '12px 18px',
  borderBottom: '1px solid #f8fafc',
  transition: 'background 0.1s',
};

const notifTitleStyle = {
  fontSize: '13px',
  fontWeight: '600',
  color: '#1e293b',
};

const notifSubStyle = {
  fontSize: '12px',
  color: '#64748b',
  marginTop: '2px',
};

const acceptBtnStyle = {
  padding: '4px 14px',
  backgroundColor: '#5a3d5c',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: '600',
  transition: 'background 0.15s',
};

const discordMenuItemStyle = {
  width: '100%',
  padding: '8px 10px',
  backgroundColor: 'transparent',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  cursor: 'pointer',
  fontSize: '13px',
  color: '#334155',
  fontWeight: '500',
  textAlign: 'left',
  borderRadius: '8px',
  transition: 'all 0.1s ease',
  boxSizing: 'border-box',
};
