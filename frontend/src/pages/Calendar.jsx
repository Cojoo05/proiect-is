import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../config';

/* ───────────────────────── Design Corporatist ─────────────────────────── */
const PRIMARY_NAVY     = '#0f172a'; // Slate 900
const SECONDARY_SLATE  = '#334155'; // Slate 700
const BRAND_PURPLE     = '#5a3d5c';
const BRAND_PURPLE_HOV = '#4a2f4c';
const CARD_BG          = '#ffffff';
const CARD_SHADOW      = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)';
const BORDER_LIGHT     = '1px solid #e2e8f0';
const BORDER_SUBTLE    = '1px solid #cbd5e1';
const RADIUS_MD        = '10px';
const RADIUS_LG        = '14px';

/* ───────────────────────── Funcții Ajutătoare ─────────────────────────── */
const pad2 = (n) => String(n).padStart(2, '0');

function formatRelativeDate(dateStr) {
  if (!dateStr) return '';
  const today   = new Date();
  const target  = new Date(dateStr);
  const diffMs  = target - new Date(today.toDateString());
  const diffDay = Math.round(diffMs / 86400000);
  if (diffDay === 0)  return 'Astăzi';
  if (diffDay === 1)  return 'Mâine';
  if (diffDay === -1) return 'Ieri';
  if (diffDay > 1 && diffDay < 7) return `În ${diffDay} zile`;
  return target.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getDayName(dateStr) {
  if (!dateStr) return '';
  const days = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
  return days[new Date(dateStr).getDay()];
}

/* ══════════════════════════════════════════════════════════════════════════
   CALENDAR CORPORATIST & SISTEM DE MANAGEMENT ȘEDINȚE
══════════════════════════════════════════════════════════════════════════ */
function Calendar({ currentUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cameFromProfile = location.state?.fromProfile === true;
  const todayKey = new Date().toISOString().split('T')[0];

  const GOOGLE_CLIENT_ID = '600998152273-t58c63k8l1vk772cqrnhocil9f1qo35u.apps.googleusercontent.com';
  const CAL_API          = `${API_BASE_URL}/api/calendar`;
  const NOTIF_API        = `${API_BASE_URL}/api/notifications`;

  /* ── Tab activ: 'agenda' (Listă Ședințe) | 'month' (Grilă Lunară) | 'meets' (Conferințe Video) ── */
  const [activeTab, setActiveTab] = useState('agenda');

  /* ── Navigare Calendar ── */
  const [currentDate,  setCurrentDate]  = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [nowTime,      setNowTime]      = useState(new Date());

  /* ── Evenimente ── */
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
  const [delayModalEvent, setDelayModalEvent] = useState(null);
  const [delayInput,     setDelayInput]     = useState('15 minute');
  const [toastMessage,   setToastMessage]   = useState('');
  const [toastType,      setToastType]      = useState('success');
  const [loading,        setLoading]        = useState(false);
  const [hoveredDay,     setHoveredDay]     = useState(null);

  /* ── Căutare Rapidă & Filtre ── */
  const [searchQuery, setSearchQuery] = useState('');
  // quickFilter: 'all' | 'meets' | 'today'
  const [quickFilter, setQuickFilter] = useState('all');

  /* ── Google OAuth Token ── */
  const [googleToken, setGoogleToken] = useState(() => localStorage.getItem('google_access_token') || null);
  const [tokenClient, setTokenClient] = useState(null);

  /* ── Formular Ședință (Curățat de priorități și categorii redundante) ── */
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

  /* ── Grilă Calendar ── */
  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie',
    'Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'
  ];
  const daysOfWeek = ['Lun','Mar','Mie','Joi','Vin','Sâm','Dum'];

  /* ════════════════ Efecte ════════════════ */

  // Timer ședințe live
  useEffect(() => {
    const t = setInterval(() => setNowTime(new Date()), 20000);
    return () => clearInterval(t);
  }, []);

  // Persistență locală
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
            userId:       b.userId,
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
            isDelayed:    Boolean(b.isDelayed),
            delayReason:  b.delayReason || '',
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
                showToast('Conectat cu Google Calendar.', 'success');
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

  // Sincronizare Google Events
  useEffect(() => {
    if (googleToken) fetchGoogleEvents();
  }, [googleToken, year, month]);

  /* ════════════════ Toast Notificare ════════════════ */
  const showToast = useCallback((msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 5000);
  }, []);

  const copyToClipboard = (text, label = 'Link-ul a fost copiat în clipboard.') => {
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
        showToast('Sincronizare completă cu Google Calendar.');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const handleGoogleAuth = () => {
    if (tokenClient) tokenClient.requestAccessToken({ prompt: 'consent' });
    else alert('Modulul de autentificare Google se încarcă. Vă rugăm reîmprospătați pagina.');
  };

  const handleDisconnectGoogle = () => {
    setGoogleToken(null);
    localStorage.removeItem('google_access_token');
    setEvents(prev => prev.filter(e => !e.isGoogle));
    showToast('Deconectat de la Google Calendar.');
  };

  /* ════════════════ Trimitere Automată Invitații pe Email (proiect.is19@gmail.com) ════════════════ */
  const sendEmailInvitesAutomatically = async (title, dateStr, startTime, endTime, meetLink, attendeesStr, description) => {
    if (!attendeesStr || !attendeesStr.trim()) return;

    const emailList = attendeesStr
      .split(',')
      .map(e => e.trim())
      .filter(e => e.includes('@'));

    if (emailList.length === 0) return;

    // 1. Apel către backend Email Service (proiect.is19@gmail.com)
    try {
      const res = await fetch(`${CAL_API}/send-invite-email`, {
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
      if (res.ok) {
        const data = await res.json();
        if (data.sentViaSmtp) {
          showToast(`Invitațiile pe email au fost expediate cu succes către ${emailList.length} participanți.`, 'success');
        } else {
          // Notificare informativă dacă SMTP are nevoie de App Password
          showToast(`Invitațiile au fost înregistrate. Pentru expedierea automată din Gmail, Google impune setarea unei Parole de Aplicație (16 caractere) în contul proiect.is19@gmail.com.`, 'info');
        }
      }
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

    // 3. Trimitere via Google Calendar API dacă utilizatorul are sesiune activă Google
    if (googleToken) {
      try {
        const startIso = new Date(`${dateStr}T${startTime || '10:00'}:00`).toISOString();
        const endIso   = new Date(`${dateStr}T${endTime || '11:00'}:00`).toISOString();
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
                  requestId: `conf-${Date.now()}`,
                  conferenceSolutionKey: { type: 'hangoutsMeet' }
                }
              }
            })
          }
        );
      } catch (_) {}
    }
  };

  /* ════════════════ Retrimitere Invitație (1-Click) ════════════════ */
  const handleResendInvites = async (ev) => {
    if (!ev.attendees) return;
    await sendEmailInvitesAutomatically(
      ev.title,
      ev.date,
      ev.startTime,
      ev.endTime,
      ev.meetLink || 'https://meet.google.com/new',
      ev.attendees,
      ev.description
    );
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
      showToast('Introduceți titlul ședinței.', 'warn');
      return;
    }
    if (!eventForm.allDay && eventForm.endTime <= eventForm.startTime) {
      showToast('Ora de încheiere trebuie să fie ulterioară orei de început.', 'warn');
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
      showToast('Ședința a fost actualizată.');
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

    // Trimitere automată email-uri
    const hasAttendees = Boolean(eventForm.attendees && eventForm.attendees.trim());
    if (hasAttendees && eventForm.sendEmailAutomatically) {
      sendEmailInvitesAutomatically(
        eventForm.title,
        selectedDate,
        eventForm.startTime,
        eventForm.endTime,
        computedMeetLink,
        eventForm.attendees,
        eventForm.description
      );
    } else {
      showToast('Ședința a fost programată cu succes.');
    }

    setShowEventModal(false);
  };

  const handleDeleteEvent = (ev) => {
    if (!window.confirm(`Confirmați ștergerea ședinței "${ev.title}"?`)) return;
    if (ev.backendId) {
      fetch(`${CAL_API}/events/${ev.backendId}`, { method: 'DELETE' }).catch(() => {});
    }
    setEvents(prev => prev.filter(e => e.id !== ev.id));
    showToast('Ședința a fost ștearsă.');
  };

  /* ════════════════ Verificare permisiune modificare (Admin sau Creator) ════════════════ */
  const canModifyMeeting = useCallback((ev) => {
    if (!currentUser) return true;
    const isAdmin = Boolean(
      currentUser.hasAdminAccess === true ||
      (currentUser.role && currentUser.role.toUpperCase() === 'ADMIN' && currentUser.role.toUpperCase() !== 'USER')
    );
    if (isAdmin) return true;
    if (ev.userId && currentUser.id && String(ev.userId) === String(currentUser.id)) return true;
    if (!ev.userId) return true;
    return false;
  }, [currentUser]);

  /* ════════════════ Gestionare Amânare / Delayed (Fără Email Automat) ════════════════ */
  const handleSaveDelay = async (ev, delayText) => {
    const isDelayed = Boolean(delayText && delayText.trim());
    const reasonStr = isDelayed ? `Amânată (+${delayText.trim()})` : '';

    setEvents(prev => prev.map(e => e.id === ev.id ? { ...e, isDelayed, delayReason: reasonStr } : e));

    if (ev.backendId) {
      try {
        await fetch(`${CAL_API}/events/${ev.backendId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isDelayed: isDelayed,
            delayReason: reasonStr
          })
        });
      } catch (_) {}
    }

    setDelayModalEvent(null);
    showToast(
      isDelayed
        ? `Ședința „${ev.title}” a fost marcată ca AMÂNATĂ (${reasonStr}). Participanții văd starea actualizată.`
        : `Amânarea pentru „${ev.title}” a fost anulată.`,
      isDelayed ? 'warn' : 'success'
    );
  };

  /* ════════════════ Filtrare & Căutare Corporatistă ════════════════ */
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const startingOffset  = (firstDayOfMonth + 6) % 7;
  const daysInMonth     = new Date(year, month + 1, 0).getDate();

  const formatDateKey = (day) => `${year}-${pad2(month + 1)}-${pad2(day)}`;

  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return events.filter(ev => {
      // quickFilter: 'all' (Ședințe Active & Viitoare) | 'today' (Doar Astăzi) | 'past' (Arhivă Trecute)
      if (quickFilter === 'today' && ev.date !== todayKey) return false;
      if (quickFilter === 'all' && ev.date && ev.date < todayKey) return false;
      if (quickFilter === 'past' && (!ev.date || ev.date >= todayKey)) return false;

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

  // La apăsare pe o zi, utilizatorul vede TOATE ședințele din acea zi (inclusiv cele trecute)
  const selectedDayEvents = useMemo(() =>
    events
      .filter(ev => ev.date === selectedDate)
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')),
    [events, selectedDate]
  );

  const agendaEvents = useMemo(() =>
    [...filteredEvents].sort(
      (a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || '')
    ),
    [filteredEvents]
  );

  const meetsEvents = useMemo(() =>
    events.filter(e => Boolean(e.meetLink || e.hasGoogleMeet) && (!e.date || e.date >= todayKey))
          .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || '')),
    [events, todayKey]
  );

  /* ════════════════ Stiluri Input Corporatiste ════════════════ */
  const corporateInputStyle = {
    padding: '10px 14px',
    borderRadius: '8px',
    border: BORDER_LIGHT,
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontSize: '14px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'Inter, system-ui, sans-serif'
  };

  const corporateLabelStyle = {
    fontSize: '12px',
    fontWeight: '700',
    color: SECONDARY_SLATE,
    display: 'block',
    marginBottom: '5px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  };

  /* ════════════════ RENDER ════════════════ */
  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '28px 24px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif', color: '#0f172a' }}>

      {/* ── Toast Alert Corporatist ── */}
      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px',
          backgroundColor: toastType === 'warn' ? '#78350f' : PRIMARY_NAVY,
          color: '#ffffff', padding: '14px 22px', borderRadius: '10px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.25)', zIndex: 99999,
          fontWeight: '600', fontSize: '13px', maxWidth: '440px',
          borderLeft: `4px solid ${toastType === 'warn' ? '#f59e0b' : '#3b82f6'}`,
          lineHeight: 1.5
        }}>
          {toastMessage}
        </div>
      )}

      {/* ── CSS Keyframe Animations & Styles identice cu For Me ── */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes livePulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.85; }
        }
        .calendar-tab-btn {
          position: relative;
          background: transparent;
          border: none;
          color: #64748b;
          font-size: 13px;
          font-weight: 700;
          padding: 9px 18px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 6px;
          border-radius: 8px;
        }
        .calendar-tab-btn:hover {
          color: #0f172a;
          background-color: #ffffff;
        }
        .calendar-tab-btn.active {
          color: #0f172a;
          background-color: #ffffff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }
        .calendar-tab-btn.active::after {
          content: '';
          position: absolute;
          bottom: 2px;
          left: 15%;
          right: 15%;
          height: 3px;
          background: linear-gradient(90deg, #ec4899, #8b5cf6);
          border-radius: 3px;
          box-shadow: 0 0 8px rgba(236, 72, 153, 0.5);
        }
      `}</style>

      {/* ══════════════════ ANTET CORPORATIST (TOP BAR) ══════════════════ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '18px' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {cameFromProfile ? (
            <button
              onClick={() => navigate('/for-me')}
              style={{
                padding: '8px 16px', backgroundColor: '#09090b',
                border: '1px solid #3f3f46', borderRadius: '8px',
                fontWeight: '700', cursor: 'pointer', color: '#ffffff',
                display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#18181b'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#09090b'}
            >
              ← Înapoi la Profil
            </button>
          ) : (
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                padding: '8px 16px', backgroundColor: '#ffffff',
                border: BORDER_LIGHT, borderRadius: '8px',
                fontWeight: '600', cursor: 'pointer', color: '#475569',
                display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px',
                transition: 'background 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}
            >
              ← Înapoi la Dashboard
            </button>
          )}

          {/* Navigator Lună cu Lună (Fără sărituri de ani « și ») */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#f1f5f9', padding: '3px 8px', borderRadius: '8px', border: BORDER_LIGHT }}>
            <button
              onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
              title="Luna anterioară"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: '800', fontSize: '13px', color: '#334155', padding: '4px 8px' }}
            >
              ◀
            </button>
            <span
              onClick={() => setActiveTab('month')}
              title="Apasă pentru vederea lunară"
              style={{ fontSize: '13px', fontWeight: '700', color: PRIMARY_NAVY, padding: '0 8px', cursor: 'pointer' }}
            >
              📅 {monthNames[month]} {year}
            </span>
            <button
              onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
              title="Luna următoare"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: '800', fontSize: '13px', color: '#334155', padding: '4px 8px' }}
            >
              ▶
            </button>
            <button
              onClick={() => { const n = new Date(); setCurrentDate(n); setSelectedDate(todayKey); }}
              title="Mergi la data de astăzi"
              style={{ background: '#ffffff', border: BORDER_LIGHT, borderRadius: '4px', fontSize: '11px', fontWeight: '700', color: '#2563eb', padding: '3px 7px', cursor: 'pointer', marginLeft: '4px' }}
            >
              Azi
            </button>
          </div>
        </div>

        {/* Butoane Acțiune (FĂRĂ BUTONUL DE QUICK MEET) */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => openAddModal()}
            style={{
              padding: '9px 20px', cursor: 'pointer',
              backgroundColor: BRAND_PURPLE, color: '#ffffff',
              border: 'none', borderRadius: '8px', fontWeight: '700',
              fontSize: '13px', display: 'flex', alignItems: 'center',
              gap: '6px', boxShadow: '0 2px 6px rgba(90,61,92,0.25)',
              transition: 'background 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = BRAND_PURPLE_HOV}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = BRAND_PURPLE}
          >
            + Programează Ședință
          </button>

          {/* Sincronizare Google Calendar */}
          {!googleToken ? (
            <button
              onClick={handleGoogleAuth}
              style={{
                padding: '8px 16px', backgroundColor: '#ffffff', color: PRIMARY_NAVY,
                border: BORDER_LIGHT, borderRadius: '8px', fontWeight: '600',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px'
              }}
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" style={{ width: '15px' }} />
              Sincronizează cu Google
            </button>
          ) : (
            <div style={{
              display: 'flex', gap: '8px', alignItems: 'center',
              backgroundColor: '#f0fdf4', padding: '6px 12px',
              borderRadius: '8px', border: '1px solid #bbf7d0'
            }}>
              <span style={{ color: '#166534', fontWeight: '700', fontSize: '12px' }}>● Google Conectat</span>
              <button onClick={fetchGoogleEvents} disabled={loading}
                style={{ background: '#ffffff', border: '1px solid #bbf7d0', color: '#166534', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: '700' }}>
                {loading ? '...' : 'Sync'}
              </button>
              <button onClick={handleDisconnectGoogle}
                style={{ background: 'transparent', border: 'none', color: '#dc2626', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}>
                Deconectează
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════ TAB-URILE & CĂUTAREA FLUENTĂ ══════════════════ */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '22px', flexWrap: 'wrap', gap: '14px'
      }}>
        {/* Tab-uri cu Animații Stil For Me */}
        <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
          {[
            { id: 'agenda', icon: '📋', label: `Agendă (${agendaEvents.length})` },
            { id: 'month',  icon: '📅', label: 'Vedere Lunară' },
            { id: 'meets',  icon: '🎥', label: `Conferințe Video (${meetsEvents.length})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`calendar-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Căutare Rapidă (Clear instant) + Exact 3 Filtre Simple */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>

          {/* Câmp Căutare */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: '10px', fontSize: '13px', color: '#94a3b8', pointerEvents: 'none' }}>
              🔍
            </span>
            <input
              type="text"
              placeholder="Căutare ședință..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                ...corporateInputStyle,
                width: '210px',
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
                title="Șterge text"
                style={{
                  position: 'absolute', right: '8px', background: '#e2e8f0',
                  border: 'none', borderRadius: '50%', width: '18px', height: '18px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: '800', color: '#475569', cursor: 'pointer'
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Filtre Rapide: Active, Astăzi, Arhivă */}
          <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f8fafc', border: BORDER_LIGHT, padding: '3px', borderRadius: '8px' }}>
            {[
              { id: 'all',   label: 'Toate Ședințele (Active)' },
              { id: 'today', label: 'Astăzi' },
              { id: 'past',  label: 'Arhivă Trecute' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setQuickFilter(f.id)}
                style={{
                  padding: '5px 12px', border: 'none', borderRadius: '6px',
                  cursor: 'pointer', fontWeight: '600', fontSize: '12px',
                  backgroundColor: quickFilter === f.id ? PRIMARY_NAVY : 'transparent',
                  color: quickFilter === f.id ? '#ffffff' : '#64748b',
                  transition: 'all 0.15s ease'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* ══════════════════ TAB 1: AGENDĂ CORPORATISTĂ (TABULARĂ / LISTĂ) ══════════════════ */}
      {activeTab === 'agenda' && (
        <div style={{ backgroundColor: CARD_BG, borderRadius: RADIUS_LG, border: BORDER_LIGHT, boxShadow: CARD_SHADOW, overflow: 'hidden', animation: 'fadeIn 0.25s ease' }}>

          <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', color: PRIMARY_NAVY, fontWeight: '700' }}>
                Program Ședințe Echipă
              </h3>
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                Invitațiile sunt expediate automat prin contul oficial <strong>proiect.is19@gmail.com</strong>
              </span>
            </div>
            <button
              onClick={() => openAddModal()}
              style={{ padding: '8px 16px', backgroundColor: BRAND_PURPLE, color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}
            >
              + Adaugă Ședință
            </button>
          </div>

          {agendaEvents.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>📅</div>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>
                Nicio ședință înregistrată {searchQuery ? `pentru căutarea „${searchQuery}”` : ''}.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {agendaEvents.map((ev, index) => {
                const isLive  = isMeetingLiveNow(ev);
                const relDate = formatRelativeDate(ev.date);
                const dayName = getDayName(ev.date);
                const isPast  = ev.date < todayKey;
                const meetUrl = ev.meetLink || 'https://meet.google.com/new';

                return (
                  <div
                    key={ev.id}
                    style={{
                      padding: '16px 24px',
                      borderBottom: index < agendaEvents.length - 1 ? '1px solid #f1f5f9' : 'none',
                      borderLeft: (ev.hasGoogleMeet || (ev.meetLink && ev.meetLink.includes('meet'))) ? '3px solid #1a73e8' : '3px solid #5a3d5c',
                      backgroundColor: isLive ? '#fef2f2' : '#ffffff',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      gap: '20px', flexWrap: 'wrap',
                      opacity: isPast ? 0.75 : 1,
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={e => { if (!isLive) e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                    onMouseLeave={e => { if (!isLive) e.currentTarget.style.backgroundColor = '#ffffff'; }}
                  >
                    {/* Interval orar & Dată */}
                    <div style={{ minWidth: '150px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          fontSize: '12px', fontWeight: '700',
                          color: isLive ? '#dc2626' : PRIMARY_NAVY,
                          backgroundColor: isLive ? '#fee2e2' : '#f1f5f9',
                          border: isLive ? '1px solid #fecaca' : '1px solid #e2e8f0',
                          padding: '3px 8px', borderRadius: '6px',
                          letterSpacing: '0.02em'
                        }}>
                          {ev.allDay ? 'Toată ziua' : `${ev.startTime} – ${ev.endTime}`}
                        </span>
                        {isLive && (
                          <span style={{ fontSize: '10px', backgroundColor: '#dc2626', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>
                            LIVE
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', fontWeight: '500' }}>
                        {dayName}, {ev.date}
                        {relDate && <span style={{ marginLeft: '6px', color: '#2563eb', fontWeight: '600' }}>({relDate})</span>}
                      </div>
                    </div>

                    {/* Subiect & Detalii */}
                    <div style={{ flex: 1, minWidth: '240px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '15px', fontWeight: '600', color: PRIMARY_NAVY }}>
                          {ev.title}
                        </span>
                        {ev.isDelayed && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: '#fef3c7',
                            border: '1px solid #fde68a',
                            color: '#b45309',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '700'
                          }}>
                            ⏳ AMÂNATĂ {ev.delayReason ? `(${ev.delayReason})` : ''}
                          </span>
                        )}
                      </div>

                      {ev.description && (
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b', lineHeight: 1.4 }}>
                          {ev.description}
                        </p>
                      )}

                      {ev.isDelayed && (
                        <div style={{ marginTop: '5px', fontSize: '12px', color: '#b45309', fontWeight: '500' }}>
                          ⚠️ Notă: Organizatorul a decalat această ședință.
                        </div>
                      )}

                      {ev.attendees && (
                        <div style={{ marginTop: '6px', fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: '600', color: '#94a3b8' }}>Participanți:</span>
                          {ev.attendees.split(',').map((email, i) => (
                            <span key={i} style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500' }}>
                              {email.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Acțiuni Corporatiste: Conectare Meet + Retrimite Invitații + Amânare */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <a
                        href={meetUrl}
                        target="_blank" rel="noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          fontSize: '12px', backgroundColor: isLive ? '#dc2626' : '#1a73e8', color: '#ffffff',
                          padding: '7px 14px', borderRadius: '6px', fontWeight: '600',
                          textDecoration: 'none', whiteSpace: 'nowrap',
                          boxShadow: isLive ? '0 1px 4px rgba(220,38,38,0.3)' : '0 1px 2px rgba(26,115,232,0.2)',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = isLive ? '#b91c1c' : '#1557b0')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = isLive ? '#dc2626' : '#1a73e8')}
                      >
                        {isLive ? '🔴 Conectare Live' : '🎥 Intră în Meet'}
                      </a>

                      {/* Buton Amânare (Admin sau Creator ședință) */}
                      {canModifyMeeting(ev) && (
                        ev.isDelayed ? (
                          <button
                            onClick={() => handleSaveDelay(ev, '')}
                            title="Resetează amânarea și revino la programul normal"
                            style={{
                              padding: '7px 10px', backgroundColor: '#fef3c7',
                              border: '1px solid #fde68a', color: '#b45309',
                              borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            ↺ Anulează Amânarea
                          </button>
                        ) : (
                          <button
                            onClick={() => { setDelayModalEvent(ev); setDelayInput('15 minute'); }}
                            title="Marchează ședința ca amânată pentru participanți (fără email automat)"
                            style={{
                              padding: '7px 10px', backgroundColor: '#fff7ed',
                              border: '1px solid #fed7aa', color: '#c2410c',
                              borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            ⏳ Amână
                          </button>
                        )
                      )}

                      {ev.attendees && (
                        <button
                          onClick={() => handleResendInvites(ev)}
                          title="Retrimite invitația pe email tuturor participanților prin contul proiect.is19@gmail.com"
                          style={{
                            fontSize: '12px', backgroundColor: '#ffffff', color: '#334155',
                            border: BORDER_LIGHT, padding: '7px 12px', borderRadius: '6px',
                            fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap',
                            transition: 'background-color 0.15s ease'
                          }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#ffffff')}
                        >
                          ✉️ Retrimite Invitație
                        </button>
                      )}

                      <button
                        onClick={() => copyToClipboard(meetUrl)}
                        title="Copiază link-ul conferinței"
                        style={{ padding: '7px 10px', backgroundColor: '#ffffff', border: BORDER_LIGHT, color: '#475569', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}
                      >
                        Copiază Link
                      </button>

                      <button
                        onClick={() => handleEditClick(ev)}
                        title="Modifică ședință"
                        style={{ padding: '7px 10px', backgroundColor: '#ffffff', border: BORDER_LIGHT, color: '#475569', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}
                      >
                        Editează
                      </button>

                      <button
                        onClick={() => handleDeleteEvent(ev)}
                        title="Șterge ședință"
                        style={{ padding: '7px 10px', backgroundColor: '#fff1f2', color: '#e11d48', border: '1px solid #ffe4e6', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '12px' }}
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

      {/* ══════════════════ TAB 2: VEDERE LUNARĂ ══════════════════ */}
      {activeTab === 'month' && (
        <div style={{ backgroundColor: CARD_BG, borderRadius: RADIUS_LG, padding: '24px', border: BORDER_LIGHT, boxShadow: CARD_SHADOW, animation: 'fadeIn 0.25s ease' }}>

          {/* Butoane navigație lună cu lună (Fără sărituri de an) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                title="Luna anterioară"
                style={{ padding: '7px 14px', cursor: 'pointer', backgroundColor: '#ffffff', border: BORDER_LIGHT, borderRadius: '6px', fontWeight: '800', fontSize: '13px', color: PRIMARY_NAVY }}
              >
                ◀
              </button>
              <button
                onClick={() => { const n = new Date(); setCurrentDate(n); setSelectedDate(todayKey); }}
                style={{ padding: '7px 16px', cursor: 'pointer', backgroundColor: PRIMARY_NAVY, color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '13px' }}
              >
                Astăzi
              </button>
              <button
                onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                title="Luna următoare"
                style={{ padding: '7px 14px', cursor: 'pointer', backgroundColor: '#ffffff', border: BORDER_LIGHT, borderRadius: '6px', fontWeight: '800', fontSize: '13px', color: PRIMARY_NAVY }}
              >
                ▶
              </button>
              <h2 style={{ margin: '0 0 0 10px', fontSize: '18px', fontWeight: '800', color: PRIMARY_NAVY }}>
                {monthNames[month]} {year}
              </h2>
            </div>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Selectați o zi din calendar pentru detalii complete
            </span>
          </div>

          {/* Antet Zile */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center', marginBottom: '8px' }}>
            {daysOfWeek.map(d => (
              <div key={d} style={{ fontWeight: '700', color: '#64748b', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '4px 0' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Grilă Lunar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
            {Array.from({ length: startingOffset }).map((_, i) => (
              <div key={`off-${i}`} style={{ minHeight: '105px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #e2e8f0' }} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day      = idx + 1;
              const dateKey  = formatDateKey(day);
              const isSel    = selectedDate === dateKey;
              const isToday  = todayKey    === dateKey;
              const isHov    = hoveredDay  === dateKey;
              const dayEvs   = events
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
                    borderRadius: '8px',
                    border: isSel ? `2px solid ${BRAND_PURPLE}` : isToday ? '2px solid #2563eb' : BORDER_LIGHT,
                    backgroundColor: isSel ? '#faf5ff' : isHov ? '#f8fafc' : '#ffffff',
                    cursor: 'pointer', display: 'flex', flexDirection: 'column',
                    transition: 'all 0.12s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{
                      fontWeight: isToday || isSel ? '700' : '600',
                      fontSize: '13px',
                      color: isToday ? '#2563eb' : isSel ? BRAND_PURPLE : PRIMARY_NAVY
                    }}>
                      {day}
                    </span>
                    {isToday && (
                      <span style={{ fontSize: '9px', backgroundColor: '#2563eb', color: '#fff', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>
                        Astăzi
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
                            backgroundColor: isLive ? '#fee2e2' : '#f1f5f9',
                            color: isLive ? '#dc2626' : PRIMARY_NAVY,
                            borderLeft: `3px solid ${isLive ? '#dc2626' : '#64748b'}`,
                            padding: '2px 5px', borderRadius: '4px',
                            whiteSpace: 'nowrap', overflow: 'hidden',
                            textOverflow: 'ellipsis', fontWeight: '600'
                          }}
                        >
                          {!ev.allDay && ev.startTime ? `${ev.startTime} ` : ''}{ev.title}
                        </div>
                      );
                    })}
                    {dayEvs.length > 3 && (
                      <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', paddingLeft: '4px' }}>
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

      {/* ══════════════════ TAB 3: CONFERINȚE VIDEO ══════════════════ */}
      {activeTab === 'meets' && (
        <div style={{ backgroundColor: CARD_BG, borderRadius: RADIUS_LG, padding: '24px', border: BORDER_LIGHT, boxShadow: CARD_SHADOW, animation: 'fadeIn 0.25s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', color: PRIMARY_NAVY, fontWeight: '700' }}>
                Conferințe Video Google Meet Programate ({meetsEvents.length})
              </h3>
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                Acces direct la camerele de ședință dedicate proiectului
              </span>
            </div>
            <button
              onClick={() => openAddModal()}
              style={{ padding: '8px 16px', backgroundColor: BRAND_PURPLE, color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}
            >
              + Programează Conferință
            </button>
          </div>

          {meetsEvents.length === 0 ? (
            <div style={{ padding: '50px 20px', textAlign: 'center', color: '#64748b' }}>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>
                Nicio conferință video programată în prezent.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
              {meetsEvents.map(ev => {
                const isLive = isMeetingLiveNow(ev);
                const meetUrl = ev.meetLink || 'https://meet.google.com/new';

                return (
                  <div
                    key={ev.id}
                    style={{
                      padding: '20px', borderRadius: '12px',
                      backgroundColor: isLive ? '#fff5f5' : '#ffffff',
                      border: isLive ? '2px solid #ef4444' : BORDER_LIGHT,
                      boxShadow: isLive ? '0 0 20px rgba(239, 68, 68, 0.2)' : CARD_SHADOW,
                      borderLeft: `5px solid ${isLive ? '#dc2626' : ev.isDelayed ? '#d97706' : '#1a73e8'}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                      <span style={{ fontWeight: '700', color: PRIMARY_NAVY, fontSize: '15px' }}>
                        {ev.title}
                      </span>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {isLive && (
                          <span style={{
                            fontSize: '11px', backgroundColor: '#dc2626', color: '#fff',
                            padding: '3px 8px', borderRadius: '20px', fontWeight: '800',
                            display: 'inline-flex', alignItems: 'center', gap: '5px'
                          }}>
                            ● CONFERINȚĂ PORNITĂ
                          </span>
                        )}
                        {ev.isDelayed && (
                          <span style={{
                            fontSize: '11px', backgroundColor: '#fef3c7', color: '#b45309',
                            border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '6px', fontWeight: '700'
                          }}>
                            ⏳ AMÂNATĂ
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ fontSize: '13px', color: '#2563eb', fontWeight: '600', marginTop: '6px' }}>
                      📅 {ev.date} • ⏰ {ev.allDay ? 'Toată ziua' : `${ev.startTime} – ${ev.endTime}`}
                    </div>

                    {ev.isDelayed && (
                      <div style={{ marginTop: '6px', fontSize: '12px', color: '#b45309', fontWeight: '500', backgroundColor: '#fffbeb', padding: '4px 8px', borderRadius: '4px' }}>
                        ⚠️ {ev.delayReason || 'Această conferință a fost decalată de organizator.'}
                      </div>
                    )}

                    {ev.attendees && (
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                        Invitați: {ev.attendees}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                      <a
                        href={meetUrl}
                        target="_blank" rel="noreferrer"
                        style={{
                          fontSize: '12px',
                          backgroundColor: isLive ? '#dc2626' : '#1a73e8',
                          color: '#fff',
                          padding: '8px 16px', borderRadius: '6px', fontWeight: '700',
                          textDecoration: 'none',
                          boxShadow: isLive ? '0 2px 6px rgba(220,38,38,0.3)' : '0 1px 2px rgba(26,115,232,0.2)'
                        }}
                      >
                        {isLive ? '🔴 Conectare Live Acum' : '🎥 Intră în Google Meet'}
                      </a>

                      <button
                        onClick={() => copyToClipboard(meetUrl)}
                        style={{ fontSize: '12px', backgroundColor: '#ffffff', border: BORDER_LIGHT, color: '#334155', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                      >
                        Copiază Link
                      </button>

                      {/* Buton Amânare din card conferință */}
                      {canModifyMeeting(ev) && (
                        ev.isDelayed ? (
                          <button
                            onClick={() => handleSaveDelay(ev, '')}
                            style={{ fontSize: '12px', backgroundColor: '#fef3c7', border: '1px solid #fde68a', color: '#b45309', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                          >
                            ↺ Anulează Amânarea
                          </button>
                        ) : (
                          <button
                            onClick={() => { setDelayModalEvent(ev); setDelayInput('15 minute'); }}
                            style={{ fontSize: '12px', backgroundColor: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                          >
                            ⏳ Amână
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ MODAL AMÂNARE ȘEDINȚĂ (DELAYED - FĂRĂ EMAIL) ══════════════════ */}
      {delayModalEvent && (
        <div
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(15,23,42,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10001, padding: '20px'
          }}
          onClick={() => setDelayModalEvent(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              padding: '24px 28px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              border: BORDER_LIGHT
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', color: PRIMARY_NAVY, fontWeight: '700' }}>
                  ⏳ Amână Ședința
                </h3>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  {delayModalEvent.title}
                </span>
              </div>
              <button
                onClick={() => setDelayModalEvent(null)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '16px', fontSize: '13px', color: '#92400e', lineHeight: 1.5, backgroundColor: '#fffbeb', border: '1px solid #fde68a', padding: '12px 14px', borderRadius: '8px' }}>
              <strong>Notă:</strong> Ședința va apărea cu eticheta <strong>AMÂNATĂ / DELAYED</strong> pentru toți participanții invitați. <em>(Nu se trimite email automat conform cerinței).</em>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={corporateLabelStyle}>Presetări Rapide</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['10 minute', '15 minute', '30 minute', '1 oră', 'Decalată'].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDelayInput(preset)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: delayInput === preset ? '1px solid #d97706' : BORDER_LIGHT,
                      backgroundColor: delayInput === preset ? '#fef3c7' : '#f8fafc',
                      color: delayInput === preset ? '#b45309' : '#334155',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    +{preset}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={corporateLabelStyle}>Motiv / Timp întârziere afișat participanților</label>
              <input
                type="text"
                value={delayInput}
                onChange={e => setDelayInput(e.target.value)}
                placeholder="Ex: 15 minute / Discutăm la :45"
                style={corporateInputStyle}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDelayModalEvent(null)}
                style={{ padding: '9px 16px', backgroundColor: '#ffffff', border: BORDER_LIGHT, borderRadius: '6px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', color: '#475569' }}
              >
                Anulează
              </button>
              <button
                type="button"
                onClick={() => handleSaveDelay(delayModalEvent, delayInput)}
                style={{ padding: '9px 18px', backgroundColor: '#d97706', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(217,119,6,0.3)' }}
              >
                Confirmă Amânarea
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ MODAL PROGRAMARE ȘEDINȚĂ (CORPORATIST) ══════════════════ */}
      {showEventModal && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, padding: '20px' }}
          onClick={() => setShowEventModal(false)}
        >
          <div
            style={{ backgroundColor: '#ffffff', borderRadius: '14px', padding: '28px', maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Antet Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', color: PRIMARY_NAVY, fontWeight: '700' }}>
                  {editingId ? 'Editare Detalii Ședință' : 'Programare Ședință de Lucru'}
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Expediere automată a invitației prin <strong>proiect.is19@gmail.com</strong>
                </span>
              </div>
              <button onClick={() => setShowEventModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>

            <form onSubmit={handleSaveEvent} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* 1. Titlu */}
              <div>
                <label style={corporateLabelStyle}>Subiect / Titlu Ședință *</label>
                <input
                  type="text"
                  placeholder="ex: Ședință Evaluare Etapa 2 Proiect IS"
                  value={eventForm.title}
                  onChange={e => setEventForm({ ...eventForm, title: e.target.value })}
                  required
                  autoFocus
                  style={corporateInputStyle}
                />
              </div>

              {/* 2. Dată */}
              <div>
                <label style={corporateLabelStyle}>Dată Desfășurare</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  required
                  style={corporateInputStyle}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155', cursor: 'pointer', fontWeight: '600' }}>
                  <input
                    type="checkbox"
                    checked={eventForm.allDay}
                    onChange={e => setEventForm({ ...eventForm, allDay: e.target.checked })}
                    style={{ width: '16px', height: '16px', accentColor: BRAND_PURPLE }}
                  />
                  Ședință pentru întreaga zi
                </label>
              </div>

              {!eventForm.allDay && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={corporateLabelStyle}>Ora Început</label>
                    <input
                      type="time"
                      value={eventForm.startTime}
                      onChange={e => setEventForm({ ...eventForm, startTime: e.target.value })}
                      style={corporateInputStyle}
                    />
                  </div>
                  <div>
                    <label style={corporateLabelStyle}>Ora Încheiere</label>
                    <input
                      type="time"
                      value={eventForm.endTime}
                      onChange={e => setEventForm({ ...eventForm, endTime: e.target.value })}
                      style={corporateInputStyle}
                    />
                  </div>
                </div>
              )}

              {/* 3. Google Meet Link */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: BORDER_LIGHT,
                borderRadius: '8px', padding: '14px'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: PRIMARY_NAVY, cursor: 'pointer', fontWeight: '700' }}>
                  <input
                    type="checkbox"
                    checked={eventForm.hasGoogleMeet}
                    onChange={e => setEventForm({ ...eventForm, hasGoogleMeet: e.target.checked })}
                    style={{ width: '16px', height: '16px', accentColor: '#2563eb' }}
                  />
                  Conferință Google Meet integrată
                </label>

                {eventForm.hasGoogleMeet && (
                  <div style={{ marginTop: '10px' }}>
                    <input
                      type="url"
                      placeholder="Link Google Meet (implicit: meet.google.com/new)"
                      value={eventForm.meetLink}
                      onChange={e => setEventForm({ ...eventForm, meetLink: e.target.value })}
                      style={{ ...corporateInputStyle, fontSize: '13px' }}
                    />
                  </div>
                )}
              </div>

              {/* 4. Invitați (Email-uri) */}
              <div>
                <label style={corporateLabelStyle}>
                  Participanți (Adrese Email, separate prin virgulă)
                </label>
                <input
                  type="text"
                  placeholder="coleg1@gmail.com, coleg2@gmail.com"
                  value={eventForm.attendees}
                  onChange={e => setEventForm({ ...eventForm, attendees: e.target.value })}
                  style={corporateInputStyle}
                />
              </div>

              {/* 5. Opțiune automată de trimitere pe email */}
              {eventForm.attendees && (
                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 14px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#166534', cursor: 'pointer', fontWeight: '600' }}>
                    <input
                      type="checkbox"
                      checked={eventForm.sendEmailAutomatically}
                      onChange={e => setEventForm({ ...eventForm, sendEmailAutomatically: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: '#166534' }}
                    />
                    Trimite automat invitațiile prin email de la proiect.is19@gmail.com
                  </label>
                </div>
              )}

              {/* 6. Descriere / Agendă */}
              <div>
                <label style={corporateLabelStyle}>Agendă Ședință / Note (Opțional)</label>
                <textarea
                  placeholder="Obiective și teme discutate..."
                  value={eventForm.description}
                  onChange={e => setEventForm({ ...eventForm, description: e.target.value })}
                  rows={2}
                  style={{ ...corporateInputStyle, resize: 'vertical' }}
                />
              </div>

              {/* Butoane Salvare */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  style={{
                    padding: '9px 16px', backgroundColor: '#ffffff',
                    color: '#64748b', border: BORDER_LIGHT, borderRadius: '6px',
                    fontWeight: '600', cursor: 'pointer', fontSize: '13px'
                  }}
                >
                  Anulează
                </button>

                <button
                  type="submit"
                  style={{
                    padding: '9px 22px', backgroundColor: BRAND_PURPLE,
                    color: '#ffffff', border: 'none', borderRadius: '6px',
                    fontWeight: '700', fontSize: '13px', cursor: 'pointer'
                  }}
                >
                  {editingId ? 'Salvează Modificările' : 'Confirmă & Trimite Invitații'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ══════════════════ MODAL POP-UP INSPECTARE ZI (ISTORIC & ȘEDINȚE COMPLETE) ══════════════════ */}
      {inspectorOpen && (
        <div
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(15,23,42,0.6)',
            backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10000, padding: '20px'
          }}
          onClick={() => setInspectorOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '24px 26px',
              maxWidth: '470px',
              width: '92%',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: BORDER_LIGHT,
              animation: 'popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Antet Pop-up */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', color: PRIMARY_NAVY, fontWeight: '800' }}>
                    📅 {getDayName(selectedDate)}, {selectedDate}
                  </h3>
                  {selectedDate < todayKey && (
                    <span style={{ fontSize: '11px', backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
                      Arhivă / Trecută
                    </span>
                  )}
                  {selectedDate === todayKey && (
                    <span style={{ fontSize: '11px', backgroundColor: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
                      Astăzi
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                  {selectedDayEvents.length === 0
                    ? 'Nicio ședință înregistrată în această zi'
                    : `${selectedDayEvents.length} ${selectedDayEvents.length === 1 ? 'ședință înregistrată' : 'ședințe înregistrate'}`
                  }
                </div>
              </div>
              <button
                onClick={() => setInspectorOpen(false)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', cursor: 'pointer', color: '#64748b', fontWeight: '700' }}
              >
                ✕
              </button>
            </div>

            <button
              onClick={() => { setInspectorOpen(false); openAddModal(selectedDate); }}
              style={{
                width: '100%', padding: '10px',
                backgroundColor: BRAND_PURPLE, color: '#fff',
                border: 'none', borderRadius: '8px',
                fontWeight: '700', fontSize: '13px',
                cursor: 'pointer', marginBottom: '18px',
                boxShadow: '0 2px 6px rgba(90,61,92,0.25)'
              }}
            >
              + Programează Ședință pe {selectedDate}
            </button>

            {selectedDayEvents.length === 0 ? (
              <div style={{ padding: '36px 16px', textAlign: 'center', color: '#94a3b8', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>☕</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#475569' }}>
                  Nicio ședință înregistrată în această zi
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                  {selectedDate < todayKey ? 'Nu au existat întâlniri înregistrate în această dată.' : 'Apasă butonul de mai sus pentru a programa o ședință.'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {selectedDayEvents.map(ev => {
                  const isLive = isMeetingLiveNow(ev);
                  const isPast = ev.date < todayKey;
                  const meetUrl = ev.meetLink || 'https://meet.google.com/new';

                  return (
                    <div
                      key={ev.id}
                      style={{
                        padding: '16px', borderRadius: '10px',
                        backgroundColor: isLive ? '#fef2f2' : isPast ? '#f8fafc' : '#ffffff',
                        border: isLive ? '1px solid #fecaca' : BORDER_LIGHT,
                        borderLeft: `4px solid ${isLive ? '#dc2626' : ev.isDelayed ? '#d97706' : isPast ? '#94a3b8' : '#2563eb'}`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: '700', color: PRIMARY_NAVY, fontSize: '15px' }}>
                              {ev.title}
                            </span>
                            {isLive && (
                              <span style={{ fontSize: '10px', backgroundColor: '#dc2626', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>
                                ● LIVE ACUM
                              </span>
                            )}
                            {ev.isDelayed && (
                              <span style={{ fontSize: '10px', backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                                ⏳ AMÂNATĂ {ev.delayReason ? `(${ev.delayReason})` : ''}
                              </span>
                            )}
                            {isPast && !isLive && (
                              <span style={{ fontSize: '10px', backgroundColor: '#e2e8f0', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>
                                ✓ Încheiată
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: '12px', color: '#2563eb', fontWeight: '600', marginTop: '4px' }}>
                            ⏰ {ev.allDay ? 'Toată ziua' : `${ev.startTime} – ${ev.endTime}`}
                          </div>

                          {ev.description && (
                            <div style={{ fontSize: '13px', color: '#475569', marginTop: '6px', lineHeight: 1.4 }}>
                              {ev.description}
                            </div>
                          )}

                          {ev.attendees && (
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                              <span>Participanți:</span>
                              {ev.attendees.split(',').map((email, i) => (
                                <span key={i} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '1px 6px', borderRadius: '4px', color: '#334155' }}>
                                  {email.trim()}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => { setInspectorOpen(false); handleEditClick(ev); }}
                            title="Editează ședință"
                            style={{ background: '#ffffff', border: BORDER_LIGHT, borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', fontSize: '12px' }}
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteEvent(ev)}
                            title="Șterge ședință"
                            style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Acțiuni ședință */}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                        {(ev.meetLink || ev.hasGoogleMeet) && (
                          <a
                            href={meetUrl}
                            target="_blank" rel="noreferrer"
                            style={{
                              fontSize: '12px',
                              backgroundColor: isLive ? '#dc2626' : '#1a73e8',
                              color: '#fff',
                              padding: '6px 12px', borderRadius: '6px',
                              fontWeight: '600', textDecoration: 'none'
                            }}
                          >
                            {isLive ? '🔴 Conectare Live' : '🎥 Intră în Meet'}
                          </a>
                        )}

                        {canModifyMeeting(ev) && (
                          ev.isDelayed ? (
                            <button
                              onClick={() => handleSaveDelay(ev, '')}
                              style={{ fontSize: '12px', backgroundColor: '#fef3c7', border: '1px solid #fde68a', color: '#b45309', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                            >
                              ↺ Resetează Amânarea
                            </button>
                          ) : (
                            <button
                              onClick={() => { setInspectorOpen(false); setDelayModalEvent(ev); setDelayInput('15 minute'); }}
                              style={{ fontSize: '12px', backgroundColor: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                            >
                              ⏳ Amână
                            </button>
                          )
                        )}

                        <button
                          onClick={() => copyToClipboard(meetUrl)}
                          style={{ fontSize: '12px', backgroundColor: '#ffffff', border: BORDER_LIGHT, color: '#475569', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}
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

    </div>
  );
}

export default Calendar;
