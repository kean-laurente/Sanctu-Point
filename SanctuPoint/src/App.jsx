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
        // New tab - check if we should be logged in
        const newTabId = Date.now().toString();
        sessionStorage.setItem('tabId', newTabId);
        sessionStorage.setItem('tabCreated', Date.now().toString());
        
        if (currentUser && authService.isAuthenticated()) {
          // New tab with existing auth - check if this is a true new tab or a refresh
          const lastTabClosed = localStorage.getItem('lastTabClosed');
          const tabCreated = parseInt(sessionStorage.getItem('tabCreated'));
          
          if (lastTabClosed && (tabCreated - parseInt(lastTabClosed)) < 1000) {
            // Tab was just closed - treat as new session
            localStorage.removeItem('user');
            localStorage.removeItem('sessionActive');
            setUser(null);
          } else {
            // Valid new tab from existing session
            localStorage.setItem('sessionActive', 'true');
            setUser(currentUser);
          }
        } else {
          setUser(null);
        }
      } else {
        // Existing tab - check session
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

  // Detect tab close vs refresh
  useEffect(() => {
    let isRefreshing = false;
    
    // Detect refresh shortcuts
    const handleKeyDown = (e) => {
      // F5 or Ctrl+R
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
        isRefreshing = true;
      }
    };
    
    // Detect browser refresh button
    const handleBeforeUnload = (e) => {
      // Check if it's a refresh (by various methods)
      const navigationEntries = performance.getEntriesByType('navigation');
      const isPerformanceReload = navigationEntries.length > 0 && 
                                 navigationEntries[0].type === 'reload';
      
      // Check if refresh was triggered by keyboard or was a hard reload
      if (isRefreshing || isPerformanceReload || e.currentTarget.performance?.navigation?.type === 1) {
        console.log('Refresh detected - keeping session');
        // Don't clear sessionActive on refresh
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

  // Check page visibility (for detecting tab close)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page became hidden (tab switched or minimized)
        console.log('Tab hidden');
      } else {
        // Page became visible again
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
    // Set tab ID if not exists
    if (!sessionStorage.getItem('tabId')) {
      sessionStorage.setItem('tabId', Date.now().toString());
    }
    // Mark session as active
    localStorage.setItem('sessionActive', 'true');
    localStorage.removeItem('lastTabClosed'); // Clear any previous close markers
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
        {/* Auto-logout is now handled by SessionManager */}
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