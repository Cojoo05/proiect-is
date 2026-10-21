import { useState, useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const COLORS = ['#5a3d5c', '#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed'];
const avatarColor = (name) => COLORS[(name?.charCodeAt(0) || 0) % COLORS.length];

function FeedTab({ projectId, currentUser, isOwner }) {
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const stompClientRef = useRef(null);
  const messagesEndRef = useRef(null);
  const subscriptionRef = useRef(null);

  const API = `http://localhost:8080/api/projects/${projectId}`;

  // Load channels on mount
  useEffect(() => {
    fetch(`${API}/feed/channels`)
      .then(r => r.json())
      .then(data => {
        const chans = Array.isArray(data) ? data : [];
        setChannels(chans);
        if (chans.length > 0) setActiveChannel(chans[0]);
      })
      .catch(console.error);
  }, [projectId]);

  // Setup WebSocket
  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        // Subscribe to new channels
        client.subscribe(`/topic/projects/${projectId}/channels`, (msg) => {
          const newChan = JSON.parse(msg.body);
          setChannels(prev => {
            if (prev.find(c => c.id === newChan.id)) return prev;
            return [...prev, newChan];
          });
        });
      }
    });
    client.activate();
    stompClientRef.current = client;
    return () => client.deactivate();
  }, [projectId]);

  // Subscribe to active channel messages
  useEffect(() => {
    if (!activeChannel || !stompClientRef.current) return;

    // Fetch history
    fetch(`${API}/feed?channelId=${activeChannel.id}`)
      .then(r => r.json())
      .then(data => setMessages(Array.isArray(data) ? data : []))
      .catch(console.error);

    const subscribeToChannel = () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
      if (stompClientRef.current?.connected) {
        subscriptionRef.current = stompClientRef.current.subscribe(
          `/topic/projects/${projectId}/feed/${activeChannel.id}`,
          (msg) => {
            const newMsg = JSON.parse(msg.body);
            setMessages(prev => [...prev, newMsg]);
          }
        );
      } else {
        // Wait for connection
        const originalOnConnect = stompClientRef.current?.onConnect;
        if (stompClientRef.current) {
          stompClientRef.current.onConnect = (frame) => {
            if (originalOnConnect) originalOnConnect(frame);
            subscriptionRef.current = stompClientRef.current.subscribe(
              `/topic/projects/${projectId}/feed/${activeChannel.id}`,
              (msg) => {
                const newMsg = JSON.parse(msg.body);
                setMessages(prev => [...prev, newMsg]);
              }
            );
          };
        }
      }
    };
    subscribeToChannel();

    return () => {
      if (subscriptionRef.current) subscriptionRef.current.unsubscribe();
    };
  }, [activeChannel]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!text.trim() || !activeChannel) return;
    fetch(`${API}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: activeChannel.id,
        senderId: currentUser.id,
        content: text.trim(),
        type: 'TEXT'
      })
    }).catch(console.error);
    setText('');
  };

  const addChannel = (e) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    fetch(`${API}/feed/channels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newChannelName.trim().toLowerCase().replace(/\s+/g, '-') })
    }).then(r => r.json())
      .then(ch => {
        setShowAddChannel(false);
        setNewChannelName('');
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
    <div style={{ display: 'flex', height: '600px', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      {/* Channel Sidebar */}
      <div style={{ width: '200px', backgroundColor: '#1e293b', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '14px 12px 8px', fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Canale
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {channels.map(ch => (
            <div
              key={ch.id}
              onClick={() => setActiveChannel(ch)}
              style={{
                padding: '6px 12px',
                cursor: 'pointer',
                borderRadius: '4px',
                margin: '1px 6px',
                color: activeChannel?.id === ch.id ? 'white' : '#94a3b8',
                backgroundColor: activeChannel?.id === ch.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                fontSize: '14px',
                fontWeight: activeChannel?.id === ch.id ? '600' : '400'
              }}
            >
              # {ch.name}
            </div>
          ))}
        </div>
        {isOwner && (
          <div style={{ padding: '8px' }}>
            {showAddChannel ? (
              <form onSubmit={addChannel} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <input
                  autoFocus
                  value={newChannelName}
                  onChange={e => setNewChannelName(e.target.value)}
                  placeholder="nume-canal"
                  style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: 'none', outline: 'none' }}
                />
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button type="submit" style={{ flex: 1, padding: '4px', fontSize: '11px', backgroundColor: '#5a3d5c', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>OK</button>
                  <button type="button" onClick={() => setShowAddChannel(false)} style={{ flex: 1, padding: '4px', fontSize: '11px', backgroundColor: '#374151', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>X</button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowAddChannel(true)}
                style={{ width: '100%', padding: '6px', fontSize: '12px', backgroundColor: 'rgba(255,255,255,0.07)', color: '#94a3b8', border: 'none', borderRadius: '4px', cursor: 'pointer', textAlign: 'left' }}
              >
                + Canal nou
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'white' }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#64748b', fontSize: '16px' }}>#</span>
          <span style={{ fontWeight: '700', color: '#1e293b' }}>{activeChannel?.name || 'Selectează un canal'}</span>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {messages.map((msg, i) => {
            const prevMsg = messages[i - 1];
            const showHeader = !prevMsg || prevMsg.sender?.id !== msg.sender?.id ||
              new Date(msg.sentAt) - new Date(prevMsg.sentAt) > 5 * 60 * 1000;
            const name = msg.sender?.username || msg.sender?.email || '?';

            if (msg.type === 'POLL') {
              return (
                <div key={msg.id} style={{ display: 'flex', gap: '10px', marginTop: showHeader ? '12px' : '2px', alignItems: 'flex-start' }}>
                  {showHeader && (
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: avatarColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '14px', flexShrink: 0 }}>
                      {name[0]?.toUpperCase()}
                    </div>
                  )}
                  {!showHeader && <div style={{ width: '36px', flexShrink: 0 }} />}
                  <div style={{ flex: 1 }}>
                    {showHeader && (
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '2px' }}>
                        <span style={{ fontWeight: '700', fontSize: '14px', color: '#1e293b' }}>{name}</span>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>{formatDate(msg.sentAt)} {formatTime(msg.sentAt)}</span>
                      </div>
                    )}
                    <div style={{ backgroundColor: '#f8faff', border: '1px solid #c7d2fe', borderRadius: '8px', padding: '10px 14px', display: 'inline-block', maxWidth: '400px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#4338ca' }}>📊 {msg.content.replace('📊 ', '')}</div>
                      <div style={{ fontSize: '11px', color: '#6366f1', marginTop: '4px' }}>Poll · click pe tab Polls pentru detalii</div>
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
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>👋</div>
              <div>Începe conversația în #{activeChannel?.name}</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={sendMessage} style={{ padding: '12px 16px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e); } }}
            placeholder={`Mesaj în #${activeChannel?.name || '...'}`}
            style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', backgroundColor: '#f8fafc' }}
          />
          <button
            type="submit"
            disabled={!text.trim()}
            style={{ padding: '10px 16px', backgroundColor: '#5a3d5c', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', opacity: text.trim() ? 1 : 0.5 }}
          >
            ➤
          </button>
        </form>
      </div>
    </div>
  );
}

export default FeedTab;
