import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Login from './pages/Auth/Login.jsx';
import Register from './pages/Auth/Register.jsx';
import Calendar from './pages/Calendar';
import Dashboard from './pages/Dashboard.jsx';
import AdminPanel from './pages/AdminPanel.jsx';
import TasksBoard from './pages/TasksBoard';
import ForMeDashboard from './pages/ForMeApp/ForMeDashboard.jsx';
import ProjectsDashboard from './pages/ProjectsDashboard.jsx';
import ProjectDetail from './pages/ProjectDetail.jsx';
import MessagesPage from './pages/MessagesPage.jsx';
import NotesPage from './pages/ForMeApp/NotesPage.jsx';
import TopBar from './components/TopBar.jsx';
import './App.css';

// Layout that injects TopBar on every authenticated page
function AuthLayout({ currentUser, setCurrentUser, children }) {
  return (
    <>
      <TopBar currentUser={currentUser} setCurrentUser={setCurrentUser} />
      <Outlet context={{ currentUser, setCurrentUser }} />
    </>
  );
}

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('currentUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const isAdmin = Boolean(
    currentUser?.hasAdminAccess === true ||
    (currentUser?.role && currentUser.role.toUpperCase() === 'ADMIN' && currentUser.role.toUpperCase() !== 'USER')
  );

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes — no TopBar */}
        <Route path="/login" element={currentUser ? <Navigate to="/dashboard" /> : <Login setCurrentUser={setCurrentUser} />} />
        <Route path="/register" element={<Register />} />

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
          <Route path="/projects" element={<ProjectsDashboard currentUser={currentUser} />} />
          <Route path="/projects/:projectId" element={<ProjectDetail currentUser={currentUser} />} />
          <Route path="/messages" element={<MessagesPage currentUser={currentUser} />} />
          <Route path="/calendar" element={<Calendar currentUser={currentUser} />} />
          <Route path="/for-me" element={<ForMeDashboard />} />
          <Route path="/for-me/notes" element={<NotesPage currentUser={currentUser} />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
