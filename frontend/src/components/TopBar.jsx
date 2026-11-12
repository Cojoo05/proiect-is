import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, WS_BASE_URL } from '../config.js';
import SockJS from 'sockjs-client/dist/sockjs.min.js';
import { Client } from '@stomp/stompjs';

const POLL_INTERVAL = 15_000;

export default function TopBar({ currentUser, setCurrentUser }) {
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [invitations, setInvitations] = useState([]);
  const [recentConversations, setRecentConversations] = useState([]);
  const [calendarNotifs, setCalendarNotifs] = useState([]);

  // Map of convId -> lastMsgId that the user has marked as read
  const [readMsgIds, setReadMsgIds] = useState(() => {
    try {
      const stored = localStorage.getItem(`read_conv_msgs_${currentUser?.id}`);
      return stored ? JSON.parse(stored) : {};
    } catch (_) {
      return {};
    }
  });

  const dropdownRef = useRef(null);
  const profileRef = useRef(null);
  const stompClientRef = useRef(null);

  const markConvAsRead = useCallback((convId, lastMsgId) => {
    if (!currentUser?.id || !convId) return;
    setReadMsgIds(prev => {
      const next = { ...prev, [convId]: lastMsgId || true };
      try {
        localStorage.setItem(`read_conv_msgs_${currentUser.id}`, JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  }, [currentUser?.id]);

  // ── Helper to check if a conversation is unread ───────────────────────────
  const isConvUnread = useCallback((conv) => {
    const last = conv?.lastMessage || conv?.lastMsg;
    if (!last) return false;

    const senderId = last.senderId ?? last.sender?.id;
    if (senderId && Number(senderId) === Number(currentUser?.id)) {
      return false;
    }

    if (readMsgIds[conv.id] && (readMsgIds[conv.id] === last.id || readMsgIds[conv.id] === true)) {
      return false;
    }

    if (conv.unreadCount !== undefined && conv.unreadCount !== null) {
      return Number(conv.unreadCount) > 0;
    }
    if (last.isRead !== undefined) {
      return !last.isRead;
    }
    return true;
  }, [currentUser?.id, readMsgIds]);

  const unreadMsgCount = recentConversations.filter(isConvUnread).length;
  const totalCount = invitations.length + unreadMsgCount + calendarNotifs.length;

  // ── Fetch calendar notifications ─────────────────────────────────────────
  const fetchCalendarNotifs = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications/user/${currentUser.id}/unread`);
      if (res.ok) {
        const data = await res.json();
        setCalendarNotifs(Array.isArray(data) ? data : []);
      }
    } catch (_) {}
  }, [currentUser?.id]);

  const handleMarkNotifRead = async (notifId) => {
    try {
      await fetch(`${API_BASE_URL}/api/notifications/${notifId}/read`, { method: 'PUT' });
      setCalendarNotifs(prev => prev.filter(n => n.id !== notifId));
    } catch (_) {}
  };

  // ── Fetch pending invitations ──────────────────────────────────────────────
  const fetchInvitations = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/projects/invitations/user/${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setInvitations(Array.isArray(data) ? data : []);
      }
    } catch (_) {}
  }, [currentUser?.id]);

  // ── Fetch recent conversations with messages ───────────────────────────────
  const fetchRecentMessages = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/conversations?userId=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        const convsWithMessages = (Array.isArray(data) ? data : [])
          .filter(conv => Boolean(conv.lastMessage || conv.lastMsg))
          .sort((a, b) => {
            const timeA = new Date(a.lastMessage?.sentAt || 0).getTime();
            const timeB = new Date(b.lastMessage?.sentAt || 0).getTime();
            return timeB - timeA;
          });
        setRecentConversations(convsWithMessages);
      }
    } catch (_) {}
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
    }, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchInvitations, fetchRecentMessages, currentUser?.id]);

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
        },
        onStompError: () => {},
      });
      client.activate();
      stompClientRef.current = client;
    } catch (_) {}
    return () => {
      try { stompClientRef.current?.deactivate(); } catch (_) {}
    };
  }, [currentUser?.id, fetchRecentMessages]);

  // ── Close dropdowns on outside click ─────────────────────────────────────
  useEffect(() => {
    const handleOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

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
      {/* ── Left Branding Badge ────────────────────────────────────────── */}
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
        <div style={{ display: 'flex', flexDirection: 'column' }}>
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
          <span style={{ fontSize: '12px', color: '#475569', lineHeight: '1.2' }}>
            Conectat ca <strong style={{ color: '#1e293b' }}>{currentUser?.username || currentUser?.email || 'User'}</strong>
          </span>
        </div>
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

                            {/* Calendar Notifications */}
              {calendarNotifs.length > 0 && (
                <div>
                  <div style={sectionLabelStyle}>Invitații Ședințe Google Meet</div>
                  {calendarNotifs.map(n => (
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

      {/* ── Account icon + profile dropdown ─────────────────────────── */}
      <div ref={profileRef} style={{ position: 'relative' }}>
        <div
          onClick={() => setProfileOpen(o => !o)}
          title={currentUser?.username || currentUser?.email || 'Cont'}
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            border: profileOpen ? '2px solid #5a3d5c' : '1px solid #d8b4e2',
            backgroundColor: '#5a3d5c',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '15px',
            fontWeight: '700',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            cursor: 'pointer',
            userSelect: 'none',
            flexShrink: 0,
            transition: 'border 0.15s, box-shadow 0.15s',
          }}
        >
          {(currentUser?.username || currentUser?.email || 'U')[0].toUpperCase()}
        </div>

        {/* Profile dropdown */}
        {profileOpen && (
          <div
            style={{
              position: 'absolute',
              top: '46px',
              right: 0,
              width: '200px',
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              fontFamily: 'sans-serif',
              zIndex: 10000,
            }}
          >
            {/* User info header */}
            <div
              style={{
                padding: '14px 16px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#5a3d5c',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '14px',
                  flexShrink: 0,
                }}
              >
                {(currentUser?.username || currentUser?.email || 'U')[0].toUpperCase()}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#1e293b',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {currentUser?.username || 'User'}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: '#94a3b8',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {currentUser?.email || ''}
                </div>
              </div>
            </div>

            {/* Menu items */}
            <div style={{ padding: '6px 0' }}>
              <button
                onClick={() => {
                  setProfileOpen(false);
                  navigate('/calendar');
                }}
                style={{
                  width: '100%',
                  padding: '9px 16px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: '#1e293b',
                  fontWeight: '600',
                  textAlign: 'left',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <span style={{ fontSize: '15px' }}>📅</span>
                Calendar
              </button>
              <button
                onClick={() => {
                  setProfileOpen(false);
                  navigate('/tasks');
                }}
                style={{
                  width: '100%',
                  padding: '9px 16px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: '#1e293b',
                  fontWeight: '500',
                  textAlign: 'left',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <span style={{ fontSize: '15px' }}>✅</span>
                Tasks
              </button>
              <button
                onClick={handleLogout}
                style={{
                  width: '100%',
                  padding: '9px 16px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: '#ef4444',
                  fontWeight: '500',
                  textAlign: 'left',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#fef2f2')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <span style={{ fontSize: '15px' }}>🚪</span>
                Logout
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

const declineBtnStyle = {
  padding: '4px 14px',
  backgroundColor: '#f1f5f9',
  color: '#64748b',
  border: '1px solid #e2e8f0',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '12px',
  transition: 'background 0.15s',
};
