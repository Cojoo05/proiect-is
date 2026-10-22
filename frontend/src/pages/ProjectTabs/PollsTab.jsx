import { useState, useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client/dist/sockjs.min.js';

function PollsTab({ projectId, currentUser, permissions = {} }) {
  const [polls, setPolls] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const stompClientRef = useRef(null);

  const canCreate = permissions.canCreatePolls !== false;
  const canVote = permissions.canVotePolls !== false;

  const API = `http://localhost:8080/api/projects/${projectId}`;

  const fetchPolls = () => {
    fetch(`${API}/polls`)
      .then(r => r.json())
      .then(data => setPolls(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  useEffect(() => {
    fetchPolls();
  }, [projectId]);

  useEffect(() => {
    let client = null;
    try {
      client = new Client({
        webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
        reconnectDelay: 5000,
        onConnect: () => {
          client.subscribe(`/topic/projects/${projectId}/polls`, (msg) => {
            try {
              const updatedPoll = JSON.parse(msg.body);
              setPolls(prev => {
                const idx = prev.findIndex(p => p.id === updatedPoll.id);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = updatedPoll;
                  return next;
                }
                return [updatedPoll, ...prev];
              });
            } catch (err) {
              console.error('Error parsing poll WS msg:', err);
            }
          });
        }
      });
      client.activate();
      stompClientRef.current = client;
    } catch (e) {
      console.warn('WebSocket could not be initialized:', e);
    }

    return () => {
      if (client) client.deactivate();
    };
  }, [projectId]);

  const handleCreate = (e) => {
    e.preventDefault();
    const validOptions = options.map(o => o.trim()).filter(Boolean);
    if (!question.trim() || validOptions.length < 2) {
      alert('Te rog introdu întrebarea și minim 2 opțiuni.');
      return;
    }

    setIsSubmitting(true);
    fetch(`${API}/polls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: question.trim(),
        options: validOptions,
        createdById: currentUser.id
      })
    })
      .then(r => {
        if (!r.ok) throw new Error('Eroare la crearea poll-ului');
        return r.json();
      })
      .then(poll => {
        setPolls(prev => {
          if (prev.some(p => p.id === poll.id)) return prev;
          return [poll, ...prev];
        });
        setShowCreate(false);
        setQuestion('');
        setOptions(['', '']);
      })
      .catch(err => alert(err.message))
      .finally(() => setIsSubmitting(false));
  };

  const handleVote = (pollId, optionId) => {
    if (!canVote) {
      alert('Nu ai permisiunea de a vota în sondajele acestui proiect.');
      return;
    }
    fetch(`${API}/polls/${pollId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionId, voterId: currentUser.id })
    })
      .then(r => {
        if (!r.ok) throw new Error('Eroare la înregistrarea votului');
        return r.json();
      })
      .then(updatedPoll => {
        setPolls(prev => prev.map(p => p.id === updatedPoll.id ? updatedPoll : p));
      })
      .catch(err => console.error(err));
  };

  const totalVotes = (poll) => poll.options?.reduce((s, o) => s + (o.votes?.length || 0), 0) || 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#1e293b' }}>Sondaje de opinie</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
            Ia decizii rapide împreună cu echipa proiectului
          </p>
        </div>
        {canCreate ? (
          <button
            onClick={() => setShowCreate(!showCreate)}
            style={{
              padding: '9px 18px',
              backgroundColor: showCreate ? '#64748b' : '#5a3d5c',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'background-color 0.15s'
            }}
          >
            {showCreate ? '✕ Anulează' : '+ Poll Nou'}
          </button>
        ) : (
          <span style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>
            ℹ️ Nu ai permisiunea de a crea sondaje noi
          </span>
        )}
      </div>

      {/* Create Poll Form */}
      {showCreate && (
        <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '22px', marginBottom: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#1e293b', fontSize: '1.1rem' }}>📊 Creează un Sondaj Nou</h3>
          <form onSubmit={handleCreate}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px', color: '#334155' }}>
                Întrebare / Subiect *
              </label>
              <input
                required
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder="ex: Când organizăm următorul sprint review?"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '14px' }}
              />
            </div>
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#334155' }}>
                Opțiuni de răspuns (minim 2, maxim 6) *
              </label>
              {options.map((opt, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    required
                    value={opt}
                    onChange={e => {
                      const next = [...options];
                      next[i] = e.target.value;
                      setOptions(next);
                    }}
                    placeholder={`Opțiunea ${i + 1}`}
                    style={{ flex: 1, padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
                      style={{ padding: '0 12px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                      title="Șterge opțiunea"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {options.length < 6 && (
                <button
                  type="button"
                  onClick={() => setOptions([...options, ''])}
                  style={{ marginTop: '6px', padding: '6px 14px', backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#475569', fontWeight: '500' }}
                >
                  + Adaugă o altă opțiune
                </button>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                style={{ padding: '9px 16px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              >
                Renunță
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{ padding: '9px 20px', backgroundColor: '#5a3d5c', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', opacity: isSubmitting ? 0.7 : 1 }}
              >
                {isSubmitting ? 'Se publică...' : 'Publică Sondajul'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Polls List */}
      {polls.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8', backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📊</div>
          <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>Niciun poll activ</div>
          <div style={{ fontSize: '14px', marginBottom: '20px' }}>Creează primul sondaj pentru a consulta echipa.</div>
          <button
            onClick={() => setShowCreate(true)}
            style={{ padding: '9px 18px', backgroundColor: '#5a3d5c', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Creează un Poll
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {polls.map(poll => {
            const total = totalVotes(poll);
            const userVoteOption = poll.options?.find(opt =>
              opt.votes?.some(v => v.voter?.id === currentUser?.id)
            );
            const hasVoted = Boolean(userVoteOption);
            const votedOptionId = userVoteOption?.id;

            return (
              <div
                key={poll.id}
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '20px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '16px', color: '#1e293b', marginBottom: '4px' }}>
                      📊 {poll.question}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      Inițiat de <strong>{poll.createdBy?.username || poll.createdBy?.email || 'Membru'}</strong> · {total} {total === 1 ? 'vot' : 'voturi'}
                    </div>
                  </div>
                  {hasVoted ? (
                    <span style={{ fontSize: '12px', color: '#059669', backgroundColor: '#d1fae5', padding: '4px 10px', borderRadius: '12px', fontWeight: '600' }}>
                      ✓ Ai votat (poți schimba votul)
                    </span>
                  ) : (
                    <span style={{ fontSize: '12px', color: '#6366f1', backgroundColor: '#e0e7ff', padding: '4px 10px', borderRadius: '12px', fontWeight: '500' }}>
                      Alege o opțiune pentru a vota
                    </span>
                  )}
                </div>

                {/* Options */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {poll.options?.map(opt => {
                    const isMyVote = votedOptionId === opt.id;
                    const voteCount = opt.votes?.length || 0;
                    const pct = total > 0 ? Math.round((voteCount / total) * 100) : 0;

                    return (
                      <div
                        key={opt.id}
                        onClick={() => handleVote(poll.id, opt.id)}
                        style={{
                          cursor: 'pointer',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          border: isMyVote ? '2px solid #5a3d5c' : '1px solid #e2e8f0',
                          backgroundColor: '#fafafa',
                          position: 'relative',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {/* Progress bar background */}
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            height: '100%',
                            width: `${pct}%`,
                            backgroundColor: isMyVote ? '#ede9fe' : '#f1f5f9',
                            transition: 'width 0.4s ease'
                          }}
                        />

                        {/* Content */}
                        <div
                          style={{
                            position: 'relative',
                            padding: '12px 16px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                border: isMyVote ? '5px solid #5a3d5c' : '2px solid #cbd5e1',
                                display: 'inline-block',
                                flexShrink: 0
                              }}
                            />
                            <span
                              style={{
                                fontSize: '14px',
                                color: isMyVote ? '#5a3d5c' : '#334155',
                                fontWeight: isMyVote ? '700' : '500'
                              }}
                            >
                              {opt.text}
                            </span>
                            {isMyVote && (
                              <span style={{ fontSize: '11px', color: '#5a3d5c', fontWeight: 'bold' }}>
                                (Votul tău)
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>
                              {voteCount} {voteCount === 1 ? 'vot' : 'voturi'}
                            </span>
                            <span
                              style={{
                                fontSize: '14px',
                                color: isMyVote ? '#5a3d5c' : '#475569',
                                fontWeight: '700',
                                minWidth: '40px',
                                textAlign: 'right'
                              }}
                            >
                              {pct}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default PollsTab;
