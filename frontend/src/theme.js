/**
 * Paleta și constantele vizuale ale aplicației.
 * Se folosesc în stilurile inline care nu pot fi acoperite de clasele din App.css.
 */
export const colors = {
  bg: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  text: '#0f172a',
  textMuted: '#64748b',
  textSoft: '#94a3b8',
  accent: '#5a3d5c',
  accentHover: '#6d4a70',
  accentSoft: '#f6eff7',
  accentBorder: '#ebd9eb',
  success: '#10b981',
  successSoft: '#ecfdf5',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  dangerBorder: '#fecaca',
  warningSoft: '#fffbeb',
  warningBorder: '#fde68a',
  info: '#2563eb',
  infoSoft: '#eff6ff'
};

export const radius = {
  sm: '6px',
  md: '8px',
  lg: '12px'
};

export const shadow = {
  card: '0 4px 6px -1px rgba(15, 23, 42, 0.05), 0 2px 4px -2px rgba(15, 23, 42, 0.05)',
  hover: '0 12px 20px -3px rgba(90, 61, 92, 0.15)'
};

/** Detectarea adminului, folosită și de layout, și de pagini. */
export function isAdminUser(user) {
  if (!user) return false;
  if (user.hasAdminAccess === true) return true;

  const role = String(user.role || '').toUpperCase();
  return role === 'ADMIN' && role !== 'USER';
}
