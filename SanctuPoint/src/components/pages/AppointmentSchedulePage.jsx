import { useState, useEffect } from 'react'
import { appointmentService } from '../../services/appointmentService'
import { authService } from '../../auth/authService'
import CalendarView from './CalendarView'
import SuccessModal from '../common/SuccessModal'
import ErrorModal from '../common/ErrorModal'
import ReceiptModal from '../common/ReceiptModal'

const AppointmentSchedulePage = () => {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [receiptData, setReceiptData] = useState(null)
  const [showRequirementModal, setShowRequirementModal] = useState(false)
  const [requirementUpdates, setRequirementUpdates] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [viewMode, setViewMode] = useState('list')

  useEffect(() => {
    loadCurrentUser()
  }, [])

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
    setShowErrorModal(false)
    try {
      let result
      
      if (currentUser?.role === 'admin' || currentUser?.role === 'staff') {
        result = await appointmentService.getAppointments(currentUser)
      } else {
        result = await appointmentService.getUserAppointments(currentUser.user_id)
      }

      if (result.success) {
        setAppointments(result.data)
      } else {
        setError(result.error || 'Failed to load appointments')
        setShowErrorModal(true)
      }
    } catch (err) {
      console.error('Appointment loading error:', err)
      setError('An error occurred while loading appointments')
      setShowErrorModal(true)
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
        setShowSuccessModal(true)
      } else {
        setError(result.error || 'Failed to update appointment')
        setShowErrorModal(true)
      }
    } catch (err) {
      setError('An error occurred while updating appointment')
      setShowErrorModal(true)
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
        setShowSuccessModal(true)
      } else {
        setError(result.error || 'Failed to archive appointment')
        setShowErrorModal(true)
      }
    } catch (err) {
      setError('An error occurred while archiving appointment')
      setShowErrorModal(true)
    }
  }

  const handleReprintReceipt = async (appointment) => {
    try {
      if (!appointment.receipt_number) {
        setError('No receipt found for this appointment')
        setShowErrorModal(true)
        return
      }
      
      const result = await appointmentService.reprintReceipt(appointment.appointment_id, currentUser)
      
      if (result.success) {
        setSuccess('Receipt reprinted successfully!')
        setShowSuccessModal(true)
        setReceiptData(result.data)
        setShowReceiptModal(true)
      } else {
        setError(result.error || 'Failed to reprint receipt')
        setShowErrorModal(true)
      }
    } catch (err) {
      setError('An error occurred while reprinting receipt')
      setShowErrorModal(true)
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

  const filteredAppointments = appointments.filter(appointment => {
    const matchesStatus = filterStatus === 'all' || appointment.status === filterStatus
    const matchesSearch = searchTerm === '' || 
      appointment.customer_first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.customer_last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.service_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.receipt_number?.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesStatus && matchesSearch
  })

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

  const getCalendarEvents = () => {
    return appointments.map(appointment => ({
      id: appointment.appointment_id,
      date: appointment.date,
      time: appointment.time,
      title: appointment.service_type,
      customer_name: `${appointment.customer_first_name} ${appointment.customer_last_name}`,
      status: appointment.status,
      payment_status: appointment.payment_status,
      service_type: appointment.service_type,
      customer_first_name: appointment.customer_first_name,
      customer_last_name: appointment.customer_last_name,
      customer_email: appointment.customer_email,
      customer_phone: appointment.customer_phone,
      service_price: appointment.service_price,
      formatted_time: formatTime(appointment.time)
    }))
  }

  const statusCounts = getStatusCounts()

  const handleRequirementChange = (requirementId, checked) => {
    setRequirementUpdates(prev => ({
      ...prev,
      [requirementId]: checked
    }))
  }

  const saveRequirementUpdates = async () => {
    if (!selectedAppointment) return
    
    try {
      const updates = []
      
      const requirements = selectedAppointment.requirements || []
      
      requirements.forEach(req => {
        if (requirementUpdates.hasOwnProperty(req.requirement_id)) {
          updates.push({
            requirement_id: req.requirement_id,
            is_checked: requirementUpdates[req.requirement_id]
          })
        }
      })
      
      console.log('Saving requirement updates:', updates)
      
      const result = await appointmentService.updateAppointmentRequirements(
        selectedAppointment.appointment_id,
        updates,
        currentUser
      )
      
      if (result.success) {
        setSuccess('Requirements updated successfully!')
        setShowSuccessModal(true)
        await loadAppointments()
        setShowRequirementModal(false)
        setRequirementUpdates({})
      } else {
        setError(result.error || 'Failed to update requirements')
        setShowErrorModal(true)
      }
    } catch (err) {
      console.error('Error saving requirement updates:', err)
      setError('An error occurred while updating requirements')
      setShowErrorModal(true)
    }
  }

  const openRequirementModal = (appointment) => {
    console.log('DEBUG openRequirementModal:', {
      appointment_id: appointment.appointment_id,
      requirements: appointment.requirements,
      requirementsCount: appointment.requirements?.length || 0
    });
    
    setSelectedAppointment(appointment);
    
    const initialUpdates = {};
    
    const requirements = appointment.requirements || [];
    
    requirements.forEach(req => {
      const requirementId = req.requirement_id || req.id;
      if (requirementId) {
        const isChecked = req.is_checked !== undefined ? req.is_checked : (req.isChecked || false);
        initialUpdates[requirementId] = isChecked;
      }
    });
    
    console.log('DEBUG: Initial requirement updates:', initialUpdates);
    
    setRequirementUpdates(initialUpdates);
    setShowRequirementModal(true);
  }


  const renderRequirementsSection = (appointment) => {
    console.log('DEBUG renderRequirementsSection for appointment:', {
      appointment_id: appointment.appointment_id,
      hasRequirements: !!appointment.requirements,
      requirementsCount: appointment.requirements?.length || 0,
      requirements: appointment.requirements || [],
      service_type: appointment.service_type
    });
    
    if (!appointment.requirements || appointment.requirements.length === 0) {
      console.log('DEBUG: No requirements found for appointment:', appointment.appointment_id);
      return null;
    }

    const requirements = appointment.requirements.map(req => ({
      requirement_id: req.requirement_id || `temp-${Math.random()}`,
      requirement_details: req.requirement_details || req.details || 'Unknown requirement',
      is_required: req.is_required !== undefined ? req.is_required : (req.isRequired || false),
      is_checked: req.is_checked !== undefined ? req.is_checked : (req.isChecked || false),
      is_predefined: req.is_predefined || false
    }));

    console.log('DEBUG: Processed requirements:', requirements);

    return (
      <div className="appointment-requirements">
        <div className="requirements-header">
          <strong>Requirements Status:</strong>
          {(currentUser?.role === 'admin' || currentUser?.role === 'staff') && (
            <button 
              onClick={() => openRequirementModal(appointment)}
              className="btn-manage-requirements"
            >
              📋 Manage Requirements
            </button>
          )}
        </div>
        
        <div className="requirements-list">
          {requirements.map((req, index) => (
            <div key={req.requirement_id || index} className={`requirement-item ${req.is_required ? 'required' : 'to-follow'} ${req.is_checked ? 'checked' : ''}`}>
              <div className="requirement-content">
                <span className="requirement-details">{req.requirement_details}</span>
                <span className="requirement-status">
                  {req.is_required ? (
                    <span className={`status-badge ${req.is_checked ? 'checked-badge' : 'unchecked-badge'}`}>
                      {req.is_checked ? '✅ Required & Checked' : '❌ Required - Not Checked'}
                    </span>
                  ) : (
                    <span className={`status-badge ${req.is_checked ? 'checked-badge' : 'unchecked-badge'}`}>
                      {req.is_checked ? '✅ To be followed & Checked' : '◻️ To be followed - Can check'}
                    </span>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }


  return (
    <div className="page-container">
      <div className="page-content">
        <div className="schedule-header">
          <h1>Appointment Schedule</h1>
          <p>{currentUser?.role === 'admin' || currentUser?.role === 'staff' ? 'All scheduled appointments' : 'Your scheduled appointments'}</p>
        </div>

        <ErrorModal isOpen={showErrorModal} onClose={() => setShowErrorModal(false)} />

        <SuccessModal 
          message={success} 
          isOpen={showSuccessModal} 
          onClose={() => setShowSuccessModal(false)} 
        />

        <ReceiptModal 
          appointment={receiptData} 
          isOpen={showReceiptModal} 
          onClose={() => setShowReceiptModal(false)} 
        />

        {/* View Mode Toggle */}
        <div className="view-mode-toggle">
          <div className="toggle-buttons">
            <button
              className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="4" width="18" height="3" rx="1.5" fill="currentColor"/>
                <rect x="3" y="10" width="18" height="3" rx="1.5" fill="currentColor"/>
                <rect x="3" y="16" width="18" height="3" rx="1.5" fill="currentColor"/>
              </svg>
              List View
            </button>
            <button
              className={`toggle-btn ${viewMode === 'calendar' ? 'active' : ''}`}
              onClick={() => setViewMode('calendar')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
                <path d="M3 9H21" stroke="currentColor" strokeWidth="2"/>
                <path d="M8 2V6" stroke="currentColor" strokeWidth="2"/>
                <path d="M16 2V6" stroke="currentColor" strokeWidth="2"/>
              </svg>
              Calendar View
            </button>
          </div>
        </div>

        {/* Search and Filter Section - Show only in list view */}
        {viewMode === 'list' && (
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
            

          </div>
        )}

        {showRequirementModal && selectedAppointment && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Manage Requirements</h3>
                <button 
                  onClick={() => setShowRequirementModal(false)}
                  className="close-modal"
                >
                  ×
                </button>
              </div>
              
              <div className="modal-body">
                <div className="appointment-info">
                  <h4>{selectedAppointment.service_type}</h4>
                  <p>Date: {formatDate(selectedAppointment.date)}</p>
                  <p>Time: {formatTime(selectedAppointment.time)}</p>
                  <p>Customer: {selectedAppointment.customer_first_name} {selectedAppointment.customer_last_name}</p>
                </div>
                
                <div className="requirements-management">
                  <h4>Requirements Management</h4>
                  
                  {(!selectedAppointment.requirements || selectedAppointment.requirements.length === 0) ? (
                    <div className="no-requirements-message">
                      <p>No requirements found for this appointment.</p>
                      <p>If this service has requirements, they may not have been saved properly during booking.</p>
                    </div>
                  ) : (
                    <>
                      <p className="instructions">
                        <strong>Instructions:</strong><br/>
                        • Required items: Once checked, cannot be unchecked<br/>
                        • To be followed items: Can be checked/unchecked as needed<br/>
                        • Click Save Changes to update the requirement status
                      </p>
                      
                      <div className="requirements-checkboxes">
                        {selectedAppointment.requirements.map((req, index) => {
                          const requirementId = req.requirement_id || `temp-${index}`;
                          const isRequired = req.is_required !== undefined ? req.is_required : (req.isRequired || false);
                          const isChecked = req.is_checked !== undefined ? req.is_checked : (req.isChecked || false);
                          const details = req.requirement_details || req.details || 'Unknown requirement';
                          
                          return (
                            <div key={requirementId} className="management-requirement-item">
                              <label className="management-requirement-label">
                                <input
                                  type="checkbox"
                                  checked={requirementUpdates[requirementId] !== undefined ? requirementUpdates[requirementId] : isChecked}
                                  onChange={(e) => handleRequirementChange(requirementId, e.target.checked)}
                                  disabled={isRequired && isChecked}
                                  className="management-checkbox"
                                />
                                <span className={`management-requirement-text ${isRequired ? 'required' : 'to-follow'}`}>
                                  {details}
                                  <span className="management-requirement-type">
                                    {isRequired 
                                      ? ' (Required - Cannot uncheck if checked)' 
                                      : ' (To be followed - Can check/uncheck)'}
                                  </span>
                                </span>
                              </label>
                              
                              <div className="current-status">
                                Current: {isChecked ? '✅ Checked' : '◻️ Not Checked'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              <div className="modal-actions">
                <button 
                  onClick={saveRequirementUpdates}
                  className="btn-save-requirements"
                  disabled={Object.keys(requirementUpdates).length === 0 || !selectedAppointment.requirements || selectedAppointment.requirements.length === 0}
                >
                  Save Changes
                </button>
                <button 
                  onClick={() => setShowRequirementModal(false)}
                  className="btn-cancel"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading appointments...</p>
          </div>
        ) : viewMode === 'calendar' ? (
          <CalendarView 
            events={getCalendarEvents()}
            currentUser={currentUser}
          />
        ) : filteredAppointments.length === 0 ? (
          <div className="empty-state">
            <h3>No Appointments Scheduled</h3>
            <p>There are no appointments to display at the moment.</p>
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
                      {appointment.services?.allow_concurrent && (
                        <span className="concurrent-badge">
                          🔀 Concurrent
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="appointment-details">
                    <p><strong>Date:</strong> {formatDate(appointment.date)}</p>
                    <p><strong>Time:</strong> {formatTime(appointment.time)}</p>
                    
                    {servicePrice > 0 && (
                      <p><strong>Service Fee:</strong> ₱{servicePrice.toFixed(2)}</p>
                    )}
                    
                    <div className="customer-info">
                      <p><strong>Customer:</strong> {appointment.customer_first_name} {appointment.customer_last_name}</p>
                      <p><strong>Email:</strong> {appointment.customer_email}</p>
                      {appointment.customer_phone && (
                        <p><strong>Phone:</strong> {appointment.customer_phone}</p>
                      )}
                    </div>

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

                    {renderRequirementsSection(appointment)}
                  </div>

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

      <style>{`
        .page-container {
          padding: 20px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .page-content {
          background: white;
          border-radius: 12px;
          padding: 30px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }

        .schedule-header {
          margin-bottom: 30px;
          text-align: center;
        }

        .schedule-header h1 {
          color: #1e293b;
          margin-bottom: 8px;
          font-size: 32px;
          font-weight: 700;
        }

        .schedule-header p {
          color: #64748b;
          font-size: 16px;
          max-width: 600px;
          margin: 0 auto;
        }

        /* View Mode Toggle */
        .view-mode-toggle {
          margin-bottom: 30px;
          display: flex;
          justify-content: center;
        }

        .toggle-buttons {
          display: inline-flex;
          background: #f1f5f9;
          border-radius: 10px;
          padding: 6px;
          border: 2px solid #e2e8f0;
          gap: 4px;
        }

        .toggle-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: #64748b;
          cursor: pointer;
          font-size: 15px;
          font-weight: 600;
          transition: all 0.3s ease;
          white-space: nowrap;
        }

        .toggle-btn:hover {
          color: #475569;
          background: #e2e8f0;
        }

        .toggle-btn.active {
          background: white;
          color: #3b82f6;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .toggle-btn svg {
          transition: transform 0.3s ease;
        }

        .toggle-btn:hover svg {
          transform: scale(1.1);
        }

        .message {
          padding: 16px;
          border-radius: 10px;
          margin-bottom: 24px;
          font-size: 15px;
          font-weight: 500;
          border: 2px solid transparent;
        }

        .message.error {
          background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
          border-color: #fca5a5;
          color: #dc2626;
        }

        .message.success {
          background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
          border-color: #86efac;
          color: #16a34a;
        }

        .filters-section {
          display: flex;
          flex-direction: column;
          gap: 20px;
          margin-bottom: 30px;
        }

        .search-box {
          width: 100%;
        }

        .search-input {
          width: 100%;
          padding: 14px 20px;
          border: 2px solid #e2e8f0;
          border-radius: 10px;
          font-size: 15px;
          transition: all 0.3s;
          background: #f8fafc;
        }

        .search-input:focus {
          outline: none;
          border-color: #3b82f6;
          background: white;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }

        .status-filters {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .filter-btn {
          padding: 10px 20px;
          border: 2px solid #e2e8f0;
          border-radius: 25px;
          background: white;
          color: #64748b;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.3s;
        }

        .filter-btn:hover {
          border-color: #94a3b8;
          color: #475569;
          transform: translateY(-2px);
        }

        .filter-btn.active {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          border-color: #3b82f6;
          color: white;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }

        .loading-state {
          text-align: center;
          padding: 80px 40px;
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

        .loading-state p {
          color: #64748b;
          font-size: 16px;
          font-weight: 500;
        }

        .empty-state {
          text-align: center;
          padding: 80px 40px;
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border-radius: 12px;
          border: 3px dashed #e2e8f0;
        }

        .empty-state h3 {
          color: #475569;
          margin-bottom: 12px;
          font-size: 24px;
          font-weight: 600;
        }

        .empty-state p {
          color: #64748b;
          margin-bottom: 24px;
          font-size: 16px;
          max-width: 500px;
          margin-left: auto;
          margin-right: auto;
        }

        .btn-primary {
          padding: 14px 32px;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-size: 15px;
          font-weight: 600;
          transition: all 0.3s;
        }

        .btn-primary:hover {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.3);
        }

        .appointments-list {
          display: grid;
          gap: 20px;
        }

        .appointment-card {
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          padding: 28px;
          background: white;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .appointment-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, #3b82f6, #8b5cf6, #10b981);
          opacity: 0;
          transition: opacity 0.3s;
        }

        .appointment-card:hover::before {
          opacity: 1;
        }

        .appointment-card:hover {
          border-color: #cbd5e0;
          box-shadow: 0 12px 40px rgba(0,0,0,0.12);
          transform: translateY(-4px);
        }

        .appointment-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 2px solid #f1f5f9;
        }

        .appointment-header h3 {
          margin: 0;
          color: #1e293b;
          font-size: 22px;
          font-weight: 700;
          line-height: 1.3;
        }

        .status-badges {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .appointment-status,
        .payment-status,
        .concurrent-badge {
          padding: 8px 16px;
          border-radius: 25px;
          color: white;
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .appointment-status::before,
        .payment-status::before {
          content: '';
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: currentColor;
          opacity: 0.8;
        }

        .concurrent-badge {
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
        }

        .appointment-details {
          margin-bottom: 24px;
        }

        .appointment-details p {
          margin: 10px 0;
          color: #475569;
          line-height: 1.6;
          font-size: 15px;
        }

        .customer-info {
          margin-top: 20px;
          padding: 20px;
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border-radius: 10px;
          border-left: 5px solid #3b82f6;
        }

        .payment-info {
          margin-top: 20px;
          padding: 20px;
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          border-radius: 10px;
          border-left: 5px solid #22c55e;
        }

        .payment-info p {
          margin: 0 0 16px 0;
          font-weight: 700;
          color: #1e293b;
          font-size: 16px;
        }

        .payment-details-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
        }

        .payment-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: white;
          border-radius: 8px;
          border: 2px solid #e2e8f0;
          transition: all 0.3s;
        }

        .payment-item:hover {
          border-color: #cbd5e0;
          transform: translateY(-2px);
        }

        .payment-label {
          color: #64748b;
          font-size: 14px;
          font-weight: 600;
        }

        .payment-value {
          color: #1e293b;
          font-weight: 700;
          font-size: 15px;
        }

        .receipt-number {
          font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Courier New', monospace;
          background: #f1f5f9;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 13px;
          letter-spacing: 0.8px;
        }

        .admin-info {
          margin-top: 16px;
          padding: 16px;
          background: linear-gradient(135deg, #ecfeff 0%, #cffafe 100%);
          border-radius: 8px;
          border-left: 5px solid #06b6d4;
          font-size: 14px;
        }

        .appointment-requirements {
          margin: 20px 0;
          padding: 20px;
          background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
          border-radius: 10px;
          border-left: 5px solid #f59e0b;
        }

        .appointment-requirements strong {
          color: #92400e;
          font-size: 16px;
          display: block;
          margin-bottom: 12px;
        }

        .appointment-requirements ul {
          margin: 0;
          padding-left: 20px;
        }

        .appointment-requirements li {
          margin: 8px 0;
          color: #92400e;
          font-size: 14px;
          line-height: 1.5;
        }

        .appointment-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 24px;
          padding-top: 24px;
          border-top: 2px solid #f1f5f9;
        }

        .appointment-actions button {
          padding: 12px 24px;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-size: 15px;
          font-weight: 600;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 140px;
          justify-content: center;
        }

        .btn-confirm {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
        }

        .btn-confirm:hover {
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(16, 185, 129, 0.4);
        }

        .btn-cancel {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
        }

        .btn-cancel:hover {
          background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(239, 68, 68, 0.4);
        }

        .btn-complete {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
        }

        .btn-complete:hover {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(59, 130, 246, 0.4);
        }

        .btn-receipt {
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
          color: white;
        }

        .btn-receipt:hover {
          background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(139, 92, 246, 0.4);
        }

        .btn-archive {
          background: linear-gradient(135deg, #64748b 0%, #475569 100%);
          color: white;
        }

        .btn-archive:hover {
          background: linear-gradient(135deg, #475569 0%, #334155 100%);
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(100, 116, 139, 0.4);
        }

        @media (max-width: 1024px) {
          .page-container {
            padding: 15px;
          }

          .page-content {
            padding: 24px;
          }

          .schedule-header h1 {
            font-size: 28px;
          }

          .toggle-btn {
            padding: 10px 20px;
            font-size: 14px;
          }
        }

        @media (max-width: 768px) {
          .page-content {
            padding: 20px;
          }

          .schedule-header h1 {
            font-size: 24px;
          }

          .toggle-buttons {
            width: 100%;
            justify-content: center;
          }

          .toggle-btn {
            flex: 1;
            justify-content: center;
          }

          .appointment-header {
            flex-direction: column;
            gap: 16px;
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
            gap: 16px;
          }

          .status-filters {
            overflow-x: auto;
            padding-bottom: 10px;
            margin: -10px;
            padding: 10px;
          }

          .filter-btn {
            white-space: nowrap;
          }
        }

        @media (max-width: 480px) {
          .appointment-card {
            padding: 20px;
          }

          .appointment-header h3 {
            font-size: 20px;
          }

          .appointment-status,
          .payment-status,
          .concurrent-badge {
            font-size: 12px;
            padding: 6px 12px;
          }

          .toggle-btn {
            padding: 8px 16px;
            font-size: 13px;
          }

          .toggle-btn svg {
            width: 18px;
            height: 18px;
          }

          .search-input {
            padding: 12px 16px;
            font-size: 14px;
          }
        }

        .appointment-requirements {
          margin: 20px 0;
          padding: 20px;
          background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
          border-radius: 10px;
          border-left: 5px solid #f59e0b;
        }

        .requirement-status {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px;
          margin: 8px 0;
          background: white;
          border-radius: 6px;
          border-left: 4px solid #f59e0b;
        }

        .requirement-status.required {
          border-left-color: #ef4444;
          background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
        }

        .requirement-status.to-follow {
          border-left-color: #3b82f6;
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
        }

        .requirement-name {
          font-weight: 600;
          color: #1e293b;
          flex: 1;
        }

        .status-indicator {
          font-size: 14px;
          font-weight: 500;
          padding: 4px 12px;
          border-radius: 20px;
          margin-left: 10px;
        }

        .status-indicator.checked {
          background: #dcfce7;
          color: #166534;
        }

        .status-indicator.unchecked {
          background: #f1f5f9;
          color: #64748b;
        }

        .required-text {
          color: #dc2626;
        }

        .to-follow-text {
          color: #1d4ed8;
        }

        .btn-manage-requirements {
          margin-top: 15px;
          padding: 10px 20px;
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.3s;
        }

        .btn-manage-requirements:hover {
          background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-content {
          background: white;
          border-radius: 12px;
          width: 100%;
          max-width: 600px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px;
          border-bottom: 2px solid #f1f5f9;
        }

        .modal-header h3 {
          margin: 0;
          color: #1e293b;
          font-size: 24px;
        }

        .close-modal {
          background: none;
          border: none;
          font-size: 28px;
          cursor: pointer;
          color: #64748b;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s;
        }

        .close-modal:hover {
          background: #f1f5f9;
          color: #1e293b;
        }

        .modal-body {
          padding: 24px;
        }

        .appointment-info {
          margin-bottom: 24px;
          padding: 20px;
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border-radius: 10px;
          border-left: 5px solid #3b82f6;
        }

        .appointment-info h4 {
          margin: 0 0 12px 0;
          color: #1e293b;
          font-size: 18px;
        }

        .requirements-management h4 {
          margin: 0 0 16px 0;
          color: #1e293b;
          font-size: 18px;
        }

        .management-requirement-item {
          background: white;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 12px;
          border: 2px solid #e2e8f0;
          transition: all 0.2s;
        }

        .management-requirement-item:hover {
          border-color: #9f7aea;
        }

        .management-requirement-label {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          cursor: pointer;
          width: 100%;
          margin-bottom: 8px;
        }

        .management-checkbox {
          width: 20px;
          height: 20px;
          margin-top: 2px;
          accent-color: #9f7aea;
        }

        .management-requirement-text {
          flex: 1;
          color: #2d3748;
          font-size: 15px;
          line-height: 1.5;
          font-weight: 500;
        }

        .management-requirement-text.required {
          color: #dc2626;
        }

        .management-requirement-text.to-follow {
          color: #2563eb;
        }

        .management-requirement-type {
          display: block;
          color: #718096;
          font-size: 13px;
          font-weight: 400;
          margin-top: 4px;
        }

        .current-status {
          padding: 8px 12px;
          background: #f1f5f9;
          border-radius: 6px;
          font-size: 14px;
          color: #475569;
          font-weight: 500;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          padding: 24px;
          border-top: 2px solid #f1f5f9;
        }

        .btn-save-requirements {
          flex: 1;
          padding: 14px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 600;
          transition: all 0.3s;
        }

        .btn-save-requirements:hover {
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(16, 185, 129, 0.4);
        }

        .btn-cancel {
          flex: 1;
          padding: 14px;
          background: #f1f5f9;
          color: #475569;
          border: 2px solid #e2e8f0;
          border-radius: 10px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 600;
          transition: all 0.2s;
        }

        .btn-cancel:hover {
          background: #e2e8f0;
          color: #1e293b;
        }

        @media (max-width: 768px) {
          .modal-content {
            max-width: 95%;
          }
          
          .modal-actions {
            flex-direction: column;
          }
          
          .management-requirement-label {
            flex-direction: column;
            gap: 8px;
          }
        }

        .requirement-item.required.checked {
        border-left-color: #10b981;
        background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
      }

      .requirement-item.to-follow.checked {
        border-left-color: #10b981;
        background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
      }

      .checked-badge {
        background: #10b981;
        color: white;
        border: 1px solid #059669;
      }

      .unchecked-badge {
        background: #f1f5f9;
        color: #64748b;
        border: 1px solid #e2e8f0;
      }

      .required-badge.unchecked-badge {
        background: #fee2e2;
        color: #991b1b;
        border: 1px solid #fca5a5;
      }

      .tofollow-badge.unchecked-badge {
        background: #dbeafe;
        color: #1e40af;
        border: 1px solid #93c5fd;
      }

      .btn-save-requirements:disabled {
        background: #cbd5e0;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }

      .no-requirements-message {
      padding: 20px;
      background: #fef3c7;
      border-radius: 8px;
      border-left: 4px solid #f59e0b;
      color: #92400e;
      text-align: center;
    }

    .no-requirements-message p {
      margin: 8px 0;
    }
      `}</style>
    </div>
  )
}

export default AppointmentSchedulePage  