import { useState } from 'react';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AdminPanel from './pages/AdminPanel.jsx';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('login'); 

  return (
    <>
      {currentView === 'login' && <Login setCurrentView={setCurrentView} />}
      {currentView === 'register' && <Register setCurrentView={setCurrentView} />}
      {currentView === 'dashboard' && <Dashboard setCurrentView={setCurrentView} />}
      {currentView === 'admin' && <AdminPanel setCurrentView={setCurrentView} />}
    </>
  );
}

export default App;