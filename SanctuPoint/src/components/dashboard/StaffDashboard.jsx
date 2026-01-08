import { useState, useEffect } from 'react';
import DashboardHeader from '../common/DashboardHeader';
import NavigationHeader from '../common/NavigationHeader';
import ServicesPage from '../pages/ServicesPage';
import BookAppointmentPage from '../pages/BookAppointmentPage';
import AppointmentSchedulePage from '../pages/AppointmentSchedulePage';
import AppointmentHistoryPage from '../pages/AppointmentHistoryPage';
import { appointmentService } from '../../services/appointmentService';
import { offeringService } from '../../services/offeringService';

const StaffDashboard = ({ user, onLogout }) => {
  const [currentPage, setCurrentPage] = useState('home');
  const [stats, setStats] = useState({
    todayAppointments: 0,
    pendingAppointments: 0,
    confirmedAppointments: 0,
    totalRevenue: 0,
    todayRevenue: 0
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
      
      // Load upcoming appointments
      const appointmentsResult = await appointmentService.getUpcomingAppointments(10, user);
      if (appointmentsResult.success) {
        setUpcomingAppointments(appointmentsResult.data);
        
        // Calculate today's appointments
        const todayAppts = appointmentsResult.data.filter(
          appt => appt.appointment_date === today
        );
        
        // Calculate pending and confirmed appointments
        const pendingAppts = appointmentsResult.data.filter(
          appt => appt.status === 'pending'
        ).length;
        
        const confirmedAppts = appointmentsResult.data.filter(
          appt => appt.status === 'confirmed'
        ).length;

        setStats(prev => ({
          ...prev,
          todayAppointments: todayAppts.length,
          pendingAppointments: pendingAppts,
          confirmedAppointments: confirmedAppts
        }));
      }

      // Load recent appointments (for activity feed)
      const allAppointments = await appointmentService.getAppointments(user);
      if (allAppointments.success) {
        const recent = allAppointments.data
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 5)
          .map(appointment => ({
            id: appointment.appointment_id,
            type: 'appointment',
            title: `Appointment: ${appointment.customer_first_name} ${appointment.customer_last_name} - ${appointment.service_type}`,
            time: new Date(appointment.created_at),
            icon: appointment.status === 'confirmed' ? '✅' : '📅',
            status: appointment.status
          }));
        
        setRecentActivity(recent);
      }

      // Load today's revenue
      const todayReport = await appointmentService.getDailyReport(today);
      if (todayReport.success) {
        setStats(prev => ({
          ...prev,
          todayRevenue: todayReport.data.totals.netRevenue || 0
        }));
      }

      // Load total monthly revenue
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
          totalRevenue: statsResult.data.total_service_revenue || 0
        }));
      }

    } catch (error) {
      console.error('Error loading staff dashboard data:', error);
    } finally {
      setLoading(false);
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

  const formatTime = (timeString) => {
    if (!timeString) return 'No time set';
    
    try {
      if (timeString.includes('AM') || timeString.includes('PM')) {
        return timeString;
      }
      
      if (timeString.includes(':')) {
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours, 10);
        const period = hour >= 12 ? 'PM' : 'AM';
        const twelveHour = hour % 12 || 12;
        return `${twelveHour}:${minutes} ${period}`;
      }
      
      return timeString;
    } catch (error) {
      return timeString;
    }
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
              <div className="welcome-section">
                <h2 className="dashboard-title">Welcome back, {user.first_name}! 👋</h2>
                <p className="dashboard-subtitle">Here's what's happening today in the church</p>
              </div>
              <div className="header-actions">
                <button 
                  onClick={handleRefreshDashboard}
                  className="refresh-btn"
                  disabled={loading}
                >
                  {loading ? 'Refreshing...' : '🔄 Refresh'}
                </button>
                {/* <button 
                  onClick={() => setCurrentPage('book-appointment')}
                  className="quick-action-btn"
                >
                  ➕ Book New Appointment
                </button> */}
              </div>
            </div>
            
            {/* Stats Cards */}
            <div className="stats-grid mb-8">
              <div className="stat-card blue">
                <div className="stat-icon">📅</div>
                <div className="stat-content">
                  <h3 className="stat-number">{stats.todayAppointments}</h3>
                  <p className="stat-label">Today's Appointments</p>
                  {/* <div className="stat-subtext">
                    <span className="sub-item pending">{stats.pendingAppointments} Pending</span>
                    <span className="sub-item confirmed">{stats.confirmedAppointments} Confirmed</span>
                  </div> */}
                </div>
              </div>
              
              <div className="stat-card green">
                <div className="stat-icon">💰</div>
                <div className="stat-content">
                  <h3 className="stat-number">₱{stats.totalRevenue.toLocaleString()}</h3>
                  <p className="stat-label">Monthly Revenue</p>
                  {/* <div className="stat-subtext">
                    <span className="sub-item">Today: ₱{stats.todayRevenue.toLocaleString()}</span>
                  </div> */}
                </div>
              </div>
              
              <div className="stat-card purple">
                <div className="stat-icon">👥</div>
                <div className="stat-content">
                  <h3 className="stat-number">{user.staff_id || 'STAFF'}</h3>
                  <p className="stat-label">Your Staff ID</p>
                  {/* <div className="stat-subtext">
                    <span className="sub-item">Role: Staff Member</span>
                    <span className="sub-item">{user.email}</span>
                  </div> */}
                </div>
              </div>
              
              <div className="stat-card orange">
                <div className="stat-icon">⚡</div>
                <div className="stat-content">
                  <h3 className="stat-number">{upcomingAppointments.length}</h3>
                  <p className="stat-label">Upcoming</p>
                  {/* <div className="stat-subtext">
                    {upcomingAppointments.length > 0 ? (
                      <span className="sub-item">Next: {formatTime(upcomingAppointments[0]?.appointment_time)}</span>
                    ) : (
                      <span className="sub-item">No upcoming appointments</span>
                    )}
                  </div> */}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            {/* <div className="quick-actions mb-8">
              <h3 className="section-title">Quick Actions</h3>
              <div className="actions-grid">
                <button 
                  onClick={() => setCurrentPage('book-appointment')}
                  className="action-card primary"
                >
                  <div className="action-icon">➕</div>
                  <div className="action-content">
                    <h4>Book Appointment</h4>
                    <p>Create new appointment for client</p>
                  </div>
                </button>
                
                <button 
                  onClick={() => setCurrentPage('appointment-schedule')}
                  className="action-card secondary"
                >
                  <div className="action-icon">📋</div>
                  <div className="action-content">
                    <h4>View Schedule</h4>
                    <p>See all scheduled appointments</p>
                  </div>
                </button>
                
                <button 
                  onClick={() => setCurrentPage('services')}
                  className="action-card success"
                >
                  <div className="action-icon">⚙️</div>
                  <div className="action-content">
                    <h4>View Services</h4>
                    <p>Check available church services</p>
                  </div>
                </button>
                
                <button 
                  onClick={() => setCurrentPage('appointment-history')}
                  className="action-card warning"
                >
                  <div className="action-icon">📊</div>
                  <div className="action-content">
                    <h4>Appointment History</h4>
                    <p>View archived appointments</p>
                  </div>
                </button>
              </div>
            </div> */}

            <div className="dashboard-grid">
              {/* Today's Appointments */}
              <div className="dashboard-card">
                <div className="card-header">
                  <h3 className="card-title">Today's Schedule</h3>
                  <button 
                    onClick={() => setCurrentPage('appointment-schedule')}
                    className="card-action"
                  >
                    View All →
                  </button>
                </div>
                <div className="card-content">
                  {upcomingAppointments.filter(appt => 
                    appt.appointment_date === new Date().toISOString().split('T')[0]
                  ).length === 0 ? (
                    <div className="empty-state">
                      <p>No appointments scheduled for today</p>
                      <button 
                        onClick={() => setCurrentPage('book-appointment')}
                        className="empty-action-btn"
                      >
                        Book an Appointment
                      </button>
                    </div>
                  ) : (
                    <div className="appointments-list">
                      {upcomingAppointments
                        .filter(appt => appt.appointment_date === new Date().toISOString().split('T')[0])
                        .slice(0, 5)
                        .map(appointment => (
                        <div key={appointment.appointment_id} className="appointment-item">
                          <div className="appointment-time">
                            <span className="time">{formatTime(appointment.appointment_time)}</span>
                            <span className={`status-badge ${appointment.status}`}>
                              {appointment.status}
                            </span>
                          </div>
                          <div className="appointment-details">
                            <h4 className="service-type">{appointment.service_type}</h4>
                            <p className="customer-name">
                              {appointment.customer_first_name} {appointment.customer_last_name}
                            </p>
                            <div className="appointment-meta">
                              {appointment.payment_status === 'paid' ? (
                                <span className="payment-badge paid">✅ Paid</span>
                              ) : (
                                <span className="payment-badge unpaid">❌ Unpaid</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Activity */}
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
      
      default:
        return (
          <div className="dashboard-section">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Staff Dashboard</h2>
            <div className="grid-responsive">
              <div className="card hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold mb-2 text-gray-700">Manage Appointments</h3>
                <p className="text-gray-600 mb-4">View and manage all appointments</p>
                <button 
                  onClick={() => setCurrentPage('appointment-schedule')}
                  className="btn btn-primary"
                >
                  Go to Appointments
                </button>
              </div>
              <div className="card hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold mb-2 text-gray-700">Book New Appointment</h3>
                <p className="text-gray-600 mb-4">Create new appointments for clients</p>
                <button 
                  onClick={() => setCurrentPage('book-appointment')}
                  className="btn btn-primary"
                >
                  Book Appointment
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
        title="Staff Dashboard"
        subtitle="Manage appointments and services"
      />
      
      <NavigationHeader 
        currentPage={currentPage} 
        onPageChange={setCurrentPage}
        showStaffLinks={true}
      />

      <div className="dashboard-content container">
        {loading && currentPage === 'home' ? (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Loading dashboard...</p>
          </div>
        ) : (
          renderPageContent()
        )}
      </div>

      <style jsx>{`
        .dashboard {
          min-height: 100vh;
          background: linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%);
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
          align-items: flex-start;
          margin-bottom: 32px;
          padding-bottom: 24px;
          border-bottom: 2px solid #f1f3f5;
        }

        .welcome-section {
          flex: 1;
        }

        .dashboard-title {
          color: #2d3748;
          font-size: 28px;
          font-weight: 700;
          margin: 0 0 8px 0;
        }

        .dashboard-subtitle {
          color: #64748b;
          font-size: 16px;
          margin: 0;
        }

        .header-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .refresh-btn,
        .quick-action-btn {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          font-size: 14px;
          transition: all 0.3s ease;
          white-space: nowrap;
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

        .quick-action-btn {
          background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
          color: white;
        }

        .quick-action-btn:hover {
          background: linear-gradient(135deg, #3182ce 0%, #2b6cb0 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(66, 153, 225, 0.3);
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
          background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
        }

        .stat-card.green {
          background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
        }

        .stat-card.purple {
          background: linear-gradient(135deg, #805ad5 0%, #6b46c1 100%);
        }

        .stat-card.orange {
          background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%);
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

        .empty-action-btn {
          padding: 10px 20px;
          background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          margin-top: 12px;
          transition: all 0.3s ease;
        }

        .empty-action-btn:hover {
          background: linear-gradient(135deg, #3182ce 0%, #2b6cb0 100%);
          transform: translateY(-2px);
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
          font-size: 16px;
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
          margin: 0 0 8px 0;
          color: #718096;
          font-size: 14px;
        }

        .appointment-meta {
          display: flex;
          gap: 8px;
        }

        .payment-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
        }

        .payment-badge.paid {
          background: #dcfce7;
          color: #16a34a;
        }

        .payment-badge.unpaid {
          background: #fee2e2;
          color: #dc2626;
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
            flex-direction: column;
            align-items: stretch;
          }

          .refresh-btn,
          .quick-action-btn {
            width: 100%;
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

export default StaffDashboard;