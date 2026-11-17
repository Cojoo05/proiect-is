import { useState, useEffect, useMemo } from 'react';
import { API_BASE_URL } from '../../config';

const CATEGORIES = [
  { value: 'meeting', label: '🤝 Ședință Echipă', color: '#3b82f6', bg: '#dbeafe' },
  { value: 'video_call', label: '🎥 Google Meet', color: '#8b5cf6', bg: '#ede9fe' },
  { value: 'deadline', label: '🔥 Termen Predare', color: '#ef4444', bg: '#fee2e2' },
  { value: 'consultation', label: '🎓 Laborator / Demo', color: '#10b981', bg: '#d1fae5' },
  { value: 'presentation', label: '🚀 Prezentare & Review', color: '#f59e0b', bg: '#fef3c7' },
  { value: 'workshop', label: '💡 Workshop Tehnic', color: '#ec4899', bg: '#fce7f3' }
];

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'O singură dată' },
  { value: 'DAILY', label: 'Zilnic (7 zile)' },
  { value: 'WEEKLY', label: 'Săptămânal (4 săpt.)' },
];

const DAYS_RO = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'];
const MONTHS_RO = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
];

const ACCENT = '#5a3d5c';
const ACCENT_LIGHTER = '#f6eff7';
const ACCENT_GRADIENT = 'linear-gradient(135deg, #5a3d5c 0%, #7c5a7e 100%)';

