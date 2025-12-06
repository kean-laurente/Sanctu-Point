import { useState } from 'react';
import DashboardHeader from '../common/DashboardHeader';
import NavigationHeader from '../common/NavigationHeader';
import StaffManagement from '../StaffManagement';
import ServicesPage from '../pages/ServicesPage';
import BookAppointmentPage from '../pages/BookAppointmentPage'
import AppointmentSchedulePage from '../pages/AppointmentSchedulePage'
import AppointmentHistoryPage from '../pages/AppointmentHistoryPage'
import DonationPage from '../pages/DonationPage';

const AdminDashboard = ({ user, onLogout, onStaffUpdate }) => {
  const [currentPage, setCurrentPage] = useState('home');

  const handleStaffManagementClick = () => {
    setCurrentPage('staff-management');
  };

  const renderPageContent = () => {
    switch (currentPage) {
      case 'home':
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
              <div className="card hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold mb-2 text-gray-700">Services</h3>
                <p className="text-gray-600 mb-4">Manage church services and pricing</p>
                <button 
                  onClick={() => setCurrentPage('services')}
                  className="btn btn-primary"
                >
                  Manage Services
                </button>
              </div>
              <div className="card hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold mb-2 text-gray-700">Reports</h3>
                <p className="text-gray-600 mb-4">Generate system reports and analytics</p>
                <button className="btn btn-primary">
                  View Reports
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
    </div>
  );
};

export default AdminDashboard;