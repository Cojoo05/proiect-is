import { useState, useEffect, useRef } from 'react';
import { API_BASE_URL, WS_BASE_URL } from '../config';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client/dist/sockjs.min.js';

const COLORS = ['#5a3d5c', '#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#4b5563'];
const avatarColor = (name) => COLORS[(name?.charCodeAt(0) || 0) % COLORS.length];

function MessagesPage({ currentUser }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetUserId = searchParams.get('userId');
  const targetConvId = searchParams.get('convId') || searchParams.get('conversationId');

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState([]);

  // Modals
  const [showNewDirectModal, setShowNewDirectModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  // Group Form
  const [groupName, setGroupName] = useState('');
  const [selectedGroupUserIds, setSelectedGroupUserIds] = useState([]);

  // Add Member Form
  const [selectedAddUserId, setSelectedAddUserId] = useState('');

  const stompClientRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messageSubscriptionRef = useRef(null);
  const activeConversationRef = useRef(activeConversation);
  const handledParamsRef = useRef(null);

  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  const API_CHAT = `${API_BASE_URL}/api/chat`;
  const API_USERS = `${API_BASE_URL}/api/users`;

  // 1. Fetch conversations
  const fetchConversations = (selectId = null) => {
    if (!currentUser?.id) return;
    fetch(`${API_CHAT}/conversations?userId=${currentUser.id}`)
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setConversations(list);

        const currentActive = activeConversationRef.current;
        if (selectId) {
          const target = list.find(c => c.id === selectId);
          if (target) {
            setActiveConversation(target);
            activeConversationRef.current = target;
          }
        } else if (currentActive) {
          // Keep the user on their CURRENT chat! Never switch to another chat when a message arrives
          const updatedActive = list.find(c => c.id === currentActive.id);
          if (updatedActive) {
            setActiveConversation(updatedActive);
            activeConversationRef.current = updatedActive;
          }
        } else if (list.length > 0) {
          setActiveConversation(list[0]);
          activeConversationRef.current = list[0];
        }
      })
      .catch(console.error);
  };

  // 2. Fetch all users for starting chats
  const fetchUsers = () => {
    fetch(API_USERS)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAllUsers(data.filter(u => u.id !== currentUser?.id));
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchConversations();
    fetchUsers();
  }, [currentUser]);

  // Deschidere automata din parametru ?convId=... sau ?userId=...
  useEffect(() => {
    if (!currentUser?.id) return;

    const paramKey = `${targetConvId || ''}_${targetUserId || ''}`;
    if (!targetConvId && !targetUserId) return;
    if (handledParamsRef.current === paramKey) return;

    if (targetConvId && conversations.length > 0) {
      const conv = conversations.find(c => String(c.id) === String(targetConvId));
      if (conv) {
        handledParamsRef.current = paramKey;
        setActiveConversation(conv);
        activeConversationRef.current = conv;
        return;
      }
    }

    if (!targetUserId) return;
    const otherId = parseInt(targetUserId, 10);
    if (!otherId || otherId === currentUser.id) return;

    handledParamsRef.current = paramKey;
    fetch(`${API_CHAT}/direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.id,
        otherUserId: otherId
      })
    })
      .then(r => r.json())
      .then(conv => {
        if (conv?.id) {
          setActiveConversation(conv);
          activeConversationRef.current = conv;
          fetchConversations(conv.id);
        }
      })
      .catch(console.error);
  }, [currentUser?.id, targetUserId, targetConvId, conversations]);

  // 3. Setup global WebSocket for user notifications
  useEffect(() => {
    if (!currentUser?.id) return;

    let client = null;
    try {
      client = new Client({
        webSocketFactory: () => new SockJS(WS_BASE_URL),
        reconnectDelay: 5000,
        onConnect: () => {
          client.subscribe(`/topic/chat/users/${currentUser.id}/notifications`, () => {
            fetchConversations();
          });
        }
      });
      client.activate();
      stompClientRef.current = client;
    } catch (err) {
      console.warn('Chat WS setup error:', err);
    }

    return () => {
      if (client) client.deactivate();
    };
  }, [currentUser]);

  // 4. Load messages and subscribe to active conversation
  useEffect(() => {
    if (!activeConversation) {
      setMessages([]);
      return;
    }

    // Load message history
    fetch(`${API_CHAT}/conversations/${activeConversation.id}/messages?currentUserId=${currentUser.id}`)
      .then(r => r.json())
      .then(data => {
        const msgs = Array.isArray(data) ? data : [];
        setMessages(msgs);
        const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
        window.dispatchEvent(new CustomEvent('messages-read', {
          detail: {
            conversationId: activeConversation.id,
            lastMessageId: lastMsg?.id
          }
        }));
      })
      .catch(console.error);

    // Unsubscribe from previous
    if (messageSubscriptionRef.current) {
      messageSubscriptionRef.current.unsubscribe();
      messageSubscriptionRef.current = null;
    }

    if (stompClientRef.current?.connected) {
      messageSubscriptionRef.current = stompClientRef.current.subscribe(
        `/topic/chat/conversations/${activeConversation.id}`,
        (msg) => {
          try {
            const newMsg = JSON.parse(msg.body);
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          } catch (e) {
            console.error(e);
          }
        }
      );
    }

    return () => {
      if (messageSubscriptionRef.current) {
        messageSubscriptionRef.current.unsubscribe();
        messageSubscriptionRef.current = null;
      }
    };
  }, [activeConversation]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 5. Send message
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConversation) return;

    const content = inputText.trim();
    setInputText('');

    fetch(`${API_CHAT}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: activeConversation.id,
        senderId: currentUser.id,
        content
      })
    })
      .then(r => r.json())
      .then(saved => {
        setMessages(prev => {
          if (prev.some(m => m.id === saved.id)) return prev;
          return [...prev, saved];
        });
        fetchConversations(activeConversation.id);
      })
      .catch(console.error);
  };

  // 6. Start Conversation with Member
  const handleStartDirectChat = (otherUserId) => {
    fetch(`${API_CHAT}/direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.id,
        otherUserId
      })
    })
      .then(r => r.json())
      .then(conv => {
        setShowNewDirectModal(false);
        fetchConversations(conv.id);
      })
      .catch(err => alert('Eroare: ' + err.message));
  };

  // 7. Create Group Chat
  const handleCreateGroup = (e) => {
    e.preventDefault();
    if (!groupName.trim() || selectedGroupUserIds.length === 0) {
      alert('Te rog introdu numele grupului și selectează cel puțin un membru.');
      return;
    }

    fetch(`${API_CHAT}/group`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: groupName.trim(),
        creatorId: currentUser.id,
        participantIds: selectedGroupUserIds
      })
    })
      .then(r => r.json())
      .then(conv => {
        setShowNewGroupModal(false);
        setGroupName('');
        setSelectedGroupUserIds([]);
        fetchConversations(conv.id);
      })
      .catch(err => alert('Eroare la crearea grupului: ' + err.message));
  };

  // 8. Add Member to Group
  const handleAddMemberToGroup = (e) => {
    e.preventDefault();
    if (!selectedAddUserId || !activeConversation) return;

    fetch(`${API_CHAT}/conversations/${activeConversation.id}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: parseInt(selectedAddUserId) })
    })
      .then(r => r.json())
      .then(updated => {
        setShowAddMemberModal(false);
        setSelectedAddUserId('');
        setActiveConversation(updated);
        fetchConversations(updated.id);
      })
      .catch(err => alert('Eroare: ' + err.message));
  };

  // 9. Delete Conversation
  const handleDeleteConversation = (convId) => {
    if (!window.confirm('Sigur dorești să ștergi această conversație?')) return;

    fetch(`${API_CHAT}/conversations/${convId}`, { method: 'DELETE' })
      .then(r => {
        if (r.ok) {
          if (activeConversation?.id === convId) {
            setActiveConversation(null);
          }
          fetchConversations();
        }
      })
      .catch(console.error);
  };

  const toggleGroupUserSelection = (userId) => {
    setSelectedGroupUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  // Helper: Display name & avatar for a conversation
  const getConversationDetails = (conv) => {
    if (!conv) return { title: '', subtitle: '', initials: '?', isGroup: false };

    if (conv.type === 'GROUP') {
      const participantNames = (conv.participants || [])
        .map(p => (p.id === currentUser?.id ? 'Tu' : (p.username || p.email)))
        .join(', ');
      return {
        title: conv.name || 'Grup',
        subtitle: `${conv.participants?.length || 0} membri: ${participantNames}`,
        initials: '👥',
        isGroup: true,
        color: '#5a3d5c'
      };
    } else {
      const other = (conv.participants || []).find(p => p.id !== currentUser?.id);
      const name = other?.username || other?.email || 'Membru';
      return {
        title: name,
        subtitle: other?.email || 'Conversație',
        initials: name[0]?.toUpperCase() || '?',
        isGroup: false,
        color: avatarColor(name),
        otherUser: other
      };
    }
  };

  // Filter conversations by search query
  const filteredConversations = conversations.filter(c => {
    const details = getConversationDetails(c);
    return details.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.lastMessage?.content || '').toLowerCase().includes(searchQuery.toLowerCase());
  });

  const activeDetails = getConversationDetails(activeConversation);

  // Users that are not yet in the active group
  const activeGroupParticipantIds = new Set((activeConversation?.participants || []).map(p => p.id));
  const availableToAddUsers = allUsers.filter(u => !activeGroupParticipantIds.has(u.id));

  return (
    <div style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', fontFamily: 'sans-serif' }}>
      {/* Top Header */}
      <header
        style={{
          height: '60px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '22px' }}>💬</span>
          <h1 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b', fontWeight: '700' }}>Mesagerie</h1>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowNewDirectModal(true)}
            style={{
              padding: '8px 15px',
              backgroundColor: '#5a3d5c',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            + Conversație Nouă
          </button>
          <button
            onClick={() => setShowNewGroupModal(true)}
            style={{
              padding: '8px 15px',
              backgroundColor: '#f1f5f9',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            + Grup Nou
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Sidebar (Conversations List) */}
        <div
          style={{
            width: '340px',
            backgroundColor: '#ffffff',
            borderRight: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0
          }}
        >
          {/* Search Bar */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
            <input
              type="text"
              placeholder="🔍 Caută o conversație..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                backgroundColor: '#f8fafc',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
          </div>

          {/* Conversations Items */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredConversations.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>✉️</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#64748b' }}>Nu există conversații încă</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>Apasă pe „+ Conversație Nouă” pentru a începe.</div>
              </div>
            ) : (
              filteredConversations.map(conv => {
                const details = getConversationDetails(conv);
                const isActive = activeConversation?.id === conv.id;
                const lastMsg = conv.lastMessage;

                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      setActiveConversation(conv);
                      activeConversationRef.current = conv;
                    }}
                    style={{
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f8fafc',
                      backgroundColor: isActive ? '#f5eff6' : 'transparent',
                      borderLeft: isActive ? '4px solid #5a3d5c' : '4px solid transparent',
                      transition: 'background-color 0.1s'
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {/* Avatar */}
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: details.isGroup ? '12px' : '50%',
                        backgroundColor: details.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: details.isGroup ? '18px' : '16px',
                        flexShrink: 0
                      }}
                    >
                      {details.initials}
                    </div>

                    {/* Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
                        <span
                          style={{
                            fontWeight: isActive ? '700' : '600',
                            fontSize: '14px',
                            color: '#1e293b',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {details.title}
                        </span>
                        {lastMsg && (
                          <span style={{ fontSize: '11px', color: '#94a3b8', flexShrink: 0, marginLeft: '6px' }}>
                            {new Date(lastMsg.sentAt).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          fontSize: '12px',
                          color: '#64748b',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {lastMsg ? (
                          <span>
                            {lastMsg.senderId === currentUser?.id ? 'Tu: ' : (details.isGroup ? `${lastMsg.senderName}: ` : '')}
                            {lastMsg.content}
                          </span>
                        ) : (
                          <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>Fără mesaje</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Area (Chat Window) */}
        {activeConversation ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff' }}>
            {/* Chat Header */}
            <div
              style={{
                padding: '14px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#ffffff'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: activeDetails.isGroup ? '12px' : '50%',
                    backgroundColor: activeDetails.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: activeDetails.isGroup ? '18px' : '16px'
                  }}
                >
                  {activeDetails.initials}
                </div>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '16px', color: '#1e293b' }}>
                    {activeDetails.title}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', maxWidth: '600px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeDetails.subtitle}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {activeDetails.isGroup && (
                  <button
                    onClick={() => setShowAddMemberModal(true)}
                    style={{
                      padding: '7px 14px',
                      backgroundColor: '#f1f5f9',
                      color: '#334155',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}
                  >
                    + Adaugă Membru
                  </button>
                )}
                <button
                  onClick={() => handleDeleteConversation(activeConversation.id)}
                  title="Șterge conversația"
                  style={{
                    padding: '7px 12px',
                    backgroundColor: '#fee2e2',
                    color: '#ef4444',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}
                >
                  Șterge Conversația
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '24px',
                backgroundColor: '#fafaf9',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              {messages.length === 0 ? (
                <div style={{ margin: 'auto', textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ fontSize: '36px', marginBottom: '8px' }}>💬</div>
                  <div style={{ fontSize: '14px', color: '#64748b' }}>Începe conversația trimițând un mesaj.</div>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMe = msg.sender?.id === currentUser?.id;
                  const prevMsg = messages[idx - 1];
                  const showSenderHeader = !isMe && activeDetails.isGroup && (!prevMsg || prevMsg.sender?.id !== msg.sender?.id);
                  const senderName = msg.sender?.username || msg.sender?.email || 'User';

                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isMe ? 'flex-end' : 'flex-start',
                        marginTop: showSenderHeader ? '10px' : '2px'
                      }}
                    >
                      {showSenderHeader && (
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#5a3d5c', marginLeft: '4px', marginBottom: '3px' }}>
                          {senderName}
                        </span>
                      )}

                      <div
                        style={{
                          maxWidth: '65%',
                          padding: '10px 16px',
                          borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          backgroundColor: isMe ? '#5a3d5c' : '#ffffff',
                          color: isMe ? '#ffffff' : '#1e293b',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                          border: isMe ? 'none' : '1px solid #e2e8f0',
                          wordBreak: 'break-word',
                          lineHeight: '1.45',
                          fontSize: '14px'
                        }}
                      >
                        {msg.content}
                        <div
                          style={{
                            fontSize: '10px',
                            color: isMe ? '#e9d5ff' : '#94a3b8',
                            textAlign: 'right',
                            marginTop: '4px'
                          }}
                        >
                          {new Date(msg.sentAt).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form
              onSubmit={handleSendMessage}
              style={{
                padding: '16px 24px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                backgroundColor: '#ffffff'
              }}
            >
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Scrie un mesaj..."
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '24px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  outline: 'none',
                  backgroundColor: '#f8fafc'
                }}
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                style={{
                  padding: '12px 22px',
                  backgroundColor: '#5a3d5c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '24px',
                  cursor: inputText.trim() ? 'pointer' : 'default',
                  fontWeight: 'bold',
                  opacity: inputText.trim() ? 1 : 0.5,
                  fontSize: '14px'
                }}
              >
                Trimite ➤
              </button>
            </form>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', flexDirection: 'column' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>💬</div>
            <h3 style={{ margin: '0 0 6px 0', color: '#475569' }}>Conversații</h3>
            <p style={{ margin: 0, fontSize: '14px' }}>Alege o conversație din stânga sau începe una nouă.</p>
          </div>
        )}
      </div>

      {/* --- MODAL 1: CONVERSATIE NOUA --- */}
      {showNewDirectModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '100%', maxWidth: '440px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '6px', color: '#1e293b' }}>💬 Conversație Nouă</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
              Selectează un membru pentru a începe o conversație:
            </p>

            <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px', marginBottom: '20px' }}>
              {allUsers.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                  Nu există alți utilizatori înregistrați.
                </div>
              ) : (
                allUsers.map(u => (
                  <div
                    key={u.id}
                    onClick={() => handleStartDirectChat(u.id)}
                    style={{
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: avatarColor(u.username),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '14px'
                      }}
                    >
                      {u.username ? u.username[0].toUpperCase() : '?'}
                    </div>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '14px', color: '#1e293b' }}>{u.username}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{u.email}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowNewDirectModal(false)}
                style={{ padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}
              >
                Închide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: GRUP NOU --- */}
      {showNewGroupModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '100%', maxWidth: '480px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '6px', color: '#1e293b' }}>👥 Grup Nou</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
              Alege numele grupului și selectează membrii:
            </p>

            <form onSubmit={handleCreateGroup}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px', color: '#334155' }}>
                  Nume Grup *
                </label>
                <input
                  required
                  placeholder="ex: Echipa Frontend, Management, Proiect Licență"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#334155' }}>
                  Selectează Membrii ({selectedGroupUserIds.length} selectați) *
                </label>
                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px' }}>
                  {allUsers.map(u => (
                    <label
                      key={u.id}
                      style={{
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        cursor: 'pointer',
                        borderRadius: '6px'
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <input
                        type="checkbox"
                        checked={selectedGroupUserIds.includes(u.id)}
                        onChange={() => toggleGroupUserSelection(u.id)}
                      />
                      <span style={{ fontWeight: '600', fontSize: '13px', color: '#1e293b' }}>{u.username}</span>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>({u.email})</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowNewGroupModal(false)}
                  style={{ padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 20px', backgroundColor: '#5a3d5c', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Creează Grupul
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 3: ADD MEMBER TO EXISTING GROUP --- */}
      {showAddMemberModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '100%', maxWidth: '420px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '6px', color: '#1e293b' }}>➕ Adaugă Membru în Grup</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
              Adaugă un nou participant în grupul <strong>{activeDetails.title}</strong>:
            </p>

            <form onSubmit={handleAddMemberToGroup}>
              <select
                required
                value={selectedAddUserId}
                onChange={e => setSelectedAddUserId(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', marginBottom: '20px' }}
              >
                <option value="">Alege membru...</option>
                {availableToAddUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.username} ({u.email})
                  </option>
                ))}
              </select>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  style={{ padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  disabled={!selectedAddUserId}
                  style={{ padding: '8px 18px', backgroundColor: '#5a3d5c', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Adaugă în Grup
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MessagesPage;
