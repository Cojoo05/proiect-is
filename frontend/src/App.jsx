import { useState } from 'react';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AdminPanel from './pages/AdminPanel.jsx';
import TasksBoard from './pages/TasksBoard';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('login');
  const [currentUser, setCurrentUser] = useState(null);

  return (
    <>
      {currentView === 'login' && <Login setCurrentView={setCurrentView} />}
      {currentView === 'register' && <Register setCurrentView={setCurrentView} />}
      {currentView === 'dashboard' && <Dashboard setCurrentView={setCurrentView} />}
      {currentView === 'admin' && <AdminPanel setCurrentView={setCurrentView} />}
      {currentView === 'tasks' && <TasksBoard setCurrentView={setCurrentView} currentUser={currentUser} />}
    </>
  );
}

export default App;