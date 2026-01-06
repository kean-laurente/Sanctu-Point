import { useState, useEffect } from 'react'
import './PublicPortal.css'
import CalendarView from './CalendarView'



// Direct Supabase client for public portal (read-only)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const PublicPortal = () => {
  const [events, setEvents] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedService, setSelectedService] = useState('all')
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
const [view, setView] = useState('calendar')

  useEffect(() => {
    loadServices()
    loadEvents()
    
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const loadServices = async () => {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/services?select=service_id,service_name&order=service_name.asc`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setServices(data)
      }
    } catch (err) {
      console.error('Error loading services:', err)
    }
  }

  const loadEvents = async () => {
    setLoading(true)
    setError('')
    try {
      // Fetch active appointments
      const appointmentsPromise = fetch(
        `${SUPABASE_URL}/rest/v1/appointments?` + 
        `select=*,payments(amount)&` +
        `status=in.(confirmed,completed)&` +
        `order=appointment_date.asc,appointment_time.asc`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        }
      )

      // Fetch archived appointments
      const archivedPromise = fetch(
        `${SUPABASE_URL}/rest/v1/archived_appointments?` + 
        `select=*&` +
        `status=in.(confirmed,completed)&` +
        `total_payments=gt.0&` +
        `order=appointment_date.asc,appointment_time.asc`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        }
      )

      // Execute both requests in parallel
      const [appointmentsResponse, archivedResponse] = await Promise.all([
        appointmentsPromise,
        archivedPromise
      ])

      if (!appointmentsResponse.ok) {
        throw new Error(`Failed to load active appointments: ${appointmentsResponse.status}`)
      }

      if (!archivedResponse.ok) {
        throw new Error(`Failed to load archived appointments: ${archivedResponse.status}`)
      }

      const appointments = await appointmentsResponse.json()
      const archivedAppointments = await archivedResponse.json()

      // Process active appointments
      const activeEvents = appointments
        .filter(appointment => {
          const totalPayments = appointment.payments?.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0) || 0
          return totalPayments > 0
        })
        .map(appointment => ({
          id: appointment.appointment_id,
          title: appointment.service_type,
          date: appointment.appointment_date,
          time: appointment.appointment_time,
          status: appointment.status,
          customer_name: `${appointment.customer_first_name} ${appointment.customer_last_name}`,
          service_type: appointment.service_type,
          total_payments: appointment.payments?.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0) || 0,
          payment_count: appointment.payments?.length || 0,
          is_archived: false,
          is_past: new Date(appointment.appointment_date) < new Date(),
          formatted_date: formatDate(appointment.appointment_date, isMobile),
          formatted_time: formatTime(appointment.appointment_time, isMobile)
        }))

      // Process archived appointments
      const archivedEvents = archivedAppointments.map(appointment => ({
        id: `archived_${appointment.archived_id}`,
        original_id: appointment.original_appointment_id,
        title: appointment.service_type,
        date: appointment.appointment_date,
        time: appointment.appointment_time,
        status: appointment.status,
        customer_name: `${appointment.customer_first_name} ${appointment.customer_last_name}`,
        service_type: appointment.service_type,
        total_payments: parseFloat(appointment.total_payments) || 0,
        payment_count: appointment.payment_count || 0,
        is_archived: true,
        is_past: new Date(appointment.appointment_date) < new Date(),
        formatted_date: formatDate(appointment.appointment_date, isMobile),
        formatted_time: formatTime(appointment.appointment_time, isMobile),
        archived_at: appointment.archived_at
      }))

      // Combine and sort all events by date and time
      const allEvents = [...activeEvents, ...archivedEvents]
        .sort((a, b) => {
          const dateA = new Date(a.date + ' ' + a.time)
          const dateB = new Date(b.date + ' ' + b.time)
          return dateA - dateB
        })

      setEvents(allEvents)
    } catch (err) {
      console.error('Error loading events:', err)
      setError('Unable to load events at this time. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString, mobile = false) => {
    const date = new Date(dateString)
    
    if (mobile) {
      return date.toLocaleDateString('en-PH', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    }
    
    return date.toLocaleDateString('en-PH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (timeString, mobile = false) => {
    if (!timeString) return 'TBA'
    
    try {
      if (timeString.includes('AM') || timeString.includes('PM')) {
        return mobile ? timeString.replace(' ', '') : timeString
      }
      
      if (timeString.includes(':')) {
        const [hours, minutes] = timeString.split(':')
        const hour = parseInt(hours, 10)
        const period = hour >= 12 ? 'PM' : 'AM'
        const twelveHour = hour % 12 || 12
        
        if (mobile) {
          return `${twelveHour}:${minutes}${period.toLowerCase()}`
        }
        
        return `${twelveHour}:${minutes} ${period}`
      }
      
      return timeString
    } catch (error) {
      console.error('Error formatting time:', error)
      return timeString
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: isMobile ? 0 : 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  const getStatusColor = (status) => {
    const colors = {
      confirmed: '#3b82f6',
      completed: '#10b981'
    }
    return colors[status] || '#6b7280'
  }

  const getStatusText = (status) => {
    const statusMap = {
      confirmed: isMobile ? 'Confirmed' : 'Confirmed',
      completed: isMobile ? 'Done' : 'Completed'
    }
    return statusMap[status] || status
  }

  const filteredEvents = events.filter(event => {
    const dateFilter = filter === 'all' ? true : 
                     filter === 'upcoming' ? !event.is_past : 
                     filter === 'past' ? event.is_past : true
    
    const serviceFilter = selectedService === 'all' ? true : 
                         event.service_type === selectedService
    
    return dateFilter && serviceFilter
  })

  const getStats = () => {
    const total = events.length
    const upcoming = events.filter(e => !e.is_past).length
    const past = events.filter(e => e.is_past).length
    const archived = events.filter(e => e.is_archived).length
    const totalRevenue = events.reduce((sum, e) => sum + e.total_payments, 0)
    
    return { total, upcoming, past, archived, totalRevenue }
  }

  const stats = getStats()

  return (
    <div className="public-portal">
      {/* Mobile Menu Toggle */}
      {isMobile && (
        <button className="mobile-menu-toggle" onClick={() => {}}>
          ☰
        </button>
      )}

      {/* Header */}
      <header className="portal-header">
        <div className="container">
          <div className="header-content">
            <div className="logo-section">
              <h1>{isMobile ? 'SanctuPoint Events' : 'SanctuPoint Church Events'}</h1>
              <p className="subtitle">
                {isMobile ? 'Public Events Portal' : 'Public Portal - View confirmed and completed church appointments'}
              </p>
            </div>
            
            {!isMobile && (
              <div className="header-stats">
                <div className="stat-item">
                  <span className="stat-number">{stats.total}</span>
                  <span className="stat-label">Total Events</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">{stats.upcoming}</span>
                  <span className="stat-label">Upcoming</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">{stats.past}</span>
                  <span className="stat-label">Past Events</span>
                </div>
               
              </div>
            )}
          </div>

          {/* Mobile Stats */}
          {isMobile && (
            <div className="mobile-stats">
              <div className="mobile-stat-row">
                <div className="mobile-stat">
                  <span className="mobile-stat-number">{stats.total}</span>
                  <span className="mobile-stat-label">Events</span>
                </div>
                <div className="mobile-stat">
                  <span className="mobile-stat-number">{stats.upcoming}</span>
                  <span className="mobile-stat-label">Upcoming</span>
                </div>
                <div className="mobile-stat">
                  <span className="mobile-stat-number">{stats.past}</span>
                  <span className="mobile-stat-label">Past</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

{view === 'calendar' && <CalendarView events={events} />}

      {/* Main Content */}
      <main className="portal-main">
        <div className="container">
          {/* Filters */}
          <div className="filters-section">
            <div className="filter-group">
              <h3>{isMobile ? 'Date Filter' : 'Filter by Date'}</h3>
              <div className="filter-buttons">
                <button 
                  className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                  onClick={() => setFilter('all')}
                  aria-label="Show all events"
                >
                  {isMobile ? 'All' : 'All Events'}
                </button>
                <button 
                  className={`filter-btn ${filter === 'upcoming' ? 'active' : ''}`}
                  onClick={() => setFilter('upcoming')}
                  aria-label="Show upcoming events"
                >
                  {isMobile ? 'Upcoming' : 'Upcoming'}
                </button>
                <button 
                  className={`filter-btn ${filter === 'past' ? 'active' : ''}`}
                  onClick={() => setFilter('past')}
                  aria-label="Show past events"
                >
                  {isMobile ? 'Past' : 'Past Events'}
                </button>
              </div>
            </div>

            <div className="filter-group">
              <h3>{isMobile ? 'Service' : 'Filter by Service'}</h3>
              <div className="select-wrapper">
                <select 
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  className="service-select"
                  aria-label="Select service type"
                >
                  <option value="all">All Services</option>
                  {services.map(service => (
                    <option key={service.service_id} value={service.service_name}>
                      {isMobile && service.service_name.length > 15 
                        ? `${service.service_name.substring(0, 15)}...`
                        : service.service_name}
                    </option>
                  ))}
                </select>
                <span className="select-arrow">▼</span>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading events...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="error-container">
              <div className="error-icon">⚠️</div>
              <h3>Unable to Load Events</h3>
              <p>{error}</p>
              <button onClick={loadEvents} className="retry-btn">
                Try Again
              </button>
            </div>
          )}

          {/* Events Grid/List */}
          {!loading && !error && (
            <>
              {filteredEvents.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📅</div>
                  <h3>No Events Found</h3>
                  <p>There are no events matching your filters.</p>
                  <button 
                    onClick={() => {
                      setFilter('all')
                      setSelectedService('all')
                    }}
                    className="clear-filters-btn"
                  >
                    Clear Filters
                  </button>
                </div>
              ) : (
                <>
                  <div className="events-header">
                    <div className="events-count">
                      Showing {filteredEvents.length} of {events.length} events
                      {events.some(e => e.is_archived) && ' (includes archived)'}
                    </div>
                    <div className="view-toggle">
                      <span className="view-label">
                        {isMobile ? 'View:' : 'View as:'}
                      </span>
                    </div>
                  </div>

                  {isMobile ? (
                    /* Mobile List View */
                    <div className="events-list">
                      {filteredEvents.map(event => (
                        <div key={event.id} className="event-list-item">
                          <div className="list-item-header">
                            <div className="list-date-time">
                              <span className="list-date">{event.formatted_date}</span>
                              <span className="list-time">{event.formatted_time}</span>
                            </div>
                            <div className="list-status-group">
                              <span 
                                className="list-status"
                                style={{ backgroundColor: getStatusColor(event.status) }}
                              >
                                {getStatusText(event.status)}
                              </span>
                              {event.is_archived && (
                                <span className="archived-badge">Archived</span>
                              )}
                            </div>
                          </div>
                          
                          <h3 className="list-title">{event.title}</h3>
                          
                          <div className="list-details">
                            <div className="list-detail">
                              <span className="detail-icon">🙏</span>
                              <span className="detail-text">
                                {event.customer_name.split(' ')[0]} {event.customer_name.split(' ')[1]?.charAt(0)}.
                              </span>
                            </div>
                            <div className="list-detail">
                              <span className="detail-icon">💰</span>
                              <span className="detail-text">
                                {formatCurrency(event.total_payments)}
                              </span>
                            </div>
                          </div>
                          
                          {event.status === 'confirmed' && !event.is_past && !event.is_archived && (
                            <div className="list-upcoming">
                              <span className="upcoming-icon">📢</span>
                              <span className="upcoming-text">Upcoming</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Desktop Grid View */
                    <div className="events-grid">
                      {filteredEvents.map(event => (
                        <div key={event.id} className="event-card">
                          <div className="event-header">
                            <div className="event-status">
                              <span 
                                className="status-badge"
                                style={{ backgroundColor: getStatusColor(event.status) }}
                              >
                                {getStatusText(event.status)}
                              </span>
                              {/* {event.is_archived && (
                                <span className="archived-badge">Archived</span>
                              )} */}
                              {event.is_past && !event.is_archived && (
                                <span className="past-badge">Past Event</span>
                              )}
                            </div>
                            <div className="event-date">
                              <span className="date-day">{formatDate(event.date).split(',')[0]}</span>
                              <span className="date-full">{formatDate(event.date)}</span>
                            </div>
                          </div>

                          <div className="event-body">
                            <h3 className="event-title">{event.title}</h3>
                            <div className="event-time">
                              <span className="time-icon">⏰</span>
                              <span className="time-text">{formatTime(event.time)}</span>
                            </div>
                            <div className="event-customer">
                              <span className="customer-icon">🙏</span>
                              <span className="customer-text">Booked by: {event.customer_name}</span>
                            </div>
                            {/* <div className="event-payment">
                              <span className="payment-icon">💰</span>
                              <span className="payment-text">
                                {formatCurrency(event.total_payments)}
                                {event.payment_count > 1 && ` (${event.payment_count} payments)`}
                              </span>
                            </div> */}
                          </div>

                          <div className="event-footer">
                            <div className="event-id">
                              {event.is_archived ? 'Archived Event' : `Event ID: #${event.id}`}
                            </div>
                            {event.status === 'confirmed' && !event.is_past && !event.is_archived && (
                              <div className="upcoming-notice">
                                <span className="notice-icon">📢</span>
                                <span className="notice-text">Upcoming Event</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}


          {/* Info Section */}
          <div className="info-section">
            <div className="info-card">
              <h3>About This Portal</h3>
              <p>
                This public portal displays confirmed and completed church appointments that have been processed. 
                We believe in transparency and accountability in our church activities.
              </p>
              <ul className="info-list">
                <li>✅ All events shown are confirmed and processed</li>
                <li>✅ Includes both active and archived appointments</li>
                <li>✅ Events are automatically updated</li>
                <li>✅ Privacy protected - minimal information shown</li>
                <li>✅ For inquiries, contact church administration</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="portal-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-info">
              <h4>SanctuPoint Church</h4>
              <p>Church Events and Appointments Portal</p>
              <p className="copyright">© {new Date().getFullYear()} All rights reserved</p>
            </div>
            <div className="footer-links">
              <p>This is a public view-only portal. For appointment booking or inquiries, please contact the church office.</p>
              <p className="disclaimer">
                <strong>Privacy Notice:</strong> This portal shows only necessary information for transparency purposes. 
                Full details are kept confidential and managed by church administration.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default PublicPortal