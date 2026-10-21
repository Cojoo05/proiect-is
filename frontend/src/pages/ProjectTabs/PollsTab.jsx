import { useState, useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

function PollsTab({ projectId, currentUser }) {
  const [polls, setPolls] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [votedPolls, setVotedPolls] = useState(new Set());
  const stompClientRef = useRef(null);

  const API = `http://localhost:8080/api/projects/${projectId}`;

  useEffect(() => {
    fetch(`${API}/polls`)
      .then(r => r.json())
      .then(data => setPolls(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [projectId]);

  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/projects/${projectId}/polls`, (msg) => {
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
        });
      }
    });
    client.activate();
    stompClientRef.current = client;
    return () => client.deactivate();
  }, [projectId]);

  const handleCreate = (e) => {
    e.preventDefault();
    const validOptions = options.filter(o => o.trim());
    if (!question.trim() || validOptions.length < 2) return;
    fetch(`${API}/polls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question.trim(), options: validOptions, createdById: currentUser.id })
    }).then(r => r.json())
      .then(poll => {
        setPolls(prev => [poll, ...prev]);
        setShowCreate(false);
        setQuestion('');
        setOptions(['', '']);
      })
      .catch(console.error);
  };

  const handleVote = (pollId, optionId) => {
    if (votedPolls.has(pollId)) return;
    fetch(`${API}/polls/${pollId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionId, voterId: currentUser.id })
    }).then(r => {
      if (r.ok) setVotedPolls(prev => new Set([...prev, pollId]));
    }).catch(console.error);
  };

  const totalVotes = (poll) => poll.options?.reduce((s, o) => s + (o.votes?.length || 0), 0) || 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
        <button
          onClick={() => setShowCreate(!showCreate)}
          style={{ padding: '9px 18px', backgroundColor: '#5a3d5c', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          {showCreate ? '✕ Anulează' : '+ Poll Nou'}
        </button>
      </div>

      {/* Create Poll Form */}
      {showCreate && (
        <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#1e293b' }}>📊 Poll Nou</h3>
          <form onSubmit={handleCreate}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px', color: '#334155' }}>Întrebare *</label>
              <input
                required
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder="ex: Care este prioritatea pentru săptămâna viitoare?"
                style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '14px' }}
              />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#334155' }}>Opțiuni (min. 2) *</label>
              {options.map((opt, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                  <input
                    value={opt}
                    onChange={e => { const next = [...options]; next[i] = e.target.value; setOptions(next); }}
                    placeholder={`Opțiunea ${i + 1}`}
                    style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                  {options.length > 2 && (
                    <button type="button" onClick={() => setOptions(options.filter((_, idx) => idx !== i))} style={{ padding: '0 10px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>✕</button>
                  )}
                </div>
              ))}
              {options.length < 6 && (
                <button type="button" onClick={() => setOptions([...options, ''])} style={{ marginTop: '4px', padding: '6px 12px', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#64748b' }}>+ Opțiune</button>
              )}
            </div>
            <button type="submit" style={{ padding: '9px 20px', backgroundColor: '#5a3d5c', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Creează Poll</button>
          </form>
        </div>
      )}

      {/* Polls List */}
      {polls.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📊</div>
          <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>Niciun poll încă</div>
          <div style={{ fontSize: '14px' }}>Creează primul poll pentru a lua decizii împreună.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {polls.map(poll => {
            const total = totalVotes(poll);
            const hasVoted = votedPolls.has(poll.id);
            return (
              <div key={poll.id} style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '16px', color: '#1e293b', marginBottom: '4px' }}>📊 {poll.question}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>de {poll.createdBy?.username} · {total} {total === 1 ? 'vot' : 'voturi'}</div>
                  </div>
                  {hasVoted && <span style={{ fontSize: '11px', color: '#10b981', backgroundColor: '#d1fae5', padding: '3px 8px', borderRadius: '10px', fontWeight: '600' }}>✓ Ai votat</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {poll.options?.map(opt => {
                    const voteCount = opt.votes?.length || 0;
                    const pct = total > 0 ? Math.round((voteCount / total) * 100) : 0;
                    return (
                      <div
                        key={opt.id}
                        onClick={() => !hasVoted && handleVote(poll.id, opt.id)}
                        style={{ cursor: hasVoted ? 'default' : 'pointer', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', position: 'relative' }}
                      >
                        <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: pct + '%', backgroundColor: '#f3e8ff', transition: 'width 0.4s ease' }} />
                        <div style={{ position: 'relative', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '14px', color: '#334155', fontWeight: hasVoted ? '500' : '400' }}>{opt.text}</span>
                          <span style={{ fontSize: '13px', color: '#6b21a8', fontWeight: '700' }}>{pct}%</span>
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
