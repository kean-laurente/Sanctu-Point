import { useState, useEffect } from 'react'
import { donationService } from '../../services/donationService'

const DonationPage = () => {
  const [donations, setDonations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [stats, setStats] = useState({
    totalAmount: 0,
    totalCount: 0,
    recentAmount: 0,
    recentCount: 0,
    averageAmount: 0
  })
  
  const [formData, setFormData] = useState({
    donor_name: '',
    amount: '',
    description: ''
  })

  useEffect(() => {
    loadDonations()
    loadStats()
  }, [])

  const loadDonations = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await donationService.getDonations()
      
      if (result.success) {
        setDonations(result.data || [])
      } else {
        setError(result.error || 'Failed to load donations')
      }
    } catch (err) {
      setError('An error occurred while loading donations')
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const result = await donationService.getDonationStats()
      
      if (result.success) {
        setStats(result.data)
      }
    } catch (err) {
      console.error('Error loading stats:', err)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    // Validate form
    if (!formData.donor_name.trim()) {
      setError('Please enter donor name')
      setLoading(false)
      return
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError('Please enter a valid amount greater than 0')
      setLoading(false)
      return
    }

    try {
      const result = await donationService.createDonation(formData)
      
      if (result.success) {
        setSuccess(result.message)
        setFormData({
          donor_name: '',
          amount: '',
          description: ''
        })
        setShowForm(false)
        await loadDonations()
        await loadStats()
      } else {
        setError(result.error || 'Failed to record donation')
      }
    } catch (err) {
      setError('An error occurred while recording donation')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="donation-header">
          <h1>Donation Management</h1>
          <p>Record and manage church donations</p>
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

        {/* Statistics Cards */}
        <div className="stats-cards">
          <div className="stat-card">
            <div className="stat-number">{formatCurrency(stats.totalAmount)}</div>
            <div className="stat-label">Total Donations</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{formatCurrency(stats.recentAmount)}</div>
            <div className="stat-label">Last 30 Days</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.totalCount}</div>
            <div className="stat-label">Total Donations</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{formatCurrency(stats.averageAmount)}</div>
            <div className="stat-label">Average Donation</div>
          </div>
        </div>

        <div className="donation-actions">
          <button 
            onClick={() => setShowForm(!showForm)}
            className="add-donation-button"
            disabled={loading}
          >
            {showForm ? 'Cancel' : 'Record New Donation'}
          </button>
        </div>

        {showForm && (
          <div className="donation-form-container">
            <h2>Record New Donation</h2>
            <form onSubmit={handleSubmit} className="donation-form">
              <div className="form-group">
                <label htmlFor="donor_name">Donor Name *</label>
                <input
                  type="text"
                  id="donor_name"
                  name="donor_name"
                  value={formData.donor_name}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter donor's name"
                  disabled={loading}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="amount">Amount (₱) *</label>
                <input
                  type="number"
                  id="amount"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="Enter donation amount"
                  disabled={loading}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description (Optional)</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Enter donation purpose or notes..."
                  rows="3"
                  disabled={loading}
                  className="form-textarea"
                />
              </div>

              <div className="form-actions">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="submit-button"
                >
                  {loading ? 'Recording...' : 'Record Donation'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="donations-section">
          <div className="section-header">
            <h2>Donation History</h2>
            <button 
              onClick={() => {
                loadDonations()
                loadStats()
              }}
              className="refresh-button"
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {loading && donations.length === 0 ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading donations...</p>
            </div>
          ) : donations.length === 0 ? (
            <div className="empty-state">
              <h3>No Donations Recorded</h3>
              <p>No donations have been recorded yet. Start by recording your first donation.</p>
            </div>
          ) : (
            <div className="donations-table-container">
              <table className="donations-table">
                <thead>
                  <tr>
                    <th>Donor Name</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {donations.map(donation => (
                    <tr key={donation.donation_id} className="donation-row">
                      <td className="donor-name-cell">
                        <strong>{donation.donor_name}</strong>
                      </td>
                      <td className="amount-cell">
                        <span className="amount-value">
                          {formatCurrency(donation.amount)}
                        </span>
                      </td>
                      <td className="date-cell">
                        {formatDate(donation.donation_date)}
                      </td>
                      <td className="description-cell">
                        {donation.description || 'No description provided'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .page-container {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .page-content {
          background: white;
          border-radius: 12px;
          padding: 30px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        }

        .donation-header {
          margin-bottom: 40px;
          text-align: center;
        }

        .donation-header h1 {
          color: #2d3748;
          margin-bottom: 12px;
          font-size: 2.2rem;
          font-weight: 700;
        }

        .donation-header p {
          color: #718096;
          font-size: 1.1rem;
          max-width: 600px;
          margin: 0 auto;
          line-height: 1.6;
        }

        .message {
          padding: 16px 20px;
          border-radius: 10px;
          margin-bottom: 24px;
          font-weight: 500;
          border-left: 4px solid transparent;
          font-size: 15px;
        }

        .message.error {
          background: #fff5f5;
          border-color: #f56565;
          color: #c53030;
        }

        .message.success {
          background: #f0fff4;
          border-color: #48bb78;
          color: #276749;
        }

        .stats-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 20px;
          margin-bottom: 40px;
        }

        .stat-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 28px 20px;
          border-radius: 16px;
          text-align: center;
          color: white;
          box-shadow: 0 8px 25px rgba(102, 126, 234, 0.15);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .stat-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 15px 35px rgba(102, 126, 234, 0.25);
        }

        .stat-number {
          font-size: 2rem;
          font-weight: 800;
          margin-bottom: 10px;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .stat-label {
          font-size: 15px;
          opacity: 0.95;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-weight: 600;
        }

        .donation-actions {
          margin-bottom: 30px;
          text-align: center;
        }

        .add-donation-button {
          padding: 16px 40px;
          background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
          color: white;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          font-size: 17px;
          font-weight: 600;
          transition: all 0.3s ease;
          box-shadow: 0 6px 20px rgba(72, 187, 120, 0.2);
        }

        .add-donation-button:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 10px 25px rgba(72, 187, 120, 0.3);
          background: linear-gradient(135deg, #3ac569 0%, #2f855a 100%);
        }

        .add-donation-button:disabled {
          background: #cbd5e0;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .donation-form-container {
          background: #f8fafc;
          border-radius: 16px;
          padding: 36px;
          margin-bottom: 40px;
          border: 2px solid #e2e8f0;
          box-shadow: 0 6px 15px rgba(0, 0, 0, 0.05);
        }

        .donation-form-container h2 {
          color: #2d3748;
          margin-bottom: 28px;
          text-align: center;
          font-size: 1.8rem;
          font-weight: 600;
        }

        .donation-form {
          display: flex;
          flex-direction: column;
          gap: 24px;
          max-width: 700px;
          margin: 0 auto;
        }

        .form-group {
          display: flex;
          flex-direction: column;
        }

        .form-group label {
          margin-bottom: 10px;
          font-weight: 600;
          color: #4a5568;
          font-size: 15px;
        }

        .form-input,
        .form-textarea {
          padding: 16px 20px;
          border: 2px solid #e2e8f0;
          border-radius: 10px;
          font-size: 16px;
          color: #2d3748;
          background: white;
          transition: all 0.2s;
          width: 100%;
        }

        .form-input:focus,
        .form-textarea:focus {
          outline: none;
          border-color: #4299e1;
          box-shadow: 0 0 0 4px rgba(66, 153, 225, 0.1);
        }

        .form-input:disabled,
        .form-textarea:disabled {
          background: #f7fafc;
          cursor: not-allowed;
          opacity: 0.7;
        }

        .form-textarea {
          resize: vertical;
          min-height: 100px;
          font-family: inherit;
          line-height: 1.5;
        }

        .form-actions {
          display: flex;
          justify-content: center;
          margin-top: 20px;
        }

        .submit-button {
          padding: 18px 48px;
          background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
          color: white;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          font-size: 17px;
          font-weight: 600;
          transition: all 0.3s ease;
          min-width: 220px;
        }

        .submit-button:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 10px 25px rgba(66, 153, 225, 0.3);
          background: linear-gradient(135deg, #3182ce 0%, #2b6cb0 100%);
        }

        .submit-button:disabled {
          background: #cbd5e0;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .donations-section {
          margin-top: 50px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 28px;
          padding-bottom: 20px;
          border-bottom: 2px solid #edf2f7;
        }

        .section-header h2 {
          color: #2d3748;
          margin: 0;
          font-size: 1.8rem;
          font-weight: 600;
        }

        .refresh-button {
          padding: 12px 28px;
          background: #718096;
          color: white;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-size: 15px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .refresh-button:hover:not(:disabled) {
          background: #4a5568;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(113, 128, 150, 0.2);
        }

        .refresh-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .loading-container {
          text-align: center;
          padding: 60px 40px;
          color: #718096;
        }

        .loading-spinner {
          border: 4px solid #f3f3f3;
          border-top: 4px solid #4299e1;
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

        .empty-state {
          text-align: center;
          padding: 80px 40px;
          color: #a0aec0;
          background: #f8fafc;
          border-radius: 16px;
          border: 2px dashed #e2e8f0;
        }

        .empty-state h3 {
          margin-bottom: 16px;
          color: #718096;
          font-size: 1.5rem;
          font-weight: 600;
        }

        .empty-state p {
          font-size: 16px;
          max-width: 500px;
          margin: 0 auto;
          line-height: 1.6;
        }

        .donations-table-container {
          overflow-x: auto;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
        }

        .donations-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 800px;
        }

        .donations-table thead {
          background: linear-gradient(135deg, #4c51bf 0%, #434190 100%);
        }

        .donations-table th {
          padding: 22px 24px;
          text-align: left;
          color: white;
          font-weight: 600;
          font-size: 15px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 3px solid #434190;
        }

        .donations-table th:first-child {
          border-top-left-radius: 12px;
        }

        .donations-table th:last-child {
          border-top-right-radius: 12px;
        }

        .donation-row {
          border-bottom: 1px solid #edf2f7;
          transition: background-color 0.2s;
        }

        .donation-row:hover {
          background-color: #f8fafc;
        }

        .donation-row:last-child {
          border-bottom: none;
        }

        .donations-table td {
          padding: 22px 24px;
          vertical-align: top;
          color: #4a5568;
          font-size: 15px;
          line-height: 1.5;
        }

        .donor-name-cell {
          font-weight: 600;
          color: #2d3748;
          min-width: 200px;
        }

        .amount-cell {
          min-width: 150px;
        }

        .amount-value {
          background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
          color: white;
          padding: 8px 18px;
          border-radius: 20px;
          font-weight: 700;
          font-size: 15px;
          display: inline-block;
          box-shadow: 0 4px 12px rgba(72, 187, 120, 0.2);
        }

        .date-cell {
          color: #718096;
          min-width: 200px;
          font-size: 14.5px;
        }

        .description-cell {
          max-width: 300px;
          color: #4a5568;
          line-height: 1.6;
        }

        /* Responsive Styles */
        @media (max-width: 1024px) {
          .page-content {
            padding: 25px;
          }
          
          .stats-cards {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .page-container {
            padding: 15px;
          }
          
          .page-content {
            padding: 20px;
          }
          
          .donation-header h1 {
            font-size: 1.8rem;
          }
          
          .donation-header p {
            font-size: 1rem;
          }
          
          .stats-cards {
            grid-template-columns: 1fr;
            gap: 16px;
          }
          
          .stat-card {
            padding: 24px 18px;
          }
          
          .stat-number {
            font-size: 1.7rem;
          }
          
          .donation-form-container {
            padding: 25px;
          }
          
          .donation-form-container h2 {
            font-size: 1.5rem;
          }
          
          .section-header {
            flex-direction: column;
            gap: 16px;
            align-items: flex-start;
          }
          
          .refresh-button {
            align-self: stretch;
            width: 100%;
          }
          
          .donations-table th,
          .donations-table td {
            padding: 18px 16px;
            font-size: 14.5px;
          }
          
          .amount-value {
            padding: 6px 14px;
            font-size: 14px;
          }
        }

        @media (max-width: 640px) {
          .page-container {
            padding: 12px;
          }
          
          .page-content {
            padding: 18px;
          }
          
          .donation-form-container {
            padding: 20px;
          }
          
          .form-input,
          .form-textarea {
            padding: 14px 16px;
            font-size: 15px;
          }
          
          .add-donation-button,
          .submit-button {
            padding: 16px 32px;
            font-size: 16px;
            width: 100%;
          }
          
          .donations-table th,
          .donations-table td {
            padding: 16px 12px;
            font-size: 14px;
          }
          
          .amount-value {
            padding: 5px 12px;
            font-size: 13.5px;
          }
          
          .description-cell {
            max-width: 200px;
          }
        }

        @media (max-width: 480px) {
          .donation-header h1 {
            font-size: 1.6rem;
          }
          
          .stat-number {
            font-size: 1.5rem;
          }
          
          .stat-label {
            font-size: 14px;
          }
          
          .donations-table {
            min-width: 600px;
          }
          
          .donations-table th {
            font-size: 13.5px;
            padding: 14px 10px;
          }
          
          .donations-table td {
            padding: 14px 10px;
            font-size: 13.5px;
          }
          
          .amount-value {
            font-size: 13px;
            padding: 4px 10px;
          }
        }
      `}</style>
    </div>
  )
}

export default DonationPage