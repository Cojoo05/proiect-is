export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? 'http://localhost:8080'
    : 'https://proiect-is-backend.onrender.com');

export const WS_BASE_URL = `${API_BASE_URL}/ws`;

export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '581947728431-1lqjbaf8ae86ig53pg7do170mdpmlgrd.apps.googleusercontent.com';
