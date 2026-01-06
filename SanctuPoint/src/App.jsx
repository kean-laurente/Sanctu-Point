import { useState, useEffect } from 'react';
import { authService } from './auth/authService';
import Login from './components/Login';
import AutoLogout from './components/autologout.jsx';
import AdminDashboard from './components/dashboard/AdminDashboard';
import StaffDashboard from './components/dashboard/StaffDashboard';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [staffUpdated, setStaffUpdated] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('App loading...');
    const currentUser = authService.getCurrentUser();
    console.log('Current user:', currentUser);
    
    if (currentUser && authService.isAuthenticated()) {
      setUser(currentUser);
    }
    setLoading(false);
  }, [staffUpdated]);

  const handleLoginSuccess = (userData) => {
    console.log('Login success:', userData);
    setUser(userData);
  };

  const handleLogout = async () => {
    await authService.logout();
    setUser(null);
  };

  const handleStaffUpdate = () => {
    setStaffUpdated(prev => prev + 1);
  };

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-spinner"></div>
        <p>Loading application...</p>
      </div>
    );
  }

  if (user) {
    console.log('Rendering dashboard for:', user.role);
    return (
      <div className="app">

        {/* AUTO LOGOUT COMPONENT */}
        <AutoLogout user={user} onLogout={handleLogout} />

        {user.role === 'admin' && (
          <AdminDashboard 
            user={user} 
            onLogout={handleLogout} 
            onStaffUpdate={handleStaffUpdate} 
          />
        )}

        {user.role === 'staff' && (
          <StaffDashboard 
            user={user} 
            onLogout={handleLogout} 
          />
        )}
      </div>
    );
  }

  console.log('Rendering login page');
  return (
    <div className="app">
      <Login onLoginSuccess={handleLoginSuccess} />
    </div>
  );
}

export default App;