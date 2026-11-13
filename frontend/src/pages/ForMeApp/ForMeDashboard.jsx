import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config';

/* ── Palete de culori vibrante randomizate/alocate per profil ── */
const PROFILE_PALETTES = [
  {
    id: 'purple',
    name: 'Mov Neon',
    gradient: 'linear-gradient(135deg, #a855f7 0%, #8b5cf6 50%, #6366f1 100%)',
    primary: '#8b5cf6',
    glowColor1: 'rgba(139, 92, 246, 0.55)',
    glowColor2: 'rgba(168, 85, 247, 0.3)'
  },
  {
    id: 'orange',
    name: 'Portocaliu Sunset',
    gradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #fbbf24 100%)',
    primary: '#f97316',
    glowColor1: 'rgba(249, 115, 22, 0.55)',
    glowColor2: 'rgba(251, 191, 36, 0.3)'
  },
  {
    id: 'cyan',
    name: 'Cyan Electric',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #0284c7 50%, #38bdf8 100%)',
    primary: '#06b6d4',
    glowColor1: 'rgba(6, 182, 212, 0.55)',
    glowColor2: 'rgba(56, 189, 248, 0.3)'
  },
  {
    id: 'emerald',
    name: 'Verde Smarald',
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #34d399 100%)',
    primary: '#10b981',
    glowColor1: 'rgba(16, 185, 129, 0.55)',
    glowColor2: 'rgba(52, 211, 153, 0.3)'
  },
  {
    id: 'pink',
    name: 'Roz Fucsia',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 50%, #fb7185 100%)',
    primary: '#ec4899',
    glowColor1: 'rgba(236, 72, 153, 0.55)',
    glowColor2: 'rgba(244, 63, 94, 0.3)'
  },
  {
    id: 'amber',
    name: 'Auriu Amber',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #fde68a 100%)',
    primary: '#f59e0b',
    glowColor1: 'rgba(245, 158, 11, 0.55)',
    glowColor2: 'rgba(217, 119, 6, 0.3)'
  },
  {
    id: 'blue',
    name: 'Albastru Regal',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 50%, #60a5fa 100%)',
    primary: '#3b82f6',
    glowColor1: 'rgba(59, 130, 246, 0.55)',
    glowColor2: 'rgba(96, 165, 250, 0.3)'
  },
  {
    id: 'red',
    name: 'Roșu Rubiniu',
    gradient: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 50%, #f87171 100%)',
    primary: '#ef4444',
    glowColor1: 'rgba(239, 68, 68, 0.55)',
    glowColor2: 'rgba(185, 28, 28, 0.3)'
  }
];

function getDeterministicPaletteIndex(str) {
  if (!str) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % PROFILE_PALETTES.length;
}

