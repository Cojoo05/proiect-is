import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { ToastProvider } from './context/ToastContext.jsx';
import AppLayout from './components/AppLayout.jsx';

import Login from './pages/Auth/Login.jsx';
import Register from './pages/Auth/Register.jsx';
import Calendar from './pages/Calendar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AdminPanel from './pages/AdminPanel.jsx';
import TasksBoard from './pages/TasksBoard.jsx';
import ForMeDashboard from './pages/ForMeApp/ForMeDashboard.jsx';
import ProjectsDashboard from './pages/ProjectsDashboard.jsx';
import NotesPage from './pages/ForMeApp/NotesPage.jsx';
import MeetingRooms from './pages/ForMeApp/MeetingRooms.jsx';
import AnnouncementsPage from './pages/AnnouncementsPage.jsx';
import NotFound from './pages/NotFound.jsx';

import './App.css';

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('currentUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // Toate paginile autentificate primesc același layout (TopBar + logout).
  const withLayout = (page) =>
    currentUser ? (
      <AppLayout currentUser={currentUser} setCurrentUser={setCurrentUser}>
        {page}
      </AppLayout>
    ) : (
      <Navigate to="/login" replace />
    );

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to={currentUser ? '/dashboard' : '/login'} replace />} />

          <Route
            path="/login"
            element={currentUser ? <Navigate to="/dashboard" replace /> : <Login setCurrentUser={setCurrentUser} />}
          />
          <Route
            path="/register"
            element={currentUser ? <Navigate to="/dashboard" replace /> : <Register />}
          />

          <Route path="/dashboard" element={withLayout(<Dashboard currentUser={currentUser} />)} />
          <Route path="/calendar" element={withLayout(<Calendar currentUser={currentUser} />)} />
          <Route path="/tasks" element={withLayout(<TasksBoard currentUser={currentUser} />)} />
          <Route path="/projects" element={withLayout(<ProjectsDashboard currentUser={currentUser} />)} />
          <Route path="/admin-panel" element={withLayout(<AdminPanel />)} />
          <Route path="/announcements" element={withLayout(<AnnouncementsPage currentUser={currentUser} />)} />

          <Route path="/for-me" element={withLayout(<ForMeDashboard />)} />
          <Route path="/for-me/notes" element={withLayout(<NotesPage currentUser={currentUser} />)} />
          <Route path="/meeting-rooms" element={withLayout(<MeetingRooms currentUser={currentUser} />)} />

          <Route path="*" element={withLayout(<NotFound />)} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
