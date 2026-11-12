import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';

/* ───────────────────────── Categorii Activități ───────────────────────── */
const CATEGORIES = {
  meeting:      { label: 'Ședință / Sync Echipă',   color: '#3b82f6', bg: '#dbeafe', icon: '🤝' },
  video_call:   { label: 'Google Meet',              color: '#8b5cf6', bg: '#ede9fe', icon: '🎥' },
  deadline:     { label: 'Termen Limită / Predare',  color: '#ef4444', bg: '#fee2e2', icon: '🔥' },
  consultation: { label: 'Laborator / Curs',         color: '#10b981', bg: '#d1fae5', icon: '🎓' },
  presentation: { label: 'Prezentare & Demo',        color: '#f59e0b', bg: '#fef3c7', icon: '🚀' },
  workshop:     { label: 'Workshop / Brainstorming', color: '#ec4899', bg: '#fce7f3', icon: '💡' }
};

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

/**
 * Generează link pentru deschiderea Gmail Web Compose cu toate datele gata completate
 */
function buildGmailComposeUrl(attendees, title, date, startTime, meetLink, description) {
  const to = (attendees || '')
    .split(',')
    .map(e => e.trim())
    .filter(e => e.includes('@'))
    .join(',');

  const subject = `Invitație Google Meet: ${title || 'Ședință Echipă'}`;

  const body =
`Salut!

Ai fost invitat(ă) la o ședință pe Google Meet:

📌 Titlu: ${title || 'Ședință'}
📅 Dată: ${date || 'Stabilita de comun acord'}
⏰ Oră: ${startTime || 'La timp'}
${description ? `📝 Detalii / Agendă: ${description}\n` : ''}
🎥 Link Google Meet pentru a intra în ședință:
${meetLink || 'https://meet.google.com/new'}

Apasă pe link-ul de mai sus la ora stabilită pentru a te alătura apelului.

Echipa Proiect Ingineria Software`;

  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Fallback mailto: pentru orice client nativ de email (Outlook, Thunderbird, Mail)
 */
function buildMailtoUrl(attendees, title, date, startTime, meetLink, description) {
  const to = (attendees || '')
    .split(',')
    .map(e => e.trim())
    .filter(e => e.includes('@'))
    .join(',');

  const subject = `Invitație Google Meet: ${title || 'Ședință Echipă'}`;
  const body =
`Salut!

Ai fost invitat(ă) la o ședință pe Google Meet:
Titlu: ${title || 'Ședință'}
Dată: ${date || ''} la ora ${startTime || ''}
${description ? `Detalii: ${description}\n` : ''}
Link Google Meet pentru a intra:
${meetLink || 'https://meet.google.com/new'}

Te așteptăm!`;

  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/* ══════════════════════════════════════════════════════════════════════════
   COMPONENTA PRINCIPALĂ CALENDAR
══════════════════════════════════════════════════════════════════════════ */
function Calendar({ currentUser }) {
  const navigate  = useNavigate();
  const todayKey  = new Date().toISOString().split('T')[0];

  // Client ID din client_secret.json al proiectului
  const GOOGLE_CLIENT_ID = '600998152273-t58c63k8l1vk772cqrnhocil9f1qo35u.apps.googleusercontent.com';
  const CAL_API          = `${API_BASE_URL}/api/calendar`;
  const NOTIF_API        = `${API_BASE_URL}/api/notifications`;

  /* ── Tab activ: 'month' (Calendar) | 'agenda' (Listă simplă) | 'meets' (Google Meet Hub) ── */
  const [activeTab, setActiveTab] = useState('month');

  /* ── Navigare Calendar ── */
  const [currentDate,  setCurrentDate]  = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [nowTime,      setNowTime]      = useState(new Date());

  /* ── Lista de evenimente ── */
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
  const [toastType,      setToastType]      = useState('info');
  const [loading,        setLoading]        = useState(false);
  const [hoveredDay,     setHoveredDay]     = useState(null);

  /* ── Email Invite Success Dialog ── */
  const [emailInviteModal, setEmailInviteModal] = useState(null);

  /* ── Filtre & Căutare ── */
  const [searchQuery,          setSearchQuery]          = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('all');
  const [agendaTimeFilter,     setAgendaTimeFilter]     = useState('upcoming');

  /* ── Google OAuth Token ── */
  const [googleToken, setGoogleToken] = useState(() => localStorage.getItem('google_access_token') || null);
  const [tokenClient, setTokenClient] = useState(null);

  /* ── Formular Simplificat (FĂRĂ PRIORITATE) ── */
  const emptyForm = {
    title: '',
    startTime: '10:00',
    endTime: '11:00',
    allDay: false,
    category: 'video_call',
    hasGoogleMeet: true,
    meetLink: '',
    attendees: '',
    location: '',
    description: '',
    sendEmailAutomatically: true
  };
  const [eventForm, setEventForm] = useState(emptyForm);

  /* ── Date pentru grila lunară ── */
  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie',
    'Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'
  ];
  const daysOfWeek = ['Lun','Mar','Mie','Joi','Vin','Sâm','Dum'];

  /* ════════════════ Efecte ════════════════ */

  // Ceas live pentru evidențierea ședințelor în desfășurare
  useEffect(() => {
    const t = setInterval(() => setNowTime(new Date()), 20000);
    return () => clearInterval(t);
  }, []);

  // Salvare locală
  useEffect(() => {
    const local = events.filter(e => !e.isGoogle);
    localStorage.setItem('calendar_local_events', JSON.stringify(local));
  }, [events]);

  // Încărcare evenimente din backend
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
            category:     b.category   || 'video_call',
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

  // Inițializare Google Identity Services OAuth
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
                showToast('✅ Conectat cu Google Calendar!', 'info');
              }
            }
          });
          setTokenClient(client);
        } catch (err) {
          console.warn('Google GSI init err:', err);
        }
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

  /* ════════════════ Toast Alert ════════════════ */
  const showToast = useCallback((msg, type = 'info') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 4500);
  }, []);

  const copyToClipboard = (text, label = 'Link copiat!') => {
    if (!text) return;
    navigator.clipboard.writeText(text).catch(() => {});
    showToast(label);
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
            category:     meetUri ? 'video_call' : 'meeting',
            hasGoogleMeet: Boolean(meetUri),
            meetLink:     meetUri,
            attendees:    item.attendees ? item.attendees.map(a => a.email).join(', ') : '',
            isGoogle:     true
          };
        });
        setEvents(prev => [...prev.filter(e => !e.isGoogle), ...parsed]);
        showToast('🔄 Calendar sincronizat cu Google!');
      })
      .catch(err => console.warn('Google sync err:', err))
      .finally(() => setLoading(false));
  };

  const handleGoogleAuth = () => {
    if (tokenClient) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      alert('Modulul Google se încarcă. Dacă problema persistă, reîmprospătează pagina (F5).');
    }
  };

  const handleDisconnectGoogle = () => {
    setGoogleToken(null);
    localStorage.removeItem('google_access_token');
    setEvents(prev => prev.filter(e => !e.isGoogle));
    showToast('Deconectat de la Google Calendar.');
  };

  /* ════════════════ Creare Eveniment Google Calendar (API cu Meet & Email Invite) ════════════════ */
  const createGoogleCalendarEvent = async (form, dateStr) => {
    if (!googleToken) return null;

    const attendeeList = form.attendees
      ? form.attendees
          .split(',')
          .map(e => e.trim())
          .filter(e => e.includes('@'))
          .map(email => ({ email }))
      : [];

    let startObj, endObj;
    if (form.allDay) {
      startObj = { date: dateStr };
      endObj   = { date: dateStr };
    } else {
      const startIso = new Date(`${dateStr}T${form.startTime}:00`).toISOString();
      const endIso   = new Date(`${dateStr}T${form.endTime}:00`).toISOString();
      startObj = { dateTime: startIso };
      endObj   = { dateTime: endIso };
    }

    const payload = {
      summary:     form.title,
      description: form.description || '',
      location:    form.location || '',
      start:       startObj,
      end:         endObj,
      attendees:   attendeeList.length > 0 ? attendeeList : undefined
    };

    if (form.hasGoogleMeet) {
      payload.conferenceData = {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      };
    }

    try {
      const res = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all',
        {
          method:  'POST',
          headers: {
            Authorization:  `Bearer ${googleToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Google Calendar create failed:', e);
    }
    return null;
  };

  /* ════════════════ Trimite Email & Notificări ════════════════ */
  const dispatchMeetingInvites = async (form, dateStr, meetLink) => {
    const attendeeList = (form.attendees || '')
      .split(',')
      .map(e => e.trim())
      .filter(e => e.includes('@'));

    if (attendeeList.length === 0) return;

    // 1. Apel către backend Email Service (Spring Boot Mail)
    try {
      await fetch(`${CAL_API}/send-invite-email`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmails:    attendeeList,
          eventTitle:  form.title,
          eventDate:   dateStr,
          startTime:   form.startTime,
          meetLink:    meetLink,
          senderName:  currentUser?.username || currentUser?.email || 'Coleg Echipă',
          description: form.description
        })
      });
    } catch (_) {}

    // 2. Apel către backend In-App Notifications
    try {
      await fetch(`${NOTIF_API}/calendar-invite`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderUserId:   currentUser?.id || null,
          senderName:     currentUser?.username || currentUser?.email || 'Utilizator',
          eventTitle:     form.title,
          eventDate:      dateStr,
          eventStartTime: form.startTime,
          meetLink:       meetLink,
          attendeeEmails: attendeeList
        })
      });
    } catch (_) {}
  };

  /* ════════════════ CRUD & Salvare Eveniment ════════════════ */

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
      category:     ev.category     || 'video_call',
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

    // Calcul link Meet
    let computedMeetLink = eventForm.meetLink.trim();
    if (eventForm.hasGoogleMeet && !computedMeetLink) {
      computedMeetLink = 'https://meet.google.com/new';
    }

    // ── Editare eveniment existent ──
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
            category:     eventForm.category,
            hasVideoMeet: eventForm.hasGoogleMeet,
            meetLink:     computedMeetLink,
            location:     eventForm.location,
            attendees:    eventForm.attendees
          })
        }).catch(() => {});
      }

      setShowEventModal(false);
      showToast('✅ Modificările au fost salvate!');
      return;
    }

    // ── Eveniment NOU ──
    let googleEventCreated = false;

    // 1. Încercare salvare pe Google Calendar dacă avem token activ
    if (googleToken) {
      const gcal = await createGoogleCalendarEvent(eventForm, selectedDate);
      if (gcal) {
        googleEventCreated = true;
        const gMeet =
          gcal.hangoutLink ||
          gcal.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri;
        if (gMeet) computedMeetLink = gMeet;
      }
    }

    // 2. Salvare în backend
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
          category:     eventForm.category,
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

    // 3. Trimitere Invitații pe Email & Notificări
    const hasAttendees = Boolean(eventForm.attendees && eventForm.attendees.trim());
    if (hasAttendees) {
      await dispatchMeetingInvites(eventForm, selectedDate, computedMeetLink);

      // Deschide modalul de confirmare email cu opțiunea de a trimite direct prin Gmail sau Mail Client
      setEmailInviteModal({
        title:       eventForm.title,
        date:        selectedDate,
        startTime:   eventForm.startTime,
        meetLink:    computedMeetLink,
        attendees:   eventForm.attendees,
        description: eventForm.description,
        googleSent:  googleEventCreated
      });
    } else {
      showToast('✨ Ședință programată cu succes!');
    }

    setShowEventModal(false);
  };

  const handleDeleteEvent = (ev) => {
    if (!window.confirm(`Ștergi definitiv "${ev.title}"?`)) return;
    if (ev.backendId) {
      fetch(`${CAL_API}/events/${ev.backendId}`, { method: 'DELETE' }).catch(() => {});
    }
    setEvents(prev => prev.filter(e => e.id !== ev.id));
    showToast('Ședință ștearsă.');
  };

  /* ── Deschide direct Gmail cu invitația pre-completată ── */
  const handleOpenGmailCompose = (title, date, startTime, meetLink, attendees, description) => {
    const url = buildGmailComposeUrl(attendees, title, date, startTime, meetLink, description);
    window.open(url, '_blank');
    showToast('📧 S-a deschis Gmail cu invitația gata de trimis!');
  };

  /* ── Deschide clientul implicit de mail (mailto:) ── */
  const handleOpenMailto = (title, date, startTime, meetLink, attendees, description) => {
    const url = buildMailtoUrl(attendees, title, date, startTime, meetLink, description);
    window.location.href = url;
  };

  /* ════════════════ Filtre & Derivate ════════════════ */
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const startingOffset  = (firstDayOfMonth + 6) % 7;
  const daysInMonth     = new Date(year, month + 1, 0).getDate();

  const formatDateKey = (day) => `${year}-${pad2(month + 1)}-${pad2(day)}`;

  const filteredEvents = useMemo(() => {
    return events.filter(ev => {
      const matchCat  = activeCategoryFilter === 'all' || ev.category === activeCategoryFilter;
      const matchSrch =
        ev.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.location?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSrch;
    });
  }, [events, activeCategoryFilter, searchQuery]);

  const selectedDayEvents = useMemo(() =>
    filteredEvents
      .filter(ev => ev.date === selectedDate)
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')),
    [filteredEvents, selectedDate]
  );

  const agendaEvents = useMemo(() => {
    let evs = [...filteredEvents].sort(
      (a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || '')
    );
    if (agendaTimeFilter === 'upcoming') evs = evs.filter(e => e.date >= todayKey);
    if (agendaTimeFilter === 'past')     evs = evs.filter(e => e.date < todayKey);
    return evs;
  }, [filteredEvents, agendaTimeFilter, todayKey]);

  const meetsEvents = useMemo(() =>
    events.filter(e => Boolean(e.meetLink || e.hasGoogleMeet || e.category === 'video_call'))
          .sort((a, b) => a.date.localeCompare(b.date)),
    [events]
  );

  const totalMonthEvents = events.filter(ev => ev.date.startsWith(`${year}-${pad2(month + 1)}`)).length;
  const todayEventsCount = events.filter(ev => ev.date === todayKey).length;
  const meetsCount       = meetsEvents.length;

  /* ════════════════ Stiluri Input Simplificate ════════════════ */
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
          fontWeight: '700', fontSize: '14px', maxWidth: '400px',
          borderLeft: `5px solid ${toastType === 'warn' ? '#f59e0b' : '#a855f7'}`,
          lineHeight: 1.4
        }}>
          {toastMessage}
        </div>
      )}

      {/* ══════════════════ BARA DE SUS (TOP BAR) ══════════════════ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
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

          {/* Statistici rapide */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            backgroundColor: '#ffffff', padding: '7px 16px',
            borderRadius: '10px', border: CARD_BORDER,
            fontSize: '13px', color: '#64748b', fontWeight: '600'
          }}>
            <span>📅 Luna: <strong style={{ color: ACCENT }}>{totalMonthEvents}</strong></span>
            <span style={{ color: '#cbd5e1' }}>•</span>
            <span>⭐ Azi: <strong style={{ color: '#0f172a' }}>{todayEventsCount}</strong></span>
            <span style={{ color: '#cbd5e1' }}>•</span>
            <span>🎥 Meet-uri: <strong style={{ color: '#7c3aed' }}>{meetsCount}</strong></span>
          </div>
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
            ➕ Adaugă Eveniment / Meet
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

      {/* ══════════════════ TAB-URILE PRINCIPALE ══════════════════ */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '2px solid #e2e8f0', marginBottom: '20px',
        flexWrap: 'wrap', gap: '10px'
      }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[
            { id: 'month',  label: '📅 Vedere Lunară' },
            { id: 'agenda', label: `📋 Agendă & Ședințe (${agendaEvents.length})` },
            { id: 'meets',  label: `🎥 Google Meet Hub (${meetsCount})` }
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

        {/* Căutare & Filtru tip activitate */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
          <input
            type="text" placeholder="🔍 Caută ședință..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            style={{ ...inputStyle, width: '170px', padding: '7px 12px', fontSize: '13px' }}
          />
          <select
            value={activeCategoryFilter} onChange={e => setActiveCategoryFilter(e.target.value)}
            style={{ ...inputStyle, width: 'auto', padding: '7px 12px', fontSize: '13px', cursor: 'pointer', fontWeight: '700' }}
          >
            <option value="all">Toate tipurile</option>
            {Object.entries(CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>{v.icon} {v.label}</option>
            ))}
          </select>
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
              💡 Apasă pe o zi pentru detalii sau pentru a programa o ședință
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
                      const cat    = CATEGORIES[ev.category] || CATEGORIES.video_call;
                      const isLive = isMeetingLiveNow(ev);
                      return (
                        <div
                          key={ev.id}
                          style={{
                            fontSize: '11px',
                            backgroundColor: isLive ? '#fee2e2' : cat.bg,
                            color: isLive ? '#dc2626' : cat.color,
                            borderLeft: `3px solid ${isLive ? '#dc2626' : cat.color}`,
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

      {/* ══════════════════ TAB 2: AGENDĂ SIMPLIFICATĂ (FĂRĂ PRIORITATE) ══════════════════ */}
      {activeTab === 'agenda' && (
        <div>
          {/* Bara de opțiuni agendă */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '16px', flexWrap: 'wrap', gap: '10px'
          }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { id: 'upcoming', label: '📅 Viitoare' },
                { id: 'all',      label: '📋 Toate' },
                { id: 'past',     label: '📁 Trecute' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setAgendaTimeFilter(f.id)}
                  style={{
                    padding: '8px 16px', borderRadius: '20px', border: 'none',
                    cursor: 'pointer', fontWeight: '700', fontSize: '13px',
                    backgroundColor: agendaTimeFilter === f.id ? ACCENT : '#f1f5f9',
                    color: agendaTimeFilter === f.id ? '#fff' : '#64748b',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => openAddModal()}
              style={{
                padding: '9px 18px', background: ACCENT_GRADIENT, color: '#fff',
                border: 'none', borderRadius: '10px', fontWeight: '800',
                fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              ➕ Programează Ședință Nouă
            </button>
          </div>

          {agendaEvents.length === 0 ? (
            <div style={{
              padding: '60px 20px', textAlign: 'center', color: '#94a3b8',
              backgroundColor: '#ffffff', borderRadius: CARD_RADIUS, border: CARD_BORDER
            }}>
              <div style={{ fontSize: '44px', marginBottom: '12px' }}>
                {agendaTimeFilter === 'upcoming' ? '🌱' : '📁'}
              </div>
              <p style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#475569' }}>
                {agendaTimeFilter === 'upcoming'
                  ? 'Nicio ședință sau activitate viitoare programată.'
                  : 'Nicio activitate găsită.'}
              </p>
              <button
                onClick={() => openAddModal()}
                style={{ marginTop: '14px', padding: '9px 16px', background: ACCENT_GRADIENT, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
              >
                + Adaugă Prima Ședință
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {agendaEvents.map(ev => {
                const cat     = CATEGORIES[ev.category] || CATEGORIES.video_call;
                const isLive  = isMeetingLiveNow(ev);
                const relDate = formatRelativeDate(ev.date);
                const dayName = getDayName(ev.date);
                const isPast  = ev.date < todayKey;
                const hasMeet = Boolean(ev.meetLink || ev.hasGoogleMeet);
                const meetUrl = ev.meetLink || 'https://meet.google.com/new';

                return (
                  <div
                    key={ev.id}
                    style={{
                      backgroundColor: '#ffffff', borderRadius: '14px',
                      border: CARD_BORDER,
                      borderLeft: `5px solid ${isLive ? '#dc2626' : isPast ? '#94a3b8' : cat.color}`,
                      boxShadow: CARD_SHADOW, padding: '16px 20px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      gap: '16px', flexWrap: 'wrap',
                      opacity: isPast ? 0.75 : 1
                    }}
                  >
                    {/* Detalii activitate */}
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
                        <span style={{ fontSize: '11px', backgroundColor: cat.bg, color: cat.color, padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
                          {cat.icon} {cat.label}
                        </span>
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

                    {/* Butoane acțiune: Google Meet + Trimite Email + Edit/Delete */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {hasMeet && (
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
                      )}

                      {/* Buton explicit pentru trimiterea email-ului cu link-ul Meet */}
                      {ev.attendees && (
                        <button
                          onClick={() => handleOpenGmailCompose(ev.title, ev.date, ev.startTime, meetUrl, ev.attendees, ev.description)}
                          title="Deschide email-ul pregătit în Gmail pentru a trimite link-ul de Meet"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            fontSize: '12px', backgroundColor: '#fef3c7', color: '#92400e',
                            border: '1.5px solid #fde68a', padding: '7px 12px', borderRadius: '8px',
                            fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap'
                          }}
                        >
                          📧 Trimite Email cu Meet
                        </button>
                      )}

                      <button
                        onClick={() => copyToClipboard(meetUrl, '📋 Link Meet copiat!')}
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

          {/* Card lansare rapidă Google Meet */}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', color: '#1e293b', fontWeight: '800' }}>
                📹 Ședințe Video Planificate ({meetsCount})
              </h3>
            </div>

            {meetsCount === 0 ? (
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
                              onClick={() => handleOpenGmailCompose(ev.title, ev.date, ev.startTime, meetUrl, ev.attendees, ev.description)}
                              style={{ fontSize: '12px', backgroundColor: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', padding: '6px 10px', borderRadius: '7px', cursor: 'pointer', fontWeight: '700' }}
                              title="Trimite link-ul pe email"
                            >
                              📧 Email
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

      {/* ══════════════════ MODAL SIMPLU PENTRU PROGRAMAT EVENIMENT / MEET ══════════════════ */}
      {showEventModal && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, padding: '20px' }}
          onClick={() => setShowEventModal(false)}
        >
          <div
            style={{ backgroundColor: '#ffffff', borderRadius: '20px', padding: '28px', maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Titlu Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '800' }}>
                  {editingId ? '✏️ Editează Ședința' : '➕ Programează Ședință / Eveniment'}
                </h3>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Completează detaliile pentru a trimite invitațiile</span>
              </div>
              <button onClick={() => setShowEventModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>

            <form onSubmit={handleSaveEvent} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* 1. Titlu */}
              <div>
                <label style={labelStyle}>Titlu ședință / eveniment *</label>
                <input
                  type="text"
                  placeholder="ex: Ședință Echipa IS, Verificare Proiect"
                  value={eventForm.title}
                  onChange={e => setEventForm({ ...eventForm, title: e.target.value })}
                  required
                  autoFocus
                  style={inputStyle}
                />
              </div>

              {/* 2. Tip activitate */}
              <div>
                <label style={labelStyle}>Tip activitate</label>
                <select
                  value={eventForm.category}
                  onChange={e => setEventForm({ ...eventForm, category: e.target.value })}
                  style={{ ...inputStyle, cursor: 'pointer', fontWeight: '700' }}
                >
                  {Object.entries(CATEGORIES).map(([k, v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
              </div>

              {/* 3. Dată & Ore */}
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

              {/* 4. Opțiune Google Meet */}
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

              {/* 5. Invitați (Email-uri) */}
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
                <span style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                  💡 La salvare, invitații vor primi email cu link-ul Google Meet pentru a intra în ședință.
                </span>
              </div>

              {/* 6. Descriere / Agendă (opțional) */}
              <div>
                <label style={labelStyle}>Agendă / Descriere (opțional)</label>
                <textarea
                  placeholder="Ce se discută la ședință..."
                  value={eventForm.description}
                  onChange={e => setEventForm({ ...eventForm, description: e.target.value })}
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              {/* Butoane acțiune salvare */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
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

      {/* ══════════════════ MODAL CONFIRMARE & TRIMITERE EMAIL INVITAȚIE ══════════════════ */}
      {emailInviteModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10002, padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', padding: '28px', maxWidth: '480px', width: '100%', boxShadow: '0 24px 48px rgba(0,0,0,0.25)' }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                ✉️
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '800' }}>
                  Invitație Ședință Pregătită!
                </h3>
                <span style={{ fontSize: '13px', color: '#059669', fontWeight: '700' }}>
                  {emailInviteModal.googleSent
                    ? '✅ S-a trimis automat prin Google Calendar!'
                    : 'Ședința a fost salvată.'}
                </span>
              </div>
            </div>

            <div style={{ backgroundColor: '#f8fafc', border: CARD_BORDER, borderRadius: '12px', padding: '14px', marginBottom: '18px', fontSize: '13px', lineHeight: 1.5 }}>
              <div><strong>📌 Ședință:</strong> {emailInviteModal.title}</div>
              <div><strong>📅 Dată & Oră:</strong> {emailInviteModal.date} la ora {emailInviteModal.startTime}</div>
              <div><strong>👥 Destinatari:</strong> {emailInviteModal.attendees}</div>
              <div style={{ marginTop: '8px', wordBreak: 'break-all' }}>
                <strong>🎥 Link Google Meet:</strong><br />
                <a href={emailInviteModal.meetLink} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: '700' }}>
                  {emailInviteModal.meetLink}
                </a>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: '#475569', marginBottom: '16px' }}>
              Apasă pe butonul de mai jos pentru a deschide email-ul direct în Gmail sau în clientul tău de mail cu toate datele gata completate:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => {
                  handleOpenGmailCompose(
                    emailInviteModal.title,
                    emailInviteModal.date,
                    emailInviteModal.startTime,
                    emailInviteModal.meetLink,
                    emailInviteModal.attendees,
                    emailInviteModal.description
                  );
                  setEmailInviteModal(null);
                }}
                style={{
                  padding: '12px', background: 'linear-gradient(135deg, #ea4335, #c5221f)',
                  color: '#ffffff', border: 'none', borderRadius: '10px',
                  fontWeight: '800', fontSize: '14px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" style={{ width: '16px', filter: 'brightness(0) invert(1)' }} />
                Deschide & Trimite prin Gmail ↗
              </button>

              <button
                onClick={() => {
                  handleOpenMailto(
                    emailInviteModal.title,
                    emailInviteModal.date,
                    emailInviteModal.startTime,
                    emailInviteModal.meetLink,
                    emailInviteModal.attendees,
                    emailInviteModal.description
                  );
                  setEmailInviteModal(null);
                }}
                style={{
                  padding: '11px', backgroundColor: '#f1f5f9',
                  color: '#334155', border: CARD_BORDER, borderRadius: '10px',
                  fontWeight: '700', fontSize: '13px', cursor: 'pointer'
                }}
              >
                📫 Trimite prin alt Client de Email (Outlook, etc.)
              </button>

              <button
                onClick={() => setEmailInviteModal(null)}
                style={{
                  padding: '9px', backgroundColor: 'transparent',
                  color: '#64748b', border: 'none', cursor: 'pointer',
                  fontSize: '13px', fontWeight: '600'
                }}
              >
                Am trimis deja / Închide
              </button>
            </div>

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
            style={{ backgroundColor: '#ffffff', borderRadius: '20px', padding: '28px', maxWidth: '540px', width: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.22)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '800' }}>
                  {getDayName(selectedDate)}, {selectedDate}
                </h3>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  {selectedDayEvents.length} {selectedDayEvents.length === 1 ? 'eveniment' : 'evenimente'}
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
                Nicio activitate programată în această zi.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {selectedDayEvents.map(ev => {
                  const cat    = CATEGORIES[ev.category] || CATEGORIES.video_call;
                  const isLive = isMeetingLiveNow(ev);
                  const meetUrl = ev.meetLink || 'https://meet.google.com/new';

                  return (
                    <div
                      key={ev.id}
                      style={{
                        padding: '14px', borderRadius: '12px',
                        backgroundColor: isLive ? '#fff1f2' : '#f8fafc',
                        border: CARD_BORDER,
                        borderLeft: `4px solid ${isLive ? '#dc2626' : cat.color}`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '15px' }}>{ev.title}</span>
                            {isLive && <span style={{ fontSize: '9px', backgroundColor: '#dc2626', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontWeight: '800' }}>LIVE</span>}
                            <span style={{ fontSize: '10px', backgroundColor: cat.bg, color: cat.color, padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>{cat.icon} {cat.label}</span>
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
                        <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                          <a href={meetUrl} target="_blank" rel="noreferrer"
                            style={{ fontSize: '11px', backgroundColor: '#2563eb', color: '#fff', padding: '5px 10px', borderRadius: '6px', fontWeight: '700', textDecoration: 'none' }}>
                            🎥 Intră în Meet
                          </a>
                          {ev.attendees && (
                            <button
                              onClick={() => handleOpenGmailCompose(ev.title, ev.date, ev.startTime, meetUrl, ev.attendees, ev.description)}
                              style={{ fontSize: '11px', backgroundColor: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', padding: '5px 8px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700' }}
                            >
                              📧 Trimite Email
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
