import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';

/* ───────────────────────── Stiluri & Teme ─────────────────────────────── */
const ACCENT          = '#5a3d5c';
const ACCENT_LIGHT    = '#7c5a7e';
const ACCENT_LIGHTER  = '#f6eff7';
const ACCENT_GRADIENT = 'linear-gradient(135deg, #5a3d5c 0%, #7c5a7e 100%)';
const ACCENT_SHADOW   = '0 6px 20px rgba(90, 61, 92, 0.22)';
const CARD_BORDER     = '1.5px solid #e2e8f0';
const CARD_RADIUS     = '16px';
const CARD_SHADOW     = '0 4px 16px rgba(0,0,0,0.04)';

/* ───────────────────────── Funcții Ajutătoare ─────────────────────────── */
const pad2 = (n) => String(n).padStart(2, '0');

function formatRelativeDate(dateStr) {
  if (!dateStr) return '';
  const today   = new Date();
  const target  = new Date(dateStr);
  const diffMs  = target - new Date(today.toDateString());
  const diffDay = Math.round(diffMs / 86400000);
  if (diffDay === 0)  return 'Azi';
  if (diffDay === 1)  return 'Mâine';
  if (diffDay === -1) return 'Ieri';
  if (diffDay > 1 && diffDay < 7) return `Peste ${diffDay} zile`;
  return target.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getDayName(dateStr) {
  if (!dateStr) return '';
  const days = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
  return days[new Date(dateStr).getDay()];
}

/* ══════════════════════════════════════════════════════════════════════════
   COMPONENTA PRINCIPALĂ CALENDAR
══════════════════════════════════════════════════════════════════════════ */
function Calendar({ currentUser }) {
  const navigate = useNavigate();
  const todayKey = new Date().toISOString().split('T')[0];

  const GOOGLE_CLIENT_ID = '600998152273-t58c63k8l1vk772cqrnhocil9f1qo35u.apps.googleusercontent.com';
  const CAL_API          = `${API_BASE_URL}/api/calendar`;
  const NOTIF_API        = `${API_BASE_URL}/api/notifications`;

  /* ── Tab activ: 'month' (Calendar) | 'agenda' (Agendă) | 'meets' (Google Meet Hub) ── */
  const [activeTab, setActiveTab] = useState('month');

  /* ── Navigare Calendar ── */
  const [currentDate,  setCurrentDate]  = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [nowTime,      setNowTime]      = useState(new Date());

  /* ── Lista Evenimente ── */
  const [events, setEvents] = useState(() => {
    try {
      const saved = localStorage.getItem('calendar_local_events');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  /* ── Modale & Stări UI ── */
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingId,      setEditingId]      = useState(null);
  const [inspectorOpen,  setInspectorOpen]  = useState(false);
  const [showMeetModal,  setShowMeetModal]  = useState(false);
  const [toastMessage,   setToastMessage]   = useState('');
  const [toastType,      setToastType]      = useState('success');
  const [loading,        setLoading]        = useState(false);
  const [hoveredDay,     setHoveredDay]     = useState(null);

  /* ── Căutare & Filtre Rapide (Maxim 3 opțiuni, fără dropdown stufos) ── */
  const [searchQuery, setSearchQuery] = useState('');
  // quickFilter: 'all' (Toate) | 'meets' (Doar Meet) | 'today' (Azi)
  const [quickFilter, setQuickFilter] = useState('all');

  /* ── Google OAuth Token ── */
  const [googleToken, setGoogleToken] = useState(() => localStorage.getItem('google_access_token') || null);
  const [tokenClient, setTokenClient] = useState(null);

  /* ── Formular Simplu (FĂRĂ PRIORITATE, FĂRĂ TIP ACTIVITATE) ── */
  const emptyForm = {
    title: '',
    startTime: '10:00',
    endTime: '11:00',
    allDay: false,
    hasGoogleMeet: true,
    meetLink: '',
    attendees: '',
    location: '',
    description: '',
    sendEmailAutomatically: true
  };
  const [eventForm, setEventForm] = useState(emptyForm);

  /* ── Date pentru Grila Calendarului ── */
  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie',
    'Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'
  ];
  const daysOfWeek = ['Lun','Mar','Mie','Joi','Vin','Sâm','Dum'];

  /* ════════════════ Efecte ════════════════ */

  // Ceas live pentru evidențierea ședințelor live
  useEffect(() => {
    const t = setInterval(() => setNowTime(new Date()), 20000);
    return () => clearInterval(t);
  }, []);

  // Salvare evenimente locale
  useEffect(() => {
    const local = events.filter(e => !e.isGoogle);
    localStorage.setItem('calendar_local_events', JSON.stringify(local));
  }, [events]);

  // Încărcare din backend
  useEffect(() => {
    fetch(`${CAL_API}/events`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (!Array.isArray(data) || data.length === 0) return;
        setEvents(prev => {
          const googleOnly = prev.filter(e => e.isGoogle);
          const mapped = data.map(b => ({
            id:           b.id ? `be-${b.id}` : `local-${Date.now()}`,
            backendId:    b.id,
            title:        b.title,
            description:  b.description || '',
            date:         b.eventDate,
            startTime:    b.startTime  || '10:00',
            endTime:      b.endTime    || '11:00',
            allDay:       Boolean(b.allDay),
            recurrence:   b.recurrence || 'none',
            hasGoogleMeet: Boolean(b.hasVideoMeet || b.meetLink),
            meetLink:     b.meetLink   || '',
            location:     b.location   || '',
            attendees:    b.attendees  || '',
            completed:    Boolean(b.completed),
            isGoogle:     false
          }));
          const ids = new Set(mapped.map(m => m.id));
          const remLocal = prev.filter(p => !p.isGoogle && !ids.has(p.id));
          return [...mapped, ...remLocal, ...googleOnly];
        });
      })
      .catch(() => {});
  }, [CAL_API]);

  // Google OAuth GSI
  useEffect(() => {
    const initGsi = () => {
      if (window.google?.accounts?.oauth2) {
        try {
          const client = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: [
              'https://www.googleapis.com/auth/calendar.events',
              'https://www.googleapis.com/auth/calendar'
            ].join(' '),
            callback: (resp) => {
              if (resp?.access_token) {
                setGoogleToken(resp.access_token);
                localStorage.setItem('google_access_token', resp.access_token);
                showToast('✅ Conectat cu Google Calendar!', 'success');
              }
            }
          });
          setTokenClient(client);
        } catch (_) {}
      }
    };
    initGsi();
    const t = setTimeout(initGsi, 1500);
    return () => clearTimeout(t);
  }, [GOOGLE_CLIENT_ID]);

  // Sincronizare Google Events dacă există token
  useEffect(() => {
    if (googleToken) fetchGoogleEvents();
  }, [googleToken, year, month]);

  /* ════════════════ Toast Notificare ════════════════ */
  const showToast = useCallback((msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 4500);
  }, []);

  const copyToClipboard = (text, label = '📋 Link copiat!') => {
    if (!text) return;
    navigator.clipboard.writeText(text).catch(() => {});
    showToast(label, 'success');
  };

  /* ════════════════ Google Calendar Fetch ════════════════ */
  const fetchGoogleEvents = () => {
    if (!googleToken) return;
    setLoading(true);
    const tMin = new Date(year, month, 1).toISOString();
    const tMax = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

    fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${tMin}&timeMax=${tMax}&singleEvents=true&orderBy=startTime`,
      { headers: { Authorization: `Bearer ${googleToken}` } }
    )
      .then(r => {
        if (r.status === 401) {
          setGoogleToken(null);
          localStorage.removeItem('google_access_token');
          throw new Error('Token expirat');
        }
        return r.json();
      })
      .then(data => {
        const parsed = (data.items || []).map(item => {
          const startRaw = item.start?.dateTime || item.start?.date;
          const endRaw   = item.end?.dateTime   || item.end?.date;
          const isAllDay = !item.start?.dateTime;
          const meetUri  =
            item.hangoutLink ||
            item.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri || '';

          return {
            id:           item.id,
            title:        item.summary || 'Fără titlu',
            description:  item.description || '',
            location:     item.location || '',
            date:         startRaw ? startRaw.split('T')[0] : '',
            startTime:    isAllDay ? '00:00' : startRaw.split('T')[1].substring(0, 5),
            endTime:      isAllDay ? '23:59' : (endRaw ? endRaw.split('T')[1].substring(0, 5) : ''),
            allDay:       isAllDay,
            hasGoogleMeet: Boolean(meetUri),
            meetLink:     meetUri,
            attendees:    item.attendees ? item.attendees.map(a => a.email).join(', ') : '',
            isGoogle:     true
          };
        });
        setEvents(prev => [...prev.filter(e => !e.isGoogle), ...parsed]);
        showToast('🔄 Calendar sincronizat cu Google!');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const handleGoogleAuth = () => {
    if (tokenClient) tokenClient.requestAccessToken({ prompt: 'consent' });
    else alert('Modulul Google se încarcă. Reîmprospătează pagina (F5).');
  };

  const handleDisconnectGoogle = () => {
    setGoogleToken(null);
    localStorage.removeItem('google_access_token');
    setEvents(prev => prev.filter(e => !e.isGoogle));
    showToast('Deconectat de la Google Calendar.');
  };

  /* ════════════════ Trimitere Automată Invitații pe Email (noreply) ════════════════ */
  const sendEmailInvitesAutomatically = async (title, dateStr, startTime, meetLink, attendeesStr, description) => {
    if (!attendeesStr || !attendeesStr.trim()) return false;

    const emailList = attendeesStr
      .split(',')
      .map(e => e.trim())
      .filter(e => e.includes('@'));

    if (emailList.length === 0) return false;

    // 1. Apel către backend Email Service (noreply@proiect-is.ro)
    try {
      await fetch(`${CAL_API}/send-invite-email`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmails:    emailList,
          eventTitle:  title,
          eventDate:   dateStr,
          startTime:   startTime,
          meetLink:    meetLink,
          senderName:  currentUser?.username || currentUser?.email || 'Echipa Proiect IS',
          description: description
        })
      });
    } catch (_) {}

    // 2. Apel către backend Notificări în aplicație
    try {
      await fetch(`${NOTIF_API}/calendar-invite`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderUserId:   currentUser?.id || null,
          senderName:     currentUser?.username || currentUser?.email || 'Utilizator',
          eventTitle:     title,
          eventDate:      dateStr,
          eventStartTime: startTime,
          meetLink:       meetLink,
          attendeeEmails: emailList
        })
      });
    } catch (_) {}

    // 3. Trimitere via Google Calendar API dacă utilizatorul este sincronizat
    if (googleToken) {
      try {
        const startIso = new Date(`${dateStr}T${startTime}:00`).toISOString();
        const endIso   = new Date(`${dateStr}T${startTime}:00`).toISOString();
        await fetch(
          'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all',
          {
            method:  'POST',
            headers: {
              Authorization:  `Bearer ${googleToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              summary:     title,
              description: description || '',
              start:       { dateTime: startIso },
              end:         { dateTime: endIso },
              attendees:   emailList.map(email => ({ email })),
              conferenceData: {
                createRequest: {
                  requestId: `meet-${Date.now()}`,
                  conferenceSolutionKey: { type: 'hangoutsMeet' }
                }
              }
            })
          }
        );
      } catch (_) {}
    }

    return true;
  };

  /* ════════════════ Retrimitere Invitație (1-Click) ════════════════ */
  const handleResendInvites = async (ev) => {
    if (!ev.attendees) return;
    const count = ev.attendees.split(',').filter(e => e.includes('@')).length;
    await sendEmailInvitesAutomatically(
      ev.title,
      ev.date,
      ev.startTime,
      ev.meetLink || 'https://meet.google.com/new',
      ev.attendees,
      ev.description
    );
    showToast(`✅ Invitație trimisă automat pe email la ${count} colegi de pe noreply@proiect-is.ro!`);
  };

  /* ════════════════ CRUD Ședințe ════════════════ */
  const isMeetingLiveNow = (ev) => {
    if (ev.date !== todayKey || ev.allDay || !ev.startTime) return false;
    const nowHM = nowTime.toTimeString().substring(0, 5);
    const endHM = ev.endTime || '23:59';
    return nowHM >= ev.startTime && nowHM <= endHM;
  };

  const openAddModal = (dateToUse = selectedDate) => {
    setSelectedDate(dateToUse);
    setEventForm({ ...emptyForm });
    setEditingId(null);
    setShowEventModal(true);
  };

  const handleEditClick = (ev) => {
    setEditingId(ev.id);
    setSelectedDate(ev.date);
    setEventForm({
      title:        ev.title,
      startTime:    ev.startTime    || '10:00',
      endTime:      ev.endTime      || '11:00',
      allDay:       Boolean(ev.allDay),
      hasGoogleMeet: Boolean(ev.meetLink || ev.hasGoogleMeet),
      meetLink:     ev.meetLink      || '',
      attendees:    ev.attendees     || '',
      location:     ev.location      || '',
      description:  ev.description   || '',
      sendEmailAutomatically: true
    });
    setShowEventModal(true);
  };

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    if (!eventForm.title.trim()) {
      showToast('⚠️ Completează titlul ședinței!', 'warn');
      return;
    }
    if (!eventForm.allDay && eventForm.endTime <= eventForm.startTime) {
      showToast('⚠️ Ora de sfârșit trebuie să fie după ora de început!', 'warn');
      return;
    }

    let computedMeetLink = eventForm.meetLink.trim();
    if (eventForm.hasGoogleMeet && !computedMeetLink) {
      computedMeetLink = 'https://meet.google.com/new';
    }

    // Editare
    if (editingId) {
      setEvents(prev => prev.map(ev => ev.id === editingId
        ? { ...ev, ...eventForm, meetLink: computedMeetLink, date: selectedDate }
        : ev
      ));

      const existing = events.find(ev => ev.id === editingId);
      if (existing?.backendId) {
        fetch(`${CAL_API}/events/${existing.backendId}`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title:        eventForm.title,
            description:  eventForm.description,
            eventDate:    selectedDate,
            startTime:    eventForm.startTime,
            endTime:      eventForm.endTime,
            allDay:       eventForm.allDay,
            hasVideoMeet: eventForm.hasGoogleMeet,
            meetLink:     computedMeetLink,
            location:     eventForm.location,
            attendees:    eventForm.attendees
          })
        }).catch(() => {});
      }

      setShowEventModal(false);
      showToast('✅ Ședința a fost actualizată!');
      return;
    }

    // Eveniment nou
    const baseItem = {
      id:           `local-${Date.now()}`,
      ...eventForm,
      date:         selectedDate,
      meetLink:     computedMeetLink,
      isGoogle:     false
    };

    try {
      const res = await fetch(`${CAL_API}/events`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:        eventForm.title,
          description:  eventForm.description,
          eventDate:    selectedDate,
          startTime:    eventForm.startTime,
          endTime:      eventForm.endTime,
          allDay:       eventForm.allDay,
          hasVideoMeet: eventForm.hasGoogleMeet,
          meetLink:     computedMeetLink,
          location:     eventForm.location,
          attendees:    eventForm.attendees,
          userId:       currentUser?.id || null
        })
      });
      if (res.ok) {
        const saved = await res.json();
        if (saved?.id) baseItem.backendId = saved.id;
      }
    } catch (_) {}

    setEvents(prev => [...prev, baseItem]);

    // Trimitere automată invitații prin noreply
    const hasAttendees = Boolean(eventForm.attendees && eventForm.attendees.trim());
    if (hasAttendees && eventForm.sendEmailAutomatically) {
      const count = eventForm.attendees.split(',').filter(e => e.includes('@')).length;
      sendEmailInvitesAutomatically(
        eventForm.title,
        selectedDate,
        eventForm.startTime,
        computedMeetLink,
        eventForm.attendees,
        eventForm.description
      );
      showToast(`✅ Ședință salvată! Invitațiile pe email au fost trimise la ${count} colegi de pe noreply@proiect-is.ro!`);
    } else {
      showToast('✨ Ședință programată cu succes!');
    }

    setShowEventModal(false);
  };

  const handleDeleteEvent = (ev) => {
    if (!window.confirm(`Ștergi definitiv ședința "${ev.title}"?`)) return;
    if (ev.backendId) {
      fetch(`${CAL_API}/events/${ev.backendId}`, { method: 'DELETE' }).catch(() => {});
    }
    setEvents(prev => prev.filter(e => e.id !== ev.id));
    showToast('Ședință eliminată.');
  };

  /* ════════════════ Filtrare & Căutare Fluentă ════════════════ */
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const startingOffset  = (firstDayOfMonth + 6) % 7;
  const daysInMonth     = new Date(year, month + 1, 0).getDate();

  const formatDateKey = (day) => `${year}-${pad2(month + 1)}-${pad2(day)}`;

  // Filtrare simplificată (Toate / Doar Meet / Azi + Text Căutare)
  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return events.filter(ev => {
      // Filtru rapid (Maxim 3 opțiuni)
      if (quickFilter === 'meets' && !ev.meetLink && !ev.hasGoogleMeet) return false;
      if (quickFilter === 'today' && ev.date !== todayKey) return false;

      // Căutare text (Instant eliminare/filtrare)
      if (q) {
        const matchesTitle = ev.title?.toLowerCase().includes(q);
        const matchesDesc  = ev.description?.toLowerCase().includes(q);
        const matchesLoc   = ev.location?.toLowerCase().includes(q);
        const matchesAtt   = ev.attendees?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesLoc && !matchesAtt) return false;
      }

      return true;
    });
  }, [events, quickFilter, searchQuery, todayKey]);

  const selectedDayEvents = useMemo(() =>
    filteredEvents
      .filter(ev => ev.date === selectedDate)
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')),
    [filteredEvents, selectedDate]
  );

  const agendaEvents = useMemo(() =>
    [...filteredEvents].sort(
      (a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || '')
    ),
    [filteredEvents]
  );

  const meetsEvents = useMemo(() =>
    events.filter(e => Boolean(e.meetLink || e.hasGoogleMeet))
          .sort((a, b) => a.date.localeCompare(b.date)),
    [events]
  );

  /* ════════════════ Stiluri Input Curate ════════════════ */
  const inputStyle = {
    padding: '11px 14px',
    borderRadius: '10px',
    border: '1.5px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontSize: '14px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'inherit'
  };

  const labelStyle = {
    fontSize: '13px',
    fontWeight: '700',
    color: '#334155',
    display: 'block',
    marginBottom: '6px'
  };

  /* ════════════════ RENDER ════════════════ */
  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '24px 20px', fontFamily: 'Inter, system-ui, sans-serif', color: '#0f172a' }}>

      {/* ── Toast Alert ── */}
      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px',
          backgroundColor: toastType === 'warn' ? '#78350f' : '#1e293b',
          color: '#ffffff', padding: '14px 22px', borderRadius: '12px',
          boxShadow: '0 12px 28px rgba(0,0,0,0.3)', zIndex: 99999,
          fontWeight: '700', fontSize: '14px', maxWidth: '420px',
          borderLeft: `5px solid ${toastType === 'warn' ? '#f59e0b' : '#10b981'}`,
          lineHeight: 1.4
        }}>
          {toastMessage}
        </div>
      )}

      {/* ══════════════════ BARA DE SUS (TOP BAR - CURĂȚATĂ DE STATISTICI) ══════════════════ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '12px' }}>

        <div>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '9px 16px', backgroundColor: '#ffffff',
              border: CARD_BORDER, borderRadius: '10px',
              fontWeight: '700', cursor: 'pointer', color: '#475569',
              display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px'
            }}
          >
            ⬅️ Înapoi la Dashboard
          </button>
        </div>

        {/* Butoane de acțiune */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => openAddModal()}
            style={{
              padding: '10px 18px', cursor: 'pointer',
              background: ACCENT_GRADIENT, color: '#ffffff',
              border: 'none', borderRadius: '10px', fontWeight: '800',
              fontSize: '13px', display: 'flex', alignItems: 'center',
              gap: '6px', boxShadow: ACCENT_SHADOW
            }}
          >
            ➕ Adaugă Ședință / Meet
          </button>

          <button
            onClick={() => setShowMeetModal(true)}
            style={{
              padding: '10px 16px', cursor: 'pointer',
              backgroundColor: '#ffffff', color: '#1e293b',
              border: '1.5px solid #d8b4fe', borderRadius: '10px',
              fontWeight: '700', fontSize: '13px',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            🚀 Google Meet Rapid
          </button>

          {/* Sincronizare Google */}
          {!googleToken ? (
            <button
              onClick={handleGoogleAuth}
              style={{
                padding: '9px 16px', backgroundColor: '#ffffff', color: '#1e293b',
                border: CARD_BORDER, borderRadius: '10px', fontWeight: '700',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px'
              }}
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" style={{ width: '16px' }} />
              Sincronizează cu Google
            </button>
          ) : (
            <div style={{
              display: 'flex', gap: '6px', alignItems: 'center',
              backgroundColor: '#ffffff', padding: '5px 10px',
              borderRadius: '10px', border: '1.5px solid #bbf7d0'
            }}>
              <span style={{ color: '#059669', fontWeight: '700', fontSize: '12px' }}>● Sincronizat</span>
              <button onClick={fetchGoogleEvents} disabled={loading}
                style={{ background: '#eff6ff', border: 'none', color: '#2563eb', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: '700' }}>
                {loading ? '...' : 'Sync'}
              </button>
              <button onClick={handleDisconnectGoogle}
                style={{ background: '#fee2e2', border: 'none', color: '#dc2626', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: '700' }}>
                Deconectează
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════ TAB-URILE & BARA DE CĂUTARE FLUENTĂ ══════════════════ */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '2px solid #e2e8f0', marginBottom: '20px',
        flexWrap: 'wrap', gap: '12px'
      }}>
        {/* Tab-uri principale */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {[
            { id: 'month',  label: '📅 Vedere Lunară' },
            { id: 'agenda', label: `📋 Agendă Ședințe (${filteredEvents.length})` },
            { id: 'meets',  label: `🎥 Google Meet Hub (${meetsEvents.length})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '11px 20px', border: 'none', background: 'none',
                cursor: 'pointer', fontWeight: activeTab === tab.id ? '800' : '600',
                color: activeTab === tab.id ? ACCENT : '#64748b',
                borderBottom: activeTab === tab.id ? `3px solid ${ACCENT}` : '3px solid transparent',
                marginBottom: '-2px', fontSize: '14px', transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Căutare rapidă cu buton de eliminat text [✕] și exact 3 filtre simple */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>

          {/* Câmp căutare fluent cu buton de clear instant [✕] ca la Ctrl+F */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: '10px', fontSize: '14px', color: '#94a3b8', pointerEvents: 'none' }}>
              🔍
            </span>
            <input
              type="text"
              placeholder="Caută ședință..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                ...inputStyle,
                width: '185px',
                paddingLeft: '32px',
                paddingRight: searchQuery ? '28px' : '10px',
                paddingTop: '8px',
                paddingBottom: '8px',
                fontSize: '13px'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                title="Șterge text căutare (Clear)"
                style={{
                  position: 'absolute', right: '8px', background: '#e2e8f0',
                  border: 'none', borderRadius: '50%', width: '18px', height: '18px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: '800', color: '#475569', cursor: 'pointer'
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* MAXIM 3 FILTRE SIMPLE (FĂRĂ DROPDOWN COMPLICAT DE CATEGORII) */}
          <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '10px' }}>
            {[
              { id: 'all',   label: 'Toate' },
              { id: 'meets', label: '🎥 Meet' },
              { id: 'today', label: '⭐ Azi' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setQuickFilter(f.id)}
                style={{
                  padding: '5px 12px', border: 'none', borderRadius: '8px',
                  cursor: 'pointer', fontWeight: '700', fontSize: '12px',
                  backgroundColor: quickFilter === f.id ? '#ffffff' : 'transparent',
                  color: quickFilter === f.id ? ACCENT : '#64748b',
                  boxShadow: quickFilter === f.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* ══════════════════ TAB 1: VEDERE LUNARĂ ══════════════════ */}
      {activeTab === 'month' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: CARD_RADIUS, padding: '22px', border: CARD_BORDER, boxShadow: CARD_SHADOW }}>

          {/* Butoane navigație lună */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                style={{ padding: '7px 14px', cursor: 'pointer', backgroundColor: '#f8fafc', border: CARD_BORDER, borderRadius: '8px', fontWeight: '800' }}
              >
                ◀
              </button>
              <button
                onClick={() => { const n = new Date(); setCurrentDate(n); setSelectedDate(todayKey); }}
                style={{ padding: '7px 16px', cursor: 'pointer', backgroundColor: ACCENT, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '800' }}
              >
                Azi
              </button>
              <button
                onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                style={{ padding: '7px 14px', cursor: 'pointer', backgroundColor: '#f8fafc', border: CARD_BORDER, borderRadius: '8px', fontWeight: '800' }}
              >
                ▶
              </button>
              <h2 style={{ margin: '0 0 0 10px', fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>
                {monthNames[month]} {year}
              </h2>
            </div>
            <span style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>
              Apasă pe o zi pentru a vedea detaliile
            </span>
          </div>

          {/* Antet Zile */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center', marginBottom: '8px' }}>
            {daysOfWeek.map(d => (
              <div key={d} style={{ fontWeight: '800', color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '4px 0' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Grilă Lunar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
            {Array.from({ length: startingOffset }).map((_, i) => (
              <div key={`off-${i}`} style={{ minHeight: '105px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px dashed #e2e8f0' }} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day      = idx + 1;
              const dateKey  = formatDateKey(day);
              const isSel    = selectedDate === dateKey;
              const isToday  = todayKey    === dateKey;
              const isHov    = hoveredDay  === dateKey;
              const dayEvs   = filteredEvents
                .filter(ev => ev.date === dateKey)
                .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

              return (
                <div
                  key={day}
                  onClick={() => { setSelectedDate(dateKey); setInspectorOpen(true); }}
                  onMouseEnter={() => setHoveredDay(dateKey)}
                  onMouseLeave={() => setHoveredDay(null)}
                  style={{
                    minHeight: '105px', padding: '8px',
                    borderRadius: '12px',
                    border: isSel ? `2.5px solid ${ACCENT}` : isToday ? '2px solid #10b981' : '1.5px solid #f1f5f9',
                    backgroundColor: isSel ? ACCENT_LIGHTER : isHov ? '#faf5ff' : '#ffffff',
                    cursor: 'pointer', display: 'flex', flexDirection: 'column',
                    transition: 'all 0.15s ease',
                    boxShadow: isSel ? '0 4px 12px rgba(90,61,92,0.12)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{
                      fontWeight: isToday || isSel ? '800' : '700',
                      fontSize: '14px',
                      color: isToday ? '#10b981' : isSel ? ACCENT : '#334155'
                    }}>
                      {day}
                    </span>
                    {isToday && (
                      <span style={{ fontSize: '9px', backgroundColor: '#10b981', color: '#fff', padding: '1px 5px', borderRadius: '4px', fontWeight: '800' }}>
                        Azi
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflow: 'hidden' }}>
                    {dayEvs.slice(0, 3).map(ev => {
                      const isLive = isMeetingLiveNow(ev);
                      return (
                        <div
                          key={ev.id}
                          style={{
                            fontSize: '11px',
                            backgroundColor: isLive ? '#fee2e2' : '#ede9fe',
                            color: isLive ? '#dc2626' : '#6d28d9',
                            borderLeft: `3px solid ${isLive ? '#dc2626' : '#7c3aed'}`,
                            padding: '2px 5px', borderRadius: '4px',
                            whiteSpace: 'nowrap', overflow: 'hidden',
                            textOverflow: 'ellipsis', fontWeight: '700'
                          }}
                        >
                          {isLive ? '🔴 ' : ''}{ev.hasGoogleMeet || ev.meetLink ? '🎥 ' : ''}
                          {!ev.allDay && ev.startTime ? `${ev.startTime} ` : ''}{ev.title}
                        </div>
                      );
                    })}
                    {dayEvs.length > 3 && (
                      <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', paddingLeft: '4px' }}>
                        +{dayEvs.length - 3} altele
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════ TAB 2: AGENDĂ ȘEDINȚE (SIMPLĂ, CURATĂ, RAPIDĂ) ══════════════════ */}
      {activeTab === 'agenda' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '17px', color: '#0f172a', fontWeight: '800' }}>
              📋 Ședințe & Întâlniri Programate ({agendaEvents.length})
            </h3>
            <button
              onClick={() => openAddModal()}
              style={{
                padding: '9px 18px', background: ACCENT_GRADIENT, color: '#fff',
                border: 'none', borderRadius: '10px', fontWeight: '800',
                fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              ➕ Adaugă Ședință
            </button>
          </div>

          {agendaEvents.length === 0 ? (
            <div style={{
              padding: '60px 20px', textAlign: 'center', color: '#94a3b8',
              backgroundColor: '#ffffff', borderRadius: CARD_RADIUS, border: CARD_BORDER
            }}>
              <div style={{ fontSize: '44px', marginBottom: '12px' }}>🌱</div>
              <p style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#475569' }}>
                Nicio ședință găsită {searchQuery ? `pentru "${searchQuery}"` : ''}.
              </p>
              <button
                onClick={() => openAddModal()}
                style={{ marginTop: '14px', padding: '9px 18px', background: ACCENT_GRADIENT, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
              >
                + Adaugă Ședință
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {agendaEvents.map(ev => {
                const isLive  = isMeetingLiveNow(ev);
                const relDate = formatRelativeDate(ev.date);
                const dayName = getDayName(ev.date);
                const isPast  = ev.date < todayKey;
                const meetUrl = ev.meetLink || 'https://meet.google.com/new';

                return (
                  <div
                    key={ev.id}
                    style={{
                      backgroundColor: '#ffffff', borderRadius: '14px',
                      border: CARD_BORDER,
                      borderLeft: `5px solid ${isLive ? '#dc2626' : isPast ? '#94a3b8' : '#7c3aed'}`,
                      boxShadow: CARD_SHADOW, padding: '16px 20px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      gap: '16px', flexWrap: 'wrap',
                      opacity: isPast ? 0.75 : 1
                    }}
                  >
                    {/* Detalii ședință */}
                    <div style={{ flex: 1, minWidth: '260px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                          {ev.title}
                        </span>
                        {isLive && (
                          <span style={{ fontSize: '10px', backgroundColor: '#dc2626', color: '#fff', padding: '2px 8px', borderRadius: '6px', fontWeight: '800' }}>
                            🔴 LIVE ACUM
                          </span>
                        )}
                        {(ev.meetLink || ev.hasGoogleMeet) && (
                          <span style={{ fontSize: '11px', backgroundColor: '#ede9fe', color: '#7c3aed', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
                            🎥 Google Meet
                          </span>
                        )}
                      </div>

                      {/* Orar și dată */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '13px', color: '#475569', fontWeight: '600', flexWrap: 'wrap' }}>
                        <span style={{ color: isPast ? '#94a3b8' : '#2563eb', fontWeight: '700' }}>
                          📅 {dayName}, {ev.date}
                        </span>
                        {relDate && (
                          <span style={{
                            fontSize: '11px', fontWeight: '700',
                            color: relDate === 'Azi' ? '#10b981' : relDate === 'Mâine' ? '#f59e0b' : '#64748b',
                            backgroundColor: relDate === 'Azi' ? '#d1fae5' : relDate === 'Mâine' ? '#fef3c7' : '#f1f5f9',
                            padding: '2px 8px', borderRadius: '99px'
                          }}>
                            {relDate}
                          </span>
                        )}
                        <span>
                          ⏰ {ev.allDay ? 'Toată ziua' : `${ev.startTime}${ev.endTime ? ` – ${ev.endTime}` : ''}`}
                        </span>
                        {ev.location && (
                          <span style={{ color: '#64748b' }}>📍 {ev.location}</span>
                        )}
                      </div>

                      {/* Descriere */}
                      {ev.description && (
                        <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748b', lineHeight: 1.4 }}>
                          {ev.description}
                        </p>
                      )}

                      {/* Invitați */}
                      {ev.attendees && (
                        <div style={{ marginTop: '6px', fontSize: '12px', color: '#7c5a7e', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <strong>👥 Invitați:</strong>
                          {ev.attendees.split(',').map((email, i) => (
                            <span key={i} style={{ backgroundColor: '#f3e8ff', color: '#6b21a8', padding: '1px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                              {email.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Butoane acțiune: Google Meet + Retrimite Invitații pe Email (1-Click) */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <a
                        href={meetUrl}
                        target="_blank" rel="noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          fontSize: '13px', backgroundColor: '#2563eb', color: '#ffffff',
                          padding: '8px 14px', borderRadius: '8px', fontWeight: '700',
                          textDecoration: 'none', whiteSpace: 'nowrap'
                        }}
                      >
                        🎥 Intră în Meet
                      </a>

                      {/* Buton 1-Click: trimite automat pe email fără popup compose */}
                      {ev.attendees && (
                        <button
                          onClick={() => handleResendInvites(ev)}
                          title="Trimite automat invitațiile pe email tuturor colegilor de pe noreply@proiect-is.ro"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            fontSize: '12px', backgroundColor: '#fef3c7', color: '#92400e',
                            border: '1.5px solid #fde68a', padding: '7px 12px', borderRadius: '8px',
                            fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap'
                          }}
                        >
                          📧 Retrimite Email
                        </button>
                      )}

                      <button
                        onClick={() => copyToClipboard(meetUrl)}
                        title="Copiază Link Meet"
                        style={{ padding: '7px 10px', backgroundColor: '#f8fafc', border: CARD_BORDER, borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}
                      >
                        🔗 Copiază
                      </button>

                      <button
                        onClick={() => handleEditClick(ev)}
                        title="Editează"
                        style={{ padding: '7px 10px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}
                      >
                        ✏️
                      </button>

                      <button
                        onClick={() => handleDeleteEvent(ev)}
                        title="Șterge"
                        style={{ padding: '7px 10px', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '800', fontSize: '12px' }}
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
      )}

      {/* ══════════════════ TAB 3: GOOGLE MEET HUB ══════════════════ */}
      {activeTab === 'meets' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: '20px', alignItems: 'start' }}>

          {/* Card lansare rapidă */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: CARD_RADIUS, padding: '28px', border: '1.5px solid #d8b4fe', boxShadow: '0 4px 16px rgba(124,58,237,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #f3e8ff, #ede9fe)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                🎥
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b', fontWeight: '800' }}>
                  Lansează Google Meet
                </h3>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Pornește instant sau programează</span>
              </div>
            </div>

            <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.5, marginBottom: '20px' }}>
              Poți genera imediat o conferință Google Meet pentru colegii tăi și le poți trimite automat link-ul pe email.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a
                href="https://meet.google.com/new"
                target="_blank" rel="noreferrer"
                style={{
                  padding: '13px', background: ACCENT_GRADIENT, color: '#ffffff',
                  borderRadius: '10px', fontWeight: '800', fontSize: '14px',
                  textDecoration: 'none', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  gap: '8px', boxShadow: ACCENT_SHADOW
                }}
              >
                🚀 Deschide Google Meet Nou ↗
              </a>

              <button
                onClick={() => copyToClipboard('https://meet.google.com/new', 'Link Google Meet copiat!')}
                style={{
                  padding: '11px', backgroundColor: '#f8fafc',
                  color: '#334155', border: CARD_BORDER, borderRadius: '10px',
                  fontWeight: '700', fontSize: '13px', cursor: 'pointer'
                }}
              >
                📋 Copiază Link-ul de Ședință
              </button>

              <button
                onClick={() => openAddModal()}
                style={{
                  padding: '11px', backgroundColor: ACCENT_LIGHTER,
                  color: ACCENT, border: `1.5px solid ${ACCENT}30`,
                  borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer'
                }}
              >
                ➕ Programează Ședință & Trimite Email
              </button>
            </div>
          </div>

          {/* Listă ședințe video planificate */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: CARD_RADIUS, padding: '24px', border: CARD_BORDER, boxShadow: CARD_SHADOW }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '17px', color: '#1e293b', fontWeight: '800' }}>
              📹 Ședințe Video Planificate ({meetsEvents.length})
            </h3>

            {meetsEvents.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: '36px', marginBottom: '10px' }}>📹</div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '700' }}>
                  Nicio ședință video programată în prezent.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {meetsEvents.map(ev => {
                  const isLive = isMeetingLiveNow(ev);
                  const isPast = ev.date < todayKey;
                  const meetUrl = ev.meetLink || 'https://meet.google.com/new';

                  return (
                    <div
                      key={ev.id}
                      style={{
                        padding: '14px 16px', borderRadius: '12px',
                        backgroundColor: isLive ? '#fff1f2' : isPast ? '#fafafa' : '#f8fafc',
                        border: CARD_BORDER,
                        borderLeft: `4px solid ${isLive ? '#dc2626' : isPast ? '#94a3b8' : '#7c3aed'}`,
                        opacity: isPast ? 0.7 : 1
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '14px' }}>
                              {ev.title}
                            </span>
                            {isLive && (
                              <span style={{ fontSize: '10px', backgroundColor: '#dc2626', color: '#fff', padding: '2px 7px', borderRadius: '99px', fontWeight: '800' }}>
                                LIVE
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: '12px', color: '#2563eb', fontWeight: '700', marginTop: '4px' }}>
                            📅 {ev.date} • ⏰ {ev.allDay ? 'Toată ziua' : ev.startTime}
                          </div>

                          {ev.attendees && (
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                              👥 Invitați: {ev.attendees}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          <a
                            href={meetUrl}
                            target="_blank" rel="noreferrer"
                            style={{
                              fontSize: '12px', backgroundColor: '#2563eb', color: '#fff',
                              padding: '6px 12px', borderRadius: '7px', fontWeight: '700',
                              textDecoration: 'none'
                            }}
                          >
                            Intră în Meet
                          </a>

                          {ev.attendees && (
                            <button
                              onClick={() => handleResendInvites(ev)}
                              style={{ fontSize: '12px', backgroundColor: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', padding: '6px 10px', borderRadius: '7px', cursor: 'pointer', fontWeight: '700' }}
                              title="Retrimite invitația pe email"
                            >
                              📧 Retrimite
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════ MODAL SIMPLU: PROGRAMAT ȘEDINȚĂ / MEET ══════════════════ */}
      {showEventModal && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, padding: '20px' }}
          onClick={() => setShowEventModal(false)}
        >
          <div
            style={{ backgroundColor: '#ffffff', borderRadius: '20px', padding: '28px', maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Titlu Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '800' }}>
                  {editingId ? '✏️ Editează Ședința' : '➕ Programează Ședință'}
                </h3>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Completează detaliile și invitațiile se trimit automat</span>
              </div>
              <button onClick={() => setShowEventModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>

            <form onSubmit={handleSaveEvent} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* 1. Titlu */}
              <div>
                <label style={labelStyle}>Titlu ședință *</label>
                <input
                  type="text"
                  placeholder="ex: Ședință Echipa IS, Verificare Etapa 2"
                  value={eventForm.title}
                  onChange={e => setEventForm({ ...eventForm, title: e.target.value })}
                  required
                  autoFocus
                  style={inputStyle}
                />
              </div>

              {/* 2. Dată & Ore */}
              <div>
                <label style={labelStyle}>Data</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155', cursor: 'pointer', fontWeight: '700' }}>
                  <input
                    type="checkbox"
                    checked={eventForm.allDay}
                    onChange={e => setEventForm({ ...eventForm, allDay: e.target.checked })}
                    style={{ width: '16px', height: '16px', accentColor: ACCENT }}
                  />
                  Toată ziua
                </label>
              </div>

              {!eventForm.allDay && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Ora de început</label>
                    <input
                      type="time"
                      value={eventForm.startTime}
                      onChange={e => setEventForm({ ...eventForm, startTime: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Ora de sfârșit</label>
                    <input
                      type="time"
                      value={eventForm.endTime}
                      onChange={e => setEventForm({ ...eventForm, endTime: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}

              {/* 3. Google Meet Link */}
              <div style={{
                backgroundColor: eventForm.hasGoogleMeet ? '#f5f3ff' : '#f8fafc',
                border: eventForm.hasGoogleMeet ? '1.5px solid #c4b5fd' : '1px solid #e2e8f0',
                borderRadius: '12px', padding: '14px'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#6d28d9', cursor: 'pointer', fontWeight: '800' }}>
                  <input
                    type="checkbox"
                    checked={eventForm.hasGoogleMeet}
                    onChange={e => setEventForm({ ...eventForm, hasGoogleMeet: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: '#7c3aed' }}
                  />
                  🎥 Generează link Google Meet pentru această ședință
                </label>

                {eventForm.hasGoogleMeet && (
                  <div style={{ marginTop: '10px' }}>
                    <input
                      type="url"
                      placeholder="Link Google Meet personalizat (opțional, lăsat liber folosește meet.google.com/new)"
                      value={eventForm.meetLink}
                      onChange={e => setEventForm({ ...eventForm, meetLink: e.target.value })}
                      style={{ ...inputStyle, fontSize: '13px' }}
                    />
                  </div>
                )}
              </div>

              {/* 4. Invitați (Email-uri) */}
              <div>
                <label style={labelStyle}>
                  📧 Invitați (adrese de email, separate prin virgulă)
                </label>
                <input
                  type="text"
                  placeholder="coleg1@gmail.com, coleg2@gmail.com"
                  value={eventForm.attendees}
                  onChange={e => setEventForm({ ...eventForm, attendees: e.target.value })}
                  style={inputStyle}
                />
              </div>

              {/* 5. Opțiune automată de trimitere pe email prin noreply */}
              {eventForm.attendees && (
                <div style={{ backgroundColor: '#ecfdf5', border: '1.5px solid #a7f3d0', borderRadius: '10px', padding: '10px 14px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#065f46', cursor: 'pointer', fontWeight: '700' }}>
                    <input
                      type="checkbox"
                      checked={eventForm.sendEmailAutomatically}
                      onChange={e => setEventForm({ ...eventForm, sendEmailAutomatically: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: '#059669' }}
                    />
                    ✉️ Trimite automat invitațiile pe email (noreply@proiect-is.ro) la salvare
                  </label>
                </div>
              )}

              {/* 6. Descriere / Agendă (opțional) */}
              <div>
                <label style={labelStyle}>Descriere / Agendă (opțional)</label>
                <textarea
                  placeholder="Subiectele abordate la ședință..."
                  value={eventForm.description}
                  onChange={e => setEventForm({ ...eventForm, description: e.target.value })}
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              {/* Butoane acțiune salvare */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  style={{
                    padding: '11px 18px', backgroundColor: '#f1f5f9',
                    color: '#475569', border: 'none', borderRadius: '10px',
                    fontWeight: '700', cursor: 'pointer', fontSize: '13px'
                  }}
                >
                  Anulează
                </button>

                <button
                  type="submit"
                  style={{
                    padding: '11px 24px', background: ACCENT_GRADIENT,
                    color: '#ffffff', border: 'none', borderRadius: '10px',
                    fontWeight: '800', fontSize: '14px', cursor: 'pointer',
                    boxShadow: ACCENT_SHADOW, display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  💾 {editingId ? 'Salvează Modificările' : 'Programează & Trimite Invitații'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ══════════════════ MODAL QUICK GOOGLE MEET ══════════════════ */}
      {showMeetModal && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, padding: '20px' }}
          onClick={() => setShowMeetModal(false)}
        >
          <div
            style={{ backgroundColor: '#ffffff', borderRadius: '20px', padding: '28px', maxWidth: '440px', width: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.22)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b', fontWeight: '800' }}>
                🚀 Google Meet Instant
              </h3>
              <button onClick={() => setShowMeetModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>

            <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.5, marginBottom: '20px' }}>
              Deschide imediat o nouă cameră Google Meet pentru echipa ta sau copiază link-ul direct pentru colegi.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a
                href="https://meet.google.com/new" target="_blank" rel="noreferrer"
                style={{ padding: '13px', background: ACCENT_GRADIENT, color: '#fff', borderRadius: '10px', fontWeight: '800', fontSize: '14px', textDecoration: 'none', textAlign: 'center' }}
              >
                🎥 Deschide Google Meet Nou ↗
              </a>
              <button
                onClick={() => { copyToClipboard('https://meet.google.com/new', 'Link Google Meet copiat!'); setShowMeetModal(false); }}
                style={{ padding: '11px', backgroundColor: '#f1f5f9', color: '#334155', border: CARD_BORDER, borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
              >
                📋 Copiază Link Google Meet
              </button>
              <button
                onClick={() => { setShowMeetModal(false); openAddModal(); }}
                style={{ padding: '11px', backgroundColor: ACCENT_LIGHTER, color: ACCENT, border: `1.5px solid ${ACCENT}30`, borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
              >
                ➕ Programează Ședință & Trimite Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ MODAL DAY INSPECTOR ══════════════════ */}
      {inspectorOpen && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}
          onClick={() => setInspectorOpen(false)}
        >
          <div
            style={{ backgroundColor: '#ffffff', borderRadius: '20px', padding: '28px', maxWidth: '520px', width: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.22)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '800' }}>
                  {getDayName(selectedDate)}, {selectedDate}
                </h3>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  {selectedDayEvents.length} {selectedDayEvents.length === 1 ? 'ședință' : 'ședințe'}
                </span>
              </div>
              <button
                onClick={() => setInspectorOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8', flexShrink: 0 }}
              >
                ✕
              </button>
            </div>

            <button
              onClick={() => { setInspectorOpen(false); openAddModal(selectedDate); }}
              style={{ width: '100%', padding: '11px', background: ACCENT_GRADIENT, color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', marginBottom: '16px' }}
            >
              ➕ Programează ședință pe {selectedDate}
            </button>

            {selectedDayEvents.length === 0 ? (
              <p style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '14px', textAlign: 'center', padding: '24px 0' }}>
                Nicio ședință programată în această zi.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {selectedDayEvents.map(ev => {
                  const isLive = isMeetingLiveNow(ev);
                  const meetUrl = ev.meetLink || 'https://meet.google.com/new';

                  return (
                    <div
                      key={ev.id}
                      style={{
                        padding: '14px', borderRadius: '12px',
                        backgroundColor: isLive ? '#fff1f2' : '#f8fafc',
                        border: CARD_BORDER,
                        borderLeft: `4px solid ${isLive ? '#dc2626' : '#7c3aed'}`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '15px' }}>{ev.title}</span>
                            {isLive && <span style={{ fontSize: '9px', backgroundColor: '#dc2626', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontWeight: '800' }}>LIVE</span>}
                            {(ev.meetLink || ev.hasGoogleMeet) && <span style={{ fontSize: '10px', backgroundColor: '#ede9fe', color: '#7c3aed', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>🎥 Meet</span>}
                          </div>
                          <div style={{ fontSize: '12px', color: '#2563eb', fontWeight: '700', marginTop: '4px' }}>
                            ⏰ {ev.allDay ? 'Toată ziua' : `${ev.startTime}${ev.endTime ? ` – ${ev.endTime}` : ''}`}
                          </div>
                          {ev.description && <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px', lineHeight: 1.4 }}>{ev.description}</div>}
                          {ev.location && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>📍 {ev.location}</div>}
                          {ev.attendees && <div style={{ fontSize: '11px', color: '#7c5a7e', marginTop: '4px' }}>👥 Invitați: {ev.attendees}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                          <button onClick={() => { setInspectorOpen(false); handleEditClick(ev); }} style={{ background: '#e2e8f0', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                          <button onClick={() => handleDeleteEvent(ev)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>✕</button>
                        </div>
                      </div>

                      {(ev.meetLink || ev.hasGoogleMeet) && (
                        <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                          <a href={meetUrl} target="_blank" rel="noreferrer"
                            style={{ fontSize: '11px', backgroundColor: '#2563eb', color: '#fff', padding: '5px 10px', borderRadius: '6px', fontWeight: '700', textDecoration: 'none' }}>
                            🎥 Intră în Meet
                          </a>
                          {ev.attendees && (
                            <button
                              onClick={() => handleResendInvites(ev)}
                              style={{ fontSize: '11px', backgroundColor: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', padding: '5px 8px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700' }}
                            >
                              📧 Retrimite Email
                            </button>
                          )}
                          <button onClick={() => copyToClipboard(meetUrl)}
                            style={{ fontSize: '11px', backgroundColor: '#fff', border: '1px solid #cbd5e1', color: '#475569', padding: '5px 8px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700' }}>
                            Copiază
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

    </div>
  );
}

export default Calendar;
