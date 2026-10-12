import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AdminPanel from './pages/AdminPanel.jsx';
import TasksBoard from './pages/TasksBoard';
import './App.css';

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('currentUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={currentUser ? "/dashboard" : "/login"} />} />
        
        <Route path="/login" element={currentUser ? <Navigate to="/dashboard" /> : <Login setCurrentUser={setCurrentUser} />} />
        <Route path="/register" element={<Register />} />
        
        <Route path="/dashboard" element={currentUser ? <Dashboard currentUser={currentUser} setCurrentUser={setCurrentUser} /> : <Navigate to="/login" />} />
        <Route path="/admin-panel" element={currentUser ? <AdminPanel /> : <Navigate to="/login" />} />
        <Route path="/tasks" element={currentUser ? <TasksBoard currentUser={currentUser} /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;