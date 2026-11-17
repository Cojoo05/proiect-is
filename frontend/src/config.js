export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? 'http://localhost:8080'
    : 'https://proiect-is-backend.onrender.com');

export const WS_BASE_URL = `${API_BASE_URL}/ws`;
