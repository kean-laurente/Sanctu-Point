import { useState } from 'react';
import { authService } from '../../auth/authService';

const NavigationHeader = ({ currentPage, onPageChange }) => {
  const [activePage, setActivePage] = useState(currentPage || 'home');
  const currentUser = authService.getCurrentUser();

  // Admin menu items
  const adminMenuItems = [
    { key: 'home', label: 'Home', description: 'Dashboard' },
    { key: 'services', label: 'Services', description: 'Our Services' },
    { key: 'book-appointment', label: 'Book Appointment', description: 'Schedule New Appointment' },
    { key: 'appointment-schedule', label: 'Appointment Schedule', description: 'View Schedule' },
    { key: 'appointment-history', label: 'Appointment History', description: 'Past Appointments' },
    { key: 'staff-management', label: 'Staff Management', description: 'Manage Staff' },
    { key: 'donation', label: 'Donation', description: 'Support Us' }
  ];

  // Staff menu items 
  const staffMenuItems = [
    { key: 'home', label: 'Home', description: 'Dashboard' },
    { key: 'services', label: 'Services', description: 'Our Services' },
    { key: 'book-appointment', label: 'Book Appointment', description: 'Schedule New Appointment' },
    { key: 'appointment-schedule', label: 'Appointment Schedule', description: 'View Schedule' },
    { key: 'appointment-history', label: 'Appointment History', description: 'Past Appointments' }
  ];

  // Use appropriate menu based on user role
  const menuItems = currentUser?.role === 'admin' ? adminMenuItems : staffMenuItems;

  const handlePageClick = (pageKey) => {
    setActivePage(pageKey);
    onPageChange?.(pageKey);
  };

  return (
    <nav className="navigation-header">
      <div className="nav-container">
        <div className="nav-logo">
          <h2>SanctuPoint</h2>
        </div>
        <div className="nav-menu">
          {menuItems.map(item => (
            <button
              key={item.key}
              className={`nav-item ${activePage === item.key ? 'active' : ''}`}
              onClick={() => handlePageClick(item.key)}
            >
              <span className="nav-label">{item.label}</span>
              <span className="nav-description">{item.description}</span>
            </button>
          ))}
        </div>
      </div>

      <style jsx="true">{`
        .navigation-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 0;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .nav-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
        }

        .nav-logo {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .nav-logo h2 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 600;
          color: white;
        }

        .user-role-badge {
          background: rgba(255, 255, 255, 0.2);
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .nav-menu {
          display: flex;
          gap: 2px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 4px;
          backdrop-filter: blur(10px);
        }

        .nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 12px 20px;
          border: none;
          background: transparent;
          color: rgba(255, 255, 255, 0.8);
          cursor: pointer;
          border-radius: 8px;
          transition: all 0.3s ease;
          min-width: 120px;
        }

        .nav-item:hover {
          background: rgba(255, 255, 255, 0.15);
          color: white;
          transform: translateY(-1px);
        }

        .nav-item.active {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .nav-label {
          font-size: 0.9rem;
          font-weight: 600;
          margin-bottom: 2px;
        }

        .nav-description {
          font-size: 0.7rem;
          opacity: 0.8;
          text-align: center;
        }

        @media (max-width: 768px) {
          .nav-container {
            flex-direction: column;
            padding: 15px 20px;
            gap: 15px;
          }

          .nav-logo {
            flex-direction: column;
            gap: 8px;
            text-align: center;
          }

          .nav-menu {
            width: 100%;
            overflow-x: auto;
            justify-content: flex-start;
          }

          .nav-item {
            min-width: 100px;
            padding: 10px 15px;
          }

          .nav-label {
            font-size: 0.8rem;
          }

          .nav-description {
            font-size: 0.65rem;
          }
        }

        @media (max-width: 480px) {
          .nav-logo h2 {
            font-size: 1.2rem;
          }

          .nav-item {
            min-width: 90px;
            padding: 8px 12px;
          }

          .nav-label {
            font-size: 0.75rem;
          }

          .nav-description {
            display: none;
          }
        }
      `}</style>
    </nav>
  );
};

export default NavigationHeader;