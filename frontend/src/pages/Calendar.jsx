import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Calendar({ currentUser }) {
  const navigate = useNavigate();
  const GOOGLE_CLIENT_ID = '581947728431-1lqjbaf8ae86ig53pg7do170mdpmlgrd.apps.googleusercontent.com';

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [events, setEvents] = useState([]);
  const [newEvent, setNewEvent] = useState({ title: '', time: '10:00', description: '' });

  const [googleToken, setGoogleToken] = useState(null);
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
    if (typeof window !== 'undefined' && window.google) {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/calendar.events',
        callback: (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            setGoogleToken(tokenResponse.access_token);
          }
        },
      });
      setTokenClient(client);
    }
  }, []);

  const fetchGoogleEvents = () => {
    if (!googleToken) return;
    setLoading(true);

    const firstDay = new Date(year, month, 1).toISOString();
    const lastDay = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

    fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${firstDay}&timeMax=${lastDay}&singleEvents=true&orderBy=startTime`,
      { headers: { Authorization: `Bearer ${googleToken}` } }
    )
      .then(res => res.json())
      .then(data => {
        const parsed = (data.items || []).map(item => {
          const raw = item.start?.dateTime || item.start?.date;
          return {
            id: item.id,
            title: item.summary || 'Fără titlu',
            description: item.description || '',
            date: raw ? raw.split('T')[0] : '',
            time: item.start?.dateTime ? raw.split('T')[1].substring(0, 5) : 'Toată ziua'
          };
        });
        setEvents(parsed);
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
      alert('Serviciul Google se încarcă... Dă un refresh la pagină dacă persistă.');
    }
  };

  const handleCreateEvent = (e) => {
    e.preventDefault();
    if (!newEvent.title.trim()) return alert('Completează titlul!');

    if (!googleToken) {
      alert('Apasă mai întâi pe butonul "Conectează Google Calendar" din dreapta sus!');
      return;
    }

    const startDateTime = new Date(`${selectedDate}T${newEvent.time}:00`).toISOString();
    const endDateTime = new Date(new Date(`${selectedDate}T${newEvent.time}:00`).getTime() + 60 * 60 * 1000).toISOString();

    fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${googleToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        summary: newEvent.title,
        description: newEvent.description,
        start: { dateTime: startDateTime },
        end: { dateTime: endDateTime }
      })
    })
      .then(res => res.json())
      .then(saved => {
        setEvents(prev => [
          ...prev,
          {
            id: saved.id,
            title: saved.summary,
            description: saved.description,
            date: selectedDate,
            time: newEvent.time
          }
        ]);
        setNewEvent({ title: '', time: '10:00', description: '' });
      })
      .catch(err => console.error(err));
  };

  const handleDeleteEvent = (id) => {
    if (!window.confirm('Ștergi acest eveniment din Google Calendar?')) return;

    fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${googleToken}` }
    })
      .then(() => setEvents(prev => prev.filter(ev => ev.id !== id)))
      .catch(err => console.error(err));
  };

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const startingOffset = (firstDayOfMonth + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const formatDateKey = (day) => {
    const formattedMonth = String(month + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    return `${year}-${formattedMonth}-${formattedDay}`;
  };

  const selectedDayEvents = events.filter(ev => ev.date === selectedDate);
  const todayKey = new Date().toISOString().split('T')[0];

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button 
          onClick={() => navigate('/dashboard')} 
          style={{ padding: '10px 18px', cursor: 'pointer', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}
        >
          ⬅️ Back to Dashboard
        </button>

        {!googleToken ? (
          <button
            onClick={handleGoogleAuth}
            style={{
              padding: '10px 18px',
              backgroundColor: '#fff',
              color: '#333',
              border: '2px solid #4285f4',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
              fontSize: '15px'
            }}
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" style={{ width: '20px', height: '20px' }} />
            Conectează Google Calendar
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ color: '#28a745', fontWeight: 'bold', fontSize: '15px' }}>● Sincronizat cu Google</span>
            <button 
              onClick={() => { setGoogleToken(null); setEvents([]); }} 
              style={{ padding: '8px 14px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Deconectează
            </button>
          </div>
        )}
      </div>

      <h1 style={{ textAlign: 'center', color: '#333', marginBottom: '25px' }}>
        📅 Google Calendar {loading && <span style={{ fontSize: '16px', color: '#888' }}>(Sincronizare...)</span>}
      </h1>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '15px 25px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '25px', border: '1px solid #e0e0e0' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} style={{ padding: '8px 14px', cursor: 'pointer', backgroundColor: '#f0f0f0', border: '1px solid #ccc', borderRadius: '5px', fontWeight: 'bold' }}>◀ Lună anterioară</button>
          <button onClick={() => { const now = new Date(); setCurrentDate(now); setSelectedDate(now.toISOString().split('T')[0]); }} style={{ padding: '8px 14px', cursor: 'pointer', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px' }}>Azi</button>
          <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} style={{ padding: '8px 14px', cursor: 'pointer', backgroundColor: '#f0f0f0', border: '1px solid #ccc', borderRadius: '5px', fontWeight: 'bold' }}>Lună următoare ▶</button>
        </div>
        <h2 style={{ margin: 0, color: '#222' }}>{monthNames[month]} {year}</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '25px', alignItems: 'start' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '10px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #e0e0e0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '10px', textAlign: 'center' }}>
            {daysOfWeek.map(d => (
              <div key={d} style={{ fontWeight: 'bold', color: '#666', padding: '8px 0', fontSize: '14px' }}>{d}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
            {Array.from({ length: startingOffset }).map((_, idx) => (
              <div key={`offset-${idx}`} style={{ minHeight: '80px', backgroundColor: '#fafafa', borderRadius: '6px', border: '1px dashed #eee' }} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const dateKey = formatDateKey(day);
              const isSelected = selectedDate === dateKey;
              const isToday = todayKey === dateKey;
              const dayEvents = events.filter(ev => ev.date === dateKey);

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDate(dateKey)}
                  style={{
                    minHeight: '80px',
                    padding: '8px',
                    borderRadius: '8px',
                    border: isSelected ? '2px solid #007bff' : isToday ? '2px solid #28a745' : '1px solid #e5e5e5',
                    backgroundColor: isSelected ? '#f0f7ff' : '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: '0.15s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                    <span style={{ fontWeight: isToday || isSelected ? 'bold' : 'normal', color: isToday ? '#28a745' : isSelected ? '#007bff' : '#333' }}>
                      {day}
                    </span>
                    {isToday && <span style={{ fontSize: '9px', backgroundColor: '#28a745', color: '#fff', padding: '1px 5px', borderRadius: '4px' }}>Azi</span>}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflow: 'hidden' }}>
                    {dayEvents.slice(0, 2).map(ev => (
                      <span
                        key={ev.id}
                        title={ev.title}
                        style={{
                          fontSize: '11px',
                          backgroundColor: '#e8f0fe',
                          color: '#1a73e8',
                          padding: '2px 4px',
                          borderRadius: '4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {ev.time ? `${ev.time} ` : ''}{ev.title}
                      </span>
                    ))}
                    {dayEvents.length > 2 && (
                      <span style={{ fontSize: '10px', color: '#888' }}>+{dayEvents.length - 2} altele</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #e0e0e0' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Adaugă în Google Calendar</h3>
            <p style={{ fontSize: '13px', color: '#666', marginTop: 0 }}>Data: <b>{selectedDate}</b></p>
            
            <form onSubmit={handleCreateEvent} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="text"
                placeholder="Titlu eveniment"
                value={newEvent.title}
                onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                required
                style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
              />

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <label style={{ fontSize: '13px', color: '#555' }}>Ora:</label>
                <input
                  type="time"
                  value={newEvent.time}
                  onChange={e => setNewEvent({ ...newEvent, time: e.target.value })}
                  style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc', flex: 1 }}
                />
              </div>

              <textarea
                placeholder="Descriere / Notițe (opțional)"
                value={newEvent.description}
                onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                rows={3}
                style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', resize: 'vertical' }}
              />

              <button
                type="submit"
                style={{
                  padding: '10px',
                  backgroundColor: googleToken ? '#007bff' : '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {googleToken ? '+ Salvează în Google' : 'Conectează Google mai sus'}
              </button>
            </form>
          </div>

          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #e0e0e0' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Evenimente: {selectedDate}</h3>

            {selectedDayEvents.length === 0 ? (
              <p style={{ color: '#888', fontStyle: 'italic', fontSize: '14px' }}>
                {googleToken ? 'Niciun eveniment în această zi.' : 'Conectează contul Google pentru a vedea evenimentele.'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {selectedDayEvents.map(ev => (
                  <div
                    key={ev.id}
                    style={{
                      borderLeft: '4px solid #1a73e8',
                      padding: '10px 12px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '4px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'start'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#333' }}>{ev.title}</div>
                      {ev.time && <div style={{ fontSize: '12px', color: '#1a73e8', marginTop: '2px' }}>⏰ {ev.time}</div>}
                      {ev.description && <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>{ev.description}</div>}
                    </div>
                    <button
                      onClick={() => handleDeleteEvent(ev.id)}
                      style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
                      title="Șterge"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Calendar;