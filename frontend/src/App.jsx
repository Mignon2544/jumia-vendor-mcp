import { useState, useEffect } from 'react';
import Login from './Login';
import Dashboard from './Dashboard';

export default function App() {
  const [token, setToken] = useState(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('wizo_token');
    if (savedToken) setToken(savedToken);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('wizo_token');
    setToken(null);
  };

  if (!token) {
    return <Login onLogin={(t) => setToken(t)} />;
  }

  return <Dashboard token={token} onLogout={handleLogout} />;
}