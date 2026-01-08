import { useState, useEffect } from 'react'
import { authService } from '../../auth/authService'
import { archivedAppointmentsService } from '../../services/archivedAppointmentsService'

const AppointmentHistoryPage = () => {
  const [archivedAppointments, setArchivedAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadCurrentUser()
  }, [])

  useEffect(() => {
    if (currentUser) {
      loadArchivedAppointments()
    }
  }, [currentUser])

  const loadCurrentUser = () => {
    const user = authService.getCurrentUser()
    setCurrentUser(user)
  }

  const loadArchivedAppointments = async () => {
    if (!currentUser) {
      setError('User not authenticated')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      const result = await archivedAppointmentsService.getArchivedAppointments(currentUser)
      
      if (result.success) {
        setArchivedAppointments(result.data)
      } else {
        setError(result.error || 'Failed to load archived appointments')
      }
    } catch (err) {
      console.error('Archived appointments loading error:', err)
      setError('An error occurred while loading archived appointments')
    } finally {
      setLoading(false)
    }
  }

  const handleRestoreAppointment = async (archivedId) => {
    if (!currentUser) {
      setError('User not authenticated')
      return
    }

    try {
      const result = await archivedAppointmentsService.restoreAppointment(archivedId, currentUser)
      
      if (result.success) {
        await loadArchivedAppointments()
        setSuccess('Appointment restored successfully!')
        setError('')
      } else {
        setError(result.error || 'Failed to restore appointment')
      }
    } catch (err) {
      setError('An error occurred while restoring appointment')
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

  const formatArchivedDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status) => {
    const colors = {
      completed: '#28a745',
      cancelled: '#dc3545',
      expired: '#6c757d',
      noshow: '#ffc107',
      archived: '#6c757d'
    }
    return colors[status] || '#6c757d'
  }

  const getStatusText = (status) => {
    const statusMap = {
      completed: 'Completed',
      cancelled: 'Cancelled',
      expired: 'Expired',
      noshow: 'No Show',
      archived: 'Archived'
    }
    return statusMap[status] || status
  }

  const filteredAppointments = archivedAppointments.filter(appointment => {
    const matchesStatus = filterStatus === 'all' || appointment.status === filterStatus
    const matchesSearch = searchTerm === '' || 
      appointment.customer_first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.customer_last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.service_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.customer_email?.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesStatus && matchesSearch
  })

  const getStatusCounts = () => {
    const counts = {
      all: archivedAppointments.length,
      completed: 0,
      cancelled: 0,
      expired: 0,
      noshow: 0
    }
    
    archivedAppointments.forEach(appointment => {
      if (counts[appointment.status] !== undefined) {
        counts[appointment.status]++
      }
    })
    
    return counts
  }

  const statusCounts = getStatusCounts()

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="history-header">
          <h1>Appointment History</h1>
          <p>View all archived and past appointments</p>
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

        <div className="stats-cards">
          <div className="stat-card">
            <div className="stat-number">{statusCounts.all}</div>
            <div className="stat-label">Total Archived</div>
          </div>
          <div className="stat-card">
            <div className="stat-number" style={{ color: '#28a745' }}>{statusCounts.completed}</div>
            <div className="stat-label">Completed</div>
          </div>
          <div className="stat-card">
            <div className="stat-number" style={{ color: '#dc3545' }}>{statusCounts.cancelled}</div>
            <div className="stat-label">Cancelled</div>
          </div>
          <div className="stat-card">
            <div className="stat-number" style={{ color: '#6c757d' }}>{statusCounts.expired + statusCounts.noshow}</div>
            <div className="stat-label">Other</div>
          </div>
        </div>

        <div className="filters-section">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search by name, service, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          {/* <div className="status-filters">
            <button 
              className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
              onClick={() => setFilterStatus('all')}
            >
              All ({statusCounts.all})
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
          </div> */}
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading archived appointments...</p>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="empty-state">
            <h3>No Archived Appointments</h3>
            <p>There are no archived appointments to display.</p>
          </div>
        ) : (
          <div className="archived-appointments-list">
            {filteredAppointments.map(appointment => (
              <div key={appointment.archived_id} className="archived-appointment-card">
                <div className="appointment-header">
                  <div className="service-info">
                    <h3>{appointment.service_type}</h3>
                    <p className="original-id">Original ID: #{appointment.original_appointment_id}</p>
                  </div>
                  <div className="status-badges">
                    <span 
                      className="appointment-status"
                      style={{ backgroundColor: getStatusColor(appointment.status) }}
                    >
                      {getStatusText(appointment.status).toUpperCase()}
                    </span>
                    <span className="archived-badge">
                      ARCHIVED
                    </span>
                  </div>
                </div>

                <div className="appointment-details">
                  <div className="detail-row">
                    <div className="detail-group">
                      <p><strong>Date:</strong> {formatDate(appointment.date)}</p>
                      <p><strong>Time:</strong> {formatTime(appointment.time)}</p>
                    </div>
                    <div className="detail-group">
                      <p><strong>Archived On:</strong> {formatArchivedDate(appointment.archived_at)}</p>
                    </div>
                  </div>

                  <div className="customer-info">
                    <h4>Customer Information</h4>
                    <div className="customer-details">
                      <p><strong>Name:</strong> {appointment.customer_first_name} {appointment.customer_last_name}</p>
                      <p><strong>Email:</strong> {appointment.customer_email}</p>
                      {appointment.customer_phone && (
                        <p><strong>Phone:</strong> {appointment.customer_phone}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="appointment-actions">
                  {currentUser && (currentUser.role === 'admin' || currentUser.role === 'staff') && (
                    <button 
                      onClick={() => handleRestoreAppointment(appointment.archived_id)}
                      className="btn-restore"
                    >
                      Restore to Active
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
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

        .history-header {
          margin-bottom: 32px;
          text-align: center;
        }

        .history-header h1 {
          color: #333;
          margin-bottom: 8px;
        }

        .history-header p {
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

        .stats-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }

        .stat-card {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          text-align: center;
          border: 1px solid #e9ecef;
        }

        .stat-number {
          font-size: 2rem;
          font-weight: bold;
          color: #007bff;
          margin-bottom: 8px;
        }

        .stat-label {
          color: #6c757d;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

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
        }

        .search-input:focus {
          outline: none;
          border-color: #007bff;
        }

        .status-filters {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .filter-btn {
          padding: 8px 16px;
          border: 1px solid #ddd;
          border-radius: 20px;
          background: white;
          color: #666;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .filter-btn:hover {
          border-color: #007bff;
          color: #007bff;
        }

        .filter-btn.active {
          background: #007bff;
          border-color: #007bff;
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

        .archived-appointments-list {
          display: grid;
          gap: 16px;
        }

        .archived-appointment-card {
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 20px;
          background: #fafafa;
        }

        .appointment-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .service-info h3 {
          margin: 0;
          color: #333;
          font-size: 18px;
        }

        .original-id {
          margin: 4px 0 0 0;
          color: #666;
          font-size: 12px;
        }

        .status-badges {
          display: flex;
          gap: 8px;
        }

        .appointment-status,
        .archived-badge {
          padding: 4px 12px;
          border-radius: 20px;
          color: white;
          font-size: 12px;
          font-weight: bold;
        }

        .archived-badge {
          background: #6c757d;
        }

        .appointment-details {
          margin-bottom: 16px;
        }

        .detail-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }

        .detail-group p {
          margin: 4px 0;
          color: #555;
        }

        .customer-info {
          background: white;
          padding: 16px;
          border-radius: 4px;
          border-left: 3px solid #007bff;
        }

        .customer-info h4 {
          margin: 0 0 8px 0;
          color: #333;
          font-size: 14px;
        }

        .customer-details p {
          margin: 4px 0;
          color: #555;
        }

        .appointment-actions {
          display: flex;
          gap: 8px;
        }

        .appointment-actions button {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.2s;
        }

        .btn-restore {
          background: #28a745;
          color: white;
        }

        .btn-restore:hover {
          background: #218838;
        }

        @media (max-width: 768px) {
          .stats-cards {
            grid-template-columns: repeat(2, 1fr);
          }

          .appointment-header {
            flex-direction: column;
            gap: 12px;
          }

          .status-badges {
            align-self: flex-start;
          }

          .detail-row {
            grid-template-columns: 1fr;
          }

          .appointment-actions {
            flex-direction: column;
          }

          .appointment-actions button {
            width: 100%;
          }

          .filters-section {
            flex-direction: column;
          }

          .status-filters {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  )
}

export default AppointmentHistoryPage