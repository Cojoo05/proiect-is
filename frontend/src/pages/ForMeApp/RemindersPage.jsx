import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const PRIORITIES = {
  high: { label: '🔴 Urgent', color: '#dc2626', bg: '#fee2e2' },
  medium: { label: '🟡 Important', color: '#d97706', bg: '#fef3c7' },
  low: { label: '🟢 Relaxat', color: '#16a34a', bg: '#dcfce7' }
};

const CATEGORIES = {
  study: { label: '📚 Facultate / Proiect IS', icon: '📚', color: '#8b5cf6' },
  meeting: { label: '🤝 Ședințe & Echipă', icon: '🤝', color: '#3b82f6' },
  health: { label: '💊 Sănătate & Pauză', icon: '💧', color: '#10b981' },
  personal: { label: '🎯 Obiectiv Personal', icon: '🎯', color: '#ec4899' },
  general: { label: '⚡ General', icon: '⚡', color: '#64748b' }
};

const ACCENT = '#5a3d5c';
const ACCENT_GRADIENT = 'linear-gradient(135deg, #5a3d5c 0%, #7c5a7e 100%)';

function RemindersPage({ currentUser }) {
  const navigate = useNavigate();
  const storageKey = `for_me_reminders_${currentUser?.id || 'guest'}`;

  const todayStr = new Date().toISOString().split('T')[0];

  const [reminders, setReminders] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    // Default initial mock reminders
    return [
      {
        id: 'rem-1',
        title: 'Verifică pull request-urile pe branch-ul de IS',
        dueDate: todayStr,
        dueTime: '16:00',
        priority: 'high',
        category: 'study',
        completed: false,
        notes: 'Verifică dacă totul compilează pe development_cimpean',
        createdAt: new Date().toISOString()
      },
      {
        id: 'rem-2',
        title: 'Pregătește agenda pentru sincronizarea de proiect',
        dueDate: todayStr,
        dueTime: '18:30',
        priority: 'medium',
        category: 'meeting',
        completed: false,
        notes: 'Discută distribuția taskurilor și tabul de calendar',
        createdAt: new Date().toISOString()
      },
      {
        id: 'rem-3',
        title: 'Pauză de hidratare & relaxare 10 min',
        dueDate: todayStr,
        dueTime: '14:00',
        priority: 'low',
        category: 'health',
        completed: true,
        notes: '',
        createdAt: new Date().toISOString()
      }
    ];
  });

  const [activeTab, setActiveTab] = useState('active'); // 'active', 'today', 'completed', 'all'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState(todayStr);
  const [newDueTime, setNewDueTime] = useState('12:00');
  const [newPriority, setNewPriority] = useState('medium');
  const [newCategory, setNewCategory] = useState('study');
  const [newNotes, setNewNotes] = useState('');

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(reminders));
    } catch (e) {
      console.error(e);
    }
  }, [reminders, storageKey]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleToggleComplete = (id) => {
    setReminders(prev => prev.map(rem => {
      if (rem.id === id) {
        const nextState = !rem.completed;
        if (nextState) showToast('🎉 Reminder marcat ca finalizat!');
        return { ...rem, completed: nextState };
      }
      return rem;
    }));
  };

  const handleDelete = (id) => {
    setReminders(prev => prev.filter(r => r.id !== id));
    showToast('Reminder șters.');
  };

  const handleQuickPreset = (minutes) => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + minutes);
    const dateStr = d.toISOString().split('T')[0];
    const timeStr = d.toTimeString().substring(0, 5);
    setNewDueDate(dateStr);
    setNewDueTime(timeStr);
  };

  const handleCreateReminder = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return alert('Completează titlul reminder-ului!');

    const item = {
      id: `rem-${Date.now()}`,
      title: newTitle.trim(),
      dueDate: newDueDate,
      dueTime: newDueTime,
      priority: newPriority,
      category: newCategory,
      notes: newNotes.trim(),
      completed: false,
      createdAt: new Date().toISOString()
    };

    setReminders(prev => [item, ...prev]);
    setShowModal(false);
    setNewTitle('');
    setNewNotes('');
    showToast('⏰ Reminder adăugat cu succes!');
  };

  // Sound / Alert Simulator
  const handleSimulateAlert = (reminder) => {
    alert(`🔔 [ALERTA REMINDER]:\n\n${reminder.title}\nTermen: ${reminder.dueDate} la ${reminder.dueTime}\nPrioritate: ${reminder.priority.toUpperCase()}`);
  };

  // Filtered Reminders
  const filteredReminders = useMemo(() => {
    return reminders.filter(r => {
      // Tab filter
      if (activeTab === 'active' && r.completed) return false;
      if (activeTab === 'completed' && !r.completed) return false;
      if (activeTab === 'today') {
        if (r.dueDate !== todayStr) return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && r.category !== selectedCategory) return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = r.title.toLowerCase().includes(q);
        const matchNotes = r.notes && r.notes.toLowerCase().includes(q);
        if (!matchTitle && !matchNotes) return false;
      }

      return true;
    }).sort((a, b) => {
      // Sort incomplete first, then by date and time
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const dtA = `${a.dueDate} ${a.dueTime}`;
      const dtB = `${b.dueDate} ${b.dueTime}`;
      return dtA.localeCompare(dtB);
    });
  }, [reminders, activeTab, selectedCategory, searchQuery, todayStr]);

  const activeCount = reminders.filter(r => !r.completed).length;
  const todayCount = reminders.filter(r => r.dueDate === todayStr && !r.completed).length;
  const completedCount = reminders.filter(r => r.completed).length;

  const inputStyle = {
    padding: '11px 14px',
    borderRadius: '10px',
    border: '1.5px solid #cbd5e1',
    backgroundColor: '#fafafa',
    color: '#1e293b',
    fontSize: '14px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box'
  };

  return (
    <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '32px 20px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* Toast Alert */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: '#1e293b',
          color: '#ffffff',
          padding: '12px 22px',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
          zIndex: 9999,
          fontWeight: '700',
          fontSize: '14px',
          borderLeft: '5px solid #a855f7'
        }}>
          {toastMessage}
        </div>
      )}

      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate('/for-me')}
            style={{
              padding: '9px 16px',
              backgroundColor: '#ffffff',
              border: '1.5px solid #e2e8f0',
              borderRadius: '10px',
              fontWeight: '700',
              cursor: 'pointer',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ⬅️ Înapoi la For Me
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#1e293b', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
              ⏰ Reminders & Alerte
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '14px', color: '#64748b' }}>
              Amintește-ți de termene, ședințe și obiective zilnice.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: '11px 22px',
            background: ACCENT_GRADIENT,
            color: '#ffffff',
            border: 'none',
            borderRadius: '12px',
            fontWeight: '800',
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(90, 61, 92, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          ➕ Adaugă Reminder
        </button>
      </div>

      {/* Stats Counter Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: '#ffffff', padding: '16px 20px', borderRadius: '14px', border: '1.5px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '700' }}>⚡ REMINDERS ACTIVE</div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#2563eb', marginTop: '4px' }}>{activeCount}</div>
        </div>
        <div style={{ backgroundColor: '#ffffff', padding: '16px 20px', borderRadius: '14px', border: '1.5px solid #fecdd3', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '12px', color: '#e11d48', fontWeight: '700' }}>🔥 SCADENȚĂ AZI</div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#e11d48', marginTop: '4px' }}>{todayCount}</div>
        </div>
        <div style={{ backgroundColor: '#ffffff', padding: '16px 20px', borderRadius: '14px', border: '1.5px solid #bbf7d0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: '700' }}>✅ FINALIZATE</div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#16a34a', marginTop: '4px' }}>{completedCount}</div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        padding: '14px 18px',
        borderRadius: '14px',
        border: '1.5px solid #e2e8f0',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Tab Pills */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { id: 'active', label: `Active (${activeCount})` },
            { id: 'today', label: `Azi (${todayCount})` },
            { id: 'completed', label: `Finalizate (${completedCount})` },
            { id: 'all', label: `Toate (${reminders.length})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '13px',
                backgroundColor: activeTab === tab.id ? ACCENT : '#f1f5f9',
                color: activeTab === tab.id ? '#ffffff' : '#475569',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Category Filter */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="🔍 Caută reminder..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ ...inputStyle, width: '200px', padding: '8px 12px' }}
          />
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            style={{ ...inputStyle, width: 'auto', padding: '8px 12px', fontWeight: '600' }}
          >
            <option value="all">Toate Categoriile</option>
            {Object.entries(CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>{v.icon} {v.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Reminders List */}
      {filteredReminders.length === 0 ? (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '60px 20px',
          textAlign: 'center',
          border: '1.5px dashed #cbd5e1'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🌱</div>
          <h3 style={{ margin: '0 0 6px 0', color: '#1e293b', fontSize: '18px' }}>
            Niciun reminder de afișat
          </h3>
          <p style={{ margin: '0 0 16px 0', color: '#64748b', fontSize: '14px' }}>
            Folosește butonul de mai sus pentru a adăuga un reminder util pentru activitățile tale.
          </p>
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: '10px 20px',
              backgroundColor: ACCENT,
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            ➕ Creează primul reminder
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredReminders.map(rem => {
            const prio = PRIORITIES[rem.priority] || PRIORITIES.medium;
            const cat = CATEGORIES[rem.category] || CATEGORIES.general;
            const isToday = rem.dueDate === todayStr;

            return (
              <div
                key={rem.id}
                style={{
                  backgroundColor: rem.completed ? '#f8fafc' : '#ffffff',
                  borderRadius: '14px',
                  padding: '16px 20px',
                  border: isToday && !rem.completed ? '1.5px solid #fca5a5' : '1.5px solid #e2e8f0',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '14px',
                  opacity: rem.completed ? 0.7 : 1,
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1 }}>
                  {/* Complete Checkbox */}
                  <input
                    type="checkbox"
                    checked={rem.completed}
                    onChange={() => handleToggleComplete(rem.id)}
                    style={{
                      width: '20px',
                      height: '20px',
                      marginTop: '3px',
                      cursor: 'pointer',
                      accentColor: ACCENT
                    }}
                    title="Marchează ca rezolvat"
                  />

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '15px',
                        fontWeight: '700',
                        color: rem.completed ? '#64748b' : '#0f172a',
                        textDecoration: rem.completed ? 'line-through' : 'none'
                      }}>
                        {rem.title}
                      </span>

                      <span style={{
                        fontSize: '11px',
                        backgroundColor: prio.bg,
                        color: prio.color,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontWeight: '700'
                      }}>
                        {prio.label}
                      </span>

                      <span style={{
                        fontSize: '11px',
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontWeight: '600'
                      }}>
                        {cat.icon} {cat.label}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px', fontSize: '13px', color: isToday && !rem.completed ? '#dc2626' : '#64748b', fontWeight: isToday ? '700' : '500' }}>
                      <span>📅 {isToday ? 'Azi' : rem.dueDate}</span>
                      <span>⏰ {rem.dueTime}</span>
                    </div>

                    {rem.notes && (
                      <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748b', fontStyle: 'italic' }}>
                        {rem.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={() => handleSimulateAlert(rem)}
                    style={{
                      padding: '6px 10px',
                      backgroundColor: '#eff6ff',
                      color: '#2563eb',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '700',
                      fontSize: '12px'
                    }}
                    title="Testează alerta sonoră / pop-up"
                  >
                    🔔 Sună
                  </button>
                  <button
                    onClick={() => handleDelete(rem.id)}
                    style={{
                      padding: '6px 10px',
                      backgroundColor: '#fee2e2',
                      color: '#dc2626',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '700',
                      fontSize: '12px'
                    }}
                    title="Șterge reminder"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Reminder Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '18px',
            padding: '28px',
            maxWidth: '480px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b', fontWeight: '800' }}>
                ⏰ Reminder Nou
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {/* Quick Presets */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>
                Presetări rapide de timp:
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => handleQuickPreset(15)}
                  style={{ padding: '5px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', cursor: 'pointer', fontWeight: '600' }}
                >
                  ⚡ Peste 15 min
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset(60)}
                  style={{ padding: '5px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', cursor: 'pointer', fontWeight: '600' }}
                >
                  ⏱️ Peste 1 oră
                </button>
                <button
                  type="button"
                  onClick={() => { setNewDueDate(todayStr); setNewDueTime('20:00'); }}
                  style={{ padding: '5px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', cursor: 'pointer', fontWeight: '600' }}
                >
                  🌙 Diseară (20:00)
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateReminder} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Ce vrei să îți amintești? *
                </label>
                <input
                  type="text"
                  placeholder="ex: Trimite raportul de laborator, Ia o pauză"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Dată:
                  </label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={e => setNewDueDate(e.target.value)}
                    required
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Oră:
                  </label>
                  <input
                    type="time"
                    value={newDueTime}
                    onChange={e => setNewDueTime(e.target.value)}
                    required
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Prioritate:
                  </label>
                  <select
                    value={newPriority}
                    onChange={e => setNewPriority(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer', fontWeight: '600' }}
                  >
                    {Object.entries(PRIORITIES).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Categorie:
                  </label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer', fontWeight: '600' }}
                  >
                    {Object.entries(CATEGORIES).map(([k, v]) => (
                      <option key={k} value={k}>{v.icon} {v.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Notițe adiționale (opțional):
                </label>
                <textarea
                  placeholder="Detalii suplimentare..."
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: '#f1f5f9',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontWeight: '700',
                    color: '#64748b'
                  }}
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    background: ACCENT_GRADIENT,
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                >
                  💾 Salvează Reminder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default RemindersPage;
