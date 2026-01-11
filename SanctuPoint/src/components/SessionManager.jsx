import { useEffect, useRef, useState } from 'react';

const AUTO_LOGOUT_TIME = 30 * 60 * 1000;
const WARNING_TIME = 5 * 60 * 1000; 

function SessionManager({ user, onLogout }) {
  const logoutTimerRef = useRef(null);
  const warningTimerRef = useRef(null);
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(Math.floor(AUTO_LOGOUT_TIME / 1000));

  const resetTimer = () => {
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
    }
    
    setShowWarning(false);
    setTimeLeft(Math.floor(AUTO_LOGOUT_TIME / 1000));

    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      
      const warningInterval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(warningInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, AUTO_LOGOUT_TIME - WARNING_TIME);

    logoutTimerRef.current = setTimeout(() => {
      alert('You have been logged out due to inactivity.');
      onLogout();
    }, AUTO_LOGOUT_TIME);
  };

  const handleExtendSession = () => {
    resetTimer();
    setShowWarning(false);
  };

  const handleLogoutNow = () => {
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
    }
    onLogout();
  };

  useEffect(() => {
    if (!user) return;

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

    const handleActivity = () => {
      resetTimer();
    };

    events.forEach(event =>
      window.addEventListener(event, handleActivity)
    );

    resetTimer();

    return () => {
      events.forEach(event =>
        window.removeEventListener(event, handleActivity)
      );
      
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
      }
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
      }
    };
  }, [user, onLogout]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (!user) return null;

  return (
    <>
      {showWarning && (
        <div className="session-warning-overlay">
          <div className="session-warning-modal">
            <h3>Session About to Expire</h3>
            <p>Your session will expire in {formatTime(timeLeft)} due to inactivity.</p>
            <p>Move your mouse or click to stay logged in.</p>
            <div className="session-warning-buttons">
              <button 
                onClick={handleExtendSession}
                className="btn btn-primary"
              >
                Stay Logged In
              </button>
              <button 
                onClick={handleLogoutNow}
                className="btn btn-secondary"
              >
                Log Out Now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default SessionManager;