import { useState, useEffect } from 'react';
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
import { appointmentService } from '../../services/appointmentService';
import { authService } from '../../auth/authService';
import { offeringService } from '../../services/offeringService';

const AdminDashboard = ({ user, onLogout, onStaffUpdate }) => {
  const [currentPage, setCurrentPage] = useState('home');
  const [stats, setStats] = useState({
    totalAppointments: 0,
    pendingAppointments: 0,
    confirmedAppointments: 0,
    completedAppointments: 0,
    paidAmount: 0,
    staffCount: 0,
    todayRevenue: 0,
    totalOfferings: 0,
    activeServices: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString().split('T')[0];
      
      const statsResult = await appointmentService.getAppointmentStats(
        startOfMonth,
        today,
        user
      );
      
      if (statsResult.success) {
        setStats(prev => ({
          ...prev,
          totalAppointments: statsResult.data.total_appointments || 0,
          pendingAppointments: statsResult.data.pending_count || 0,
          confirmedAppointments: statsResult.data.confirmed_count || 0,
          completedAppointments: statsResult.data.completed_count || 0,
          paidAmount: statsResult.data.total_service_revenue || 0
        }));
      }

      const staffMembers = await authService.getStaffMembers();
      setStats(prev => ({
        ...prev,
        staffCount: staffMembers.length
      }));

      const todayReport = await appointmentService.getDailyReport(today);
      if (todayReport.success) {
        setStats(prev => ({
          ...prev,
          todayRevenue: todayReport.data.totals.netRevenue || 0
        }));
      }

      const offeringsResult = await offeringService.getOfferingsSummary(
        startOfMonth,
        today,
        user
      );
      if (offeringsResult.success) {
        setStats(prev => ({
          ...prev,
          totalOfferings: offeringsResult.data.totals.total_offerings || 0
        }));
      }

      await loadRecentActivity();
      
      await loadUpcomingAppointments();

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentActivity = async () => {
    try {
      const result = await appointmentService.getAppointments(user);
      if (result.success) {
        const recentAppointments = result.data
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 5)
          .map(appointment => ({
            id: appointment.appointment_id,
            type: 'appointment',
            title: `Appointment booked: ${appointment.customer_first_name} ${appointment.customer_last_name} - ${appointment.service_type}`,
            time: new Date(appointment.created_at),
            icon: '📅',
            status: appointment.status
          }));

        const staffMembers = await authService.getStaffMembers();
        const recentStaff = staffMembers
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 3)
          .map(staff => ({
            id: staff.user_id,
            type: 'staff',
            title: `Staff added: ${staff.first_name} ${staff.last_name} - ${staff.username}`,
            time: new Date(staff.created_at),
            icon: '👥'
          }));

        const allActivities = [...recentAppointments, ...recentStaff]
          .sort((a, b) => b.time - a.time)
          .slice(0, 5);

        setRecentActivity(allActivities);
      }
    } catch (error) {
      console.error('Error loading recent activity:', error);
    }
  };

  const loadUpcomingAppointments = async () => {
    try {
      const result = await appointmentService.getUpcomingAppointments(5, user);
      if (result.success) {
        setUpcomingAppointments(result.data);
      }
    } catch (error) {
      console.error('Error loading upcoming appointments:', error);
    }
  };

  const formatTimeAgo = (date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return `${Math.floor(diffInSeconds / 2592000)} months ago`;
  };

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

  const handleRefreshDashboard = () => {
    loadDashboardData();
  };

  const renderPageContent = () => {
    switch (currentPage) {
      case 'home':
        return (
          <div className="dashboard-section">
            <div className="dashboard-header">
              <h2 className="text-2xl font-bold text-gray-800">Administrator Panel</h2>
              <div className="header-actions">
                <button 
                  onClick={handleRefreshDashboard}
                  className="refresh-btn"
                  disabled={loading}
                >
                  {loading ? 'Refreshing...' : '🔄 Refresh'}
                </button>
              </div>
            </div>
            
            <div className="stats-grid mb-8">
              <div className="stat-card blue">
                <div className="stat-icon">📅</div>
                <div className="stat-content">
                  <h3 className="stat-number">{stats.totalAppointments}</h3>
                  <p className="stat-label">Total Appointments</p>
                </div>
              </div>
              
              <div className="stat-card green">
                <div className="stat-icon">💰</div>
                <div className="stat-content">
                  <h3 className="stat-number">₱{stats.paidAmount.toLocaleString()}</h3>
                  <p className="stat-label">Monthly Revenue</p>
                </div>
              </div>
              
              <div className="stat-card purple">
                <div className="stat-icon">👥</div>
                <div className="stat-content">
                  <h3 className="stat-number">{stats.staffCount}</h3>
                  <p className="stat-label">Staff Members</p>
                </div>
              </div>
              
              <div className="stat-card orange">
                <div className="stat-icon">⚡</div>
                <div className="stat-content">
                  <h3 className="stat-number">{upcomingAppointments.length}</h3>
                  <p className="stat-label">Upcoming Today</p>
                </div>
              </div>
            </div>

            <div className="dashboard-grid">
              <div className="dashboard-card">
                <div className="card-header">
                  <h3 className="card-title">Today's Appointments</h3>
                  <button 
                    onClick={() => setCurrentPage('appointment-schedule')}
                    className="card-action"
                  >
                    View All →
                  </button>
                </div>
                <div className="card-content">
                  {upcomingAppointments.length === 0 ? (
                    <div className="empty-state">
                      <p>No appointments scheduled for today</p>
                    </div>
                  ) : (
                    <div className="appointments-list">
                      {upcomingAppointments.map(appointment => (
                        <div key={appointment.appointment_id} className="appointment-item">
                          <div className="appointment-time">
                            <span className="time">{appointment.appointment_time}</span>
                            <span className={`status-badge ${appointment.status}`}>
                              {appointment.status}
                            </span>
                          </div>
                          <div className="appointment-details">
                            <h4 className="service-type">{appointment.service_type}</h4>
                            <p className="customer-name">
                              {appointment.customer_first_name} {appointment.customer_last_name}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="dashboard-card">
                <div className="card-header">
                  <h3 className="card-title">Recent Activity</h3>
                  <span className="card-subtitle">Last 24 hours</span>
                </div>
                <div className="card-content">
                  {recentActivity.length === 0 ? (
                    <div className="empty-state">
                      <p>No recent activity</p>
                    </div>
                  ) : (
                    <div className="activity-list">
                      {recentActivity.map(activity => (
                        <div key={activity.id} className="activity-item">
                          <div className="activity-icon">{activity.icon}</div>
                          <div className="activity-content">
                            <p className="activity-title">{activity.title}</p>
                            <span className="activity-time">
                              {formatTimeAgo(activity.time)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
        {loading && currentPage === 'home' ? (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Loading dashboard data...</p>
          </div>
        ) : (
          renderPageContent()
        )}
      </div>

      <style>{`
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

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
          padding-bottom: 24px;
          border-bottom: 2px solid #f1f3f5;
        }

        .header-actions {
          display: flex;
          gap: 12px;
        }

        .refresh-btn,
        .reports-btn {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          font-size: 14px;
          transition: all 0.3s ease;
        }

        .refresh-btn {
          background: #f1f3f5;
          color: #495057;
        }

        .refresh-btn:hover:not(:disabled) {
          background: #e9ecef;
          transform: translateY(-1px);
        }

        .refresh-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .reports-btn {
          background: linear-gradient(135deg, #4dabf7 0%, #339af0 100%);
          color: white;
        }

        .reports-btn:hover {
          background: linear-gradient(135deg, #339af0 0%, #228be6 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(51, 154, 240, 0.3);
        }

        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 24px;
        }

        .stat-card {
          border-radius: 12px;
          padding: 28px;
          display: flex;
          align-items: center;
          gap: 20px;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(0,0,0,0.1);
          color: white;
        }

        .stat-card.blue {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .stat-card.green {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        }

        .stat-card.purple {
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
        }

        .stat-card.orange {
          background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
        }

        .stat-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        }

        .stat-icon {
          font-size: 40px;
          background: rgba(255,255,255,0.2);
          width: 70px;
          height: 70px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .stat-content {
          flex: 1;
        }

        .stat-number {
          font-size: 32px;
          font-weight: 800;
          margin: 0 0 8px 0;
          text-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .stat-label {
          font-size: 16px;
          opacity: 0.9;
          margin: 0 0 12px 0;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .stat-subtext {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .sub-item {
          font-size: 13px;
          opacity: 0.8;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .sub-item.pending {
          color: #ffd43b;
        }

        .sub-item.confirmed {
          color: #51cf66;
        }

        .sub-item.completed {
          color: #adb5bd;
        }

        /* Section Titles */
        .section-title {
          font-size: 20px;
          font-weight: 600;
          color: #2d3748;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 2px solid #edf2f7;
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

        .action-card.primary {
          border-color: #4299e1;
        }

        .action-card.secondary {
          border-color: #718096;
        }

        .action-card.success {
          border-color: #48bb78;
        }

        .action-card.warning {
          border-color: #ed8936;
        }

        .action-card.info {
          border-color: #4299e1;
        }

        .action-card.danger {
          border-color: #f56565;
        }

        .action-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.12);
        }

        .action-card.primary:hover {
          background: linear-gradient(135deg, #ebf8ff 0%, #ceedff 100%);
        }

        .action-card.secondary:hover {
          background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
        }

        .action-card.success:hover {
          background: linear-gradient(135deg, #f0fff4 0%, #dcffe4 100%);
        }

        .action-card.warning:hover {
          background: linear-gradient(135deg, #fffbeb 0%, #fff5c2 100%);
        }

        .action-card.info:hover {
          background: linear-gradient(135deg, #ebf8ff 0%, #ceedff 100%);
        }

        .action-card.danger:hover {
          background: linear-gradient(135deg, #fff5f5 0%, #ffecec 100%);
        }

        .action-icon {
          font-size: 28px;
          width: 60px;
          height: 60px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .action-card.primary .action-icon {
          background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
          color: white;
        }

        .action-card.secondary .action-icon {
          background: linear-gradient(135deg, #718096 0%, #4a5568 100%);
          color: white;
        }

        .action-card.success .action-icon {
          background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
          color: white;
        }

        .action-card.warning .action-icon {
          background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%);
          color: white;
        }

        .action-card.info .action-icon {
          background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
          color: white;
        }

        .action-card.danger .action-icon {
          background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%);
          color: white;
        }

        .action-content {
          flex: 1;
        }

        .action-content h4 {
          margin: 0 0 8px 0;
          color: #2d3748;
          font-size: 18px;
          font-weight: 600;
        }

        .action-content p {
          margin: 0;
          color: #718096;
          font-size: 14px;
          line-height: 1.4;
        }

        /* Dashboard Grid */
        .dashboard-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-top: 32px;
        }

        .dashboard-card {
          background: white;
          border: 2px solid #edf2f7;
          border-radius: 12px;
          overflow: hidden;
        }

        .card-header {
          padding: 20px 24px;
          background: #f8fafc;
          border-bottom: 2px solid #edf2f7;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .card-title {
          margin: 0;
          color: #2d3748;
          font-size: 18px;
          font-weight: 600;
        }

        .card-subtitle {
          color: #718096;
          font-size: 14px;
        }

        .card-action {
          background: none;
          border: none;
          color: #4299e1;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: color 0.2s;
        }

        .card-action:hover {
          color: #3182ce;
        }

        .card-content {
          padding: 24px;
        }

        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: #718096;
        }

        /* Appointments List */
        .appointments-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .appointment-item {
          display: flex;
          align-items: center;
          padding: 16px;
          background: #f8fafc;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          transition: all 0.2s;
        }

        .appointment-item:hover {
          background: #edf2f7;
          border-color: #cbd5e0;
        }

        .appointment-time {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-right: 16px;
          border-right: 2px solid #e2e8f0;
          min-width: 80px;
        }

        .time {
          font-size: 18px;
          font-weight: 600;
          color: #2d3748;
        }

        .status-badge {
          font-size: 11px;
          padding: 4px 8px;
          border-radius: 12px;
          font-weight: 600;
          text-transform: uppercase;
          margin-top: 4px;
        }

        .status-badge.pending {
          background: #fff3cd;
          color: #856404;
        }

        .status-badge.confirmed {
          background: #d4edda;
          color: #155724;
        }

        .status-badge.completed {
          background: #d1ecf1;
          color: #0c5460;
        }

        .appointment-details {
          flex: 1;
          padding-left: 16px;
        }

        .service-type {
          margin: 0 0 4px 0;
          color: #2d3748;
          font-size: 16px;
          font-weight: 600;
        }

        .customer-name {
          margin: 0;
          color: #718096;
          font-size: 14px;
        }

        /* Activity List */
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
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          background: #e2e8f0;
          flex-shrink: 0;
        }

        .activity-content {
          flex: 1;
        }

        .activity-title {
          margin: 0 0 4px 0;
          color: #2d3748;
          font-size: 14px;
          line-height: 1.4;
        }

        .activity-time {
          color: #a0aec0;
          font-size: 12px;
        }

        /* Loading Overlay */
        .loading-overlay {
          text-align: center;
          padding: 80px 40px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }

        .loading-spinner {
          border: 4px solid #f1f5f9;
          border-top: 4px solid #3b82f6;
          border-radius: 50%;
          width: 50px;
          height: 50px;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Test Tools */
        .test-tools {
          margin-top: 40px;
          padding-top: 32px;
          border-top: 2px solid #e2e8f0;
        }

        .test-btn {
          padding: 12px 24px;
          background: #f8f9fa;
          border: 2px solid #dee2e6;
          border-radius: 8px;
          color: #495057;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .test-btn:hover {
          background: #e9ecef;
          border-color: #ced4da;
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

        @media (max-width: 1024px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .dashboard-content {
            padding: 20px 15px;
          }
          
          .dashboard-section {
            padding: 24px;
          }
          
          .dashboard-header {
            flex-direction: column;
            gap: 16px;
            align-items: flex-start;
          }

          .header-actions {
            width: 100%;
          }

          .refresh-btn,
          .reports-btn {
            flex: 1;
            text-align: center;
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

          .appointment-item {
            flex-direction: column;
            align-items: flex-start;
          }

          .appointment-time {
            flex-direction: row;
            gap: 12px;
            border-right: none;
            border-bottom: 2px solid #e2e8f0;
            padding-right: 0;
            padding-bottom: 12px;
            margin-bottom: 12px;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;