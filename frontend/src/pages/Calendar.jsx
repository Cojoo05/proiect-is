import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const CATEGORIES = {
  task: { label: '📋 Task / De făcut', color: '#10b981', bg: '#d1fae5', googleColorId: '10' },
  meeting: { label: '🤝 Ședință / Meeting', color: '#3b82f6', bg: '#dbeafe', googleColorId: '9' },
  deadline: { label: '🔥 Deadline / Urgent', color: '#ef4444', bg: '#fee2e2', googleColorId: '11' },
  personal: { label: '🎓 Personal / Studiu', color: '#8b5cf6', bg: '#ede9fe', googleColorId: '3' }
};

const PRIORITIES = {
  low: { label: '🟢 Scăzută', color: '#16a34a', bg: '#dcfce7' },
  medium: { label: '🟡 Medie', color: '#d97706', bg: '#fef3c7' },
  high: { label: '🔴 Ridicată', color: '#dc2626', bg: '#fee2e2' }
};

function Calendar({ currentUser }) {
  const navigate = useNavigate();
  const GOOGLE_CLIENT_ID = '581947728431-1lqjbaf8ae86ig53pg7do170mdpmlgrd.apps.googleusercontent.com';
  const KANBAN_API_URL = 'http://localhost:8080/api/tasks';

  const todayKey = new Date().toISOString().split('T')[0];

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [nowTime, setNowTime] = useState(new Date());

  const [events, setEvents] = useState(() => {
    const saved = localStorage.getItem('calendar_local_events');
    return saved ? JSON.parse(saved) : [];
  });

  const [newEvent, setNewEvent] = useState({
    title: '',
    startTime: '09:00',
    endTime: '10:00',
    allDay: false,
    category: 'task',
    priority: 'medium',
    recurrence: 'none',
    createMeet: false,
    attendees: '',
    location: '',
    description: ''
  });

  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

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

  useEffect(() => {
    const timer = setInterval(() => setNowTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const localOnly = events.filter(e => !e.isGoogle);
    localStorage.setItem('calendar_local_events', JSON.stringify(localOnly));
  }, [events]);

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

  const mapGoogleColorToCategory = (colorId, summary = '') => {
    if (colorId === '10' || summary.toLowerCase().includes('[task]')) return 'task';
    if (colorId === '11') return 'deadline';
    if (colorId === '3') return 'personal';
    return 'meeting';
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
          const savedPriority = item.extendedProperties?.private?.priority || 'medium';
          const savedCategory = item.extendedProperties?.private?.category || mapGoogleColorToCategory(item.colorId, item.summary);

          return {
            id: item.id,
            title: item.summary || 'Fără titlu',
            description: item.description || '',
            location: item.location || '',
            date: startRaw ? startRaw.split('T')[0] : '',
            startTime: isAllDay ? '00:00' : startRaw.split('T')[1].substring(0, 5),
            endTime: isAllDay ? '23:59' : (endRaw ? endRaw.split('T')[1].substring(0, 5) : ''),
            allDay: isAllDay,
            category: savedCategory,
            priority: savedPriority,
            meetLink: meetUri,
            attendees: item.attendees ? item.attendees.map(a => a.email).join(', ') : '',
            completed: item.summary?.startsWith('✓ ') || false,
            htmlLink: item.htmlLink,
            isGoogle: true
          };
        });

        setEvents(prev => {
          const localOnly = prev.filter(e => !e.isGoogle);
          return [...localOnly, ...googleParsed];
        });
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (googleToken) {
      fetchGoogleEvents();
    }
  }, [googleToken, currentDate]);

  const handleSyncKanbanTasks = () => {
    setLoading(true);
    fetch(KANBAN_API_URL)
      .then(res => {
        if (!res.ok) throw new Error(' Eroare conexiune backend');
        return res.json();
      })
      .then(data => {
        if (!Array.isArray(data)) return;
        const imported = data.map(t => ({
          id: `kanban-${t.id}`,
          title: `[Kanban] ${t.title || t.name || 'Task'}`,
          description: t.description || '',
          date: t.dueDate ? t.dueDate.split('T')[0] : selectedDate,
          startTime: '10:00',
          endTime: '11:00',
          allDay: false,
          category: 'task',
          priority: t.priority?.toLowerCase() === 'high' ? 'high' : t.priority?.toLowerCase() === 'low' ? 'low' : 'medium',
          completed: t.status === 'DONE' || t.status === 'COMPLETED',
          isGoogle: false,
          isKanban: true
        }));

        setEvents(prev => {
          const withoutOldKanban = prev.filter(e => !e.isKanban);
          return [...withoutOldKanban, ...imported];
        });
        alert(`S-au sincronizat ${imported.length} task-uri din Kanban Board!`);
      })
      .catch(() => {
        alert('Nu s-au putut prelua task-urile din backend (verifică dacă serverul Spring Boot rulează pe portul 8080).');
      })
      .finally(() => setLoading(false));
  };

  const handleGoogleAuth = () => {
    if (tokenClient) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      alert('Scriptul Google încă se încarcă. Reîncarcă pagina (F5).');
    }
  };

  const handleDisconnectGoogle = () => {
    setGoogleToken(null);
    localStorage.removeItem('google_access_token');
    setEvents(prev => prev.filter(e => !e.isGoogle));
  };

  const resetForm = () => {
    setNewEvent({
      title: '',
      startTime: '09:00',
      endTime: '10:00',
      allDay: false,
      category: 'task',
      priority: 'medium',
      recurrence: 'none',
      createMeet: false,
      attendees: '',
      location: '',
      description: ''
    });
    setEditingId(null);
  };

  const buildLocalInstances = (baseItem) => {
    const instances = [baseItem];
    if (baseItem.recurrence === 'DAILY') {
      for (let i = 1; i < 7; i++) {
        const d = new Date(baseItem.date);
        d.setDate(d.getDate() + i);
        instances.push({ ...baseItem, id: `${baseItem.id}-r${i}`, date: d.toISOString().split('T')[0] });
      }
    } else if (baseItem.recurrence === 'WEEKLY') {
      for (let i = 1; i < 4; i++) {
        const d = new Date(baseItem.date);
        d.setDate(d.getDate() + i * 7);
        instances.push({ ...baseItem, id: `${baseItem.id}-r${i}`, date: d.toISOString().split('T')[0] });
      }
    }
    return instances;
  };

  const handleSaveEvent = (e) => {
    e.preventDefault();
    if (!newEvent.title.trim()) return alert('Completează titlul!');

    if (!newEvent.allDay && newEvent.endTime <= newEvent.startTime) {
      return alert('Ora de sfârșit trebuie să fie după ora de început!');
    }

    const catInfo = CATEGORIES[newEvent.category] || CATEGORIES.task;
    const attendeeList = newEvent.attendees
      ? newEvent.attendees.split(',').map(em => em.trim()).filter(em => em.includes('@')).map(email => ({ email }))
      : [];

    if (editingId) {
      const targetEv = events.find(ev => ev.id === editingId);

      if (targetEv?.isGoogle && googleToken) {
        const startObj = newEvent.allDay
          ? { date: selectedDate }
          : { dateTime: new Date(`${selectedDate}T${newEvent.startTime}:00`).toISOString() };
        const endObj = newEvent.allDay
          ? { date: selectedDate }
          : { dateTime: new Date(`${selectedDate}T${newEvent.endTime}:00`).toISOString() };

        fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${editingId}?sendUpdates=all`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${googleToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            summary: newEvent.title,
            description: newEvent.description,
            location: newEvent.location,
            colorId: catInfo.googleColorId,
            start: startObj,
            end: endObj,
            attendees: attendeeList.length > 0 ? attendeeList : undefined,
            extendedProperties: {
              private: { priority: newEvent.priority, category: newEvent.category }
            }
          })
        })
          .then(res => res.json())
          .then(() => {
            fetchGoogleEvents();
            resetForm();
          });
      } else {
        setEvents(prev => prev.map(ev => ev.id === editingId ? { ...ev, ...newEvent, date: selectedDate } : ev));
        resetForm();
      }
      return;
    }

    if (googleToken) {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Bucharest';
      const startObj = newEvent.allDay
        ? { date: selectedDate }
        : { dateTime: new Date(`${selectedDate}T${newEvent.startTime}:00`).toISOString(), timeZone };
      const endObj = newEvent.allDay
        ? { date: selectedDate }
        : { dateTime: new Date(`${selectedDate}T${newEvent.endTime}:00`).toISOString(), timeZone };

      const recurrenceRule =
        newEvent.recurrence === 'DAILY'
          ? ['RRULE:FREQ=DAILY;COUNT=7']
          : newEvent.recurrence === 'WEEKLY'
            ? ['RRULE:FREQ=WEEKLY;COUNT=4']
            : undefined;

      const googlePayload = {
        summary: newEvent.title,
        description: newEvent.description,
        location: newEvent.location,
        colorId: catInfo.googleColorId,
        start: startObj,
        end: endObj,
        recurrence: recurrenceRule,
        attendees: attendeeList.length > 0 ? attendeeList : undefined,
        extendedProperties: {
          private: { priority: newEvent.priority, category: newEvent.category }
        }
      };

      if (newEvent.createMeet) {
        googlePayload.conferenceData = {
          createRequest: {
            requestId: `meet-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' }
          }
        };
      }

      fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${googleToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(googlePayload)
      })
        .then(res => res.json())
        .then(() => {
          fetchGoogleEvents();
          resetForm();
        })
        .catch(err => console.error(err));
    } else {
      const baseLocal = {
        id: `local-${Date.now()}`,
        ...newEvent,
        date: selectedDate,
        meetLink: newEvent.createMeet ? 'https://meet.google.com/new' : '',
        completed: false,
        isGoogle: false
      };
      const instances = buildLocalInstances(baseLocal);
      setEvents(prev => [...prev, ...instances]);
      resetForm();
    }
  };

  const handleEditClick = (ev) => {
    setEditingId(ev.id);
    setSelectedDate(ev.date);
    setNewEvent({
      title: ev.title.replace(/^✓\s*/, ''),
      startTime: ev.startTime || '09:00',
      endTime: ev.endTime || '10:00',
      allDay: ev.allDay || false,
      category: ev.category || 'task',
      priority: ev.priority || 'medium',
      recurrence: 'none',
      createMeet: Boolean(ev.meetLink),
      attendees: ev.attendees || '',
      location: ev.location || '',
      description: ev.description || ''
    });
  };

  const handleToggleComplete = (ev) => {
    const updatedStatus = !ev.completed;
    const updatedTitle = updatedStatus
      ? (ev.title.startsWith('✓ ') ? ev.title : `✓ ${ev.title}`)
      : ev.title.replace(/^✓\s*/, '');

    setEvents(prev =>
      prev.map(item => item.id === ev.id ? { ...item, completed: updatedStatus, title: updatedTitle } : item)
    );

    if (ev.isGoogle && googleToken) {
      fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${ev.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${googleToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ summary: updatedTitle })
      }).catch(err => console.error(err));
    }
  };

  const handleDeleteEvent = (ev) => {
    if (!window.confirm(`Ștergi "${ev.title}"?`)) return;

    if (ev.isGoogle && googleToken) {
      fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${ev.id}?sendUpdates=all`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${googleToken}` }
      })
        .then(() => setEvents(prev => prev.filter(item => item.id !== ev.id)))
        .catch(err => console.error(err));
    } else {
      setEvents(prev => prev.filter(item => item.id !== ev.id));
    }
  };

  const getNextUpcomingEventInfo = () => {
    const nowHM = nowTime.toTimeString().substring(0, 5);
    const todayUpcoming = events
      .filter(ev => ev.date === todayKey && !ev.completed && !ev.allDay && ev.startTime > nowHM)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (todayUpcoming.length === 0) return null;

    const nextEv = todayUpcoming[0];
    const [h, m] = nextEv.startTime.split(':').map(Number);
    const target = new Date(nowTime);
    target.setHours(h, m, 0, 0);
    const diffMins = Math.max(1, Math.round((target - nowTime) / 60000));
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;

    return {
      title: nextEv.title,
      timeStr: hrs > 0 ? `în ${hrs}h ${mins}m` : `în ${mins} min`,
      startTime: nextEv.startTime
    };
  };

  const nextUpcoming = getNextUpcomingEventInfo();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const startingOffset = (firstDayOfMonth + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const formatDateKey = (day) => {
    const formattedMonth = String(month + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    return `${year}-${formattedMonth}-${formattedDay}`;
  };

  const filteredEvents = events.filter(ev => {
    const matchesCategory = activeFilter === 'all' || ev.category === activeFilter;
    const matchesSearch =
      ev.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ev.description && ev.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (ev.location && ev.location.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const selectedDayEvents = filteredEvents
    .filter(ev => ev.date === selectedDate)
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

  const totalMonthEvents = events.filter(ev => ev.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).length;
  const todayEventsCount = events.filter(ev => ev.date === todayKey).length;
  const pendingTasksCount = events.filter(ev => ev.category === 'task' && !ev.completed).length;

  const inputStyle = {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    fontSize: '14px',
    outline: 'none'
  };

  return (
    <div style={{ padding: '24px', fontFamily: 'Inter, system-ui, sans-serif', maxWidth: '1360px', margin: '0 auto', color: '#1e293b' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{ padding: '10px 18px', cursor: 'pointer', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            ⬅️ Înapoi la Dashboard
          </button>

          <button
            onClick={handleSyncKanbanTasks}
            style={{ padding: '10px 16px', cursor: 'pointer', backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)' }}
          >
            📥 Sincronizează Kanban
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {!googleToken ? (
            <button
              onClick={handleGoogleAuth}
              style={{
                padding: '10px 20px',
                backgroundColor: '#ffffff',
                color: '#1e293b',
                border: '2px solid #3b82f6',
                borderRadius: '8px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)'
              }}
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" style={{ width: '18px', height: '18px' }} />
              Conectează Google Calendar
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', backgroundColor: '#fff', padding: '6px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <span style={{ color: '#10b981', fontWeight: '700', fontSize: '14px' }}>● Google Sincronizat</span>
              <button
                onClick={fetchGoogleEvents}
                style={{ padding: '6px 10px', backgroundColor: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
              >
                🔄 Sync
              </button>
              <button
                onClick={handleDisconnectGoogle}
                style={{ padding: '6px 10px', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
              >
                Deconectează
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', padding: '18px 22px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)' }}>
          <div style={{ fontSize: '13px', opacity: 0.85 }}>Luna curentă ({monthNames[month]})</div>
          <div style={{ fontSize: '28px', fontWeight: '800', marginTop: '4px' }}>{totalMonthEvents} activități</div>
        </div>

        <div style={{ backgroundColor: '#fff', padding: '18px 22px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Programate Azi ({todayKey})</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>{todayEventsCount} evenimente</div>
        </div>

        <div style={{ backgroundColor: '#fff', padding: '18px 22px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Task-uri active de rezolvat</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#10b981', marginTop: '4px' }}>{pendingTasksCount} task-uri</div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', color: 'white', padding: '18px 22px', borderRadius: '12px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>⏳ URMĂTOAREA ACTIVITATE AZI</div>
          {nextUpcoming ? (
            <>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#38bdf8', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {nextUpcoming.timeStr} ({nextUpcoming.startTime})
              </div>
              <div style={{ fontSize: '13px', color: '#e2e8f0', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {nextUpcoming.title}
              </div>
            </>
          ) : (
            <div style={{ fontSize: '15px', fontWeight: '600', color: '#cbd5e1', marginTop: '8px' }}>
              Nicio activitate rămasă azi
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', backgroundColor: '#fff', padding: '16px 24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '24px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} style={{ padding: '8px 14px', cursor: 'pointer', backgroundColor: '#f1f5f9', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: '600' }}>◀</button>
          <button onClick={() => { const now = new Date(); setCurrentDate(now); setSelectedDate(todayKey); }} style={{ padding: '8px 16px', cursor: 'pointer', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600' }}>Azi</button>
          <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} style={{ padding: '8px 14px', cursor: 'pointer', backgroundColor: '#f1f5f9', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: '600' }}>▶</button>
          <h2 style={{ margin: '0 0 0 12px', color: '#0f172a', fontSize: '22px' }}>
            {monthNames[month]} {year} {loading && <span style={{ fontSize: '13px', color: '#3b82f6' }}>(Se sincronizează...)</span>}
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="🔍 Caută eveniment sau task..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ ...inputStyle, width: '220px', padding: '8px 12px' }}
          />

          <select
            value={activeFilter}
            onChange={e => setActiveFilter(e.target.value)}
            style={{ ...inputStyle, padding: '8px 12px', cursor: 'pointer', fontWeight: '600' }}
          >
            <option value="all">Toate categoriile</option>
            <option value="task">📋 Doar Task-uri</option>
            <option value="meeting">🤝 Doar Ședințe</option>
            <option value="deadline">🔥 Doar Deadline-uri</option>
            <option value="personal">🎓 Doar Personal</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2.1fr 1fr', gap: '24px', alignItems: 'start' }}>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '12px', textAlign: 'center' }}>
            {daysOfWeek.map(d => (
              <div key={d} style={{ fontWeight: '700', color: '#475569', padding: '6px 0', fontSize: '13px', textTransform: 'uppercase' }}>
                {d}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
            {Array.from({ length: startingOffset }).map((_, idx) => (
              <div key={`offset-${idx}`} style={{ minHeight: '95px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #e2e8f0' }} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const dateKey = formatDateKey(day);
              const isSelected = selectedDate === dateKey;
              const isToday = todayKey === dateKey;
              const dayEvents = filteredEvents
                .filter(ev => ev.date === dateKey)
                .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDate(dateKey)}
                  style={{
                    minHeight: '95px',
                    padding: '8px',
                    borderRadius: '10px',
                    border: isSelected ? '2px solid #2563eb' : isToday ? '2px solid #10b981' : '1px solid #e2e8f0',
                    backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: isToday || isSelected ? '800' : '600', fontSize: '14px', color: isToday ? '#10b981' : isSelected ? '#2563eb' : '#1e293b' }}>
                      {day}
                    </span>
                    {isToday && <span style={{ fontSize: '10px', backgroundColor: '#10b981', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>Azi</span>}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                    {dayEvents.slice(0, 3).map(ev => {
                      const cat = CATEGORIES[ev.category] || CATEGORIES.meeting;
                      return (
                        <div
                          key={ev.id}
                          title={`${ev.allDay ? 'Toată ziua' : `${ev.startTime} -${ev.endTime || ''}`} | ${ev.title}`}
                          style={{
                            fontSize: '11px',
                            backgroundColor: cat.bg,
                            color: cat.color,
                            borderLeft: `3px solid ${cat.color}`,
                            padding: '2px 5px',
                            borderRadius: '4px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            fontWeight: '600',
                            textDecoration: ev.completed ? 'line-through' : 'none',
                            opacity: ev.completed ? 0.65 : 1
                          }}
                        >
                          {ev.priority === 'high' ? '🔴 ' : ''}{!ev.allDay && ev.startTime ? `${ev.startTime} ` : ''}{ev.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', paddingLeft: '4px' }}>
                        +{dayEvents.length - 3} altele
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', padding: '22px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: '18px' }}>
                {editingId ? '✏️ Editează Activitatea' : '➕ Adaugă Eveniment / Task'}
              </h3>
              {editingId && (
                <button onClick={resetForm} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>
                  Anulează
                </button>
              )}
            </div>

            <p style={{ fontSize: '13px', color: '#475569', marginTop: 0, marginBottom: '14px' }}>
              Data selectată: <b style={{ color: '#2563eb' }}>{selectedDate}</b>
            </p>

            <form onSubmit={handleSaveEvent} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="text"
                placeholder="Titlu (ex: Predare Proiect IS, Daily Scrum)"
                value={newEvent.title}
                onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                required
                style={inputStyle}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Tip activitate:</label>
                  <select
                    value={newEvent.category}
                    onChange={e => setNewEvent({ ...newEvent, category: e.target.value })}
                    style={{ ...inputStyle, cursor: 'pointer', fontWeight: '600' }}
                  >
                    {Object.entries(CATEGORIES).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Prioritate:</label>
                  <select
                    value={newEvent.priority}
                    onChange={e => setNewEvent({ ...newEvent, priority: e.target.value })}
                    style={{ ...inputStyle, cursor: 'pointer', fontWeight: '600' }}
                  >
                    {Object.entries(PRIORITIES).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#334155', cursor: 'pointer', fontWeight: '600' }}>
                  <input
                    type="checkbox"
                    checked={newEvent.allDay}
                    onChange={e => setNewEvent({ ...newEvent, allDay: e.target.checked })}
                  />
                  Toată ziua
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#2563eb', cursor: 'pointer', fontWeight: '700' }}>
                  <input
                    type="checkbox"
                    checked={newEvent.createMeet}
                    onChange={e => setNewEvent({ ...newEvent, createMeet: e.target.checked })}
                  />
                  🎥 Generează Google Meet
                </label>
              </div>

              {!newEvent.allDay && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Ora de început:</label>
                    <input
                      type="time"
                      value={newEvent.startTime}
                      onChange={e => setNewEvent({ ...newEvent, startTime: e.target.value })}
                      style={inputStyle}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Ora de sfârșit:</label>
                    <input
                      type="time"
                      value={newEvent.endTime}
                      onChange={e => setNewEvent({ ...newEvent, endTime: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}

              {!editingId && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>🔁 Repetare (Recurență):</label>
                  <select
                    value={newEvent.recurrence}
                    onChange={e => setNewEvent({ ...newEvent, recurrence: e.target.value })}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="none">O singură dată</option>
                    <option value="DAILY">Zilnic (următoarele 7 zile)</option>
                    <option value="WEEKLY">Săptămânal (următoarele 4 săptămâni)</option>
                  </select>
                </div>
              )}

              <input
                type="text"
                placeholder="📧 Invită colegi (email1@gmail.com, email2@gmail.com)"
                value={newEvent.attendees}
                onChange={e => setNewEvent({ ...newEvent, attendees: e.target.value })}
                style={inputStyle}
              />

              <input
                type="text"
                placeholder="📍 Locație sau Sală (opțional)"
                value={newEvent.location}
                onChange={e => setNewEvent({ ...newEvent, location: e.target.value })}
                style={inputStyle}
              />

              <textarea
                placeholder="📝 Descriere, sub-taskuri sau notițe..."
                value={newEvent.description}
                onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                rows={2}
                style={{ ...inputStyle, resize: 'vertical' }}
              />

              <button
                type="submit"
                style={{
                  padding: '12px',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '14px',
                  marginTop: '4px',
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
                }}
              >
                {editingId
                  ? '💾 Salvează Modificările'
                  : googleToken
                    ? '🚀 Adaugă și Sincronizează în Google'
                    : '➕ Salvează în Calendar'}
              </button>
            </form>
          </div>

          <div style={{ backgroundColor: '#ffffff', padding: '22px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#0f172a', fontSize: '17px' }}>
              Agenda zilei: {selectedDate} ({selectedDayEvents.length})
            </h3>

            {selectedDayEvents.length === 0 ? (
              <p style={{ color: '#64748b', fontStyle: 'italic', fontSize: '14px', margin: 0 }}>
                Nicio activitate programată în această zi.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {selectedDayEvents.map(ev => {
                  const cat = CATEGORIES[ev.category] || CATEGORIES.meeting;
                  const prio = PRIORITIES[ev.priority] || PRIORITIES.medium;
                  return (
                    <div
                      key={ev.id}
                      style={{
                        borderLeft: `5px solid ${cat.color}`,
                        padding: '12px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        borderLeftWidth: '5px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '10px',
                        opacity: ev.completed ? 0.65 : 1
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          {ev.category === 'task' && (
                            <input
                              type="checkbox"
                              checked={ev.completed || false}
                              onChange={() => handleToggleComplete(ev)}
                              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                              title="Marchează task-ul ca finalizat"
                            />
                          )}
                          <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '15px', textDecoration: ev.completed ? 'line-through' : 'none' }}>
                            {ev.title}
                          </span>
                          <span style={{ fontSize: '10px', backgroundColor: cat.bg, color: cat.color, padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                            {cat.label.split(' ')[0]} {ev.isGoogle ? '• Google' : ev.isKanban ? '• Kanban' : '• Local'}
                          </span>
                          <span style={{ fontSize: '10px', backgroundColor: prio.bg, color: prio.color, padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                            {prio.label}
                          </span>
                        </div>

                        <div style={{ fontSize: '12px', color: '#2563eb', fontWeight: '600', marginTop: '6px' }}>
                          ⏰ {ev.allDay ? 'Toată ziua' : `${ev.startTime} ${ev.endTime ? `– ${ev.endTime}` : ''}`}
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
                          <div style={{ fontSize: '13px', color: '#334155', marginTop: '6px', whiteSpace: 'pre-wrap' }}>
                            {ev.description}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
                          {ev.meetLink && (
                            <a
                              href={ev.meetLink}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '12px',
                                backgroundColor: '#2563eb',
                                color: '#ffffff',
                                padding: '5px 10px',
                                borderRadius: '6px',
                                fontWeight: '700',
                                textDecoration: 'none'
                              }}
                            >
                              🎥 Intră în Google Meet
                            </a>
                          )}

                          {ev.htmlLink && (
                            <a
                              href={ev.htmlLink}
                              target="_blank"
                              rel="noreferrer"
                              style={{ fontSize: '11px', color: '#2563eb', textDecoration: 'underline', fontWeight: '600' }}
                            >
                              Deschide în Google Calendar ↗
                            </a>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => handleEditClick(ev)}
                          style={{ background: '#e2e8f0', border: 'none', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', fontSize: '12px' }}
                          title="Editează"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteEvent(ev)}
                          style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                          title="Șterge"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Calendar;