export default function ForMeDashboard({ currentUser }) {
  const navigate = useNavigate();
  const user = currentUser || {};
  const todayKey = new Date().toISOString().split('T')[0];

  // Active Tab: 'notes' | 'reminders' | 'meetings'
  const [activeTab, setActiveTab] = useState('notes');

  // Real Data states
  const [notes, setNotes] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  // Reminder Modals (Pop-ups)
  const [showAddReminderModal, setShowAddReminderModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState(null);
  const [reminderForm, setReminderForm] = useState({
    title: '',
    dueDate: todayKey,
    dueTime: '12:00',
    isUrgent: false,
    completed: false
  });

  // Storage key for reminders
  const remindersKey = `for_me_reminders_${user.id || 'guest'}`;

  // Toast notification
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Fetch all user data
  const loadAllData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);

    // 1. Fetch Notes
    try {
      const res = await fetch(`${API_BASE_URL}/api/notes/creator/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setNotes(Array.isArray(data) ? data : []);
      }
    } catch (_) {}

    // 2. Load Reminders from localStorage
    try {
      const saved = localStorage.getItem(remindersKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setReminders(Array.isArray(parsed) ? parsed : []);
      } else {
        const defaults = [
          {
            id: 'rem-1',
            title: 'Verifică pull request-urile pe branch-ul de IS',
            dueDate: todayKey,
            dueTime: '16:00',
            isUrgent: true,
            completed: false
          },
          {
            id: 'rem-2',
            title: 'Pregătire prezentare arhitectură software',
            dueDate: todayKey,
            dueTime: '18:30',
            isUrgent: false,
            completed: false
          }
        ];
        localStorage.setItem(remindersKey, JSON.stringify(defaults));
        setReminders(defaults);
      }
    } catch (_) {}

    // 3. Fetch Calendar Meetings
    try {
      const res = await fetch(`${API_BASE_URL}/api/calendar/events`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const upcoming = data.filter(ev => !ev.eventDate || ev.eventDate >= todayKey);
          setMeetings(upcoming);
        }
      }
    } catch (_) {}

    setLoading(false);
  }, [user?.id, remindersKey, todayKey]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Toggle Reminder completion status
  const toggleReminderCompleted = (id) => {
    const updated = reminders.map(r => {
      if (r.id === id) {
        const next = !r.completed;
        showToast(next ? '🎉 Reminder marcat ca finalizat!' : 'Reminder reactivat.');
        return { ...r, completed: next };
      }
      return r;
    });
    setReminders(updated);
    try {
      localStorage.setItem(remindersKey, JSON.stringify(updated));
    } catch (_) {}
  };

  // Open Add Reminder Pop-up
  const handleOpenAddReminder = () => {
    setReminderForm({
      title: '',
      dueDate: todayKey,
      dueTime: '12:00',
      isUrgent: false,
      completed: false
    });
    setShowAddReminderModal(true);
  };

  // Save New Reminder
  const handleSaveNewReminder = (e) => {
    e.preventDefault();
    if (!reminderForm.title.trim()) return;
    const newRem = {
      id: `rem-${Date.now()}`,
      title: reminderForm.title.trim(),
      dueDate: reminderForm.dueDate || todayKey,
      dueTime: reminderForm.dueTime || '12:00',
      isUrgent: Boolean(reminderForm.isUrgent),
      completed: false
    };
    const updated = [newRem, ...reminders];
    setReminders(updated);
    try {
      localStorage.setItem(remindersKey, JSON.stringify(updated));
    } catch (_) {}
    setShowAddReminderModal(false);
    showToast('Reminder salvat cu succes!');
  };

  // Open Edit Reminder Pop-up
  const handleOpenEditReminder = (rem) => {
    setEditingReminder(rem);
    setReminderForm({
      title: rem.title,
      dueDate: rem.dueDate || todayKey,
      dueTime: rem.dueTime || '12:00',
      isUrgent: Boolean(rem.isUrgent ?? rem.priority === 'high'),
      completed: Boolean(rem.completed)
    });
  };

  // Save Edit Reminder
  const handleSaveEditReminder = (e) => {
    e.preventDefault();
    if (!editingReminder || !reminderForm.title.trim()) return;
    const updated = reminders.map(r => r.id === editingReminder.id ? {
      ...r,
      title: reminderForm.title.trim(),
      dueDate: reminderForm.dueDate,
      dueTime: reminderForm.dueTime,
      isUrgent: Boolean(reminderForm.isUrgent),
      completed: Boolean(reminderForm.completed)
    } : r);
    setReminders(updated);
    try {
      localStorage.setItem(remindersKey, JSON.stringify(updated));
    } catch (_) {}
    setEditingReminder(null);
    showToast('Reminder actualizat cu succes!');
  };

  // Delete Reminder
  const handleDeleteReminder = (id) => {
    const updated = reminders.filter(r => r.id !== id);
    setReminders(updated);
    try {
      localStorage.setItem(remindersKey, JSON.stringify(updated));
    } catch (_) {}
    setEditingReminder(null);
    showToast('Reminder șters.');
  };

  // Copy Profile Link
  const handleCopyProfile = () => {
    const handle = `@${user.username || 'user'}`;
    navigator.clipboard?.writeText(window.location.href);
    showToast(`Link-ul profilului (${handle}) a fost copiat!`);
  };

  // Is meeting currently live
  const isMeetingLive = (ev) => {
    if (!ev || ev.eventDate !== todayKey || !ev.startTime) return false;
    const now = new Date();
    const nowHM = now.toTimeString().substring(0, 5);
    const endHM = ev.endTime || '23:59';
    return nowHM >= ev.startTime && nowHM <= endHM;
  };

  // Strictly first letter of name for avatar
  const userInitial = (user.username || user.name || user.email || 'U')[0].toUpperCase();
  const isAdmin = Boolean(
    user?.hasAdminAccess === true ||
    (user?.role && user.role.toUpperCase() === 'ADMIN' && user.role.toUpperCase() !== 'USER')
  );

  // Deterministic randomized color palette per profile (each user has their own distinct color)
  const userColorKey = `for_me_profile_color_${user.id || user.username || 'current'}`;
  const defaultPaletteIndex = useMemo(() => {
    const seed = String(user.username || user.name || user.email || user.id || 'default');
    return getDeterministicPaletteIndex(seed);
  }, [user.username, user.name, user.email, user.id]);

  const [paletteIndex, setPaletteIndex] = useState(() => {
    try {
      const saved = localStorage.getItem(userColorKey);
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed < PROFILE_PALETTES.length) {
          return parsed;
        }
      }
    } catch (_) {}
    return defaultPaletteIndex;
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(userColorKey);
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed < PROFILE_PALETTES.length) {
          setPaletteIndex(parsed);
          return;
        }
      }
    } catch (_) {}
    setPaletteIndex(defaultPaletteIndex);
  }, [userColorKey, defaultPaletteIndex]);

  const currentPalette = PROFILE_PALETTES[paletteIndex] || PROFILE_PALETTES[0];

  const cycleNextColor = () => {
    const next = (paletteIndex + 1) % PROFILE_PALETTES.length;
    setPaletteIndex(next);
    try {
      localStorage.setItem(userColorKey, String(next));
    } catch (_) {}
    showToast(`🎨 Culoare profil: ${PROFILE_PALETTES[next].name}`);
  };

  const activeRemindersCount = useMemo(() => reminders.filter(r => !r.completed).length, [reminders]);

  return (
    <div style={{
      minHeight: 'calc(100vh - 60px)',
      backgroundColor: '#09090b',
      color: '#f8fafc',
      padding: '30px 20px 80px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
      {/* ── CSS Keyframe Animations & Dark Theme Styles ── */}
      <style>{`
        @keyframes avatarGlow {
          0%, 100% {
            box-shadow: 0 0 25px rgba(139, 92, 246, 0.4), 0 0 50px rgba(236, 72, 153, 0.2);
          }
          50% {
            box-shadow: 0 0 35px rgba(236, 72, 153, 0.5), 0 0 65px rgba(6, 182, 212, 0.3);
          }
        }
        @keyframes livePulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.85; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .tiktok-tab-btn {
          position: relative;
          background: transparent;
          border: none;
          color: #71717a;
          font-size: 14px;
          font-weight: 700;
          padding: 14px 24px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .tiktok-tab-btn:hover {
          color: #e4e4e7;
        }
        .tiktok-tab-btn.active {
          color: #ffffff;
        }
        .tiktok-tab-btn.active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 15%;
          right: 15%;
          height: 3px;
          background: linear-gradient(90deg, #ec4899, #8b5cf6);
          border-radius: 3px 3px 0 0;
          box-shadow: 0 0 10px rgba(236, 72, 153, 0.6);
        }
        .dark-profile-card {
          background-color: #121217;
          border: 1px solid #27272a;
          border-radius: 14px;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .dark-profile-card:hover {
          transform: translateY(-4px);
          border-color: #3f3f46;
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45);
        }
        .dark-input-field {
          width: 100%;
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid #27272a;
          background-color: #18181b;
          color: #ffffff;
          font-size: 14px;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s;
        }
        .dark-input-field:focus {
          border-color: #8b5cf6;
        }
      `}</style>

      {/* ── Toast Alert ── */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '30px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#18181b',
          color: '#ffffff',
          padding: '12px 24px',
          borderRadius: '30px',
          border: '1px solid #3f3f46',
          boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
          zIndex: 99999,
          fontWeight: '600',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeIn 0.2s ease'
        }}>
          <span>✨</span>
          <span>{toastMessage}</span>
        </div>
      )}

      <div style={{ maxWidth: '820px', margin: '0 auto' }}>

        {/* ── BUTON PROEMINENT DE BACK LA DASHBOARD ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '10px 20px',
              backgroundColor: '#18181b',
              color: '#ffffff',
              border: '1px solid #3f3f46',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#27272a'; e.currentTarget.style.borderColor = '#71717a'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#18181b'; e.currentTarget.style.borderColor = '#3f3f46'; }}
          >
            ← Înapoi la Dashboard
          </button>
        </div>

        {/* ══════════════════ 1. TIKTOK-STYLE CENTERED PROFILE HEADER ══════════════════ */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          marginBottom: '32px',
          animation: 'fadeIn 0.35s ease'
        }}>

          {/* Large Circular Avatar showing strictly the first letter of name with unique randomized profile color */}
          <div style={{ position: 'relative', marginBottom: '18px' }}>
            <div
              onClick={cycleNextColor}
              title="Apasă pentru a schimba culoarea inelului de profil"
              style={{
                width: '116px',
                height: '116px',
                borderRadius: '50%',
                padding: '4px',
                background: currentPalette.gradient,
                boxShadow: `0 0 28px ${currentPalette.glowColor1}, 0 0 55px ${currentPalette.glowColor2}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease',
                userSelect: 'none'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <div style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                backgroundColor: '#09090b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '48px',
                fontWeight: '900',
                color: '#ffffff'
              }}>
                {userInitial}
              </div>
            </div>
          </div>

          {/* User Name & Handle */}
          <h1 style={{
            margin: '0 0 6px 0',
            fontSize: '26px',
            fontWeight: '800',
            letterSpacing: '-0.02em',
            color: '#ffffff'
          }}>
            {user.username || 'Utilizator'}
          </h1>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '10px',
            flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: '14px', color: '#a1a1aa', fontWeight: '500' }}>
              @{user.username?.toLowerCase() || 'workspace.user'}
            </span>
            <span style={{
              backgroundColor: isAdmin ? 'rgba(245, 158, 11, 0.15)' : 'rgba(139, 92, 246, 0.15)',
              color: isAdmin ? '#fbbf24' : '#c084fc',
              border: isAdmin ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(139, 92, 246, 0.3)',
              fontSize: '11px',
              fontWeight: '700',
              padding: '2px 8px',
              borderRadius: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              {user.role || (isAdmin ? 'Admin' : 'Membru')}
            </span>
          </div>

          {/* User Bio / Workspace Info */}
          <p style={{
            margin: '0 0 20px 0',
            fontSize: '13px',
            color: '#71717a',
            maxWidth: '460px',
            lineHeight: 1.5
          }}>
            {user.email || 'Email neconfigurat'} · Spațiul tău privat de lucru și productivitate în Proiect IS
          </p>

          {/* TikTok-Style Metrics Counters Row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '36px',
            padding: '16px 28px',
            backgroundColor: '#121217',
            border: '1px solid #27272a',
            borderRadius: '16px',
            marginBottom: '22px'
          }}>
            <div
              onClick={() => setActiveTab('notes')}
              style={{ textAlign: 'center', cursor: 'pointer', transition: 'transform 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.06)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#ffffff' }}>
                {notes.length}
              </div>
              <div style={{ fontSize: '12px', color: '#a1a1aa', fontWeight: '600', marginTop: '2px' }}>
                Notițe
              </div>
            </div>

            <div style={{ width: '1px', height: '26px', backgroundColor: '#27272a' }} />

            <div
              onClick={() => setActiveTab('reminders')}
              style={{ textAlign: 'center', cursor: 'pointer', transition: 'transform 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.06)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#ffffff' }}>
                {activeRemindersCount}
              </div>
              <div style={{ fontSize: '12px', color: '#a1a1aa', fontWeight: '600', marginTop: '2px' }}>
                Reminders
              </div>
            </div>

            <div style={{ width: '1px', height: '26px', backgroundColor: '#27272a' }} />

            <div
              onClick={() => setActiveTab('meetings')}
              style={{ textAlign: 'center', cursor: 'pointer', transition: 'transform 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.06)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#ffffff' }}>
                {meetings.length}
              </div>
              <div style={{ fontSize: '12px', color: '#a1a1aa', fontWeight: '600', marginTop: '2px' }}>
                Ședințe
              </div>
            </div>
          </div>

          {/* Action Buttons Row with fromProfile state for Back button */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => navigate('/settings', { state: { fromProfile: true } })}
              style={{
                padding: '9px 20px',
                backgroundColor: '#27272a',
                color: '#ffffff',
                border: '1px solid #3f3f46',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#3f3f46'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#27272a'}
            >
              ⚙️ Setări Profil
            </button>

            {/* UN SINGUR BUTON CURAT DE CALENDAR CU fromProfile STATE */}
            <button
              onClick={() => navigate('/calendar', { state: { fromProfile: true } })}
              style={{
                padding: '9px 20px',
                backgroundColor: '#1e1b4b',
                color: '#c7d2fe',
                border: '1px solid #3730a3',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#312e81'; e.currentTarget.style.color = '#ffffff'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#1e1b4b'; e.currentTarget.style.color = '#c7d2fe'; }}
            >
              📅 Calendar & Ședințe
            </button>

            <button
              onClick={handleCopyProfile}
              style={{
                padding: '9px 18px',
                backgroundColor: '#18181b',
                color: '#a1a1aa',
                border: '1px solid #27272a',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.borderColor = '#3f3f46'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.borderColor = '#27272a'; }}
            >
              🔗 Copiază Profil
            </button>
          </div>

        </div>

        {/* ══════════════════ 2. TIKTOK-STYLE INTERACTIVE TABS BAR ══════════════════ */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          borderBottom: '1px solid #27272a',
          marginBottom: '26px'
        }}>
          <button
            className={`tiktok-tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => setActiveTab('notes')}
          >
            <span>📝</span>
            <span>Notițe</span>
            <span style={{ fontSize: '11px', opacity: 0.7 }}>({notes.length})</span>
          </button>

          <button
            className={`tiktok-tab-btn ${activeTab === 'reminders' ? 'active' : ''}`}
            onClick={() => setActiveTab('reminders')}
          >
            <span>⏰</span>
            <span>Reminders</span>
            <span style={{ fontSize: '11px', opacity: 0.7 }}>({reminders.length})</span>
          </button>

          <button
            className={`tiktok-tab-btn ${activeTab === 'meetings' ? 'active' : ''}`}
            onClick={() => setActiveTab('meetings')}
          >
            <span>📅</span>
            <span>Ședințe</span>
            <span style={{ fontSize: '11px', opacity: 0.7 }}>({meetings.length})</span>
          </button>
        </div>

        {/* ══════════════════ 3. INTERACTIVE CONTENT PANELS ══════════════════ */}

        {/* ── TAB 1: NOTIȚE ── */}
        {activeTab === 'notes' && (
          <div style={{ animation: 'fadeIn 0.25s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', color: '#a1a1aa', fontWeight: '600' }}>
                Notițele tale private salvate în cont
              </div>
              <button
                onClick={() => navigate('/for-me/notes', { state: { fromProfile: true } })}
                style={{
                  padding: '7px 14px',
                  backgroundColor: '#8b5cf6',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
                }}
              >
                + Deschide Aplicația Notițe
              </button>
            </div>

            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#71717a' }}>Se încarcă notițele...</div>
            ) : notes.length === 0 ? (
              <div style={{
                padding: '48px 24px',
                textAlign: 'center',
                backgroundColor: '#121217',
                border: '1px dashed #27272a',
                borderRadius: '14px'
              }}>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>📝</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#ffffff', marginBottom: '6px' }}>
                  Nu ai nicio notiță privată încă
                </div>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#71717a' }}>
                  Salvează gânduri, idei sau schițe de cod în spațiul tău personal.
                </p>
                <button
                  onClick={() => navigate('/for-me/notes', { state: { fromProfile: true } })}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#27272a',
                    color: '#ffffff',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Creează prima notiță
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' }}>
                {notes.map(note => (
                  <div
                    key={note.id}
                    className="dark-profile-card"
                    style={{ padding: '18px', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '130px' }}
                    onClick={() => navigate('/for-me/notes', { state: { fromProfile: true } })}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <span style={{ fontSize: '15px', fontWeight: '700', color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {note.title || 'Fără titlu'}
                        </span>
                        {Boolean(note.isPinned ?? note.pinned) && (
                          <span style={{ fontSize: '13px' }} title="Fixată">📌</span>
                        )}
                      </div>
                      <p style={{
                        margin: 0,
                        fontSize: '13px',
                        color: '#a1a1aa',
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {note.content || 'Fără conținut...'}
                      </p>
                    </div>

                    <div style={{ marginTop: '14px', fontSize: '11px', color: '#71717a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{note.createdAt ? note.createdAt.substring(0, 10) : 'Notă privată'}</span>
                      <span style={{ color: '#8b5cf6', fontWeight: '600' }}>Deschide →</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: REMINDERS (INTERACTIVE, EDITABILE & DOAR CU TOGGLE URGENT) ── */}
        {activeTab === 'reminders' && (
          <div style={{ animation: 'fadeIn 0.25s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ fontSize: '14px', color: '#a1a1aa', fontWeight: '600' }}>
                Reminders & Task-uri ({activeRemindersCount} active / {reminders.length} total)
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleOpenAddReminder}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#ec4899',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 2px 10px rgba(236, 72, 153, 0.35)'
                  }}
                >
                  + Adaugă Reminder
                </button>
                <button
                  onClick={() => navigate('/for-me/reminders', { state: { fromProfile: true } })}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#18181b',
                    color: '#a1a1aa',
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Vezi Tot →
                </button>
              </div>
            </div>

            {reminders.length === 0 ? (
              <div style={{
                padding: '48px 24px',
                textAlign: 'center',
                backgroundColor: '#121217',
                border: '1px dashed #27272a',
                borderRadius: '14px'
              }}>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>⏰</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#ffffff', marginBottom: '6px' }}>
                  Niciun reminder înregistrat
                </div>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#71717a' }}>
                  Adaugă remindere pentru a-ți organiza sarcinile și întâlnirile de lucru.
                </p>
                <button
                  onClick={handleOpenAddReminder}
                  style={{
                    padding: '9px 18px',
                    backgroundColor: '#ec4899',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  + Creează primul Reminder
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {reminders.map(rem => (
                  <div
                    key={rem.id}
                    className="dark-profile-card"
                    style={{
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '14px',
                      opacity: rem.completed ? 0.65 : 1
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                      {/* Interactive Checkbox */}
                      <input
                        type="checkbox"
                        checked={Boolean(rem.completed)}
                        onChange={() => toggleReminderCompleted(rem.id)}
                        title={rem.completed ? 'Marchează ca nefinalizat' : 'Marchează ca finalizat'}
                        style={{
                          width: '20px',
                          height: '20px',
                          cursor: 'pointer',
                          accentColor: '#ec4899'
                        }}
                      />
                      <div>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: rem.completed ? '#71717a' : '#ffffff',
                          textDecoration: rem.completed ? 'line-through' : 'none',
                          lineHeight: 1.4
                        }}>
                          {rem.title}
                        </div>
                        <div style={{ fontSize: '12px', color: '#a1a1aa', marginTop: '3px' }}>
                          📅 {rem.dueDate || 'Azi'} {rem.dueTime ? `· ⏰ ${rem.dueTime}` : ''}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {/* DOAR DACĂ E URGENT APARE ETICHETA, DACĂ NU NU APARE NIMIC */}
                      {Boolean(rem.isUrgent || rem.priority === 'high') && (
                        <span style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontWeight: '800',
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          color: '#f87171',
                          border: '1px solid rgba(239, 68, 68, 0.3)'
                        }}>
                          🔴 Urgent
                        </span>
                      )}

                      {/* Buton Editare Pop-up */}
                      <button
                        onClick={() => handleOpenEditReminder(rem)}
                        title="Editează reminder"
                        style={{
                          background: '#18181b',
                          border: '1px solid #27272a',
                          color: '#e4e4e7',
                          borderRadius: '6px',
                          padding: '5px 8px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        ✏️
                      </button>

                      {/* Buton Ștergere */}
                      <button
                        onClick={() => handleDeleteReminder(rem.id)}
                        title="Șterge reminder"
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#f87171',
                          borderRadius: '6px',
                          padding: '5px 8px',
                          cursor: 'pointer',
                          fontWeight: '700',
                          fontSize: '12px'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: ȘEDINȚE & AGENDĂ ACTIVĂ ── */}
        {activeTab === 'meetings' && (
          <div style={{ animation: 'fadeIn 0.25s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', color: '#a1a1aa', fontWeight: '600' }}>
                Ședințe programate & Conferințe Google Meet ({meetings.length})
              </div>
              <button
                onClick={() => navigate('/calendar', { state: { fromProfile: true } })}
                style={{
                  padding: '7px 14px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)'
                }}
              >
                + Vezi Calendar Complet
              </button>
            </div>

            {meetings.length === 0 ? (
              <div style={{
                padding: '48px 24px',
                textAlign: 'center',
                backgroundColor: '#121217',
                border: '1px dashed #27272a',
                borderRadius: '14px'
              }}>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>📅</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#ffffff', marginBottom: '6px' }}>
                  Nicio ședință viitoare programată
                </div>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#71717a' }}>
                  Apasă pe butonul de mai jos pentru a deschide calendarul sau a vedea ședințele trecute.
                </p>
                <button
                  onClick={() => navigate('/calendar', { state: { fromProfile: true } })}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#27272a',
                    color: '#ffffff',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Deschide Calendar
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {meetings.map(ev => {
                  const live = isMeetingLive(ev);
                  const meetUrl = ev.meetLink || 'https://meet.google.com/new';

                  return (
                    <div
                      key={ev.id}
                      className="dark-profile-card"
                      style={{
                        padding: '18px 22px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '16px',
                        flexWrap: 'wrap',
                        borderLeft: live ? '4px solid #ef4444' : ev.isDelayed ? '4px solid #f59e0b' : '4px solid #3b82f6'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '15px', fontWeight: '700', color: '#ffffff' }}>
                            {ev.title}
                          </span>
                          {live && (
                            <span style={{
                              fontSize: '10px',
                              backgroundColor: '#dc2626',
                              color: '#fff',
                              padding: '2px 7px',
                              borderRadius: '20px',
                              fontWeight: '800',
                              animation: 'livePulse 1.8s infinite'
                            }}>
                              ● LIVE ACUM
                            </span>
                          )}
                          {ev.isDelayed && (
                            <span style={{
                              fontSize: '11px',
                              backgroundColor: 'rgba(245, 158, 11, 0.2)',
                              color: '#fbbf24',
                              border: '1px solid rgba(245, 158, 11, 0.4)',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontWeight: '700'
                            }}>
                              ⏳ AMÂNATĂ
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '12px', color: '#60a5fa', fontWeight: '600', marginTop: '4px' }}>
                          📅 {ev.eventDate} · ⏰ {ev.allDay ? 'Toată ziua' : `${ev.startTime || '10:00'} – ${ev.endTime || '11:00'}`}
                        </div>

                        {ev.isDelayed && (
                          <div style={{ fontSize: '12px', color: '#fbbf24', marginTop: '4px' }}>
                            ⚠️ {ev.delayReason || 'Ședință amânată de organizator.'}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <a
                          href={meetUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            padding: '8px 14px',
                            backgroundColor: live ? '#dc2626' : '#1a73e8',
                            color: '#ffffff',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '700',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: live ? '0 2px 10px rgba(220, 38, 38, 0.4)' : 'none'
                          }}
                        >
                          🎥 {live ? 'Intră Acum' : 'Intră în Meet'}
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ══════════════════ POP-UP MODAL: ADAUGĂ REMINDER NOU ══════════════════ */}
      {showAddReminderModal && (
        <div
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10001, padding: '20px'
          }}
          onClick={() => setShowAddReminderModal(false)}
        >
          <div
            style={{
              backgroundColor: '#121217',
              borderRadius: '16px',
              padding: '26px',
              maxWidth: '460px',
              width: '100%',
              border: '1px solid #27272a',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
              animation: 'fadeIn 0.2s ease'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#ffffff' }}>
                ⏰ Adaugă Reminder Nou
              </h3>
              <button
                onClick={() => setShowAddReminderModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: '#71717a', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNewReminder} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#a1a1aa', marginBottom: '6px' }}>
                  Titlu Reminder *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ex: Predă raportul de arhitectură"
                  value={reminderForm.title}
                  onChange={e => setReminderForm({ ...reminderForm, title: e.target.value })}
                  className="dark-input-field"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#a1a1aa', marginBottom: '6px' }}>
                    Dată Scadență
                  </label>
                  <input
                    type="date"
                    value={reminderForm.dueDate}
                    onChange={e => setReminderForm({ ...reminderForm, dueDate: e.target.value })}
                    className="dark-input-field"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#a1a1aa', marginBottom: '6px' }}>
                    Oră Scadență
                  </label>
                  <input
                    type="time"
                    value={reminderForm.dueTime}
                    onChange={e => setReminderForm({ ...reminderForm, dueTime: e.target.value })}
                    className="dark-input-field"
                  />
                </div>
              </div>

              {/* SIMPLU: DOAR URGENT DA/NU */}
              <div>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 14px',
                  backgroundColor: '#18181b',
                  borderRadius: '10px',
                  border: reminderForm.isUrgent ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid #27272a',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={Boolean(reminderForm.isUrgent)}
                    onChange={e => setReminderForm({ ...reminderForm, isUrgent: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: '#ef4444', cursor: 'pointer' }}
                  />
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: reminderForm.isUrgent ? '#f87171' : '#ffffff' }}>
                      {reminderForm.isUrgent ? '🔴 Marcat ca Urgent' : 'Marchează ca Urgent'}
                    </span>
                    <span style={{ display: 'block', fontSize: '11px', color: '#71717a', marginTop: '2px' }}>
                      {reminderForm.isUrgent ? 'Va apărea eticheta roșie „Urgent” pe card.' : 'Dacă nu e bifat, nu apare nicio etichetă.'}
                    </span>
                  </div>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddReminderModal(false)}
                  style={{ padding: '9px 16px', backgroundColor: '#27272a', color: '#a1a1aa', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  style={{ padding: '9px 20px', backgroundColor: '#ec4899', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 2px 10px rgba(236, 72, 153, 0.4)' }}
                >
                  Salvează Reminder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════ POP-UP MODAL: EDITEAZĂ REMINDER ══════════════════ */}
      {editingReminder && (
        <div
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10001, padding: '20px'
          }}
          onClick={() => setEditingReminder(null)}
        >
          <div
            style={{
              backgroundColor: '#121217',
              borderRadius: '16px',
              padding: '26px',
              maxWidth: '460px',
              width: '100%',
              border: '1px solid #27272a',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
              animation: 'fadeIn 0.2s ease'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#ffffff' }}>
                ✏️ Editare Reminder
              </h3>
              <button
                onClick={() => setEditingReminder(null)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: '#71717a', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditReminder} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#a1a1aa', marginBottom: '6px' }}>
                  Titlu Reminder *
                </label>
                <input
                  type="text"
                  required
                  value={reminderForm.title}
                  onChange={e => setReminderForm({ ...reminderForm, title: e.target.value })}
                  className="dark-input-field"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#a1a1aa', marginBottom: '6px' }}>
                    Dată Scadență
                  </label>
                  <input
                    type="date"
                    value={reminderForm.dueDate}
                    onChange={e => setReminderForm({ ...reminderForm, dueDate: e.target.value })}
                    className="dark-input-field"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#a1a1aa', marginBottom: '6px' }}>
                    Oră Scadență
                  </label>
                  <input
                    type="time"
                    value={reminderForm.dueTime}
                    onChange={e => setReminderForm({ ...reminderForm, dueTime: e.target.value })}
                    className="dark-input-field"
                  />
                </div>
              </div>

              {/* SIMPLU: DOAR URGENT DA/NU */}
              <div>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 14px',
                  backgroundColor: '#18181b',
                  borderRadius: '10px',
                  border: reminderForm.isUrgent ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid #27272a',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={Boolean(reminderForm.isUrgent)}
                    onChange={e => setReminderForm({ ...reminderForm, isUrgent: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: '#ef4444', cursor: 'pointer' }}
                  />
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: reminderForm.isUrgent ? '#f87171' : '#ffffff' }}>
                      {reminderForm.isUrgent ? '🔴 Marcat ca Urgent' : 'Marchează ca Urgent'}
                    </span>
                    <span style={{ display: 'block', fontSize: '11px', color: '#71717a', marginTop: '2px' }}>
                      {reminderForm.isUrgent ? 'Va apărea eticheta roșie „Urgent” pe card.' : 'Dacă nu e bifat, nu apare nicio etichetă.'}
                    </span>
                  </div>
                </label>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#e4e4e7', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={reminderForm.completed}
                  onChange={e => setReminderForm({ ...reminderForm, completed: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: '#ec4899' }}
                />
                Marchează ca finalizat
              </label>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleDeleteReminder(editingReminder.id)}
                  style={{ padding: '9px 14px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                >
                  🗑️ Șterge
                </button>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setEditingReminder(null)}
                    style={{ padding: '9px 16px', backgroundColor: '#27272a', color: '#a1a1aa', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Anulează
                  </button>
                  <button
                    type="submit"
                    style={{ padding: '9px 20px', backgroundColor: '#ec4899', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 2px 10px rgba(236, 72, 153, 0.4)' }}
                  >
                    Salvează Modificările
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
