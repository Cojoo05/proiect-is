import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';

const CATEGORIES = {
  meeting: { label: '🤝 Ședință / Sync Echipă', color: '#3b82f6', bg: '#dbeafe', icon: '🤝' },
  video_call: { label: '🎥 Google Meet', color: '#8b5cf6', bg: '#ede9fe', icon: '🎥' },
  deadline: { label: '🔥 Termen Limită / Predare', color: '#ef4444', bg: '#fee2e2', icon: '🔥' },
  consultation: { label: '🎓 Laborator / Curs / Consultație', color: '#10b981', bg: '#d1fae5', icon: '🎓' },
  presentation: { label: '🚀 Prezentare & Demo', color: '#f59e0b', bg: '#fef3c7', icon: '🚀' },
  workshop: { label: '💡 Workshop / Brainstorming', color: '#ec4899', bg: '#fce7f3', icon: '💡' }
};

const PRIORITIES = {
  low: { label: '🟢 Relaxat', color: '#16a34a', bg: '#dcfce7' },
  medium: { label: '🟡 Mediu', color: '#d97706', bg: '#fef3c7' },
  high: { label: '🔴 Urgent', color: '#dc2626', bg: '#fee2e2' }
};

/* ───── Theme & Styling Constants ───── */
const ACCENT = '#5a3d5c';
const ACCENT_LIGHT = '#7c5a7e';
const ACCENT_LIGHTER = '#f6eff7';
const ACCENT_GRADIENT = 'linear-gradient(135deg, #5a3d5c 0%, #7c5a7e 100%)';
const ACCENT_SHADOW = '0 6px 20px rgba(90, 61, 92, 0.2)';

