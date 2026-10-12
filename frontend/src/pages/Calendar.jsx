import { useState, useEffect } from 'react';

function Calendar({ setCurrentView, currentUser }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [events, setEvents] = useState([
    // Câteva evenimente de test implicite
    { id: 1, title: 'Sprint Planning', date: new Date().toISOString().split('T')[0], time: '10:00', description: 'Ședință planificare proiect' }
  ]);
  const [newEvent, setNewEvent] = useState({ title: '', time: '09:00', description: '' });

  const API_URL = 'http://localhost:8080/api/events';

  // Formatare an și lună curentă pentru antet
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
    'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'
  ];

  const daysOfWeek = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'];

  // Preluare evenimente de la backend
  const fetchEvents = () => {
    fetch(API_URL)
      .then(res => {
        if (!res.ok) throw new Error('Backend offline');
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) setEvents(data);
      })
      .catch(err => {
        console.warn('Nu s-au putut prelua evenimentele de pe server, se folosesc cele locale:', err);
      });
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // Calcule pentru generarea grilei calendarului
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  // Ajustare pentru săptămâna care începe luni (0 = Duminică în JS)
  const startingOffset = (firstDayOfMonth + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today.toISOString().split('T')[0]);
  };

  const formatDateKey = (day) => {
    const formattedMonth = String(month + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    return `${year}-${formattedMonth}-${formattedDay}`;
  };

  // Creare eveniment nou
  const handleCreateEvent = (e) => {
    e.preventDefault();
    if (!newEvent.title.trim()) return alert('Completează titlul evenimentului!');

    const eventPayload = {
      title: newEvent.title,
      description: newEvent.description,
      date: selectedDate,
      time: newEvent.time,
      userId: currentUser?.id
    };

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventPayload)
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Eroare salvare backend');
        const saved = await res.json();
        setEvents(prev => [...prev, saved]);
      })
      .catch(() => {
        // Fallback local dacă endpoint-ul backend nu e încă configurat
        const localMock = { ...eventPayload, id: Date.now() };
        setEvents(prev => [...prev, localMock]);
      });

    setNewEvent({ title: '', time: '09:00', description: '' });
  };

  // Ștergere eveniment
  const handleDeleteEvent = (id) => {
    if (window.confirm('Ești sigur că vrei să ștergi acest eveniment?')) {
      fetch(`${API_URL}/${id}`, { method: 'DELETE' })
        .then(() => {
          setEvents(prev => prev.filter(ev => ev.id !== id));
        })
        .catch(() => {
          setEvents(prev => prev.filter(ev => ev.id !== id));
        });
    }
  };

  const selectedDayEvents = events.filter(ev => ev.date === selectedDate);
  const todayKey = new Date().toISOString().split('T')[0];

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Buton Înapoi */}
      <button 
        onClick={() => setCurrentView('dashboard')} 
        style={{ padding: '8px 15px', marginBottom: '20px', cursor: 'pointer', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '5px' }}
      >
        ⬅️ Back to Dashboard
      </button>

      <h1 style={{ textAlign: 'center', color: '#333', marginBottom: '25px' }}>📅 Calendar & Programări</h1>

      {/* Bară de navigare lună */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '15px 25px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '25px', border: '1px solid #e0e0e0' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handlePrevMonth} style={{ padding: '8px 14px', cursor: 'pointer', backgroundColor: '#f0f0f0', border: '1px solid #ccc', borderRadius: '5px', fontWeight: 'bold' }}>◀ Lună anterioară</button>
          <button onClick={handleToday} style={{ padding: '8px 14px', cursor: 'pointer', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px' }}>Azi</button>
          <button onClick={handleNextMonth} style={{ padding: '8px 14px', cursor: 'pointer', backgroundColor: '#f0f0f0', border: '1px solid #ccc', borderRadius: '5px', fontWeight: 'bold' }}>Lună următoare ▶</button>
        </div>
        <h2 style={{ margin: 0, color: '#222' }}>{monthNames[month]} {year}</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '25px', alignItems: 'start' }}>
        {/* Grila Calendar */}
        <div style={{ backgroundColor: 'white', borderRadius: '10px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #e0e0e0' }}>
          {/* Zilele săptămânii */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '10px', textAlign: 'center' }}>
            {daysOfWeek.map(d => (
              <div key={d} style={{ fontWeight: 'bold', color: '#666', padding: '8px 0', fontSize: '14px' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Căsuțele zilelor */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
            {/* Zile goale de offset */}
            {Array.from({ length: startingOffset }).map((_, idx) => (
              <div key={`offset-${idx}`} style={{ minHeight: '80px', backgroundColor: '#fafafa', borderRadius: '6px', border: '1px dashed #eee' }} />
            ))}

            {/* Zilele lunii */}
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
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                    <span style={{ fontWeight: isToday || isSelected ? 'bold' : 'normal', color: isToday ? '#28a745' : isSelected ? '#007bff' : '#333' }}>
                      {day}
                    </span>
                    {isToday && <span style={{ fontSize: '9px', backgroundColor: '#28a745', color: '#fff', padding: '1px 5px', borderRadius: '4px' }}>Azi</span>}
                  </div>

                  {/* Evenimente scurte în celulă */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflow: 'hidden' }}>
                    {dayEvents.slice(0, 2).map(ev => (
                      <span
                        key={ev.id}
                        style={{
                          fontSize: '11px',
                          backgroundColor: '#e7f1ff',
                          color: '#0056b3',
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

        {/* Panou Lateral: Adăugare & Listă Evenimente pentru ziua selectată */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Formular Adăugare */}
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #e0e0e0' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Adaugă eveniment</h3>
            <p style={{ fontSize: '13px', color: '#666', marginTop: 0 }}>Pentru data: <b>{selectedDate}</b></p>
            
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
                style={{ padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                + Salvează Evenimentul
              </button>
            </form>
          </div>

          {/* Lista Evenimentelor pentru ziua selectată */}
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #e0e0e0' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Evenimente: {selectedDate}</h3>

            {selectedDayEvents.length === 0 ? (
              <p style={{ color: '#888', fontStyle: 'italic', fontSize: '14px' }}>Niciun eveniment programat pentru această zi.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {selectedDayEvents.map(ev => (
                  <div
                    key={ev.id}
                    style={{
                      borderLeft: '4px solid #007bff',
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
                      {ev.time && <div style={{ fontSize: '12px', color: '#007bff', marginTop: '2px' }}>⏰ {ev.time}</div>}
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