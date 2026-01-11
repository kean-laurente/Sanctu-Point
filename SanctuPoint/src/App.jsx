import { useState, useEffect, useRef } from 'react';
import { authService } from './auth/authService';
import Login from './components/Login';
import AdminDashboard from './components/dashboard/AdminDashboard';
import StaffDashboard from './components/dashboard/StaffDashboard';
import SessionManager from './components/SessionManager';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [staffUpdated, setStaffUpdated] = useState(0);
  const [loading, setLoading] = useState(true);
  const isTabClosingRef = useRef(false);

  useEffect(() => {
    console.log('App loading...');
    
    const initializeSession = () => {
      const tabId = sessionStorage.getItem('tabId');
      const currentUser = authService.getCurrentUser();
      
      if (!tabId) {
        const newTabId = Date.now().toString();
        sessionStorage.setItem('tabId', newTabId);
        sessionStorage.setItem('tabCreated', Date.now().toString());
        
        if (currentUser && authService.isAuthenticated()) {
          const lastTabClosed = localStorage.getItem('lastTabClosed');
          const tabCreated = parseInt(sessionStorage.getItem('tabCreated'));
          
          if (lastTabClosed && (tabCreated - parseInt(lastTabClosed)) < 1000) {
            localStorage.removeItem('user');
            localStorage.removeItem('sessionActive');
            setUser(null);
          } else {
            localStorage.setItem('sessionActive', 'true');
            setUser(currentUser);
          }
        } else {
          setUser(null);
        }
      } else {
        const sessionActive = localStorage.getItem('sessionActive');
        
        if (currentUser && authService.isAuthenticated() && sessionActive === 'true') {
          setUser(currentUser);
        } else {
          setUser(null);
        }
      }
    };
    
    initializeSession();
    setLoading(false);
  }, [staffUpdated]);

  useEffect(() => {
    let isRefreshing = false;
    
    const handleKeyDown = (e) => {
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
        isRefreshing = true;
      }
    };
    
    const handleBeforeUnload = (e) => {
      const navigationEntries = performance.getEntriesByType('navigation');
      const isPerformanceReload = navigationEntries.length > 0 && 
                                 navigationEntries[0].type === 'reload';
      
      if (isRefreshing || isPerformanceReload || e.currentTarget.performance?.navigation?.type === 1) {
        console.log('Refresh detected - keeping session');
      } else {
        console.log('Tab closing detected - logging out');
        isTabClosingRef.current = true;
        localStorage.removeItem('sessionActive');
        localStorage.setItem('lastTabClosed', Date.now().toString());
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('Tab hidden');
      } else {
        console.log('Tab visible again');
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleLoginSuccess = (userData) => {
    console.log('Login success:', userData);
    if (!sessionStorage.getItem('tabId')) {
      sessionStorage.setItem('tabId', Date.now().toString());
    }
    localStorage.setItem('sessionActive', 'true');
    localStorage.removeItem('lastTabClosed'); 
    setUser(userData);
  };

  const handleLogout = async () => {
    await authService.logout();
    localStorage.removeItem('sessionActive');
    localStorage.removeItem('lastTabClosed');
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
        {user && (
          <SessionManager 
            user={user} 
            onLogout={handleLogout} 
          />
        )}

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