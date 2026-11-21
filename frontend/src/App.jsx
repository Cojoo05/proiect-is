import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';

import { ToastProvider } from './context/ToastContext.jsx';
import { isAdminUser } from './theme.js';

import Login from './pages/Auth/Login.jsx';
import Register from './pages/Auth/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AdminPanel from './pages/AdminPanel.jsx';
import TasksBoard from './pages/TasksBoard.jsx';
import ForMeDashboard from './pages/ForMeApp/ForMeDashboard.jsx';
import ProjectsDashboard from './pages/ProjectsDashboard.jsx';
import ProjectDetail from './pages/ProjectDetail.jsx';
import MessagesPage from './pages/MessagesPage.jsx';
import NotesPage from './pages/ForMeApp/NotesPage.jsx';
import RemindersPage from './pages/ForMeApp/RemindersPage.jsx';
import MeetingRooms from './pages/ForMeApp/MeetingRooms.jsx';
import AnnouncementsPage from './pages/AnnouncementsPage.jsx';
import NotFound from './pages/NotFound.jsx';
import Calendar from './pages/Calendar.jsx';
import Settings from './pages/Settings.jsx';
import KnowledgePage from './pages/KnowledgePage.jsx';
import TopBar from './components/TopBar.jsx';

import './App.css';

// Layout that injects TopBar on every authenticated page
function AuthLayout({ currentUser, setCurrentUser }) {
  return (
    <>
      <TopBar currentUser={currentUser} setCurrentUser={setCurrentUser} />
      <main className="app-main">
        <Outlet context={{ currentUser, setCurrentUser }} />
      </main>
    </>
  );
}

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('currentUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const isAdmin = isAdminUser(currentUser);

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes — no TopBar */}
          <Route path="/login" element={currentUser ? <Navigate to="/dashboard" /> : <Login setCurrentUser={setCurrentUser} />} />
          <Route path="/register" element={<Register setCurrentUser={setCurrentUser} />} />

          {/* Root redirect */}
          <Route path="/" element={<Navigate to={currentUser ? '/dashboard' : '/login'} />} />

          {/* Authenticated routes — TopBar injected via layout */}
          <Route
            element={
              currentUser
                ? <AuthLayout currentUser={currentUser} setCurrentUser={setCurrentUser} />
                : <Navigate to="/login" />
            }
          >
            <Route path="/dashboard" element={<Dashboard currentUser={currentUser} setCurrentUser={setCurrentUser} />} />
            <Route
              path="/admin-panel"
              element={isAdmin ? <AdminPanel currentUser={currentUser} /> : <Navigate to="/dashboard" replace />}
            />
            <Route path="/tasks" element={<TasksBoard currentUser={currentUser} />} />
            <Route path="/settings" element={<Settings currentUser={currentUser} setCurrentUser={setCurrentUser} />} />
            <Route path="/projects" element={<ProjectsDashboard currentUser={currentUser} />} />
            <Route path="/projects/:projectId" element={<ProjectDetail currentUser={currentUser} />} />
            <Route path="/messages" element={<MessagesPage currentUser={currentUser} />} />
            <Route path="/calendar" element={<Calendar currentUser={currentUser} />} />
            <Route path="/knowledge" element={<KnowledgePage currentUser={currentUser} />} />
            <Route path="/announcements" element={<AnnouncementsPage currentUser={currentUser} />} />
            <Route path="/meeting-rooms" element={<MeetingRooms currentUser={currentUser} />} />
            <Route path="/for-me" element={<ForMeDashboard currentUser={currentUser} setCurrentUser={setCurrentUser} />} />
            <Route path="/for-me/notes" element={<NotesPage currentUser={currentUser} />} />
            <Route path="/for-me/reminders" element={<RemindersPage currentUser={currentUser} />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
