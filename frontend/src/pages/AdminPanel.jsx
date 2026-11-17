import { useEffect, useMemo, useState } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { colors } from '../theme.js';

const API_URL = 'http://localhost:8080/api/users';

const EMPTY_FORM = { username: '', email: '', password: '', role: 'USER' };

function AdminPanel() {
  const toast = useToast();

  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'asc' });
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadUsers = () => {
    fetch(API_URL)
      .then((res) => {
        if (!res.ok) throw new Error('Utilizatorii nu au putut fi încărcați.');
        return res.json();
      })
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingId(null);
    setError('');
  };

  const handleSave = (event) => {
    event.preventDefault();

    if (!formData.username.trim() || !formData.email.trim()) {
      setError('Numele de utilizator și emailul sunt obligatorii.');
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(formData.email.trim())) {
      setError('Introdu o adresă de email validă.');
      return;
    }

    if (!editingId && formData.password.length < 8) {
      setError('Parola trebuie să aibă cel puțin 8 caractere.');
      return;
    }

    setError('');
    setSaving(true);

    const isEdit = Boolean(editingId);
    const url = isEdit ? `${API_URL}/${editingId}` : API_URL;
    const payload = {
      username: formData.username.trim(),
      email: formData.email.trim(),
      role: formData.role,
      password: formData.password
    };

    fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then((res) => {
        if (!res.ok) throw new Error('Serverul a respins salvarea. Verifică datele introduse.');
        return res.json();
      })
      .then(() => {
        toast.success(isEdit ? 'Utilizator actualizat.' : 'Utilizator adăugat.');
        resetForm();
        loadUsers();
      })
      .catch((err) => setError(err.message))
      .finally(() => setSaving(false));
  };

  const handleEdit = (user) => {
    setFormData({ username: user.username || '', email: user.email || '', password: '', role: user.role || 'USER' });
    setEditingId(user.id);
    setError('');
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;

    setDeleting(true);

    fetch(`${API_URL}/${pendingDelete.id}`, { method: 'DELETE' })
      .then((res) => {
        if (!res.ok) throw new Error('Utilizatorul nu a putut fi șters. Poate are proiecte sau taskuri asociate.');
        toast.success('Utilizator șters.');
        setPendingDelete(null);
        loadUsers();
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setDeleting(false));
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = query
      ? users.filter((user) =>
          `${user.id} ${user.username || ''} ${user.email || ''} ${user.role || ''}`
            .toLowerCase()
            .includes(query)
        )
      : users;

    return [...filtered].sort((a, b) => {
      const left = a[sortConfig.key];
      const right = b[sortConfig.key];
      if (left === right) return 0;
      const comparison = left > right ? 1 : -1;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [users, search, sortConfig]);

  const sortArrow = (key) => {
    if (sortConfig.key !== key) return '';
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
  };

  const ariaSort = (key) => {
    if (sortConfig.key !== key) return 'none';
    return sortConfig.direction === 'asc' ? 'ascending' : 'descending';
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">⚙️ Admin Panel</h1>
          <p className="page-subtitle">Administrare utilizatori și roluri de sistem.</p>
        </div>
      </div>

      <section className="card" style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '1.05rem', color: '#1e293b' }}>
          {editingId ? 'Editează utilizatorul' : 'Adaugă utilizator'}
        </h2>

        {error && (
          <div className="alert alert--error" role="alert">
            <span>{error}</span>
            <button type="button" className="toast-close" onClick={() => setError('')} aria-label="Închide mesajul">
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleSave} noValidate>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label" htmlFor="admin-username">Nume de utilizator</label>
              <input
                id="admin-username"
                className="input"
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
              />
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label" htmlFor="admin-email">Email</label>
              <input
                id="admin-email"
                className="input"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label" htmlFor="admin-password">Parolă</label>
              <input
                id="admin-password"
                className="input"
                type="password"
                autoComplete="new-password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                aria-describedby="admin-password-hint"
              />
              <p className="field-hint" id="admin-password-hint">
                {editingId ? 'Lasă gol pentru a păstra parola actuală.' : 'Minim 8 caractere.'}
              </p>
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label" htmlFor="admin-role">Rol</label>
              <select
                id="admin-role"
                className="select"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              >
                <option value="USER">User</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Se salvează...' : editingId ? 'Salvează modificările' : 'Adaugă utilizator'}
            </button>
            {(editingId || formData.username || formData.email) && (
              <button type="button" className="btn btn--secondary" onClick={resetForm} disabled={saving}>
                Anulează
              </button>
            )}
          </div>
        </form>
      </section>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <h2 style={{ margin: 0, fontSize: '1.05rem', color: '#1e293b' }}>
          Utilizatori ({visibleUsers.length})
        </h2>

        <input
          className="input"
          type="search"
          placeholder="Caută după nume, email sau rol..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Caută utilizatori"
          style={{ maxWidth: '300px' }}
        />
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th className="sortable" onClick={() => handleSort('id')} aria-sort={ariaSort('id')}>
                ID{sortArrow('id')}
              </th>
              <th className="sortable" onClick={() => handleSort('username')} aria-sort={ariaSort('username')}>
                Utilizator{sortArrow('username')}
              </th>
              <th className="sortable" onClick={() => handleSort('email')} aria-sort={ariaSort('email')}>
                Email{sortArrow('email')}
              </th>
              <th className="sortable" onClick={() => handleSort('role')} aria-sort={ariaSort('role')}>
                Rol{sortArrow('role')}
              </th>
              <th style={{ width: '150px' }}>Acțiuni</th>
            </tr>
          </thead>

          <tbody>
            {visibleUsers.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '28px', textAlign: 'center', color: colors.textMuted }}>
                  Niciun utilizator găsit.
                </td>
              </tr>
            ) : (
              visibleUsers.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td style={{ fontWeight: 600, color: '#1e293b' }}>{user.username}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`badge ${user.role?.toUpperCase() === 'ADMIN' ? 'badge--admin' : ''}`}>
                      {user.role}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" className="btn btn--secondary btn--sm" onClick={() => handleEdit(user)}>
                        Editează
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        onClick={() => setPendingDelete(user)}
                      >
                        Șterge
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Ștergi utilizatorul?"
        message={
          pendingDelete
            ? `„${pendingDelete.username}" (${pendingDelete.email}) va fi șters definitiv.`
            : ''
        }
        confirmLabel="Șterge utilizatorul"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

export default AdminPanel;
