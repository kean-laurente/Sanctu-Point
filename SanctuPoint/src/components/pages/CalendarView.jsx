import { useState, useMemo } from 'react'

const CalendarView = ({ events, currentUser }) => {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)

  // Helper function to convert time string to 24-hour format
  const convertTimeTo24Hour = (timeStr) => {
    if (!timeStr) return 0
    
    try {
      const timeMatch = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i)
      if (!timeMatch) return 0
      
      let hour = parseInt(timeMatch[1])
      const modifier = timeMatch[3] ? timeMatch[3].toUpperCase() : 'AM'
      
      if (hour === 12 && modifier === 'AM') {
        hour = 0
      } else if (hour !== 12 && modifier === 'PM') {
        hour += 12
      }
      
      return hour
    } catch (error) {
      return 0
    }
  }

  // Get month start and end dates
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
  const daysInMonth = endOfMonth.getDate()
  const startDay = startOfMonth.getDay()

  // Calendar days array
  const calendarDays = useMemo(() => {
    const days = []
    for (let i = 0; i < startDay; i++) days.push(null)
    for (let i = 1; i <= daysInMonth; i++) days.push(i)
    return days
  }, [daysInMonth, startDay])

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map = {}
    events.forEach(e => {
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    })
    return map
  }, [events])

  // Get selected date events
  const selectedEvents = selectedDate
    ? eventsByDate[selectedDate] || []
    : []

  // Get status color for appointments
  const getStatusColor = (status) => {
    const colors = {
      pending: '#ffc107',
      confirmed: '#28a745',
      cancelled: '#dc3545',
      completed: '#6c757d'
    }
    return colors[status] || '#6c757d'
  }

  // Navigation functions
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  // Check if date is today
  const isToday = (day) => {
    const today = new Date()
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    )
  }

  return (
    <div className="calendar-view-container">
      {/* Calendar Section */}
      <div className="calendar-section">
        <div className="calendar-header">
          <button onClick={prevMonth} className="calendar-nav-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h2 className="calendar-month">
            {currentDate.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}
          </h2>
          <button onClick={nextMonth} className="calendar-nav-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="calendar-grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="calendar-day-header">
              {day}
            </div>
          ))}

          {calendarDays.map((day, index) => {
            if (!day) return <div key={index} className="calendar-empty" />

            const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const hasEvents = eventsByDate[dateStr]
            const isSelected = selectedDate === dateStr
            const today = isToday(day)

            return (
              <div
                key={index}
                className={`calendar-day ${hasEvents ? 'has-appointments' : ''} ${isSelected ? 'selected' : ''} ${today ? 'today' : ''}`}
                onClick={() => setSelectedDate(dateStr)}
              >
                <div className="day-number">{day}</div>
                {hasEvents && (
                  <div className="appointments-indicator">
                    <div className="appointment-dots">
                      {eventsByDate[dateStr].slice(0, 3).map((event, idx) => (
                        <div
                          key={idx}
                          className="appointment-dot"
                          style={{ backgroundColor: getStatusColor(event.status) }}
                          title={`${event.title} - ${event.customer_name}`}
                        />
                      ))}
                    </div>
                    {eventsByDate[dateStr].length > 3 && (
                      <span className="more-count">+{eventsByDate[dateStr].length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Appointments List Section */}
      <div className="appointments-section">
        {!selectedDate ? (
          <div className="no-date-selected">
            <div className="placeholder-icon">
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="4" width="18" height="18" rx="2" stroke="#94a3b8" strokeWidth="2"/>
                <path d="M3 9H21" stroke="#94a3b8" strokeWidth="2"/>
                <path d="M8 2V6" stroke="#94a3b8" strokeWidth="2"/>
                <path d="M16 2V6" stroke="#94a3b8" strokeWidth="2"/>
                <circle cx="12" cy="15" r="3" stroke="#94a3b8" strokeWidth="2"/>
                <path d="M12 12V15" stroke="#94a3b8" strokeWidth="2"/>
              </svg>
            </div>
            <h3>Select a Date</h3>
            <p>Click on a calendar date to view appointments for that day</p>
          </div>
        ) : (
          <>
            <div className="selected-date-header">
              <h3>
                {new Date(selectedDate).toLocaleDateString('en-PH', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </h3>
              <div className="appointment-count">
                {selectedEvents.length} appointment{selectedEvents.length !== 1 ? 's' : ''}
              </div>
            </div>

            {selectedEvents.length === 0 ? (
              <div className="no-appointments">
                <p>No appointments scheduled for this date</p>
              </div>
            ) : (
              <div className="appointments-list">
                {selectedEvents.map(event => {
                  const formattedTime = event.formatted_time || 'Time not set'
                  const statusColor = getStatusColor(event.status)
                  
                  return (
                    <div key={event.id} className="appointment-item">
                      <div className="appointment-time">
                        <div className="time-badge">{formattedTime}</div>
                      </div>
                      <div className="appointment-details">
                        <div className="appointment-header">
                          <h4>{event.title}</h4>
                          <div className="appointment-status-badge" style={{ backgroundColor: statusColor }}>
                            {event.status?.toUpperCase()}
                          </div>
                        </div>
                        <div className="customer-info">
                          <p><strong>Customer:</strong> {event.customer_name}</p>
                          <p><strong>Contact:</strong> {event.customer_phone || event.customer_email}</p>
                          <p><strong>Service Fee:</strong> ₱{event.service_price?.toFixed(2) || '0.00'}</p>
                        </div>
                        <div className="payment-status">
                          <span className={`payment-badge ${event.payment_status}`}>
                            {event.payment_status === 'paid' ? '✅ Paid' : '❌ Unpaid'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Legend */}
            {/* <div className="calendar-legend">
              <div className="legend-title">Appointment Status:</div>
              <div className="legend-items">
                <div className="legend-item">
                  <div className="legend-color" style={{ backgroundColor: getStatusColor('pending') }}></div>
                  <span>Pending</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color" style={{ backgroundColor: getStatusColor('confirmed') }}></div>
                  <span>Confirmed</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color" style={{ backgroundColor: getStatusColor('completed') }}></div>
                  <span>Completed</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color" style={{ backgroundColor: getStatusColor('cancelled') }}></div>
                  <span>Cancelled</span>
                </div>
              </div>
            </div> */}
          </>
        )}
      </div>

      <style>{`
        .calendar-view-container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          height: 700px;
        }

        /* Calendar Section */
        .calendar-section {
          background: white;
          border-radius: 16px;
          padding: 25px;
          border: 2px solid #e2e8f0;
          display: flex;
          flex-direction: column;
        }

        .calendar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 25px;
        }

        .calendar-nav-btn {
          width: 44px;
          height: 44px;
          border: 2px solid #e2e8f0;
          border-radius: 10px;
          background: white;
          color: #64748b;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s;
        }

        .calendar-nav-btn:hover {
          border-color: #cbd5e0;
          color: #475569;
          transform: translateY(-2px);
        }

        .calendar-month {
          margin: 0;
          color: #1e293b;
          font-size: 22px;
          font-weight: 700;
          text-align: center;
          flex: 1;
        }

        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 8px;
          flex: 1;
        }

        .calendar-day-header {
          text-align: center;
          padding: 14px 8px;
          font-weight: 700;
          color: #64748b;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: #f8fafc;
          border-radius: 8px;
        }

        .calendar-empty {
          min-height: 80px;
        }

        .calendar-day {
          min-height: 80px;
          border: 2px solid #e2e8f0;
          border-radius: 10px;
          padding: 10px;
          background: white;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .calendar-day:hover {
          border-color: #cbd5e0;
          background: #f8fafc;
          transform: translateY(-2px);
        }

        .calendar-day.selected {
          border-color: #3b82f6;
          background: #eff6ff;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
        }

        .calendar-day.today {
          border-color: #10b981;
          background: #f0fdf4;
        }

        .calendar-day.has-appointments {
          border-bottom-width: 4px;
        }

        .day-number {
          font-size: 18px;
          font-weight: 700;
          color: #1e293b;
          text-align: right;
        }

        .appointments-indicator {
          display: flex;
          align-items: center;
          gap: 4px;
          justify-content: center;
        }

        .appointment-dots {
          display: flex;
          gap: 3px;
        }

        .appointment-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .more-count {
          font-size: 11px;
          color: #64748b;
          font-weight: 600;
        }

        /* Appointments Section */
        .appointments-section {
          background: white;
          border-radius: 16px;
          padding: 25px;
          border: 2px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .no-date-selected {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: #64748b;
        }

        .placeholder-icon {
          margin-bottom: 20px;
          opacity: 0.5;
        }

        .no-date-selected h3 {
          color: #475569;
          margin-bottom: 10px;
          font-size: 20px;
        }

        .no-date-selected p {
          max-width: 300px;
          line-height: 1.5;
        }

        .selected-date-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 20px;
          border-bottom: 2px solid #f1f5f9;
        }

        .selected-date-header h3 {
          margin: 0;
          color: #1e293b;
          font-size: 20px;
          font-weight: 700;
        }

        .appointment-count {
          background: #3b82f6;
          color: white;
          padding: 6px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 700;
        }

        .no-appointments {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
          font-size: 16px;
        }

        .appointments-list {
          flex: 1;
          overflow-y: auto;
          padding-right: 10px;
        }

        .appointments-list::-webkit-scrollbar {
          width: 6px;
        }

        .appointments-list::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 3px;
        }

        .appointments-list::-webkit-scrollbar-thumb {
          background: #cbd5e0;
          border-radius: 3px;
        }

        .appointments-list::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        .appointment-item {
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 15px;
          background: white;
          transition: all 0.3s;
        }

        .appointment-item:hover {
          border-color: #cbd5e0;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .appointment-time {
          margin-bottom: 15px;
        }

        .time-badge {
          display: inline-block;
          background: #3b82f6;
          color: white;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
        }

        .appointment-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 15px;
        }

        .appointment-header h4 {
          margin: 0;
          color: #1e293b;
          font-size: 18px;
          font-weight: 700;
          flex: 1;
        }

        .appointment-status-badge {
          padding: 6px 12px;
          border-radius: 20px;
          color: white;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-left: 10px;
        }

        .customer-info p {
          margin: 6px 0;
          color: #475569;
          font-size: 14px;
        }

        .payment-status {
          margin-top: 12px;
        }

        .payment-badge {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 13px;
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

        /* Legend */
        .calendar-legend {
          margin-top: 25px;
          padding-top: 20px;
          border-top: 2px solid #f1f5f9;
        }

        .legend-title {
          color: #64748b;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 12px;
        }

        .legend-items {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .legend-color {
          width: 16px;
          height: 16px;
          border-radius: 4px;
        }

        .legend-item span {
          color: #475569;
          font-size: 13px;
          font-weight: 500;
        }

        @media (max-width: 1024px) {
          .calendar-view-container {
            grid-template-columns: 1fr;
            height: auto;
          }

          .calendar-section,
          .appointments-section {
            height: 600px;
          }
        }

        @media (max-width: 768px) {
          .calendar-section,
          .appointments-section {
            padding: 20px;
            height: 500px;
          }

          .calendar-grid {
            gap: 6px;
          }

          .calendar-day-header {
            padding: 12px 4px;
            font-size: 12px;
          }

          .calendar-day {
            min-height: 70px;
            padding: 8px;
          }

          .day-number {
            font-size: 16px;
          }

          .appointment-item {
            padding: 16px;
          }

          .appointment-header {
            flex-direction: column;
            gap: 10px;
          }

          .appointment-status-badge {
            align-self: flex-start;
          }

          .legend-items {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 480px) {
          .calendar-section,
          .appointments-section {
            padding: 16px;
            height: 450px;
          }

          .calendar-month {
            font-size: 18px;
          }

          .calendar-nav-btn {
            width: 36px;
            height: 36px;
          }

          .calendar-day {
            min-height: 60px;
          }

          .day-number {
            font-size: 14px;
          }

          .appointment-header h4 {
            font-size: 16px;
          }
        }
      `}</style>
    </div>
  )
}

export default CalendarView