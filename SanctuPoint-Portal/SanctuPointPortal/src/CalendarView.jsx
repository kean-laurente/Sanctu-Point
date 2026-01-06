import { useState, useMemo } from 'react'
import './CalendarView.css'

const WORK_START = 8    // 8 AM
const WORK_END = 17    // 5 PM
const SLOT_INTERVAL = 60 // minutes
const REQUIRED_GAP = 60 // 1 hour gap required

// Helper function to convert time string to 24-hour format (moved outside component)
const convertTimeTo24Hour = (timeStr) => {
  if (!timeStr) return 0
  
  // Handle various time formats
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
}

const CalendarView = ({ events }) => {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)

  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

  const daysInMonth = endOfMonth.getDate()
  const startDay = startOfMonth.getDay()

  // Get today's date for comparison
  const today = new Date()
  const todayYear = today.getFullYear()
  const todayMonth = today.getMonth()
  const todayDay = today.getDate()

  /* ---------------- CALENDAR DAYS ---------------- */
  const calendarDays = useMemo(() => {
    const days = []
    for (let i = 0; i < startDay; i++) days.push(null)
    for (let i = 1; i <= daysInMonth; i++) days.push(i)
    return days
  }, [daysInMonth, startDay])

  /* ---------------- EVENTS MAP ---------------- */
  const eventsByDate = useMemo(() => {
    const map = {}
    events.forEach(e => {
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    })
    return map
  }, [events])

  const selectedEvents = selectedDate
    ? eventsByDate[selectedDate] || []
    : []

  /* ---------------- TIME SLOTS ---------------- */
  const timeSlots = useMemo(() => {
    const slots = []
    for (let hour = WORK_START; hour < WORK_END; hour++) {
      const h = hour % 12 || 12
      const period = hour >= 12 ? 'PM' : 'AM'
      slots.push({
        hour24: hour,
        hour12: h,
        period: period,
        display: `${h}:00 ${period}`
      })
    }
    return slots
  }, [])

  const slotsWithStatus = useMemo(() => {
    if (!selectedDate) return []
    
    // Parse selected date for comparison
    const [year, month, day] = selectedDate.split('-').map(Number)
    const selectedDateObj = new Date(year, month - 1, day)
    
    // Check if selected date is in the past
    const isPastDate = selectedDateObj < today
    
    // Sort events by time for easier gap calculation
    const sortedEvents = [...selectedEvents].sort((a, b) => {
      const timeA = a.time || a.formatted_time || '00:00 AM'
      const timeB = b.time || b.formatted_time || '00:00 AM'
      return convertTimeTo24Hour(timeA) - convertTimeTo24Hour(timeB)
    })

    return timeSlots.map(slot => {
      // Check if slot is taken by an event
      const bookedEvent = selectedEvents.find(e => {
        const eventTime = e.time || e.formatted_time || '00:00 AM'
        const eventHour24 = convertTimeTo24Hour(eventTime)
        return eventHour24 === slot.hour24
      })

      let status = 'available'
      let reason = null
      let isBookable = true
      
      if (bookedEvent) {
        status = 'taken'
        reason = 'Booked'
        isBookable = false
      } else {
        // Check if slot should be blocked due to gap requirement
        const shouldBlockForGap = sortedEvents.some(event => {
          const eventTime = event.time || event.formatted_time || '00:00 AM'
          const eventHour24 = convertTimeTo24Hour(eventTime)
          
          // Check if this slot is within 1 hour before or after an existing event
          return Math.abs(slot.hour24 - eventHour24) === 1 // Exactly 1 hour difference
        })

        if (shouldBlockForGap) {
          // Find the nearest event that causes the gap
          const nearestEvent = sortedEvents.find(event => {
            const eventHour24 = convertTimeTo24Hour(event.time || event.formatted_time || '00:00 AM')
            return Math.abs(slot.hour24 - eventHour24) === 1
          })

          if (nearestEvent) {
            const eventTime = nearestEvent.time || nearestEvent.formatted_time || '00:00 AM'
            status = 'blocked'
            reason = `1-hour gap required (adjacent to ${eventTime})`
            isBookable = false
          }
        } else if (isPastDate) {
          // Check if it's today and past time
          const isToday = year === todayYear && month === todayMonth + 1 && day === todayDay
          if (isToday) {
            // For today, check if the time slot has passed
            const currentHour = today.getHours()
            if (slot.hour24 <= currentHour) {
              status = 'past'
              reason = 'This time slot has passed'
              isBookable = false
            }
          } else {
            // For past dates, all slots are view-only
            status = 'past'
            reason = 'View only - cannot book past dates'
            isBookable = false
          }
        }
      }

      return {
        time: slot.display,
        hour24: slot.hour24,
        status: status,
        event: bookedEvent || null,
        reason: reason,
        isBookable: isBookable
      }
    })
  }, [timeSlots, selectedEvents, selectedDate, today, todayYear, todayMonth, todayDay])

  // Helper function to check if a date is in the past
  const isDateInPast = (day) => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const dateObj = new Date(year, month, day)
    return dateObj < today
  }

  return (
    <div className="calendar-layout">
      {/* LEFT: CALENDAR */}
      <div className="calendar-wrapper">
        <div className="calendar-header">
          <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}>◀</button>
          <h2>
            {currentDate.toLocaleString('en-PH', { month: 'long', year: 'numeric' })}
          </h2>
          <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}>▶</button>
        </div>

        <div className="calendar-grid">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} className="calendar-day-name">{d}</div>
          ))}

          {calendarDays.map((day, i) => {
            if (!day) return <div key={i} className="calendar-empty" />

            const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
            const hasEvents = eventsByDate[dateStr]
            const isSelected = selectedDate === dateStr
            const isPast = isDateInPast(day)

            return (
              <div
                key={i}
                className={`calendar-day ${hasEvents ? 'has-event' : ''} ${isSelected ? 'selected' : ''} ${isPast ? 'past-date' : ''}`}
                onClick={() => setSelectedDate(dateStr)}
                title={isPast ? 'View only - cannot book past dates' : ''}
              >
                <span>{day}</span>
                {hasEvents && <div className="event-dot" />}
              </div>
            )
          })}
        </div>
      </div>

      {/* RIGHT: TIME SLOTS */}
      <div className="calendar-side-panel">
        {!selectedDate ? (
          <div className="side-placeholder">
            <h3>Select a date</h3>
            <p>Click a day to view available and taken time slots.</p>
            <p className="past-note">You can view past dates but cannot book them.</p>
          </div>
        ) : (
          <>
            <h3>
              Time Slots — {new Date(selectedDate).toLocaleDateString('en-PH', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}
            </h3>

            <div className="timeslot-list">
              {slotsWithStatus.map(slot => (
                <div
                  key={slot.time}
                  className={`timeslot-card ${slot.status} ${slot.isBookable ? '' : 'not-bookable'}`}
                  title={slot.reason || ''}
                >
                  <div className="timeslot-time">{slot.time}</div>

                  {slot.status === 'taken' ? (
                    <div className="timeslot-info">
                      <strong>{slot.event.title}</strong>
                      <span>{slot.event.customer_name}</span>
                    </div>
                  ) : slot.status === 'blocked' ? (
                    <div className="timeslot-info blocked">
                      <strong>Unavailable</strong>
                      <span> </span>
                    </div>
                  ) : slot.status === 'past' ? (
                    <div className="timeslot-info past">
                      <strong> </strong>
                      <span> </span>
                    </div>
                  ) : (
                    <div className="timeslot-info available">
                      <strong>Available</strong>
                      <span>{slot.isBookable ? 'Book this slot' : 'View only'}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Legend */}
            <div className="slot-legend">
              <div className="legend-item">
                <div className="legend-color available"></div>
                <span>Available (Bookable)</span>
              </div>
              <div className="legend-item">
                <div className="legend-color taken"></div>
                <span>Booked</span>
              </div>
              <div className="legend-item">
                <div className="legend-color blocked"></div>
                <span>1-hour gap required</span>
              </div>
              <div className="legend-item">
                <div className="legend-color past"></div>
                <span>Past/View Only</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default CalendarView