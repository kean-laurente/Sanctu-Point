import { useMemo, useState } from 'react'
import './DonationReport.css'

const DonationReport = ({ events }) => {
  const [month, setMonth] = useState('all')
  const [year, setYear] = useState('all')

  const years = useMemo(() => {
    const set = new Set(events.map(e => e.date.substring(0, 4)))
    return Array.from(set).sort()
  }, [events])

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const eYear = e.date.substring(0, 4)
      const eMonth = e.date.substring(5, 7)
      return (year === 'all' || eYear === year) &&
             (month === 'all' || eMonth === month)
    })
  }, [events, month, year])

  const totalDonations = filteredEvents.reduce(
    (sum, e) => sum + e.total_payments, 0
  )

  return (
    <div className="report-card">
      <h2>Donation Report</h2>

      {/* Filters */}
      <div className="report-filters">
        <select value={month} onChange={e => setMonth(e.target.value)}>
          <option value="all">All Months</option>
          {Array.from({ length: 12 }).map((_, i) => (
            <option key={i} value={String(i + 1).padStart(2, '0')}>
              {new Date(0, i).toLocaleString('en-PH', { month: 'long' })}
            </option>
          ))}
        </select>

        <select value={year} onChange={e => setYear(e.target.value)}>
          <option value="all">All Years</option>
          {years.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="donation-summary">
        <div className="summary-box">
          <span>Total Donations</span>
          <strong>₱{totalDonations.toLocaleString()}</strong>
        </div>
        <div className="summary-box">
          <span>Transactions</span>
          <strong>{filteredEvents.length}</strong>
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="report-empty">No donations for selected period</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Donor</th>
              <th>Service / Event</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.map(e => (
              <tr key={e.id}>
                <td>{e.date}</td>
                <td>{e.customer_name}</td>
                <td>{e.service_type}</td>
                <td>₱{e.total_payments.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default DonationReport
