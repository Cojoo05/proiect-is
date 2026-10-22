import { useState, useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client/dist/sockjs.min.js';

const COLORS = ['#5a3d5c', '#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed'];
const avatarColor = (name) => COLORS[(name?.charCodeAt(0) || 0) % COLORS.length];

function FeedTab({ projectId, currentUser, isOwner, onSwitchTab, permissions = {} }) {
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const stompClientRef = useRef(null);
  const messagesEndRef = useRef(null);
  const subscriptionRef = useRef(null);

  const canCreateChannels = isOwner || permissions.canCreateChannels === true;
  const canSendMessages = permissions.canSendMessages !== false;

  const API = `http://localhost:8080/api/projects/${projectId}`;

  // Load channels on mount
  useEffect(() => {
    fetch(`${API}/feed/channels`)
      .then(r => r.json())
      .then(data => {
        let chans = Array.isArray(data) ? data : [];
        if (!isOwner && permissions.allowedChannels && permissions.allowedChannels !== 'ALL') {
          const allowedIds = permissions.allowedChannels.split(',').map(s => parseInt(s.trim()));
          chans = chans.filter(c => allowedIds.includes(c.id));
        }
        setChannels(chans);
        if (chans.length > 0) setActiveChannel(chans[0]);
      })
      .catch(console.error);
  }, [projectId, permissions.allowedChannels]);

  // Setup WebSocket
  useEffect(() => {
    let client = null;
    try {
      client = new Client({
        webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
        reconnectDelay: 5000,
        onConnect: () => {
          // Subscribe to new channels
          client.subscribe(`/topic/projects/${projectId}/channels`, (msg) => {
            try {
              const newChan = JSON.parse(msg.body);
              setChannels(prev => {
                if (prev.find(c => c.id === newChan.id)) return prev;
                return [...prev, newChan];
              });
            } catch (err) {
              console.error(err);
            }
          });
        }
      });
      client.activate();
      stompClientRef.current = client;
    } catch (e) {
      console.warn('WebSocket init warning:', e);
    }

    return () => {
      if (client) client.deactivate();
    };
  }, [projectId]);

  // Subscribe to active channel messages
  useEffect(() => {
    if (!activeChannel) return;

    // Fetch history
    fetch(`${API}/feed?channelId=${activeChannel.id}`)
      .then(r => r.json())
      .then(data => setMessages(Array.isArray(data) ? data : []))
      .catch(console.error);

    const subscribeToChannel = () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }

      if (stompClientRef.current?.connected) {
        subscriptionRef.current = stompClientRef.current.subscribe(
          `/topic/projects/${projectId}/feed/${activeChannel.id}`,
          (msg) => {
            try {
              const newMsg = JSON.parse(msg.body);
              setMessages(prev => {
                if (prev.some(m => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });
            } catch (err) {
              console.error(err);
            }
          }
        );
      }
    };

    subscribeToChannel();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [activeChannel]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!text.trim() || !activeChannel) return;
    const content = text.trim();
    setText('');

    fetch(`${API}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: activeChannel.id,
        senderId: currentUser.id,
        content: content,
        type: 'TEXT'
      })
    })
      .then(r => r.json())
      .then(saved => {
        setMessages(prev => {
          if (prev.some(m => m.id === saved.id)) return prev;
          return [...prev, saved];
        });
      })
      .catch(console.error);
  };

  const addChannel = (e) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    fetch(`${API}/feed/channels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newChannelName.trim().toLowerCase().replace(/\s+/g, '-') })
    })
      .then(r => r.json())
      .then(ch => {
        setShowAddChannel(false);
        setNewChannelName('');
        setChannels(prev => {
          if (prev.some(c => c.id === ch.id)) return prev;
          return [...prev, ch];
        });
        setActiveChannel(ch);
      })
      .catch(console.error);
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' });
  };

  return (
    <div style={{ display: 'flex', height: '620px', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden', backgroundColor: 'white' }}>
      {/* Channel Sidebar */}
      <div style={{ width: '210px', backgroundColor: '#1e293b', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '16px 14px 10px', fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Canale de discuții
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {channels.map(ch => (
            <div
              key={ch.id}
              onClick={() => setActiveChannel(ch)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                borderRadius: '6px',
                margin: '2px 8px',
                color: activeChannel?.id === ch.id ? 'white' : '#94a3b8',
                backgroundColor: activeChannel?.id === ch.id ? 'rgba(255,255,255,0.12)' : 'transparent',
                fontSize: '14px',
                fontWeight: activeChannel?.id === ch.id ? '600' : '400',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span style={{ color: activeChannel?.id === ch.id ? '#c084fc' : '#64748b' }}>#</span>
              <span>{ch.name}</span>
            </div>
          ))}
        </div>
        {canCreateChannels && (
          <div style={{ padding: '10px' }}>
            {showAddChannel ? (
              <form onSubmit={addChannel} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <input
                  autoFocus
                  value={newChannelName}
                  onChange={e => setNewChannelName(e.target.value)}
                  placeholder="nume-canal"
                  style={{ padding: '6px 8px', fontSize: '13px', borderRadius: '4px', border: 'none', outline: 'none' }}
                />
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button type="submit" style={{ flex: 1, padding: '5px', fontSize: '11px', backgroundColor: '#5a3d5c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Adaugă</button>
                  <button type="button" onClick={() => setShowAddChannel(false)} style={{ flex: 1, padding: '5px', fontSize: '11px', backgroundColor: '#374151', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Anulează</button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowAddChannel(true)}
                style={{ width: '100%', padding: '8px 10px', fontSize: '13px', backgroundColor: 'rgba(255,255,255,0.08)', color: '#cbd5e1', border: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>+</span> Canal nou
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'white' }}>
        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#5a3d5c', fontSize: '18px', fontWeight: 'bold' }}>#</span>
          <span style={{ fontWeight: '700', color: '#1e293b', fontSize: '15px' }}>{activeChannel?.name || 'Selectează un canal'}</span>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {messages.map((msg, i) => {
            const prevMsg = messages[i - 1];
            const showHeader = !prevMsg || prevMsg.sender?.id !== msg.sender?.id ||
              new Date(msg.sentAt) - new Date(prevMsg.sentAt) > 5 * 60 * 1000;
            const name = msg.sender?.username || msg.sender?.email || 'User';

            if (msg.type === 'POLL') {
              return (
                <div key={msg.id} style={{ display: 'flex', gap: '10px', marginTop: showHeader ? '14px' : '4px', alignItems: 'flex-start' }}>
                  {showHeader ? (
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: avatarColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '14px', flexShrink: 0 }}>
                      {name[0]?.toUpperCase()}
                    </div>
                  ) : (
                    <div style={{ width: '36px', flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1 }}>
                    {showHeader && (
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '700', fontSize: '14px', color: '#1e293b' }}>{name}</span>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>{formatDate(msg.sentAt)} {formatTime(msg.sentAt)}</span>
                      </div>
                    )}
                    <div
                      onClick={() => onSwitchTab && onSwitchTab('polls')}
                      style={{
                        backgroundColor: '#f5f3ff',
                        border: '1px solid #ddd6fe',
                        borderRadius: '10px',
                        padding: '14px 18px',
                        display: 'inline-block',
                        maxWidth: '460px',
                        cursor: onSwitchTab ? 'pointer' : 'default',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        transition: 'transform 0.1s, box-shadow 0.1s'
                      }}
                      onMouseEnter={(e) => {
                        if (onSwitchTab) {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 4px 10px rgba(90, 61, 92, 0.12)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (onSwitchTab) {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '18px' }}>📊</span>
                        <span style={{ fontSize: '15px', fontWeight: '700', color: '#4c1d95' }}>
                          {msg.content.replace('📊 ', '')}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginTop: '10px' }}>
                        <span style={{ fontSize: '12px', color: '#7c3aed', fontWeight: '500' }}>
                          Sondaj activ al proiectului
                        </span>
                        {onSwitchTab && (
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'white', backgroundColor: '#5a3d5c', padding: '4px 10px', borderRadius: '6px' }}>
                            Votează în Polls →
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} style={{ display: 'flex', gap: '10px', marginTop: showHeader ? '12px' : '2px', alignItems: 'flex-start' }}>
                {showHeader ? (
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: avatarColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '14px', flexShrink: 0 }}>
                    {name[0]?.toUpperCase()}
                  </div>
                ) : (
                  <div style={{ width: '36px', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1 }}>
                  {showHeader && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '2px' }}>
                      <span style={{ fontWeight: '700', fontSize: '14px', color: '#1e293b' }}>{name}</span>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>{formatDate(msg.sentAt)} {formatTime(msg.sentAt)}</span>
                    </div>
                  )}
                  <div style={{ fontSize: '14px', color: '#334155', lineHeight: '1.5', wordBreak: 'break-word' }}>
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })}
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>💬</div>
              <div style={{ fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>Niciun mesaj încă în #{activeChannel?.name || 'acest canal'}</div>
              <div style={{ fontSize: '13px' }}>Fii primul care trimite un mesaj sau publică un update!</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={sendMessage} style={{ padding: '12px 16px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: '#ffffff' }}>
          <input
            disabled={!canSendMessages}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={canSendMessages ? `Mesaj în #${activeChannel?.name || '...'}` : '⚠️ Nu ai permisiunea de a trimite mesaje pe acest canal'}
            style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', backgroundColor: canSendMessages ? '#f8fafc' : '#f1f5f9', cursor: canSendMessages ? 'text' : 'not-allowed' }}
          />
          <button
            type="submit"
            disabled={!text.trim() || !canSendMessages}
            style={{
              padding: '10px 18px',
              backgroundColor: '#5a3d5c',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: (text.trim() && canSendMessages) ? 'pointer' : 'default',
              fontWeight: 'bold',
              opacity: (text.trim() && canSendMessages) ? 1 : 0.4,
              fontSize: '14px'
            }}
          >
            Trimite ➤
          </button>
        </form>
      </div>
    </div>
  );
}

export default FeedTab;
