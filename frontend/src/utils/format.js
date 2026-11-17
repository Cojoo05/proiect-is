export const TASK_STATUSES = ['PRIMIT', 'IN_LUCRU', 'TERMINAT', 'ANULAT'];

export const TASK_STATUS_LABELS = {
  PRIMIT: 'Primit',
  IN_LUCRU: 'În lucru',
  TERMINAT: 'Terminat',
  ANULAT: 'Anulat'
};

export const taskStatusLabel = (status) => TASK_STATUS_LABELS[status] || status || '—';

const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** 17 noiembrie 2026 */
export const formatDate = (value) => {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' });
};

/** 17 noiembrie 2026, 14:30 */
export const formatDateTime = (value) => {
  const date = toDate(value);
  if (!date) return '—';
  return (
    date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' }) +
    ', ' +
    date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
  );
};

/** 17 nov, 14:30 — variantă scurtă pentru liste. */
export const formatShortDateTime = (value) => {
  const date = toDate(value);
  if (!date) return '—';
  return (
    date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' }) +
    ', ' +
    date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
  );
};

/** 2026-11-17 — pentru input-uri de tip date. */
export const toDateInputValue = (value) => {
  const date = toDate(value);
  if (!date) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

/** „expiră în 3h" mai prietenos. */
export const formatTimeLeft = (value) => {
  const date = toDate(value);
  if (!date) return '—';

  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return 'expirat';

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours >= 24) return `expiră în ${Math.floor(hours / 24)} z`;
  if (hours >= 1) return `expiră în ${hours}h`;
  return `expiră în ${Math.max(1, Math.floor(diffMs / (1000 * 60)))} min`;
};
