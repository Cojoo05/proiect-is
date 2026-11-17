import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'meetingRooms';

const DEFAULT_ROOMS = [
  { id: 1, name: 'Sala Alpha', location: 'Etaj 1, Birou 101', capacity: 8, equipment: 'TV, Whiteboard' },
  { id: 2, name: 'Sala Beta', location: 'Etaj 2, Birou 204', capacity: 4, equipment: 'TV' },
  { id: 3, name: 'Sala Gamma', location: 'Etaj 3, Birou 310', capacity: 12, equipment: 'Projector, Video call, Whiteboard' }
];

function loadRooms() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (err) {
    console.error(err);
  }
  return DEFAULT_ROOMS;
}

function MeetingRooms({ currentUser }) {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState(loadRooms);
  const [form, setForm] = useState({ name: '', location: '', capacity: '', equipment: '' });
  const [showForm, setShowForm] = useState(false);

  const persist = (nextRooms) => {
    setRooms(nextRooms);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRooms));
  };

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return alert('Completează numele sălii!');

    const newRoom = {
      id: Date.now(),
      name: form.name.trim(),
      location: form.location.trim(),
      capacity: form.capacity ? Number(form.capacity) : 0,
      equipment: form.equipment.trim()
    };

    persist([...rooms, newRoom]);
    setForm({ name: '', location: '', capacity: '', equipment: '' });
    setShowForm(false);
  };

  const handleDeleteRoom = (id) => {
    if (!window.confirm('Sigur dorești să ștergi această sală?')) return;
    persist(rooms.filter((room) => room.id !== id));
  };

  const handleReserve = (room) => {
    const startTime = window.prompt(`Rezervare pentru "${room.name}" - ora începerii (ex: 14:00):`, '10:00');
    if (!startTime) return;

    const duration = window.prompt('Durata rezervării în minute:', '60');
    if (!duration) return;

    const reservation = {
      room: room.name,
      startTime,
      duration: Number(duration),
      reservedBy: currentUser?.username || 'necunoscut',
      createdAt: new Date().toISOString()
    };

    const saved = JSON.parse(localStorage.getItem('meetingRoomReservations') || '[]');
    localStorage.setItem('meetingRoomReservations', JSON.stringify([...saved, reservation]));
    alert(`Sala "${room.name}" a fost rezervată de ${reservation.reservedBy} la ora ${startTime} (${duration} min).`);
  };

  return (
    <div style={{ padding: '30px', fontFamily: 'sans-serif', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{ padding: '8px 15px', cursor: 'pointer', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          ⬅️ Back to Dashboard
        </button>
        <h1 style={{ margin: 0, color: '#333', fontSize: '2rem' }}>🏢 Meeting Rooms</h1>
        <div style={{ width: '100px' }}></div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f8f9fa', padding: '12px 20px', borderRadius: '8px 8px 0 0', border: '1px solid #ddd', borderBottom: 'none' }}>
        <button
          onClick={() => setShowForm((prev) => !prev)}
          style={{ backgroundColor: '#5a3d5c', color: 'white', border: 'none', padding: '8px 18px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          {showForm ? 'CANCEL' : 'NEW ROOM'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreateRoom}
          style={{ backgroundColor: 'white', padding: '20px', border: '1px solid #ddd', borderTop: 'none', display: 'flex', gap: '10px', flexWrap: 'wrap' }}
        >
          <input
            type="text"
            placeholder="Nume sală"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            style={{ padding: '10px', flex: '1', minWidth: '160px' }}
          />
          <input
            type="text"
            placeholder="Locație"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            style={{ padding: '10px', flex: '1', minWidth: '160px' }}
          />
          <input
            type="number"
            min="0"
            placeholder="Capacitate"
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            style={{ padding: '10px', width: '120px' }}
          />
          <input
            type="text"
            placeholder="Dotări (TV, projector...)"
            value={form.equipment}
            onChange={(e) => setForm({ ...form, equipment: e.target.value })}
            style={{ padding: '10px', flex: '1', minWidth: '160px' }}
          />
          <button
            type="submit"
            style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Add Room
          </button>
        </form>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '18px', marginTop: showForm ? '18px' : '0' }}>
        {rooms.length === 0 ? (
          <p style={{ color: '#888' }}>Nu există nicio sală. Apasă pe <strong>NEW ROOM</strong> pentru a adăuga una.</p>
        ) : (
          rooms.map((room) => (
            <div
              key={room.id}
              style={{ backgroundColor: 'white', border: '1px solid #ddd', borderLeft: '4px solid #5a3d5c', borderRadius: '8px', padding: '18px', boxShadow: '0 2px 6px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}
            >
              <h3 style={{ margin: '0 0 8px 0', color: '#333' }}>{room.name}</h3>
              <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#666' }}>📍 {room.location || '-'}</p>
              <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#666' }}>👥 Capacitate: {room.capacity || '-'}</p>
              <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#666' }}>🔧 {room.equipment || '-'}</p>

              <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleReserve(room)}
                  style={{ flex: 1, padding: '8px 12px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Rezervă
                </button>
                <button
                  onClick={() => handleDeleteRoom(room.id)}
                  style={{ padding: '8px 12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default MeetingRooms;
