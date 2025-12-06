const DashboardHeader = ({ user, onLogout, title, onStaffManagementClick }) => {
  return (
    <div className="dashboard-header">
      <div className="user-info">
        <h1>{title}</h1>
        <div className="user-details">
          <span className={`role-badge ${user.role}`}>
            {user.role.toUpperCase()}
          </span>
          <p><strong>Welcome,</strong> {user.first_name} {user.last_name}</p>
          <p><strong>Username:</strong> {user.username} | <strong>Email:</strong> {user.email}</p>
        </div>
      </div>
      <div className="header-actions">
        {user.role === 'admin' && (
          <button onClick={onStaffManagementClick} className="staff-management-button">
            Manage Staff
          </button>
        )}
        <button onClick={onLogout} className="logout-button">
          Logout
        </button>
      </div>

      <style jsx="true">{`
        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: white;
          padding: 20px 24px;
          border-bottom: 1px solid #e0e0e0;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .user-info h1 {
          margin: 0 0 8px 0;
          color: #333;
          font-size: 1.8rem;
        }

        .user-details {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .role-badge {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: bold;
          text-transform: uppercase;
        }

        .role-badge.admin {
          background: #007bff;
          color: white;
        }

        .role-badge.staff {
          background: #28a745;
          color: white;
        }

        .user-details p {
          margin: 0;
          color: #666;
          font-size: 0.9rem;
        }

        .header-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .staff-management-button {
          padding: 10px 20px;
          background: #28a745;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: background-color 0.2s;
        }

        .staff-management-button:hover {
          background: #218838;
        }

        .logout-button {
          padding: 10px 20px;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: background-color 0.2s;
        }

        .logout-button:hover {
          background: #c82333;
        }

        @media (max-width: 768px) {
          .dashboard-header {
            flex-direction: column;
            gap: 16px;
            align-items: flex-start;
          }

          .header-actions {
            align-self: stretch;
            justify-content: space-between;
          }

          .staff-management-button,
          .logout-button {
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default DashboardHeader;