function CalendarTab({ projectId, currentUser, members = [] }) {
  const BACKEND_URL = `${API_BASE_URL}/api/calendar`;
  const storageKey = `project_calendar_${projectId}`;

  const todayKey = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [currentDate, setCurrentDate] = useState(new Date());

  const [events, setEvents] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [showEventModal, setShowEventModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('all');
  const [toastMessage, setToastMessage] = useState('');

  const [form, setForm] = useState({
    title: '',
    startTime: '10:00',
    endTime: '11:00',
    allDay: false,
    category: 'meeting',
    priority: 'medium',
    recurrence: 'none',
    hasGoogleMeet: true,
    meetLink: '',
    attendees: '',
    description: '',
    location: ''
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(events));
    } catch (e) {
      console.error(e);
    }
  }, [events, storageKey]);

  // Fetch project events from backend
  useEffect(() => {
    if (!projectId) return;
    fetch(`${BACKEND_URL}/project/${projectId}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map(item => ({
            id: item.id ? `be-${item.id}` : `proj-${Date.now()}`,
            backendId: item.id,
            title: item.title,
            description: item.description || '',
            date: item.eventDate,
            startTime: item.startTime || '10:00',
            endTime: item.endTime || '11:00',
            allDay: Boolean(item.allDay),
            category: item.category || 'meeting',
            priority: item.priority || 'medium',
            recurrence: item.recurrence || 'none',
            hasGoogleMeet: Boolean(item.hasVideoMeet || item.meetLink),
            meetLink: item.meetLink || '',
            location: item.location || '',
            attendees: item.attendees || '',
            projectId: item.projectId
          }));

          setEvents(prev => {
            const ids = new Set(mapped.map(m => m.id));
            const localOnly = prev.filter(p => !ids.has(p.id));
            return [...mapped, ...localOnly];
          });
        }
      })
      .catch(() => {});
  }, [BACKEND_URL, projectId]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const copyToClipboard = (text, msg = '📋 Link copiat în clipboard!') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast(msg);
  };

  const openAddModal = (dateToUse = selectedDate) => {
    setSelectedDate(dateToUse);
    setForm({
      title: '',
      startTime: '10:00',
      endTime: '11:00',
      allDay: false,
      category: 'meeting',
      priority: 'medium',
      recurrence: 'none',
      hasGoogleMeet: true,
      meetLink: 'https://meet.google.com/new',
      attendees: '',
      description: '',
      location: ''
    });
    setEditingId(null);
    setShowEventModal(true);
  };

  const handleEditClick = (ev) => {
    setEditingId(ev.id);
    setSelectedDate(ev.date);
    setForm({
      title: ev.title,
      startTime: ev.startTime || '10:00',
      endTime: ev.endTime || '11:00',
      allDay: Boolean(ev.allDay),
      category: ev.category || 'meeting',
      priority: ev.priority || 'medium',
      recurrence: ev.recurrence || 'none',
      hasGoogleMeet: Boolean(ev.hasGoogleMeet || ev.meetLink),
      meetLink: ev.meetLink || '',
      attendees: ev.attendees || '',
      description: ev.description || '',
      location: ev.location || ''
    });
    setShowEventModal(true);
  };

  const handleSaveEvent = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return alert('Completează titlul activității!');

    if (!form.allDay && form.endTime <= form.startTime) {
      return alert('Ora de sfârșit trebuie să fie după ora de început!');
    }

    let computedMeet = form.meetLink.trim();
    if (form.hasGoogleMeet && !computedMeet) {
      computedMeet = 'https://meet.google.com/new';
    }

    if (editingId) {
      setEvents(prev => prev.map(ev => ev.id === editingId ? {
        ...ev,
        ...form,
        meetLink: computedMeet,
        date: selectedDate
      } : ev));

      const existing = events.find(ev => ev.id === editingId);
      if (existing?.backendId) {
        fetch(`${BACKEND_URL}/events/${existing.backendId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: form.title,
            description: form.description,
            eventDate: selectedDate,
            startTime: form.startTime,
            endTime: form.endTime,
            allDay: form.allDay,
            category: form.category,
            priority: form.priority,
            hasVideoMeet: form.hasGoogleMeet,
            meetLink: computedMeet,
            attendees: form.attendees,
            location: form.location
          })
        }).catch(() => {});
      }

      setShowEventModal(false);
      showToast('Eveniment actualizat!');
      return;
    }

    // New event
    const baseItem = {
      id: `proj-ev-${Date.now()}`,
      ...form,
      date: selectedDate,
      meetLink: computedMeet,
      projectId: parseInt(projectId)
    };

    fetch(`${BACKEND_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        description: form.description,
        eventDate: selectedDate,
        startTime: form.startTime,
        endTime: form.endTime,
        allDay: form.allDay,
        category: form.category,
        priority: form.priority,
        recurrence: form.recurrence,
        hasVideoMeet: form.hasGoogleMeet,
        meetLink: computedMeet,
        attendees: form.attendees,
        location: form.location,
        projectId: parseInt(projectId),
        userId: currentUser?.id || null
      })
    })
      .then(res => res.ok ? res.json() : null)
      .then(saved => {
        if (saved?.id) baseItem.backendId = saved.id;
      })
      .catch(() => {});

    const items = [baseItem];
    if (form.recurrence === 'DAILY') {
      for (let i = 1; i < 7; i++) {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + i);
        items.push({ ...baseItem, id: `${baseItem.id}-r${i}`, date: d.toISOString().split('T')[0] });
      }
    } else if (form.recurrence === 'WEEKLY') {
      for (let i = 1; i < 4; i++) {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + i * 7);
        items.push({ ...baseItem, id: `${baseItem.id}-r${i}`, date: d.toISOString().split('T')[0] });
      }
    }

    setEvents(prev => [...prev, ...items]);
    setShowEventModal(false);
    showToast('✨ Activitate adăugată în calendarul proiectului!');
  };

  const handleDelete = (ev) => {
    if (!window.confirm(`Ștergi activitatea "${ev.title}"?`)) return;

    if (ev.backendId) {
      fetch(`${BACKEND_URL}/events/${ev.backendId}`, { method: 'DELETE' }).catch(() => {});
    }

    setEvents(prev => prev.filter(e => e.id !== ev.id));
    showToast('Activitate ștearsă din proiect.');
  };

  // Calendar calculations
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const startingOffset = (firstDayOfMonth + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const formatDateKey = (day) => {
    const formattedMonth = String(month + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    return `${year}-${formattedMonth}-${formattedDay}`;
  };

  const filteredEvents = useMemo(() => {
    return events.filter(ev => {
      if (activeCategoryFilter !== 'all' && ev.category !== activeCategoryFilter) return false;
      return true;
    });
  }, [events, activeCategoryFilter]);

  const selectedDayEvents = useMemo(() => {
    return filteredEvents
      .filter(ev => ev.date === selectedDate)
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  }, [filteredEvents, selectedDate]);

  const totalMeets = events.filter(e => Boolean(e.meetLink || e.hasGoogleMeet || e.category === 'video_call')).length;

  const inputStyle = {
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1.5px solid #cbd5e1',
    backgroundColor: '#fafafa',
    color: '#1e293b',
    fontSize: '13px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box'
  };

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* Toast Alert */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: '#1e293b',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          zIndex: 9999,
          fontWeight: '700',
          fontSize: '14px',
          borderLeft: '5px solid #8b5cf6'
        }}>
          {toastMessage}
        </div>
      )}

      {/* Top Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        padding: '16px 20px',
        borderRadius: '16px',
        border: '1.5px solid #e2e8f0',
        marginBottom: '18px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '17px', color: '#1e293b', fontWeight: '800' }}>
            📅 Calendar & Ședințe Echipă Proiect
          </h3>
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            {events.length} evenimente • {totalMeets} ședințe Google Meet
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => openAddModal()}
            style={{
              padding: '9px 16px',
              cursor: 'pointer',
              background: ACCENT_GRADIENT,
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontWeight: '700',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ➕ Adaugă Eveniment
          </button>

          <a
            href="https://meet.google.com/new"
            target="_blank"
            rel="noreferrer"
            style={{
              padding: '9px 16px',
              backgroundColor: '#ffffff',
              color: '#1e293b',
              border: '1.5px solid #d8b4fe',
              borderRadius: '10px',
              fontWeight: '700',
              fontSize: '13px',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            🚀 Google Meet Nou ↗
          </a>
        </div>
      </div>

      {/* Month Navigation & Category Filter */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            style={{ padding: '6px 12px', cursor: 'pointer', backgroundColor: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '8px', fontWeight: '700' }}
          >
            ◀
          </button>
          <button
            onClick={() => { const now = new Date(); setCurrentDate(now); setSelectedDate(todayKey); }}
            style={{ padding: '6px 14px', cursor: 'pointer', backgroundColor: ACCENT, color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: '700' }}
          >
            Azi
          </button>
          <button
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            style={{ padding: '6px 12px', cursor: 'pointer', backgroundColor: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '8px', fontWeight: '700' }}
          >
            ▶
          </button>
          <span style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginLeft: '6px' }}>
            {MONTHS_RO[month]} {year}
          </span>
        </div>

        <select
          value={activeCategoryFilter}
          onChange={e => setActiveCategoryFilter(e.target.value)}
          style={{ ...inputStyle, width: 'auto', fontWeight: '700' }}
        >
          <option value="all">Toate tipurile de activități</option>
          {CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Two Column Layout: Calendar View on Left, Day Agenda on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '20px', alignItems: 'start' }}>
        
        {/* Monthly Grid */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '18px', border: '1.5px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center', marginBottom: '8px' }}>
            {DAYS_RO.map(d => (
              <div key={d} style={{ fontWeight: '800', color: '#64748b', fontSize: '12px', textTransform: 'uppercase' }}>
                {d}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
            {Array.from({ length: startingOffset }).map((_, idx) => (
              <div key={`offset-${idx}`} style={{ minHeight: '85px', backgroundColor: '#f8fafc', borderRadius: '10px' }} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const dateKey = formatDateKey(day);
              const isSelected = selectedDate === dateKey;
              const isToday = todayKey === dateKey;
              const dayEvents = filteredEvents.filter(e => e.date === dateKey);

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDate(dateKey)}
                  style={{
                    minHeight: '85px',
                    padding: '8px',
                    borderRadius: '10px',
                    border: isSelected ? `2.5px solid ${ACCENT}` : isToday ? '2px solid #10b981' : '1.5px solid #f1f5f9',
                    backgroundColor: isSelected ? ACCENT_LIGHTER : '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: isToday || isSelected ? '800' : '700', fontSize: '13px', color: isToday ? '#10b981' : isSelected ? ACCENT : '#334155' }}>
                      {day}
                    </span>
                    {isToday && <span style={{ fontSize: '9px', backgroundColor: '#10b981', color: '#fff', padding: '1px 5px', borderRadius: '4px', fontWeight: '800' }}>Azi</span>}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflow: 'hidden' }}>
                    {dayEvents.slice(0, 2).map(ev => {
                      const cat = CATEGORIES.find(c => c.value === ev.category) || CATEGORIES[0];
                      return (
                        <div
                          key={ev.id}
                          style={{
                            fontSize: '10px',
                            backgroundColor: cat.bg,
                            color: cat.color,
                            padding: '2px 4px',
                            borderRadius: '4px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            fontWeight: '700'
                          }}
                        >
                          {ev.hasGoogleMeet || ev.meetLink ? '🎥 ' : ''}{ev.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 2 && (
                      <span style={{ fontSize: '9px', color: '#64748b', fontWeight: '700' }}>
                        +{dayEvents.length - 2} altele
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Agenda */}
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '16px', border: '1.5px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h4 style={{ margin: 0, fontSize: '16px', color: '#0f172a', fontWeight: '800' }}>
              Activități: {selectedDate}
            </h4>
            <button
              onClick={() => openAddModal(selectedDate)}
              style={{ padding: '6px 12px', background: ACCENT_GRADIENT, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}
            >
              ➕ Adaugă
            </button>
          </div>

          {selectedDayEvents.length === 0 ? (
            <p style={{ color: '#64748b', fontStyle: 'italic', fontSize: '13px', margin: 0, padding: '20px 0', textAlign: 'center' }}>
              Nicio activitate programată pe {selectedDate}.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {selectedDayEvents.map(ev => {
                const cat = CATEGORIES.find(c => c.value === ev.category) || CATEGORIES[0];
                return (
                  <div
                    key={ev.id}
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      backgroundColor: '#f8fafc',
                      border: '1.5px solid #e2e8f0',
                      borderLeft: `4px solid ${cat.color}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '14px' }}>
                            {ev.title}
                          </span>
                          <span style={{ fontSize: '10px', backgroundColor: cat.bg, color: cat.color, padding: '1px 6px', borderRadius: '6px', fontWeight: '700' }}>
                            {cat.label}
                          </span>
                        </div>

                        <div style={{ fontSize: '12px', color: '#2563eb', fontWeight: '700', marginTop: '4px' }}>
                          ⏰ {ev.allDay ? 'Toată ziua' : `${ev.startTime} ${ev.endTime ? `– ${ev.endTime}` : ''}`}
                        </div>

                        {ev.attendees && (
                          <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px' }}>
                            👥 {ev.attendees}
                          </div>
                        )}

                        {ev.description && (
                          <div style={{ fontSize: '12px', color: '#334155', marginTop: '5px' }}>
                            {ev.description}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => handleEditClick(ev)} style={{ background: '#e2e8f0', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                        <button onClick={() => handleDelete(ev)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>✕</button>
                      </div>
                    </div>

                    {(ev.meetLink || ev.hasGoogleMeet) && (
                      <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                        <a
                          href={ev.meetLink || 'https://meet.google.com/new'}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: '11px',
                            backgroundColor: '#2563eb',
                            color: '#ffffff',
                            padding: '5px 10px',
                            borderRadius: '6px',
                            fontWeight: '700',
                            textDecoration: 'none'
                          }}
                        >
                          🎥 Google Meet ↗
                        </a>
                        <button
                          onClick={() => copyToClipboard(ev.meetLink || 'https://meet.google.com/new')}
                          style={{ fontSize: '11px', backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', padding: '5px 8px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          📋 Copiază Link
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Event Add/Edit Modal */}
      {showEventModal && (
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
            padding: '26px',
            maxWidth: '480px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b', fontWeight: '800' }}>
                {editingId ? '✏️ Editează Activitate' : '➕ Activitate / Ședință Proiect'}
              </h3>
              <button onClick={() => setShowEventModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <form onSubmit={handleSaveEvent} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Titlu *</label>
                <input
                  type="text"
                  placeholder="ex: Daily Scrum, Predare Etapa 2"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  required
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Tip:</label>
                  <select
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    style={{ ...inputStyle, cursor: 'pointer', fontWeight: '600' }}
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Recurență:</label>
                  <select
                    value={form.recurrence}
                    onChange={e => setForm({ ...form, recurrence: e.target.value })}
                    style={{ ...inputStyle, cursor: 'pointer', fontWeight: '600' }}
                  >
                    {RECURRENCE_OPTIONS.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#334155', cursor: 'pointer', fontWeight: '700' }}>
                <input
                  type="checkbox"
                  checked={form.allDay}
                  onChange={e => setForm({ ...form, allDay: e.target.checked })}
                  style={{ width: '15px', height: '15px', accentColor: ACCENT }}
                />
                Toată ziua
              </label>

              {!form.allDay && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Începe la:</label>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={e => setForm({ ...form, startTime: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Se termină la:</label>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={e => setForm({ ...form, endTime: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}

              {/* Google Meet Option */}
              <div style={{ backgroundColor: '#f3e8ff', border: '1.5px solid #d8b4fe', borderRadius: '10px', padding: '10px 12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#7e22ce', cursor: 'pointer', fontWeight: '800' }}>
                  <input
                    type="checkbox"
                    checked={form.hasGoogleMeet}
                    onChange={e => setForm({ ...form, hasGoogleMeet: e.target.checked })}
                    style={{ width: '16px', height: '16px', accentColor: '#7e22ce' }}
                  />
                  🎥 Adaugă Google Meet pentru echipă
                </label>
              </div>

              {members.length > 0 && (
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Membri invitați:</label>
                  <select
                    onChange={e => {
                      if (!e.target.value) return;
                      const current = form.attendees ? form.attendees.split(', ') : [];
                      if (!current.includes(e.target.value)) {
                        setForm({ ...form, attendees: [...current, e.target.value].join(', ') });
                      }
                    }}
                    style={{ ...inputStyle, padding: '7px 10px' }}
                  >
                    <option value="">Alege membru din proiect...</option>
                    {members.map(m => (
                      <option key={m.id} value={m.user?.username || m.user?.email}>
                        {m.user?.username || m.user?.email}
                      </option>
                    ))}
                  </select>
                  {form.attendees && (
                    <div style={{ fontSize: '11px', color: '#7e22ce', marginTop: '3px', fontWeight: '600' }}>
                      Invitați: {form.attendees}
                    </div>
                  )}
                </div>
              )}

              <textarea
                placeholder="📝 Agendă / Notițe..."
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={2}
                style={{ ...inputStyle, resize: 'vertical' }}
              />

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  style={{ padding: '9px 14px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', color: '#64748b' }}
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  style={{ padding: '9px 18px', background: ACCENT_GRADIENT, color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer' }}
                >
                  💾 Salvează
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default CalendarTab;
