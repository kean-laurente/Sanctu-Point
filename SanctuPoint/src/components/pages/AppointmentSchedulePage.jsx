import { useState, useEffect } from 'react'
import { appointmentService } from '../../services/appointmentService'
import { authService } from '../../auth/authService'

const AppointmentSchedulePage = () => {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentData, setPaymentData] = useState({
    amount: '',
    payment_method: 'cash',
    payment_type: 'full'
  })
  const [processingPayment, setProcessingPayment] = useState(false)

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
      
      // UPDATED: Both admin and staff can see all appointments
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

  const handlePaymentSubmit = async (e) => {
    e.preventDefault()
    setProcessingPayment(true)
    setError('')
    setSuccess('')

    try {
      // Validate amount
      const amount = parseFloat(paymentData.amount)
      if (isNaN(amount) || amount <= 0) {
        setError('Please enter a valid payment amount greater than 0')
        setProcessingPayment(false)
        return
      }

      const result = await appointmentService.addPayment(
        selectedAppointment.appointment_id,
        {
          ...paymentData,
          amount: amount.toString()
        },
        currentUser
      )

      if (result.success) {
        setShowPaymentModal(false)
        setPaymentData({ amount: '', payment_method: 'cash', payment_type: 'full' })
        setSelectedAppointment(null)
        setSuccess('Payment processed successfully!')
        // Refresh appointments after a short delay
        setTimeout(() => {
          loadAppointments()
        }, 1000)
      } else {
        setError(result.error || 'Failed to process payment')
      }
    } catch (err) {
      console.error('Payment processing error:', err)
      setError('An error occurred while processing payment')
    } finally {
      setProcessingPayment(false)
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
    if (!appointment.payments || appointment.payments.length === 0) {
      return { text: 'Unpaid', color: '#dc3545' }
    }
    
    const totalPaid = appointment.payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0)
    const servicePrice = appointment.services?.service_price || 0
    
    if (totalPaid >= servicePrice) {
      return { text: 'Paid', color: '#28a745' }
    } else if (totalPaid > 0) {
      return { text: `Partial (₱${totalPaid})`, color: '#ffc107' }
    } else {
      return { text: 'Unpaid', color: '#dc3545' }
    }
  }

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

        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading appointments...</p>
          </div>
        ) : appointments.length === 0 ? (
          <div className="empty-state">
            <h3>No Appointments Scheduled</h3>
            <p>There are no appointments to display at the moment.</p>
          </div>
        ) : (
          <div className="appointments-list">
            {appointments.map(appointment => {
              const paymentStatus = getPaymentStatus(appointment)
              const servicePrice = appointment.services?.service_price || 0
              
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

                    {/* Additional admin/staff information */}
                    {(currentUser?.role === 'admin' || currentUser?.role === 'staff') && appointment.users && (
                      <div className="admin-info">
                        <p><strong>Booked by account:</strong> {appointment.users.first_name} {appointment.users.last_name} ({appointment.users.email})</p>
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

                  {/* Payment History */}
                  {appointment.payments && appointment.payments.length > 0 && (
                    <div className="payment-history">
                      <strong>Payment History:</strong>
                      <ul>
                        {appointment.payments.map((payment, index) => (
                          <li key={index}>
                            ₱{payment.amount} - {payment.payment_method} ({payment.payment_type}) - {new Date(payment.payment_date).toLocaleDateString()}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action Buttons - UPDATED: Allow both admin and staff */}
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

                    {/* Allow both admin and staff to add payments and archive */}
                    {(currentUser?.role === 'admin' || currentUser?.role === 'staff') && (
                      <>
                        <button 
                          onClick={() => {
                            setSelectedAppointment(appointment)
                            setShowPaymentModal(true)
                          }}
                          className="btn-payment"
                        >
                          Add Payment
                        </button>
                        <button 
                          onClick={() => archiveAppointment(appointment.appointment_id)}
                          className="btn-archive"
                        >
                          Archive
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && selectedAppointment && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Add Payment - {selectedAppointment.service_type}</h3>
                <button 
                  onClick={() => {
                    setShowPaymentModal(false)
                    setSelectedAppointment(null)
                  }}
                  className="btn-close"
                >
                  ×
                </button>
              </div>
              
              <div className="payment-customer-info">
                <p><strong>Customer:</strong> {selectedAppointment.customer_first_name} {selectedAppointment.customer_last_name}</p>
                <p><strong>Service:</strong> {selectedAppointment.service_type}</p>
                {selectedAppointment.services?.service_price > 0 && (
                  <p><strong>Service Fee:</strong> ₱{selectedAppointment.services.service_price.toFixed(2)}</p>
                )}
              </div>

              <form onSubmit={handlePaymentSubmit}>
                <div className="form-group">
                  <label>Amount (₱):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={paymentData.amount}
                    onChange={(e) => setPaymentData({...paymentData, amount: e.target.value})}
                    required
                    placeholder="Enter amount"
                  />
                </div>
                <div className="form-group">
                  <label>Payment Method:</label>
                  <select
                    value={paymentData.payment_method}
                    onChange={(e) => setPaymentData({...paymentData, payment_method: e.target.value})}
                  >
                    <option value="cash">Cash</option>
                    <option value="gcash">GCash</option>
                    <option value="card">Credit/Debit Card</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Payment Type:</label>
                  <select
                    value={paymentData.payment_type}
                    onChange={(e) => setPaymentData({...paymentData, payment_type: e.target.value})}
                  >
                    <option value="full">Full Payment</option>
                    <option value="partial">Partial Payment</option>
                    <option value="deposit">Deposit</option>
                  </select>
                </div>
                <div className="modal-actions">
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowPaymentModal(false)
                      setSelectedAppointment(null)
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={processingPayment}>
                    {processingPayment ? 'Processing...' : 'Process Payment'}
                  </button>
                </div>
              </form>
            </div>
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

        .appointments-list {
          display: grid;
          gap: 16px;
        }

        .appointment-card {
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 20px;
          background: white;
        }

        .appointment-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .appointment-header h3 {
          margin: 0;
          color: #333;
        }

        .status-badges {
          display: flex;
          gap: 8px;
        }

        .appointment-status,
        .payment-status {
          padding: 4px 12px;
          border-radius: 20px;
          color: white;
          font-size: 12px;
          font-weight: bold;
        }

        .appointment-details {
          margin-bottom: 16px;
        }

        .appointment-details p {
          margin: 4px 0;
          color: #555;
        }

        .customer-info {
          margin-top: 12px;
          padding: 12px;
          background: #f8f9fa;
          border-radius: 4px;
        }

        .admin-info {
          margin-top: 8px;
          padding: 8px 12px;
          background: #e9ecef;
          border-radius: 4px;
          font-size: 14px;
        }

        .appointment-requirements,
        .payment-history {
          margin: 12px 0;
          padding: 12px;
          background: #f8f9fa;
          border-radius: 4px;
        }

        .appointment-requirements ul,
        .payment-history ul {
          margin: 8px 0 0 0;
          padding-left: 20px;
        }

        .appointment-requirements li,
        .payment-history li {
          margin: 4px 0;
          color: #555;
        }

        .appointment-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 16px;
        }

        .appointment-actions button {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.2s;
        }

        .btn-confirm {
          background: #28a745;
          color: white;
        }

        .btn-confirm:hover {
          background: #218838;
        }

        .btn-cancel {
          background: #dc3545;
          color: white;
        }

        .btn-cancel:hover {
          background: #c82333;
        }

        .btn-complete {
          background: #6c757d;
          color: white;
        }

        .btn-complete:hover {
          background: #5a6268;
        }

        .btn-payment {
          background: #17a2b8;
          color: white;
        }

        .btn-payment:hover {
          background: #138496;
        }

        .btn-archive {
          background: #6f42c1;
          color: white;
        }

        .btn-archive:hover {
          background: #5a3790;
        }

        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: white;
          border-radius: 8px;
          padding: 24px;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .modal-header h3 {
          margin: 0;
          color: #333;
        }

        .btn-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #666;
        }

        .payment-customer-info {
          background: #f8f9fa;
          padding: 16px;
          border-radius: 4px;
          margin-bottom: 20px;
        }

        .payment-customer-info p {
          margin: 4px 0;
          color: #555;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          color: #333;
        }

        .form-group input,
        .form-group select {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 24px;
        }

        .btn-primary {
          padding: 10px 20px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .btn-primary:hover {
          background: #0056b3;
        }

        .btn-primary:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }

        .btn-secondary {
          padding: 10px 20px;
          background: #6c757d;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .btn-secondary:hover {
          background: #5a6268;
        }

        @media (max-width: 768px) {
          .appointment-header {
            flex-direction: column;
            align-items: flex-start;
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

          .modal-actions {
            flex-direction: column;
          }

          .btn-primary,
          .btn-secondary {
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}

export default AppointmentSchedulePage