function Calendar({ currentUser }) {
  const navigate = useNavigate();
  const GOOGLE_CLIENT_ID = '581947728431-1lqjbaf8ae86ig53pg7do170mdpmlgrd.apps.googleusercontent.com';
  const BACKEND_CALENDAR_URL = `${API_BASE_URL}/api/calendar`;

  const todayKey = new Date().toISOString().split('T')[0];

  // Active Main View Tab: 'month' (Calendar Grid) | 'agenda' (Lista evenimente) | 'meets' (Google Meet Hub)
  const [activeMainTab, setActiveMainTab] = useState('month');

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [nowTime, setNowTime] = useState(new Date());

  const [events, setEvents] = useState(() => {
    const saved = localStorage.getItem('calendar_local_events');
    return saved ? JSON.parse(saved) : [];
  });

  // Event Creation / Edit Modal State
  const [showEventModal, setShowEventModal] = useState(false);
  const [modalStep, setModalStep] = useState(1); // 1: Detalii, 2: Orar, 3: Google Meet & Invitați
  const [editingId, setEditingId] = useState(null);

  // Day Inspector Drawer (când dai click pe o zi din calendar)
  const [inspectorOpen, setInspectorOpen] = useState(false);

  // Quick Google Meet Modal
  const [showMeetModal, setShowMeetModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Event Form State
  const [eventForm, setEventForm] = useState({
    title: '',
    startTime: '10:00',
    endTime: '11:00',
    allDay: false,
    category: 'meeting',
    priority: 'medium',
    recurrence: 'none',
    hasGoogleMeet: false,
    meetLink: '',
    attendees: '',
    location: '',
    description: ''
  });

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('all');
  const [hoveredDay, setHoveredDay] = useState(null);

  // Google OAuth State
  const [googleToken, setGoogleToken] = useState(() => localStorage.getItem('google_access_token') || null);
  const [tokenClient, setTokenClient] = useState(null);
  const [loading, setLoading] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
    'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'
  ];
  const daysOfWeek = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'];

  // Timer
  useEffect(() => {
    const timer = setInterval(() => setNowTime(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);

  // Save local events
  useEffect(() => {
    const localOnly = events.filter(e => !e.isGoogle);
    localStorage.setItem('calendar_local_events', JSON.stringify(localOnly));
  }, [events]);

  // Load from backend
  useEffect(() => {
    fetch(`${BACKEND_CALENDAR_URL}/events`)
      .then(res => res.ok ? res.json() : [])
      .then(backendEvents => {
        if (Array.isArray(backendEvents) && backendEvents.length > 0) {
          setEvents(prev => {
            const googleOnly = prev.filter(e => e.isGoogle);
            const mapped = backendEvents.map(b => ({
              id: b.id ? `be-${b.id}` : `local-${Date.now()}`,
              backendId: b.id,
              title: b.title,
              description: b.description || '',
              date: b.eventDate,
              startTime: b.startTime || '10:00',
              endTime: b.endTime || '11:00',
              allDay: Boolean(b.allDay),
              category: b.category || 'meeting',
              priority: b.priority || 'medium',
              recurrence: b.recurrence || 'none',
              hasGoogleMeet: Boolean(b.hasVideoMeet || b.meetLink),
              meetLink: b.meetLink || '',
              location: b.location || '',
              attendees: b.attendees || '',
              completed: Boolean(b.completed),
              isGoogle: false
            }));
            const ids = new Set(mapped.map(m => m.id));
            const remainingLocal = prev.filter(p => !p.isGoogle && !ids.has(p.id));
            return [...mapped, ...remainingLocal, ...googleOnly];
          });
        }
      })
      .catch(() => {});
  }, [BACKEND_CALENDAR_URL]);

  // Google OAuth setup
  useEffect(() => {
    const initGsi = () => {
      if (typeof window !== 'undefined' && window.google?.accounts?.oauth2) {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/calendar.events',
          callback: (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
              setGoogleToken(tokenResponse.access_token);
              localStorage.setItem('google_access_token', tokenResponse.access_token);
              showToast('✅ Sincronizat cu Google Calendar!');
            }
          },
        });
        setTokenClient(client);
      }
    };

    initGsi();
    const timer = setTimeout(initGsi, 1000);
    return () => clearTimeout(timer);
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const copyToClipboard = (text, customMsg = '📋 Link copiat în clipboard!') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast(customMsg);
  };

  const fetchGoogleEvents = () => {
    if (!googleToken) return;
    setLoading(true);

    const firstDay = new Date(year, month, 1).toISOString();
    const lastDay = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

    fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${firstDay}&timeMax=${lastDay}&singleEvents=true&orderBy=startTime`,
      { headers: { Authorization: `Bearer ${googleToken}` } }
    )
      .then(res => {
        if (res.status === 401) {
          setGoogleToken(null);
          localStorage.removeItem('google_access_token');
          throw new Error('Token expirat');
        }
        return res.json();
      })
      .then(data => {
        const googleParsed = (data.items || []).map(item => {
          const startRaw = item.start?.dateTime || item.start?.date;
          const endRaw = item.end?.dateTime || item.end?.date;
          const isAllDay = !item.start?.dateTime;
          const meetUri = item.hangoutLink || item.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri || '';

          return {
            id: item.id,
            title: item.summary || 'Fără titlu',
            description: item.description || '',
            location: item.location || '',
            date: startRaw ? startRaw.split('T')[0] : '',
            startTime: isAllDay ? '00:00' : startRaw.split('T')[1].substring(0, 5),
            endTime: isAllDay ? '23:59' : (endRaw ? endRaw.split('T')[1].substring(0, 5) : ''),
            allDay: isAllDay,
            category: meetUri ? 'video_call' : 'meeting',
            priority: 'medium',
            hasGoogleMeet: Boolean(meetUri),
            meetLink: meetUri,
            attendees: item.attendees ? item.attendees.map(a => a.email).join(', ') : '',
            isGoogle: true
          };
        });

        setEvents(prev => {
          const localOnly = prev.filter(e => !e.isGoogle);
          return [...localOnly, ...googleParsed];
        });
        showToast('🔄 Calendar sincronizat cu Google!');
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (googleToken) {
      fetchGoogleEvents();
    }
  }, [googleToken, currentDate]);

  const handleGoogleAuth = () => {
    if (tokenClient) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      alert('Scriptul Google se încarcă. Reîncarcă pagina (F5).');
    }
  };

  const handleDisconnectGoogle = () => {
    setGoogleToken(null);
    localStorage.removeItem('google_access_token');
    setEvents(prev => prev.filter(e => !e.isGoogle));
    showToast('Deconectat de la Google Calendar.');
  };

  const openAddModal = (dateToUse = selectedDate) => {
    setSelectedDate(dateToUse);
    setEventForm({
      title: '',
      startTime: '10:00',
      endTime: '11:00',
      allDay: false,
      category: 'meeting',
      priority: 'medium',
      recurrence: 'none',
      hasGoogleMeet: false,
      meetLink: '',
      attendees: '',
      location: '',
      description: ''
    });
    setEditingId(null);
    setModalStep(1);
    setShowEventModal(true);
  };

  const handleEditClick = (ev) => {
    setEditingId(ev.id);
    setSelectedDate(ev.date);
    setEventForm({
      title: ev.title,
      startTime: ev.startTime || '10:00',
      endTime: ev.endTime || '11:00',
      allDay: Boolean(ev.allDay),
      category: ev.category || 'meeting',
      priority: ev.priority || 'medium',
      recurrence: ev.recurrence || 'none',
      hasGoogleMeet: Boolean(ev.meetLink || ev.hasGoogleMeet),
      meetLink: ev.meetLink || '',
      attendees: ev.attendees || '',
      location: ev.location || '',
      description: ev.description || ''
    });
    setModalStep(1);
    setShowEventModal(true);
  };

  const handleSaveEvent = (e) => {
    e.preventDefault();
    if (!eventForm.title.trim()) return alert('Completează titlul activității!');

    if (!eventForm.allDay && eventForm.endTime <= eventForm.startTime) {
      return alert('Ora de sfârșit trebuie să fie după ora de început!');
    }

    let computedMeetLink = eventForm.meetLink.trim();
    if (eventForm.hasGoogleMeet && !computedMeetLink) {
      computedMeetLink = 'https://meet.google.com/new';
    }

    if (editingId) {
      setEvents(prev => prev.map(ev => ev.id === editingId ? {
        ...ev,
        ...eventForm,
        meetLink: computedMeetLink,
        date: selectedDate
      } : ev));

      const existing = events.find(ev => ev.id === editingId);
      if (existing?.backendId) {
        fetch(`${BACKEND_CALENDAR_URL}/events/${existing.backendId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: eventForm.title,
            description: eventForm.description,
            eventDate: selectedDate,
            startTime: eventForm.startTime,
            endTime: eventForm.endTime,
            allDay: eventForm.allDay,
            category: eventForm.category,
            priority: eventForm.priority,
            hasVideoMeet: eventForm.hasGoogleMeet,
            meetLink: computedMeetLink,
            location: eventForm.location,
            attendees: eventForm.attendees
          })
        }).catch(() => {});
      }

      setShowEventModal(false);
      showToast('Modificările au fost salvate!');
      return;
    }

    // New Event
    const baseItem = {
      id: `local-${Date.now()}`,
      ...eventForm,
      date: selectedDate,
      meetLink: computedMeetLink,
      isGoogle: false
    };

    // Recurrence logic
    const items = [baseItem];
    if (eventForm.recurrence === 'DAILY') {
      for (let i = 1; i < 7; i++) {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + i);
        items.push({ ...baseItem, id: `${baseItem.id}-r${i}`, date: d.toISOString().split('T')[0] });
      }
    } else if (eventForm.recurrence === 'WEEKLY') {
      for (let i = 1; i < 4; i++) {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + i * 7);
        items.push({ ...baseItem, id: `${baseItem.id}-r${i}`, date: d.toISOString().split('T')[0] });
      }
    }

    // Save to backend
    fetch(`${BACKEND_CALENDAR_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: eventForm.title,
        description: eventForm.description,
        eventDate: selectedDate,
        startTime: eventForm.startTime,
        endTime: eventForm.endTime,
        allDay: eventForm.allDay,
        category: eventForm.category,
        priority: eventForm.priority,
        recurrence: eventForm.recurrence,
        hasVideoMeet: eventForm.hasGoogleMeet,
        meetLink: computedMeetLink,
        location: eventForm.location,
        attendees: eventForm.attendees,
        userId: currentUser?.id || null
      })
    })
      .then(res => res.ok ? res.json() : null)
      .then(saved => {
        if (saved?.id) baseItem.backendId = saved.id;
      })
      .catch(() => {});

    setEvents(prev => [...prev, ...items]);
    setShowEventModal(false);
    showToast('✨ Activitate adăugată în calendar!');
  };

  const handleDeleteEvent = (ev) => {
    if (!window.confirm(`Ștergi definitiv "${ev.title}"?`)) return;

    if (ev.backendId) {
      fetch(`${BACKEND_CALENDAR_URL}/events/${ev.backendId}`, { method: 'DELETE' }).catch(() => {});
    }

    setEvents(prev => prev.filter(e => e.id !== ev.id));
    showToast('Activitate eliminată.');
  };

  const isMeetingLiveNow = (ev) => {
    if (ev.date !== todayKey || ev.allDay || !ev.startTime) return false;
    const nowHM = nowTime.toTimeString().substring(0, 5);
    const endHM = ev.endTime || '23:59';
    return nowHM >= ev.startTime && nowHM <= endHM;
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
      const matchesCategory = activeCategoryFilter === 'all' || ev.category === activeCategoryFilter;
      const matchesSearch =
        ev.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ev.description && ev.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (ev.location && ev.location.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [events, activeCategoryFilter, searchQuery]);

  const selectedDayEvents = useMemo(() => {
    return filteredEvents
      .filter(ev => ev.date === selectedDate)
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  }, [filteredEvents, selectedDate]);

  const totalMonthEvents = events.filter(ev => ev.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).length;
  const todayEventsCount = events.filter(ev => ev.date === todayKey).length;
  const googleMeetsCount = events.filter(ev => Boolean(ev.meetLink || ev.hasGoogleMeet || ev.category === 'video_call')).length;

  const inputStyle = {
    padding: '11px 14px',
    borderRadius: '10px',
    border: '1.5px solid #cbd5e1',
    backgroundColor: '#fafafa',
    color: '#0f172a',
    fontSize: '14px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box'
  };

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '24px 20px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
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

      {/* Top Bar: Navigation, Search, and Action Hub */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/dashboard')}
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
            ⬅️ Înapoi la Dashboard
          </button>

          {/* Clean Stats Strip */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: '#ffffff',
            padding: '6px 14px',
            borderRadius: '10px',
            border: '1.5px solid #e2e8f0',
            fontSize: '13px',
            color: '#64748b',
            fontWeight: '600'
          }}>
            <span>📅 Luna: <strong style={{ color: ACCENT }}>{totalMonthEvents}</strong></span>
            <span>•</span>
            <span>⭐ Azi: <strong style={{ color: '#0f172a' }}>{todayEventsCount}</strong></span>
            <span>•</span>
            <span>🎥 Meet-uri: <strong style={{ color: '#7c3aed' }}>{googleMeetsCount}</strong></span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          
          <button
            onClick={() => openAddModal()}
            style={{
              padding: '10px 18px',
              cursor: 'pointer',
              background: ACCENT_GRADIENT,
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontWeight: '800',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: ACCENT_SHADOW
            }}
          >
            ➕ Adaugă Eveniment
          </button>

          <button
            onClick={() => setShowMeetModal(true)}
            style={{
              padding: '10px 16px',
              cursor: 'pointer',
              backgroundColor: '#ffffff',
              color: '#1e293b',
              border: '1.5px solid #d8b4fe',
              borderRadius: '10px',
              fontWeight: '700',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            🚀 Google Meet Rapid
          </button>

          {/* Google Sync Button */}
          {!googleToken ? (
            <button
              onClick={handleGoogleAuth}
              style={{
                padding: '9px 16px',
                backgroundColor: '#ffffff',
                color: '#1e293b',
                border: '1.5px solid #cbd5e1',
                borderRadius: '10px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px'
              }}
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" style={{ width: '16px', height: '16px' }} />
              Sincronizează cu Google
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', backgroundColor: '#ffffff', padding: '5px 10px', borderRadius: '10px', border: '1.5px solid #bbf7d0' }}>
              <span style={{ color: '#059669', fontWeight: '700', fontSize: '12px' }}>● Sincronizat</span>
              <button onClick={fetchGoogleEvents} style={{ background: '#eff6ff', border: 'none', color: '#2563eb', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: '700' }}>Sync</button>
              <button onClick={handleDisconnectGoogle} style={{ background: '#fee2e2', border: 'none', color: '#dc2626', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: '700' }}>Deconectează</button>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Main Tabs: Vedere Lunară / Agendă & Ședințe / Google Meet Hub */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '2px solid #e2e8f0',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { id: 'month', label: '📅 Vedere Lunară' },
            { id: 'agenda', label: `📋 Agendă & Ședințe (${filteredEvents.length})` },
            { id: 'meets', label: `🎥 Google Meet Hub (${googleMeetsCount})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveMainTab(tab.id)}
              style={{
                padding: '11px 20px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontWeight: activeMainTab === tab.id ? '800' : '600',
                color: activeMainTab === tab.id ? ACCENT : '#64748b',
                borderBottom: activeMainTab === tab.id ? `3px solid ${ACCENT}` : '3px solid transparent',
                marginBottom: '-2px',
                fontSize: '14px',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Category Filter */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="🔍 Caută ședință..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ ...inputStyle, width: '180px', padding: '7px 12px', fontSize: '13px' }}
          />

          <select
            value={activeCategoryFilter}
            onChange={e => setActiveCategoryFilter(e.target.value)}
            style={{ ...inputStyle, width: 'auto', padding: '7px 12px', fontSize: '13px', fontWeight: '700' }}
          >
            <option value="all">Toate activitățile</option>
            {Object.entries(CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ────────────────── TAB 1: VEDERE LUNARĂ ────────────────── */}
      {activeMainTab === 'month' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '18px', padding: '22px', border: '1.5px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
          
          {/* Calendar Month Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                style={{ padding: '7px 14px', cursor: 'pointer', backgroundColor: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '8px', fontWeight: '700' }}
              >
                ◀
              </button>
              <button
                onClick={() => { const now = new Date(); setCurrentDate(now); setSelectedDate(todayKey); }}
                style={{ padding: '7px 16px', cursor: 'pointer', backgroundColor: ACCENT, color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: '700' }}
              >
                Azi
              </button>
              <button
                onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                style={{ padding: '7px 14px', cursor: 'pointer', backgroundColor: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '8px', fontWeight: '700' }}
              >
                ▶
              </button>
              <h2 style={{ margin: '0 0 0 10px', fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>
                {monthNames[month]} {year}
              </h2>
            </div>

            <div style={{ fontSize: '13px', color: '#64748b' }}>
              💡 <em>Apasă pe o zi pentru a vedea detaliile sau a adăuga o ședință</em>
            </div>
          </div>

          {/* Days Header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center', marginBottom: '10px' }}>
            {daysOfWeek.map(d => (
              <div key={d} style={{ fontWeight: '800', color: '#64748b', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Month Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
            {Array.from({ length: startingOffset }).map((_, idx) => (
              <div key={`offset-${idx}`} style={{ minHeight: '110px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #e2e8f0' }} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const dateKey = formatDateKey(day);
              const isSelected = selectedDate === dateKey;
              const isToday = todayKey === dateKey;
              const isHovered = hoveredDay === dateKey;
              const dayEvents = filteredEvents
                .filter(ev => ev.date === dateKey)
                .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

              return (
                <div
                  key={day}
                  onClick={() => {
                    setSelectedDate(dateKey);
                    setInspectorOpen(true);
                  }}
                  onMouseEnter={() => setHoveredDay(dateKey)}
                  onMouseLeave={() => setHoveredDay(null)}
                  style={{
                    minHeight: '110px',
                    padding: '8px',
                    borderRadius: '12px',
                    border: isSelected ? `2.5px solid ${ACCENT}` : isToday ? '2px solid #10b981' : '1.5px solid #f1f5f9',
                    backgroundColor: isSelected ? ACCENT_LIGHTER : isHovered ? '#faf5ff' : '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 4px 12px rgba(90, 61, 92, 0.12)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: isToday || isSelected ? '800' : '700', fontSize: '14px', color: isToday ? '#10b981' : isSelected ? ACCENT : '#334155' }}>
                      {day}
                    </span>
                    {isToday && (
                      <span style={{ fontSize: '9px', backgroundColor: '#10b981', color: '#fff', padding: '1px 5px', borderRadius: '4px', fontWeight: '800' }}>
                        Azi
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflow: 'hidden' }}>
                    {dayEvents.slice(0, 3).map(ev => {
                      const cat = CATEGORIES[ev.category] || CATEGORIES.meeting;
                      const isLive = isMeetingLiveNow(ev);
                      return (
                        <div
                          key={ev.id}
                          style={{
                            fontSize: '11px',
                            backgroundColor: isLive ? '#fee2e2' : cat.bg,
                            color: isLive ? '#dc2626' : cat.color,
                            borderLeft: `3px solid ${isLive ? '#dc2626' : cat.color}`,
                            padding: '2px 5px',
                            borderRadius: '5px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            fontWeight: '700'
                          }}
                        >
                          {isLive && '🔴 '}{ev.hasGoogleMeet || ev.meetLink ? '🎥 ' : ''}{!ev.allDay && ev.startTime ? `${ev.startTime} ` : ''}{ev.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', paddingLeft: '3px' }}>
                        +{dayEvents.length - 3} altele
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ────────────────── TAB 2: AGENDĂ & ȘEDINȚE ────────────────── */}
      {activeMainTab === 'agenda' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '18px', padding: '24px', border: '1.5px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '800' }}>
              📋 Toate Activitățile & Ședințele Planificate ({filteredEvents.length})
            </h3>
            <button
              onClick={() => openAddModal()}
              style={{ padding: '8px 16px', background: ACCENT_GRADIENT, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
            >
              ➕ Adaugă Eveniment Nou
            </button>
          </div>

          {filteredEvents.length === 0 ? (
            <div style={{ padding: '50px 20px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>🌱</div>
              <p style={{ margin: 0, fontSize: '15px' }}>Nicio activitate găsită. Adaugă o ședință folosind butonul de mai sus!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredEvents
                .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''))
                .map(ev => {
                  const cat = CATEGORIES[ev.category] || CATEGORIES.meeting;
                  const prio = PRIORITIES[ev.priority] || PRIORITIES.medium;
                  const isLive = isMeetingLiveNow(ev);

                  return (
                    <div
                      key={ev.id}
                      style={{
                        padding: '16px 20px',
                        borderRadius: '14px',
                        backgroundColor: isLive ? '#fff1f2' : '#f8fafc',
                        border: '1.5px solid #e2e8f0',
                        borderLeft: `5px solid ${isLive ? '#dc2626' : cat.color}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '14px'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                            {ev.title}
                          </span>
                          {isLive && (
                            <span style={{ fontSize: '10px', backgroundColor: '#dc2626', color: '#fff', padding: '2px 8px', borderRadius: '6px', fontWeight: '800' }}>
                              🔴 LIVE ACUM
                            </span>
                          )}
                          <span style={{ fontSize: '11px', backgroundColor: cat.bg, color: cat.color, padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
                            {cat.icon} {cat.label}
                          </span>
                          <span style={{ fontSize: '11px', backgroundColor: prio.bg, color: prio.color, padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
                            {prio.label}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '6px', fontSize: '13px', color: '#2563eb', fontWeight: '700' }}>
                          <span>📅 {ev.date}</span>
                          <span>⏰ {ev.allDay ? 'Toată ziua' : `${ev.startTime} ${ev.endTime ? `– ${ev.endTime}` : ''}`}</span>
                        </div>

                        {ev.location && (
                          <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                            📍 {ev.location}
                          </div>
                        )}

                        {ev.attendees && (
                          <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                            👥 Invitați: {ev.attendees}
                          </div>
                        )}

                        {ev.description && (
                          <div style={{ fontSize: '13px', color: '#334155', marginTop: '6px' }}>
                            {ev.description}
                          </div>
                        )}

                        {(ev.meetLink || ev.hasGoogleMeet) && (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px' }}>
                            <a
                              href={ev.meetLink || 'https://meet.google.com/new'}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '12px',
                                backgroundColor: '#2563eb',
                                color: '#ffffff',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                fontWeight: '700',
                                textDecoration: 'none'
                              }}
                            >
                              🎥 Intră în Google Meet
                            </a>
                            <button
                              onClick={() => copyToClipboard(ev.meetLink || 'https://meet.google.com/new')}
                              style={{ fontSize: '12px', backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' }}
                            >
                              📋 Copiază Link
                            </button>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => handleEditClick(ev)} style={{ background: '#e2e8f0', border: 'none', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', fontSize: '13px' }}>✏️</button>
                        <button onClick={() => handleDeleteEvent(ev)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>✕</button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ────────────────── TAB 3: GOOGLE MEET HUB ────────────────── */}
      {activeMainTab === 'meets' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
          
          {/* Quick Meet Launcher Card */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '18px', padding: '26px', border: '1.5px solid #d8b4fe', boxShadow: '0 4px 16px rgba(124, 58, 237, 0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: '#f3e8ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                🎥
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b', fontWeight: '800' }}>
                  Lansează o Ședință Google Meet
                </h3>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Creează o cameră de ședință instant pentru echipă</span>
              </div>
            </div>

            <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.5, marginBottom: '20px' }}>
              Poți porni imediat un Google Meet cu un singur clic sau poți programa o conferință viitoare asociată proiectului tău de Ingineria Software.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a
                href="https://meet.google.com/new"
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: '12px 20px',
                  background: ACCENT_GRADIENT,
                  color: '#ffffff',
                  borderRadius: '10px',
                  fontWeight: '800',
                  fontSize: '14px',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: ACCENT_SHADOW
                }}
              >
                🚀 Deschide Google Meet Nou ↗
              </a>

              <button
                onClick={() => copyToClipboard('https://meet.google.com/new', 'Link-ul Google Meet a fost copiat!')}
                style={{
                  padding: '11px',
                  backgroundColor: '#f8fafc',
                  color: '#334155',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '10px',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                📋 Copiază Link-ul de Ședință
              </button>
            </div>
          </div>

          {/* Upcoming Video Meetings List */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '18px', padding: '26px', border: '1.5px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#1e293b', fontWeight: '800' }}>
              📹 Ședințe Video Planificate ({googleMeetsCount})
            </h3>

            {googleMeetsCount === 0 ? (
              <p style={{ color: '#64748b', fontStyle: 'italic', fontSize: '14px', margin: 0 }}>
                Nicio ședință video programată în prezent. Programează una folosind butonul <strong>„Adaugă Eveniment”</strong>!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {events
                  .filter(e => Boolean(e.meetLink || e.hasGoogleMeet || e.category === 'video_call'))
                  .map(ev => {
                    const isLive = isMeetingLiveNow(ev);
                    return (
                      <div
                        key={ev.id}
                        style={{
                          padding: '14px',
                          borderRadius: '12px',
                          backgroundColor: isLive ? '#fff1f2' : '#f8fafc',
                          border: '1.5px solid #e2e8f0',
                          borderLeft: `4px solid ${isLive ? '#dc2626' : '#7c3aed'}`
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '14px' }}>
                            {ev.title}
                          </span>
                          {isLive && (
                            <span style={{ fontSize: '9px', backgroundColor: '#dc2626', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>
                              🔴 LIVE
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: '#2563eb', fontWeight: '700', marginTop: '4px' }}>
                          📅 {ev.date} • ⏰ {ev.allDay ? 'Toată ziua' : ev.startTime}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          <a
                            href={ev.meetLink || 'https://meet.google.com/new'}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              fontSize: '11px',
                              backgroundColor: '#2563eb',
                              color: '#fff',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              fontWeight: '700',
                              textDecoration: 'none'
                            }}
                          >
                            Intră în Meet ↗
                          </a>
                          <button
                            onClick={() => copyToClipboard(ev.meetLink || 'https://meet.google.com/new')}
                            style={{ fontSize: '11px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', color: '#475569', padding: '5px 8px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700' }}
                          >
                            Copiază Link
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ────────────────── DAY INSPECTOR MODAL / DRAWER ────────────────── */}
      {inspectorOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            padding: '28px',
            maxWidth: '540px',
            width: '100%',
            maxHeight: '85vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '800' }}>
                  Activități: {selectedDate}
                </h3>
                <span style={{ fontSize: '13px', color: '#64748b' }}>{selectedDayEvents.length} evenimente programate</span>
              </div>
              <button
                onClick={() => setInspectorOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <button
                onClick={() => {
                  setInspectorOpen(false);
                  openAddModal(selectedDate);
                }}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: ACCENT_GRADIENT,
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: '800',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                ➕ Programează ceva pe {selectedDate}
              </button>
            </div>

            {selectedDayEvents.length === 0 ? (
              <p style={{ color: '#64748b', fontStyle: 'italic', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>
                Nicio activitate programată în această zi.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {selectedDayEvents.map(ev => {
                  const cat = CATEGORIES[ev.category] || CATEGORIES.meeting;
                  const isLive = isMeetingLiveNow(ev);

                  return (
                    <div
                      key={ev.id}
                      style={{
                        padding: '14px',
                        borderRadius: '12px',
                        backgroundColor: isLive ? '#fff1f2' : '#f8fafc',
                        border: '1.5px solid #e2e8f0',
                        borderLeft: `4px solid ${isLive ? '#dc2626' : cat.color}`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '15px' }}>
                              {ev.title}
                            </span>
                            {isLive && (
                              <span style={{ fontSize: '9px', backgroundColor: '#dc2626', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontWeight: '800' }}>
                                LIVE
                              </span>
                            )}
                            <span style={{ fontSize: '10px', backgroundColor: cat.bg, color: cat.color, padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                              {cat.label}
                            </span>
                          </div>

                          <div style={{ fontSize: '12px', color: '#2563eb', fontWeight: '700', marginTop: '4px' }}>
                            ⏰ {ev.allDay ? 'Toată ziua' : `${ev.startTime} ${ev.endTime ? `– ${ev.endTime}` : ''}`}
                          </div>

                          {ev.description && (
                            <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                              {ev.description}
                            </div>
                          )}

                          {ev.location && (
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                              📍 {ev.location}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            onClick={() => {
                              setInspectorOpen(false);
                              handleEditClick(ev);
                            }}
                            style={{ background: '#e2e8f0', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }}
                            title="Editează"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteEvent(ev)}
                            style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                            title="Șterge"
                          >
                            ✕
                          </button>
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
                              color: '#fff',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              fontWeight: '700',
                              textDecoration: 'none'
                            }}
                          >
                            🎥 Intră în Google Meet
                          </a>
                          <button
                            onClick={() => copyToClipboard(ev.meetLink || 'https://meet.google.com/new')}
                            style={{ fontSize: '11px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', color: '#475569', padding: '5px 8px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700' }}
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
      )}

      {/* ────────────────── STEP-BY-STEP EVENT CREATOR MODAL ────────────────── */}
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
            borderRadius: '20px',
            padding: '28px',
            maxWidth: '520px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '800' }}>
                {editingId ? '✏️ Editează Activitatea' : '➕ Programează Ședință / Eveniment'}
              </h3>
              <button
                onClick={() => setShowEventModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Steps Indicator */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              {[
                { step: 1, label: '1. Detalii' },
                { step: 2, label: '2. Orar' },
                { step: 3, label: '3. Google Meet' }
              ].map(s => (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => setModalStep(s.step)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '700',
                    backgroundColor: modalStep === s.step ? ACCENT : '#f1f5f9',
                    color: modalStep === s.step ? '#ffffff' : '#475569'
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSaveEvent} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* STEP 1: DETALII */}
              {modalStep === 1 && (
                <>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Titlu activitate *
                    </label>
                    <input
                      type="text"
                      placeholder="ex: Ședință Echipa IS, Predare Etapa 2"
                      value={eventForm.title}
                      onChange={e => setEventForm({ ...eventForm, title: e.target.value })}
                      required
                      style={inputStyle}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                        Categorie:
                      </label>
                      <select
                        value={eventForm.category}
                        onChange={e => setEventForm({ ...eventForm, category: e.target.value })}
                        style={{ ...inputStyle, cursor: 'pointer', fontWeight: '700' }}
                      >
                        {Object.entries(CATEGORIES).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                        Prioritate:
                      </label>
                      <select
                        value={eventForm.priority}
                        onChange={e => setEventForm({ ...eventForm, priority: e.target.value })}
                        style={{ ...inputStyle, cursor: 'pointer', fontWeight: '700' }}
                      >
                        {Object.entries(PRIORITIES).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Agendă sau Descriere:
                    </label>
                    <textarea
                      placeholder="Subiectele abordate în ședință..."
                      value={eventForm.description}
                      onChange={e => setEventForm({ ...eventForm, description: e.target.value })}
                      rows={3}
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setModalStep(2)}
                      style={{ padding: '9px 18px', backgroundColor: ACCENT, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Continuă la Orar ➔
                    </button>
                  </div>
                </>
              )}

              {/* STEP 2: ORAR */}
              {modalStep === 2 && (
                <>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Dată:
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={e => setSelectedDate(e.target.value)}
                      required
                      style={inputStyle}
                    />
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#334155', cursor: 'pointer', fontWeight: '700' }}>
                    <input
                      type="checkbox"
                      checked={eventForm.allDay}
                      onChange={e => setEventForm({ ...eventForm, allDay: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: ACCENT }}
                    />
                    Toată ziua
                  </label>

                  {!eventForm.allDay && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                          Ora de început:
                        </label>
                        <input
                          type="time"
                          value={eventForm.startTime}
                          onChange={e => setEventForm({ ...eventForm, startTime: e.target.value })}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                          Ora de sfârșit:
                        </label>
                        <input
                          type="time"
                          value={eventForm.endTime}
                          onChange={e => setEventForm({ ...eventForm, endTime: e.target.value })}
                          style={inputStyle}
                        />
                      </div>
                    </div>
                  )}

                  {!editingId && (
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                        Recurență:
                      </label>
                      <select
                        value={eventForm.recurrence}
                        onChange={e => setEventForm({ ...eventForm, recurrence: e.target.value })}
                        style={{ ...inputStyle, cursor: 'pointer', fontWeight: '600' }}
                      >
                        <option value="none">O singură dată</option>
                        <option value="DAILY">Zilnic (7 zile)</option>
                        <option value="WEEKLY">Săptămânal (4 săptămâni)</option>
                      </select>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setModalStep(1)}
                      style={{ padding: '9px 16px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      ⬅️ Înapoi
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalStep(3)}
                      style={{ padding: '9px 18px', backgroundColor: ACCENT, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Continuă la Google Meet ➔
                    </button>
                  </div>
                </>
              )}

              {/* STEP 3: GOOGLE MEET & INVITAȚI */}
              {modalStep === 3 && (
                <>
                  <div style={{
                    backgroundColor: eventForm.hasGoogleMeet ? '#f3e8ff' : '#f8fafc',
                    border: eventForm.hasGoogleMeet ? '1.5px solid #d8b4fe' : '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '14px'
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#7e22ce', cursor: 'pointer', fontWeight: '800' }}>
                      <input
                        type="checkbox"
                        checked={eventForm.hasGoogleMeet}
                        onChange={e => setEventForm({ ...eventForm, hasGoogleMeet: e.target.checked })}
                        style={{ width: '18px', height: '18px', accentColor: '#7e22ce' }}
                      />
                      🎥 Generează link Google Meet pentru această ședință
                    </label>

                    {eventForm.hasGoogleMeet && (
                      <div style={{ marginTop: '10px' }}>
                        <input
                          type="url"
                          placeholder="Link Google Meet (lăsat gol va folosi meet.google.com/new)"
                          value={eventForm.meetLink}
                          onChange={e => setEventForm({ ...eventForm, meetLink: e.target.value })}
                          style={inputStyle}
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Invitați (email-uri):
                    </label>
                    <input
                      type="text"
                      placeholder="email1@gmail.com, email2@gmail.com"
                      value={eventForm.attendees}
                      onChange={e => setEventForm({ ...eventForm, attendees: e.target.value })}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Locație fizică (opțional):
                    </label>
                    <input
                      type="text"
                      placeholder="ex: Sala C309, Biblioteca"
                      value={eventForm.location}
                      onChange={e => setEventForm({ ...eventForm, location: e.target.value })}
                      style={inputStyle}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setModalStep(2)}
                      style={{ padding: '9px 16px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      ⬅️ Înapoi
                    </button>
                    <button
                      type="submit"
                      style={{
                        padding: '10px 22px',
                        background: ACCENT_GRADIENT,
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '10px',
                        fontWeight: '800',
                        fontSize: '14px',
                        cursor: 'pointer',
                        boxShadow: ACCENT_SHADOW
                      }}
                    >
                      💾 {editingId ? 'Salvează Modificările' : 'Finalizează & Programează'}
                    </button>
                  </div>
                </>
              )}

            </form>
          </div>
        </div>
      )}

      {/* ────────────────── QUICK GOOGLE MEET MODAL ────────────────── */}
      {showMeetModal && (
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
            borderRadius: '20px',
            padding: '28px',
            maxWidth: '460px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b', fontWeight: '800' }}>
                🚀 Google Meet Instant
              </h3>
              <button onClick={() => setShowMeetModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.5, marginBottom: '20px' }}>
              Deschide imediat o nouă cameră Google Meet pentru echipa ta sau copiază link-ul direct pentru colegi.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a
                href="https://meet.google.com/new"
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: '12px',
                  background: ACCENT_GRADIENT,
                  color: '#ffffff',
                  borderRadius: '10px',
                  fontWeight: '800',
                  fontSize: '14px',
                  textDecoration: 'none',
                  textAlign: 'center'
                }}
              >
                🎥 Deschide Google Meet Nou ↗
              </a>

              <button
                onClick={() => {
                  copyToClipboard('https://meet.google.com/new', 'Link-ul Google Meet a fost copiat!');
                  setShowMeetModal(false);
                }}
                style={{
                  padding: '11px',
                  backgroundColor: '#f1f5f9',
                  color: '#334155',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '10px',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                📋 Copiază Link Google Meet
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Calendar;
