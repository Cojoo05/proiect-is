import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Auth/Login.jsx';
import Register from './pages/Auth/Register.jsx';
import Calendar from './pages/Calendar';

import Dashboard from './pages/Dashboard.jsx';
import AdminPanel from './pages/AdminPanel.jsx';
import TasksBoard from './pages/TasksBoard';
import ForMeDashboard from './pages/ForMeApp/ForMeDashboard.jsx';
import ProjectsDashboard from './pages/ProjectsDashboard.jsx';
import ProjectDetail from './pages/ProjectDetail.jsx';
import NotesPage from './pages/ForMeApp/NotesPage.jsx';
import './App.css';

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('currentUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  return (
    <BrowserRouter>
      <Routes>
        // For-Me
        <Route path="/for-me" element={currentUser ? <ForMeDashboard /> : <Navigate to="/login" />} />
        <Route path="/for-me/notes" element={currentUser ? <NotesPage currentUser={currentUser} /> : <Navigate to="/login" />} />
        
        // End for me

        <Route path="/" element={<Navigate to={currentUser ? "/dashboard" : "/login"} />} />
        
        <Route path="/login" element={currentUser ? <Navigate to="/dashboard" /> : <Login setCurrentUser={setCurrentUser} />} />
        <Route path="/register" element={<Register />} />
        <Route path="/calendar" element={<Calendar currentUser={currentUser} />} />
        <Route path="/dashboard" element={currentUser ? <Dashboard currentUser={currentUser} setCurrentUser={setCurrentUser} /> : <Navigate to="/login" />} />
        <Route path="/admin-panel" element={currentUser ? <AdminPanel /> : <Navigate to="/login" />} />
        <Route path="/tasks" element={currentUser ? <TasksBoard currentUser={currentUser} /> : <Navigate to="/login" />} />
        <Route path="/projects" element={currentUser ? <ProjectsDashboard currentUser={currentUser} /> : <Navigate to="/login" />} />
        <Route path="/projects/:projectId" element={currentUser ? <ProjectDetail currentUser={currentUser} /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;