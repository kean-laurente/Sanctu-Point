import { useState, useEffect } from 'react'
import { appointmentService } from '../../services/appointmentService'
import { authService } from '../../auth/authService'
import { printReceipt } from '../../utils/receiptUtils'

const AppointmentSchedulePage = () => {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => {
    loadCurrentUser()
  }, [])

  // Load appointments AFTER currentUser is set
  useEffect(() => {
    if (currentUser) {
      loadAppointments()
    }
  }, [currentUser])

  const loadCurrentUser = () => {
    const user = authService.getCurrentUser()
    setCurrentUser(user)
  }

  const loadAppointments = async () => {
    setLoading(true)
    setError('')
    try {
      let result
      
      // Both admin and staff can see all appointments
      if (currentUser?.role === 'admin' || currentUser?.role === 'staff') {
        result = await appointmentService.getAppointments(currentUser)
      } else {
        result = await appointmentService.getUserAppointments(currentUser.user_id)
      }

      if (result.success) {
        setAppointments(result.data)
      } else {
        setError(result.error || 'Failed to load appointments')
      }
    } catch (err) {
      console.error('Appointment loading error:', err)
      setError('An error occurred while loading appointments')
    } finally {
      setLoading(false)
    }
  }

  const updateAppointmentStatus = async (appointmentId, status) => {
    try {
      const appointment = appointments.find(a => a.appointment_id === appointmentId)
      const statusBefore = appointment.status

      const result = await appointmentService.updateAppointmentStatus(
        appointmentId, 
        status, 
        currentUser,
        statusBefore
      )

      if (result.success) {
        await loadAppointments()
        setSuccess(`Appointment ${status} successfully!`)
      } else {
        setError(result.error || 'Failed to update appointment')
      }
    } catch (err) {
      setError('An error occurred while updating appointment')
    }
  }

  const archiveAppointment = async (appointmentId) => {
    try {
      const result = await appointmentService.archiveAppointment(
        appointmentId, 
        currentUser
      )

      if (result.success) {
        await loadAppointments()
        setSuccess('Appointment archived successfully!')
      } else {
        setError(result.error || 'Failed to archive appointment')
      }
    } catch (err) {
      setError('An error occurred while archiving appointment')
    }
  }

  const handleReprintReceipt = async (appointment) => {
    try {
      if (!appointment.receipt_number) {
        setError('No receipt found for this appointment')
        return
      }
      
      const result = await appointmentService.reprintReceipt(appointment.appointment_id, currentUser)
      
      if (result.success) {
        printReceipt(result.data)
        setSuccess('Receipt reprinted successfully!')
      } else {
        setError(result.error || 'Failed to reprint receipt')
      }
    } catch (err) {
      setError('An error occurred while reprinting receipt')
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-PH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (timeString) => {
    if (!timeString) return 'No time set'
    
    try {
      if (timeString.includes('AM') || timeString.includes('PM')) {
        return timeString
      }
      
      if (timeString.includes(':')) {
        const [hours, minutes] = timeString.split(':')
        const hour = parseInt(hours, 10)
        const period = hour >= 12 ? 'PM' : 'AM'
        const twelveHour = hour % 12 || 12
        return `${twelveHour}:${minutes} ${period}`
      }
      
      return timeString
    } catch (error) {
      console.error('Error formatting time:', error)
      return timeString
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      pending: '#ffc107',
      confirmed: '#28a745',
      cancelled: '#dc3545',
      completed: '#6c757d'
    }
    return colors[status] || '#6c757d'
  }

  const getPaymentStatus = (appointment) => {
    if (appointment.payment_status === 'paid') {
      return { text: 'Paid', color: '#28a745' }
    }
    return { text: 'Unpaid', color: '#dc3545' }
  }

  // Filter appointments based on search and status
  const filteredAppointments = appointments.filter(appointment => {
    const matchesStatus = filterStatus === 'all' || appointment.status === filterStatus
    const matchesSearch = searchTerm === '' || 
      appointment.customer_first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.customer_last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.service_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.receipt_number?.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesStatus && matchesSearch
  })

  // Get status counts for filters
  const getStatusCounts = () => {
    const counts = {
      all: appointments.length,
      pending: appointments.filter(a => a.status === 'pending').length,
      confirmed: appointments.filter(a => a.status === 'confirmed').length,
      completed: appointments.filter(a => a.status === 'completed').length,
      cancelled: appointments.filter(a => a.status === 'cancelled').length
    }
    
    return counts
  }

  const statusCounts = getStatusCounts()

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="schedule-header">
          <h1>Appointment Schedule</h1>
          <p>{currentUser?.role === 'admin' || currentUser?.role === 'staff' ? 'All scheduled appointments' : 'Your scheduled appointments'}</p>
        </div>

        {error && (
          <div className="message error">
            {error}
          </div>
        )}

        {success && (
          <div className="message success">
            {success}
          </div>
        )}

        {/* Search and Filter Section */}
        <div className="filters-section">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search by name, service, or receipt number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="status-filters">
            <button 
              className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
              onClick={() => setFilterStatus('all')}
            >
              All ({statusCounts.all})
            </button>
            <button 
              className={`filter-btn ${filterStatus === 'pending' ? 'active' : ''}`}
              onClick={() => setFilterStatus('pending')}
            >
              Pending ({statusCounts.pending})
            </button>
            <button 
              className={`filter-btn ${filterStatus === 'confirmed' ? 'active' : ''}`}
              onClick={() => setFilterStatus('confirmed')}
            >
              Confirmed ({statusCounts.confirmed})
            </button>
            <button 
              className={`filter-btn ${filterStatus === 'completed' ? 'active' : ''}`}
              onClick={() => setFilterStatus('completed')}
            >
              Completed ({statusCounts.completed})
            </button>
            <button 
              className={`filter-btn ${filterStatus === 'cancelled' ? 'active' : ''}`}
              onClick={() => setFilterStatus('cancelled')}
            >
              Cancelled ({statusCounts.cancelled})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading appointments...</p>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="empty-state">
            <h3>No Appointments Scheduled</h3>
            <p>There are no appointments to display at the moment.</p>
            {(currentUser?.role === 'admin' || currentUser?.role === 'staff') && (
              <button 
                onClick={() => window.location.href = '#book-appointment'}
                className="btn-primary"
              >
                Book New Appointment
              </button>
            )}
          </div>
        ) : (
          <div className="appointments-list">
            {filteredAppointments.map(appointment => {
              const paymentStatus = getPaymentStatus(appointment)
              const servicePrice = appointment.service_price || appointment.payment_amount || 0
              
              return (
                <div key={appointment.appointment_id} className="appointment-card">
                  <div className="appointment-header">
                    <h3>{appointment.service_type}</h3>
                    <div className="status-badges">
                      <span 
                        className="appointment-status"
                        style={{ backgroundColor: getStatusColor(appointment.status) }}
                      >
                        {appointment.status?.toUpperCase()}
                      </span>
                      <span 
                        className="payment-status"
                        style={{ backgroundColor: paymentStatus.color }}
                      >
                        {paymentStatus.text}
                      </span>
                    </div>
                  </div>

                  <div className="appointment-details">
                    <p><strong>Date:</strong> {formatDate(appointment.date)}</p>
                    <p><strong>Time:</strong> {formatTime(appointment.time)}</p>
                    
                    {servicePrice > 0 && (
                      <p><strong>Service Fee:</strong> ₱{servicePrice.toFixed(2)}</p>
                    )}
                    
                    {/* Customer Information - Show for both admin and regular users */}
                    <div className="customer-info">
                      <p><strong>Customer:</strong> {appointment.customer_first_name} {appointment.customer_last_name}</p>
                      <p><strong>Email:</strong> {appointment.customer_email}</p>
                      {appointment.customer_phone && (
                        <p><strong>Phone:</strong> {appointment.customer_phone}</p>
                      )}
                    </div>

                    {/* Payment Information */}
                    {appointment.payment_status === 'paid' && (
                      <div className="payment-info">
                        <p><strong>Payment Details:</strong></p>
                        <div className="payment-details-grid">
                          <div className="payment-item">
                            <span className="payment-label">Amount Paid:</span>
                            <span className="payment-value">₱{appointment.amount_paid?.toFixed(2) || '0.00'}</span>
                          </div>
                          <div className="payment-item">
                            <span className="payment-label">Change Given:</span>
                            <span className="payment-value">₱{appointment.change_amount?.toFixed(2) || '0.00'}</span>
                          </div>
                          {appointment.receipt_number && (
                            <div className="payment-item">
                              <span className="payment-label">Receipt No:</span>
                              <span className="payment-value receipt-number">{appointment.receipt_number}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Additional admin/staff information */}
                    {(currentUser?.role === 'admin' || currentUser?.role === 'staff') && appointment.users && (
                      <div className="admin-info">
                        <p><strong>Booked by:</strong> {appointment.users.first_name} {appointment.users.last_name} ({appointment.users.email})</p>
                      </div>
                    )}
                  </div>

                  {/* Requirements Section */}
                  {appointment.requirements && appointment.requirements.length > 0 && (
                    <div className="appointment-requirements">
                      <strong>Requirements:</strong>
                      <ul>
                        {appointment.requirements.map((req, index) => (
                          <li key={index}>{req.requirement_details}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action Buttons - UPDATED: Removed payment button */}
                  <div className="appointment-actions">
                    {(currentUser?.role === 'admin' || currentUser?.role === 'staff') && appointment.status === 'pending' && (
                      <>
                        <button 
                          onClick={() => updateAppointmentStatus(appointment.appointment_id, 'confirmed')}
                          className="btn-confirm"
                        >
                          Confirm
                        </button>
                        <button 
                          onClick={() => updateAppointmentStatus(appointment.appointment_id, 'cancelled')}
                          className="btn-cancel"
                        >
                          Cancel
                        </button>
                      </>
                    )}

                    {(currentUser?.role === 'admin' || currentUser?.role === 'staff') && appointment.status === 'confirmed' && (
                      <button 
                        onClick={() => updateAppointmentStatus(appointment.appointment_id, 'completed')}
                        className="btn-complete"
                      >
                        Mark Complete
                      </button>
                    )}

                    {/* Reprint receipt button for paid appointments */}
                    {(currentUser?.role === 'admin' || currentUser?.role === 'staff') && appointment.payment_status === 'paid' && appointment.receipt_number && (
                      <button 
                        onClick={() => handleReprintReceipt(appointment)}
                        className="btn-receipt"
                        title="Reprint Receipt"
                      >
                        🖨️ Reprint Receipt
                      </button>
                    )}

                    {/* Archive button for admin/staff */}
                    {(currentUser?.role === 'admin' || currentUser?.role === 'staff') && (
                      <button 
                        onClick={() => archiveAppointment(appointment.appointment_id)}
                        className="btn-archive"
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style jsx>{`
        .page-container {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .page-content {
          background: white;
          border-radius: 8px;
          padding: 24px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .schedule-header {
          margin-bottom: 32px;
          text-align: center;
        }

        .schedule-header h1 {
          color: #333;
          margin-bottom: 8px;
        }

        .schedule-header p {
          color: #666;
          font-size: 16px;
        }

        .message {
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 16px;
        }

        .message.error {
          background: #fee;
          border: 1px solid #fcc;
          color: #c33;
        }

        .message.success {
          background: #efe;
          border: 1px solid #cfc;
          color: #363;
        }

        /* Search and Filter Styles */
        .filters-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 24px;
        }

        .search-box {
          width: 100%;
        }

        .search-input {
          width: 100%;
          padding: 12px 16px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 14px;
          border: 2px solid #e2e8f0;
        }

        .search-input:focus {
          outline: none;
          border-color: #4299e1;
          box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
        }

        .status-filters {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .filter-btn {
          padding: 8px 16px;
          border: 2px solid #e2e8f0;
          border-radius: 20px;
          background: white;
          color: #666;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
          font-weight: 500;
        }

        .filter-btn:hover {
          border-color: #4299e1;
          color: #4299e1;
        }

        .filter-btn.active {
          background: #4299e1;
          border-color: #4299e1;
          color: white;
        }

        .loading-state {
          text-align: center;
          padding: 40px;
        }

        .loading-spinner {
          border: 4px solid #f3f3f3;
          border-top: 4px solid #007bff;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 0 auto 16px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .empty-state {
          text-align: center;
          padding: 60px 40px;
          color: #666;
        }

        .empty-state h3 {
          margin-bottom: 8px;
          color: #333;
        }

        .empty-state .btn-primary {
          margin-top: 16px;
          padding: 12px 24px;
          background: #4299e1;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: background-color 0.2s;
        }

        .empty-state .btn-primary:hover {
          background: #3182ce;
        }

        .appointments-list {
          display: grid;
          gap: 16px;
        }

        .appointment-card {
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          padding: 24px;
          background: white;
          transition: all 0.3s ease;
        }

        .appointment-card:hover {
          border-color: #cbd5e0;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          transform: translateY(-1px);
        }

        .appointment-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 2px solid #edf2f7;
        }

        .appointment-header h3 {
          margin: 0;
          color: #2d3748;
          font-size: 1.3rem;
          font-weight: 600;
        }

        .status-badges {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .appointment-status,
        .payment-status {
          padding: 6px 12px;
          border-radius: 20px;
          color: white;
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .appointment-details {
          margin-bottom: 20px;
        }

        .appointment-details p {
          margin: 8px 0;
          color: #4a5568;
          line-height: 1.5;
        }

        .customer-info {
          margin-top: 16px;
          padding: 16px;
          background: #f8fafc;
          border-radius: 8px;
          border-left: 3px solid #4299e1;
        }

        .payment-info {
          margin-top: 16px;
          padding: 16px;
          background: #f0fff4;
          border-radius: 8px;
          border-left: 3px solid #48bb78;
        }

        .payment-info p {
          margin: 0 0 12px 0;
          font-weight: 600;
          color: #2d3748;
        }

        .payment-details-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }

        .payment-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px;
          background: white;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
        }

        .payment-label {
          color: #718096;
          font-size: 13px;
          font-weight: 500;
        }

        .payment-value {
          color: #2d3748;
          font-weight: 600;
          font-size: 14px;
        }

        .receipt-number {
          font-family: 'Courier New', monospace;
          background: #edf2f7;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 12px;
        }

        .admin-info {
          margin-top: 12px;
          padding: 12px;
          background: #e6fffa;
          border-radius: 6px;
          border-left: 3px solid #38b2ac;
          font-size: 13px;
        }

        .appointment-requirements {
          margin: 16px 0;
          padding: 16px;
          background: #fffaf0;
          border-radius: 8px;
          border-left: 3px solid #ed8936;
        }

        .appointment-requirements ul {
          margin: 8px 0 0 0;
          padding-left: 20px;
        }

        .appointment-requirements li {
          margin: 4px 0;
          color: #744210;
        }

        .appointment-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 2px solid #edf2f7;
        }

        .appointment-actions button {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .btn-confirm {
          background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
          color: white;
        }

        .btn-confirm:hover {
          background: linear-gradient(135deg, #3ac569 0%, #2f855a 100%);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(72, 187, 120, 0.3);
        }

        .btn-cancel {
          background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%);
          color: white;
        }

        .btn-cancel:hover {
          background: linear-gradient(135deg, #f44141 0%, #d22d2d 100%);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(245, 101, 101, 0.3);
        }

        .btn-complete {
          background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
          color: white;
        }

        .btn-complete:hover {
          background: linear-gradient(135deg, #3182ce 0%, #2b6cb0 100%);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(66, 153, 225, 0.3);
        }

        .btn-receipt {
          background: linear-gradient(135deg, #805ad5 0%, #6b46c1 100%);
          color: white;
        }

        .btn-receipt:hover {
          background: linear-gradient(135deg, #6b46c1 0%, #553c9a 100%);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(128, 90, 213, 0.3);
        }

        .btn-archive {
          background: linear-gradient(135deg, #718096 0%, #4a5568 100%);
          color: white;
        }

        .btn-archive:hover {
          background: linear-gradient(135deg, #4a5568 0%, #2d3748 100%);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(113, 128, 150, 0.3);
        }

        @media (max-width: 768px) {
          .page-container {
            padding: 15px;
          }

          .page-content {
            padding: 20px;
          }

          .appointment-header {
            flex-direction: column;
            gap: 12px;
          }

          .status-badges {
            align-self: flex-start;
          }

          .appointment-actions {
            flex-direction: column;
          }

          .appointment-actions button {
            width: 100%;
          }

          .payment-details-grid {
            grid-template-columns: 1fr;
          }

          .filters-section {
            flex-direction: column;
          }

          .status-filters {
            justify-content: center;
          }

          .filter-btn {
            flex: 1;
            text-align: center;
            min-width: 80px;
          }
        }

        @media (max-width: 480px) {
          .appointment-card {
            padding: 16px;
          }

          .appointment-header h3 {
            font-size: 1.1rem;
          }

          .appointment-status,
          .payment-status {
            font-size: 10px;
            padding: 4px 8px;
          }

          .payment-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }
        }
      `}</style>
    </div>
  )
}

export default AppointmentSchedulePage