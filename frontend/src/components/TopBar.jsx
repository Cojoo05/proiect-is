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
  const [unreadMessages, setUnreadMessages] = useState([]);
  const dropdownRef = useRef(null);
  const profileRef = useRef(null);
  const stompClientRef = useRef(null);

  const totalCount = invitations.length + unreadMessages.length;

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

  // ── Fetch conversations with unread messages ───────────────────────────────
  const fetchUnreadMessages = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/conversations?userId=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        const unread = (Array.isArray(data) ? data : []).filter(conv => {
          const last = conv.lastMessage || conv.lastMsg;
          if (!last) return false;
          const senderId = last.senderId ?? last.sender?.id;
          return senderId && Number(senderId) !== Number(currentUser.id);
        });
        setUnreadMessages(unread);
      }
    } catch (_) {}
  }, [currentUser?.id]);

  // ── Polling ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.id) return;
    fetchInvitations();
    fetchUnreadMessages();
    const timer = setInterval(() => {
      fetchInvitations();
      fetchUnreadMessages();
    }, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchInvitations, fetchUnreadMessages, currentUser?.id]);

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
            fetchUnreadMessages();
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
  }, [currentUser?.id, fetchUnreadMessages]);

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
      await fetch(`${API_BASE_URL}/api/projects/invitations/${invitationId}/accept`, { method: 'POST' });
      setInvitations(prev => prev.filter(i => i.id !== invitationId));
    } catch (_) {}
  };

  const handleDecline = async (invitationId) => {
    try {
      await fetch(`${API_BASE_URL}/api/projects/invitations/${invitationId}/decline`, { method: 'POST' });
      setInvitations(prev => prev.filter(i => i.id !== invitationId));
    } catch (_) {}
  };

  // ── Navigate to conversation ──────────────────────────────────────────────
  const handleOpenConversation = (conv) => {
    const otherId =
      conv.participants?.find(p => Number(p.id) !== Number(currentUser.id))?.id
      ?? conv.otherUserId;
    setOpen(false);
    if (otherId) {
      navigate(`/messages?userId=${otherId}`);
    } else {
      navigate('/messages');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: 'fixed',
        top: '16px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
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
                width: '17px',
                height: '17px',
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
              width: '340px',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              fontFamily: 'sans-serif',
            }}
          >
            {/* header */}
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
              {totalCount > 0 && (
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
              )}
            </div>

            {/* body */}
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>

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

              {/* Unread messages */}
              {unreadMessages.length > 0 && (
                <div>
                  <div style={sectionLabelStyle}>Mesaje noi</div>
                  {unreadMessages.map(conv => {
                    const last = conv.lastMessage || conv.lastMsg;
                    const senderName =
                      last?.senderUsername ?? last?.sender?.username ?? 'Cineva';
                    const preview = last?.content ?? last?.text ?? '';
                    return (
                      <div
                        key={conv.id}
                        onClick={() => handleOpenConversation(conv)}
                        style={{ ...notifRowStyle, cursor: 'pointer', display: 'flex', gap: '10px', alignItems: 'flex-start' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <span style={{ fontSize: '20px', flexShrink: 0 }}>💬</span>
                        <div style={{ overflow: 'hidden' }}>
                          <div style={notifTitleStyle}>{senderName}</div>
                          <div
                            style={{
                              ...notifSubStyle,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {preview || '(mesaj nou)'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Empty */}
              {totalCount === 0 && (
                <div style={{ padding: '36px 18px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                  <div style={{ fontSize: '30px', marginBottom: '10px' }}>🎉</div>
                  Nicio notificare nouă.
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
