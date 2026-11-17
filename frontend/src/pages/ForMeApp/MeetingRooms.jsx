import { useState } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import Modal from '../../components/Modal.jsx';
import { formatShortDateTime } from '../../utils/format.js';
import { colors } from '../../theme.js';

const STORAGE_KEY = 'meetingRooms';
const RESERVATIONS_KEY = 'meetingRoomReservations';

const DEFAULT_ROOMS = [
  { id: 1, name: 'Sala Alpha', location: 'Etaj 1, Birou 101', capacity: 8, equipment: 'TV, Whiteboard' },
  { id: 2, name: 'Sala Beta', location: 'Etaj 2, Birou 204', capacity: 4, equipment: 'TV' },
  { id: 3, name: 'Sala Gamma', location: 'Etaj 3, Birou 310', capacity: 12, equipment: 'Projector, Video call, Whiteboard' }
];

const EMPTY_ROOM = { name: '', location: '', capacity: '', equipment: '' };

const DURATIONS = [30, 60, 90, 120];

function loadRooms() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (err) {
    console.error(err);
  }
  return DEFAULT_ROOMS;
}

function loadReservations() {
  try {
    const saved = localStorage.getItem(RESERVATIONS_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function MeetingRooms({ currentUser }) {
  const toast = useToast();

  const [rooms, setRooms] = useState(loadRooms);
  const [reservations, setReservations] = useState(loadReservations);
  const [form, setForm] = useState(EMPTY_ROOM);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [reservingRoom, setReservingRoom] = useState(null);
  const [reservation, setReservation] = useState({ startTime: '10:00', duration: 60 });

  const persistRooms = (nextRooms) => {
    setRooms(nextRooms);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRooms));
  };

  const persistReservations = (nextReservations) => {
    setReservations(nextReservations);
    localStorage.setItem(RESERVATIONS_KEY, JSON.stringify(nextReservations));
  };

  const handleCreateRoom = (event) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setError('Completează numele sălii.');
      return;
    }

    const newRoom = {
      id: Date.now(),
      name: form.name.trim(),
      location: form.location.trim(),
      capacity: form.capacity ? Number(form.capacity) : 0,
      equipment: form.equipment.trim()
    };

    persistRooms([...rooms, newRoom]);
    setForm(EMPTY_ROOM);
    setShowForm(false);
    setError('');
    toast.success(`Sala „${newRoom.name}" a fost adăugată.`);
  };

  const confirmDeleteRoom = () => {
    if (!pendingDelete) return;

    persistRooms(rooms.filter((room) => room.id !== pendingDelete.id));
    setPendingDelete(null);
    toast.success('Sală ștearsă.');
  };

  const openReservation = (room) => {
    setReservingRoom(room);
    setReservation({ startTime: '10:00', duration: 60 });
  };

  const handleReserve = (event) => {
    event.preventDefault();
    if (!reservingRoom) return;

    if (!reservation.startTime) {
      toast.error('Alege ora de început.');
      return;
    }

    const entry = {
      id: Date.now(),
      roomId: reservingRoom.id,
      room: reservingRoom.name,
      startTime: reservation.startTime,
      duration: Number(reservation.duration),
      reservedBy: currentUser?.username || 'necunoscut',
      createdAt: new Date().toISOString()
    };

    persistReservations([...reservations, entry]);
    setReservingRoom(null);
    toast.success(
      `Sala „${entry.room}" rezervată la ${entry.startTime} pentru ${entry.duration} min.`
    );
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">🏢 Săli de ședință</h1>
          <p className="page-subtitle">Adaugă săli și rezervă-le pentru întâlniri.</p>
        </div>

        <button
          type="button"
          className={`btn ${showForm ? 'btn--secondary' : 'btn--primary'}`}
          onClick={() => {
            setShowForm((prev) => !prev);
            setError('');
          }}
        >
          {showForm ? 'Anulează' : '+ Sală nouă'}
        </button>
      </div>

      {error && (
        <div className="alert alert--error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => setError('')}
            aria-label="Închide mesajul de eroare"
          >
            ✕
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreateRoom} className="card" style={{ marginBottom: '24px' }} noValidate>
          <h2 style={{ margin: '0 0 16px', fontSize: '1.05rem', color: '#1e293b' }}>Sală nouă</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label" htmlFor="room-name">Nume sală *</label>
              <input
                id="room-name"
                className="input"
                type="text"
                placeholder="ex: Sala Delta"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label" htmlFor="room-location">Locație</label>
              <input
                id="room-location"
                className="input"
                type="text"
                placeholder="ex: Etaj 2, Birou 204"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label" htmlFor="room-capacity">Capacitate</label>
              <input
                id="room-capacity"
                className="input"
                type="number"
                min="0"
                placeholder="ex: 8"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              />
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label" htmlFor="room-equipment">Dotări</label>
              <input
                id="room-equipment"
                className="input"
                type="text"
                placeholder="TV, projector..."
                value={form.equipment}
                onChange={(e) => setForm({ ...form, equipment: e.target.value })}
              />
            </div>
          </div>

          <button type="submit" className="btn btn--primary" style={{ marginTop: '18px' }}>
            Adaugă sala
          </button>
        </form>
      )}

      {rooms.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: '40px', marginBottom: '10px' }} aria-hidden="true">🏢</div>
          Nu există nicio sală. Apasă pe <strong>+ Sală nouă</strong> pentru a adăuga una.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '18px' }}>
          {rooms.map((room) => {
            const roomReservations = reservations.filter((item) => item.roomId === room.id);

            return (
              <article
                key={room.id}
                className="card"
                style={{ display: 'flex', flexDirection: 'column', borderLeft: `4px solid ${colors.accent}` }}
              >
                <h2 style={{ margin: '0 0 8px', fontSize: '1.1rem', color: '#1e293b' }}>{room.name}</h2>
                <p style={{ margin: '0 0 4px', fontSize: '13px', color: colors.textMuted }}>
                  📍 {room.location || '—'}
                </p>
                <p style={{ margin: '0 0 4px', fontSize: '13px', color: colors.textMuted }}>
                  👥 Capacitate: {room.capacity || '—'}
                </p>
                <p style={{ margin: '0 0 14px', fontSize: '13px', color: colors.textMuted }}>
                  🔧 {room.equipment || '—'}
                </p>

                {roomReservations.length > 0 && (
                  <ul style={{ margin: '0 0 14px', paddingLeft: '18px', fontSize: '12px', color: colors.textMuted }}>
                    {roomReservations.slice(-2).map((item) => (
                      <li key={item.id}>
                        {item.startTime} · {item.duration} min · {item.reservedBy}
                      </li>
                    ))}
                  </ul>
                )}

                <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn btn--primary btn--sm" onClick={() => openReservation(room)} style={{ flex: 1 }}>
                    Rezervă
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    onClick={() => setPendingDelete(room)}
                    aria-label={`Șterge sala ${room.name}`}
                  >
                    🗑️
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {reservations.length > 0 && (
        <section style={{ marginTop: '32px' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: '1.05rem', color: '#1e293b' }}>
            Rezervările mele ({reservations.length})
          </h2>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Sală</th>
                  <th>Ora</th>
                  <th>Durată</th>
                  <th>Rezervată de</th>
                  <th>Când</th>
                </tr>
              </thead>
              <tbody>
                {[...reservations]
                  .reverse()
                  .slice(0, 10)
                  .map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600, color: '#1e293b' }}>{item.room}</td>
                      <td>{item.startTime}</td>
                      <td>{item.duration} min</td>
                      <td>{item.reservedBy}</td>
                      <td style={{ color: colors.textMuted }}>{formatShortDateTime(item.createdAt)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Modal
        open={Boolean(reservingRoom)}
        title={reservingRoom ? `Rezervă „${reservingRoom.name}"` : 'Rezervă sală'}
        onClose={() => setReservingRoom(null)}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn--secondary" onClick={() => setReservingRoom(null)}>
              Anulează
            </button>
            <button type="submit" form="reserve-room-form" className="btn btn--primary">
              Rezervă
            </button>
          </>
        }
      >
        <form id="reserve-room-form" onSubmit={handleReserve}>
          <div className="field">
            <label className="label" htmlFor="reservation-start">Ora începerii</label>
            <input
              id="reservation-start"
              className="input"
              type="time"
              value={reservation.startTime}
              onChange={(e) => setReservation({ ...reservation, startTime: e.target.value })}
              required
            />
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label className="label" htmlFor="reservation-duration">Durată</label>
            <select
              id="reservation-duration"
              className="select"
              value={reservation.duration}
              onChange={(e) => setReservation({ ...reservation, duration: Number(e.target.value) })}
            >
              {DURATIONS.map((duration) => (
                <option key={duration} value={duration}>
                  {duration} minute
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Ștergi sala?"
        message={pendingDelete ? `„${pendingDelete.name}" va fi ștearsă din listă.` : ''}
        confirmLabel="Șterge sala"
        onConfirm={confirmDeleteRoom}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

export default MeetingRooms;
