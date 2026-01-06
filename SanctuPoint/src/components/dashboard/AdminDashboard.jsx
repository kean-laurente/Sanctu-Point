import { useState } from 'react';
import DashboardHeader from '../common/DashboardHeader';
import NavigationHeader from '../common/NavigationHeader';
import StaffManagement from '../StaffManagement';
import ServicesPage from '../pages/ServicesPage';
import BookAppointmentPage from '../pages/BookAppointmentPage';
import AppointmentSchedulePage from '../pages/AppointmentSchedulePage';
import AppointmentHistoryPage from '../pages/AppointmentHistoryPage';
import DonationPage from '../pages/DonationPage';
import SimpleDailyReports from '../reports/SimpleDailyReports';
import { printReceipt } from '../../utils/receiptUtils';

const AdminDashboard = ({ user, onLogout, onStaffUpdate }) => {
  const [currentPage, setCurrentPage] = useState('home');
  const [stats, setStats] = useState({
    totalAppointments: 0,
    pendingAppointments: 0,
    paidAmount: 0,
    staffCount: 0
  });

  const handleStaffManagementClick = () => {
    setCurrentPage('staff-management');
  };

  const handlePrintTestReceipt = () => {
    const testAppointment = {
      receipt_number: 'TEST-RECEIPT-001',
      customer_first_name: 'Test',
      customer_last_name: 'Customer',
      customer_email: 'test@example.com',
      appointment_date: new Date().toISOString().split('T')[0],
      appointment_time: '14:30',
      service_type: 'Sunday Worship Service',
      payment_amount: 0,
      amount_paid: 0,
      change_amount: 0,
      payment_method: 'cash',
      payment_status: 'paid'
    };
    printReceipt(testAppointment);
  };

  const renderPageContent = () => {
    switch (currentPage) {
      case 'home':
        return (
          <div className="dashboard-section">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Administrator Panel</h2>
            
            {/* Stats Cards */}
            <div className="stats-grid mb-8">
              <div className="stat-card">
                <div className="stat-icon">📅</div>
                <div className="stat-content">
                  <h3 className="stat-number">{stats.totalAppointments}</h3>
                  <p className="stat-label">Total Appointments</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">⏳</div>
                <div className="stat-content">
                  <h3 className="stat-number">{stats.pendingAppointments}</h3>
                  <p className="stat-label">Pending</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">💰</div>
                <div className="stat-content">
                  <h3 className="stat-number">₱{stats.paidAmount.toLocaleString()}</h3>
                  <p className="stat-label">Total Paid</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-content">
                  <h3 className="stat-number">{stats.staffCount}</h3>
                  <p className="stat-label">Staff Members</p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="quick-actions mb-8">
              <h3 className="text-lg font-semibold mb-4 text-gray-700">Quick Actions</h3>
              <div className="actions-grid">
                <button 
                  onClick={handleStaffManagementClick}
                  className="action-card"
                >
                  <div className="action-icon">👥</div>
                  <div className="action-content">
                    <h4>Manage Staff</h4>
                    <p>Add, edit, or remove staff accounts</p>
                  </div>
                </button>
                
                <button 
                  onClick={() => setCurrentPage('book-appointment')}
                  className="action-card"
                >
                  <div className="action-icon">➕</div>
                  <div className="action-content">
                    <h4>Book Appointment</h4>
                    <p>Create new appointment for client</p>
                  </div>
                </button>
                
                <button 
                  onClick={() => setCurrentPage('appointment-schedule')}
                  className="action-card"
                >
                  <div className="action-icon">📋</div>
                  <div className="action-content">
                    <h4>View Schedule</h4>
                    <p>See all scheduled appointments</p>
                  </div>
                </button>
                
                <button 
                  onClick={() => setCurrentPage('daily-reports')}
                  className="action-card"
                >
                  <div className="action-icon">📊</div>
                  <div className="action-content">
                    <h4>Daily Reports</h4>
                    <p>Generate accounting reports</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="recent-activity">
              <h3 className="text-lg font-semibold mb-4 text-gray-700">Recent Activity</h3>
              <div className="activity-list">
                <div className="activity-item">
                  <div className="activity-icon success">✓</div>
                  <div className="activity-content">
                    <p><strong>Appointment booked:</strong> John Doe - Wedding Ceremony</p>
                    <span className="activity-time">10 minutes ago</span>
                  </div>
                </div>
                
                <div className="activity-item">
                  <div className="activity-icon success">💰</div>
                  <div className="activity-content">
                    <p><strong>Payment received:</strong> ₱5,000.00 - Receipt #RCPT-240115-0001</p>
                    <span className="activity-time">1 hour ago</span>
                  </div>
                </div>
                
                <div className="activity-item">
                  <div className="activity-icon info">👥</div>
                  <div className="activity-content">
                    <p><strong>Staff added:</strong> Maria Santos - Receptionist</p>
                    <span className="activity-time">2 hours ago</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Test Tools (Development Only) */}
            <div className="test-tools mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="text-sm font-semibold mb-2 text-yellow-800">Development Tools</h3>
              <div className="flex gap-2">
                <button 
                  onClick={handlePrintTestReceipt}
                  className="px-3 py-1 text-sm bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200"
                >
                  Test Receipt Printing
                </button>
                <button 
                  onClick={() => setCurrentPage('services')}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                >
                  Manage Services
                </button>
                <button 
                  onClick={() => setCurrentPage('donation')}
                  className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded hover:bg-green-200"
                >
                  View Donations
                </button>
              </div>
            </div>
          </div>
        );
      
      case 'services':
        return <ServicesPage />;
      
      case 'book-appointment':
        return <BookAppointmentPage />;
      
      case 'appointment-schedule':
        return <AppointmentSchedulePage />;
      
      case 'appointment-history':
        return <AppointmentHistoryPage />;
      
      case 'staff-management':
        return <StaffManagement currentUser={user} onStaffUpdate={onStaffUpdate} />;
      
      case 'donation':
        return <DonationPage />;
      
      case 'daily-reports':
        return <SimpleDailyReports />;
      
      case 'payment-verification':
        return (
          <div className="page-container">
            <div className="page-content">
              <h2>Payment Verification</h2>
              <p>This feature will be available in the next update.</p>
            </div>
          </div>
        );
      
      default:
        return (
          <div className="dashboard-section">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Administrator Panel</h2>
            <div className="grid-responsive">
              <div className="card hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold mb-2 text-gray-700">Staff Management</h3>
                <p className="text-gray-600 mb-4">Manage staff accounts and permissions</p>
                <button 
                  onClick={handleStaffManagementClick}
                  className="btn btn-primary"
                >
                  Manage Staff
                </button>
              </div>
              <div className="card hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold mb-2 text-gray-700">Appointments</h3>
                <p className="text-gray-600 mb-4">View and manage all appointments</p>
                <button 
                  onClick={() => setCurrentPage('appointment-schedule')}
                  className="btn btn-primary"
                >
                  View Appointments
                </button>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="dashboard">
      <DashboardHeader 
        user={user} 
        onLogout={onLogout} 
        title="Admin Dashboard"
        onStaffManagementClick={handleStaffManagementClick}
      />
      
      <NavigationHeader currentPage={currentPage} onPageChange={setCurrentPage} />

      <div className="dashboard-content container">
        {renderPageContent()}
      </div>

      <style jsx>{`
        .dashboard {
          min-height: 100vh;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        }

        .dashboard-content {
          padding: 30px 20px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .dashboard-section {
          background: white;
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }

        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 20px;
        }

        .stat-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 12px;
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 20px;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.2);
        }

        .stat-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
        }

        .stat-icon {
          font-size: 32px;
          background: rgba(255,255,255,0.2);
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-content {
          flex: 1;
        }

        .stat-number {
          font-size: 28px;
          font-weight: 800;
          margin: 0 0 8px 0;
          text-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .stat-label {
          font-size: 14px;
          opacity: 0.9;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        /* Quick Actions */
        .quick-actions {
          margin-top: 40px;
        }

        .actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
        }

        .action-card {
          background: white;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 20px;
          cursor: pointer;
          transition: all 0.3s ease;
          text-align: left;
          width: 100%;
        }

        .action-card:hover {
          border-color: #4299e1;
          transform: translateY(-3px);
          box-shadow: 0 8px 25px rgba(66, 153, 225, 0.15);
          background: #f7fafc;
        }

        .action-icon {
          font-size: 24px;
          background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
          color: white;
          width: 50px;
          height: 50px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .action-content {
          flex: 1;
        }

        .action-content h4 {
          margin: 0 0 8px 0;
          color: #2d3748;
          font-size: 16px;
          font-weight: 600;
        }

        .action-content p {
          margin: 0;
          color: #718096;
          font-size: 14px;
          line-height: 1.4;
        }

        /* Recent Activity */
        .recent-activity {
          margin-top: 40px;
          padding-top: 30px;
          border-top: 2px solid #edf2f7;
        }

        .activity-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .activity-item {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 16px;
          background: #f8fafc;
          border-radius: 10px;
          border-left: 4px solid #4299e1;
        }

        .activity-icon {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 14px;
        }

        .activity-icon.success {
          background: #c6f6d5;
          color: #22543d;
        }

        .activity-icon.info {
          background: #bee3f8;
          color: #2c5282;
        }

        .activity-content {
          flex: 1;
        }

        .activity-content p {
          margin: 0 0 4px 0;
          color: #2d3748;
          font-size: 14px;
        }

        .activity-time {
          color: #a0aec0;
          font-size: 12px;
        }

        /* Responsive Grid */
        .grid-responsive {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 24px;
        }

        .card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          border: 2px solid #e2e8f0;
          transition: all 0.3s ease;
        }

        .card:hover {
          border-color: #4299e1;
          box-shadow: 0 8px 25px rgba(66, 153, 225, 0.15);
        }

        .btn {
          padding: 12px 24px;
          background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(66, 153, 225, 0.3);
        }

        /* Test Tools */
        .test-tools {
          border-radius: 12px;
        }

        @media (max-width: 768px) {
          .dashboard-content {
            padding: 20px 15px;
          }
          
          .dashboard-section {
            padding: 24px;
          }
          
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .actions-grid {
            grid-template-columns: 1fr;
          }
          
          .stat-card {
            flex-direction: column;
            text-align: center;
            gap: 15px;
          }
          
          .action-card {
            flex-direction: column;
            text-align: center;
            gap: 15px;
          }
          
          .activity-item {
            flex-direction: column;
            gap: 12px;
          }
        }

        @media (max-width: 480px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
          
          .grid-responsive {
            grid-template-columns: 1fr;
          }
          
          .stat-number {
            font-size: 24px;
          }
          
          .action-content h4 {
            font-size: 15px;
          }
          
          .action-content p {
            font-size: 13px;
          }
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;