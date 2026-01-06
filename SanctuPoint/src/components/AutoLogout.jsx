    import { useEffect, useRef } from 'react';

const AUTO_LOGOUT_TIME = 30 * 60 * 1000; 

function AutoLogout({ user, onLogout }) {
  const logoutTimerRef = useRef(null);

  const resetTimer = () => {
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
    }

    logoutTimerRef.current = setTimeout(() => {
      alert('You have been logged out due to inactivity.');
      onLogout();
    }, AUTO_LOGOUT_TIME);
  };

  useEffect(() => {
    if (!user) return;

    const events = ['mousemove', 'keydown', 'click', 'scroll'];

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
      clearTimeout(logoutTimerRef.current);
    };
  }, [user]);

  return null; 
}

export default AutoLogout;