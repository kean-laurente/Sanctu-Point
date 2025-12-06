import { useState } from 'react';
import DashboardHeader from '../common/DashboardHeader';
import NavigationHeader from '../common/NavigationHeader';
import ServicesPage from '../pages/ServicesPage';
import BookAppointmentPage from '../pages/BookAppointmentPage';
import AppointmentSchedulePage from '../pages/AppointmentSchedulePage';
import AppointmentHistoryPage from '../pages/AppointmentHistoryPage';

const StaffDashboard = ({ user, onLogout }) => {
  const [currentPage, setCurrentPage] = useState('home');

  const renderPageContent = () => {
    switch (currentPage) {
      case 'home':
        return (
          <div className="dashboard-section">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Staff Dashboard</h2>
            <p className="text-gray-600 mb-6">Welcome, {user.first_name}! You can manage appointments and view services.</p>
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
              <div className="card hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold mb-2 text-gray-700">View Services</h3>
                <p className="text-gray-600 mb-4">See available church services</p>
                <button 
                  onClick={() => setCurrentPage('services')}
                  className="btn btn-primary"
                >
                  View Services
                </button>
              </div>
              <div className="card hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold mb-2 text-gray-700">Appointment History</h3>
                <p className="text-gray-600 mb-4">View archived and past appointments</p>
                <button 
                  onClick={() => setCurrentPage('appointment-history')}
                  className="btn btn-primary"
                >
                  View History
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
      <DashboardHeader user={user} onLogout={onLogout} title="Staff Dashboard" />
      
      <NavigationHeader currentPage={currentPage} onPageChange={setCurrentPage} />

      <div className="dashboard-content container">
        {renderPageContent()}
      </div>
    </div>
  );
};

export default StaffDashboard;