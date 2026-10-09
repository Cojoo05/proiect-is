import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [users, setUsers] = useState([])

  useEffect(() => {
    // Aici interfața apelează backend-ul tău din Java
    fetch('http://localhost:8080/api/users')
      .then(response => response.json())
      .then(data => setUsers(data))
      .catch(error => console.error("Eroare la preluarea datelor:", error));
  }, [])

  return (
    <div>
      <h1>Proiect IS - Frontend</h1>
      <h2>Utilizatori din Baza de Date:</h2>
      
      {users.length === 0 ? (
        <p>Baza de date este goală sau backend-ul nu este conectat.</p>
      ) : (
        <ul>
          {users.map(user => (
            <li key={user.id}>{user.email} - Rol: {user.role}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default App