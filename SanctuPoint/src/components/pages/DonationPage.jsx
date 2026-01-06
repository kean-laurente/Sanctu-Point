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
    averageAmount: 0,
    anonymousCount: 0
  })
  
  const [formData, setFormData] = useState({
    donor_name: '',
    amount: '',
    description: ''
  })

  const [validationErrors, setValidationErrors] = useState({
    donor_name: '',
    amount: ''
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
    let newValue = value
    
    // Real-time cleaning for donor name - OPTIONAL
    if (name === 'donor_name') {
      // Apply cleaning first (removes special characters and numbers)
      newValue = donationService.cleanDonorName(value)
      
      // Real-time validation (name is optional)
      const validation = donationService.validateDonorName(newValue)
      setValidationErrors(prev => ({
        ...prev,
        donor_name: validation.isValid ? '' : validation.message
      }))
    }
    // Real-time cleaning for amount - MAX 50,000
    else if (name === 'amount') {
      // Allow only numbers and one decimal point
      newValue = value.replace(/[^0-9.]/g, '')
      const parts = newValue.split('.')
      newValue = parts.length > 2 
        ? parts[0] + '.' + parts.slice(1).join('')
        : newValue
      
      // If value exceeds 50000, cap it at 50000
      if (newValue && parseFloat(newValue) > 50000) {
        newValue = '50000'
      }
      
      // Real-time validation
      const validation = donationService.validateAmount(newValue)
      setValidationErrors(prev => ({
        ...prev,
        amount: validation.isValid ? '' : validation.message
      }))
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    setValidationErrors({ donor_name: '', amount: '' })

    // Use service validation functions
    const nameValidation = donationService.validateDonorName(formData.donor_name)
    const amountValidation = donationService.validateAmount(formData.amount)

    // Only validate amount (donor name is optional)
    if (!amountValidation.isValid) {
      setValidationErrors({
        donor_name: nameValidation.isValid ? '' : nameValidation.message,
        amount: amountValidation.isValid ? '' : amountValidation.message
      })
      setLoading(false)
      return
    }

    // Clean the data before submission
    const cleanedData = {
      donor_name: donationService.cleanDonorName(formData.donor_name) || null, // Can be null/empty
      amount: donationService.cleanAmount(formData.amount),
      description: formData.description ? formData.description.trim() : ''
    }

    // Final validation check for amount
    if (parseFloat(cleanedData.amount) > 50000) {
      setError('Amount cannot exceed ₱50,000')
      setLoading(false)
      return
    }

    try {
      const result = await donationService.createDonation(cleanedData)
      
      if (result.success) {
        setSuccess(result.message || 'Donation recorded successfully!')
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
        if (result.validationErrors) {
          // Show validation errors from service
          setError(result.validationErrors.join('. '))
        }
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

  const isFormValid = () => {
    // Only amount is required, donor name is optional
    const amountValid = donationService.validateAmount(formData.amount).isValid
    return amountValid
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
            <span className="error-icon">❌</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="message success">
            <span className="success-icon">✅</span>
            <span>{success}</span>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="stats-cards">
          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-number">{formatCurrency(stats.totalAmount)}</div>
            <div className="stat-label">Total Donations</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📈</div>
            <div className="stat-number">{formatCurrency(stats.recentAmount)}</div>
            <div className="stat-label">Last 30 Days</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-number">{stats.totalCount}</div>
            <div className="stat-label">Total Donations</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">👤</div>
            <div className="stat-number">{stats.anonymousCount || 0}</div>
            <div className="stat-label">Anonymous Donations</div>
          </div>
        </div>

        <div className="donation-actions">
          <button 
            onClick={() => setShowForm(!showForm)}
            className="add-donation-button"
            disabled={loading}
          >
            {showForm ? 'Cancel' : '➕ Record New Donation'}
          </button>
        </div>

        {showForm && (
          <div className="donation-form-container">
            <h2>Record New Donation</h2>
            <form onSubmit={handleSubmit} className="donation-form">
              <div className="form-group">
                <label htmlFor="donor_name">
                  Donor Name
                  <span className="optional-indicator"> (optional)</span>
                </label>
                <input
                  type="text"
                  id="donor_name"
                  name="donor_name"
                  value={formData.donor_name}
                  onChange={handleInputChange}
                  placeholder="Enter donor's name (leave blank for anonymous)"
                  disabled={loading}
                  className={`form-input ${validationErrors.donor_name ? 'input-error' : ''}`}
                  autoComplete="name"
                />
                {validationErrors.donor_name && (
                  <div className="field-error">
                    <span className="error-icon">❌</span>
                    {validationErrors.donor_name}
                  </div>
                )}
                <div className="field-hint">
                  Leave blank for anonymous donation. If provided: minimum 2 characters. 
                  Letters, spaces, periods, apostrophes, and hyphens only. 
                  Special characters and numbers are not allowed.
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="amount">
                  Amount (₱)
                  <span className="required-indicator"> * required</span>
                </label>
                <div className="input-with-prefix">
                  <span className="input-prefix">₱</span>
                  <input
                    type="text"
                    id="amount"
                    name="amount"
                    value={formData.amount}
                    onChange={handleInputChange}
                    required
                    placeholder="0.00"
                    disabled={loading}
                    className={`form-input ${validationErrors.amount ? 'input-error' : ''}`}
                    inputMode="decimal"
                  />
                </div>
                {validationErrors.amount && (
                  <div className="field-error">
                    <span className="error-icon">❌</span>
                    {validationErrors.amount}
                  </div>
                )}
                <div className="field-hint">
                  Minimum ₱0.01, maximum ₱50,000
                </div>
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
                <div className="field-hint">
                  Maximum 500 characters
                </div>
              </div>

              <div className="form-actions">
                <button 
                  type="submit" 
                  disabled={loading || !isFormValid()}
                  className="submit-button"
                >
                  {loading ? (
                    <>
                      <span className="spinner"></span>
                      Recording...
                    </>
                  ) : (
                    '📝 Record Donation'
                  )}
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
              {loading ? '🔄 Refreshing...' : '🔄 Refresh'}
            </button>
          </div>

          {loading && donations.length === 0 ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading donations...</p>
            </div>
          ) : donations.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
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
                        <span className="donor-icon">👤</span>
                        <strong>
                          {donation.donor_name || (
                            <span className="anonymous-donor">Anonymous</span>
                          )}
                        </strong>
                      </td>
                      <td className="amount-cell">
                        <span className="amount-value">
                          {formatCurrency(donation.amount)}
                        </span>
                      </td>
                      <td className="date-cell">
                        <span className="date-icon">📅</span>
                        {formatDate(donation.donation_date)}
                      </td>
                      <td className="description-cell">
                        {donation.description || (
                          <span className="no-description">No description</span>
                        )}
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
          display: flex;
          align-items: center;
          gap: 12px;
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

        .error-icon, .success-icon {
          font-size: 18px;
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

        .stat-icon {
          font-size: 32px;
          margin-bottom: 12px;
          display: block;
        }

        .stat-number {
          font-size: 1.8rem;
          font-weight: 800;
          margin-bottom: 10px;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .stat-label {
          font-size: 15px;
          opacity: 0.95;
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
          display: inline-flex;
          align-items: center;
          gap: 8px;
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
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .required-indicator {
          color: #f56565;
          font-size: 13px;
          font-weight: normal;
        }

        .optional-indicator {
          color: #718096;
          font-size: 13px;
          font-weight: normal;
          font-style: italic;
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
          box-sizing: border-box;
        }

        .input-with-prefix {
          position: relative;
        }

        .input-prefix {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: #4a5568;
          font-weight: 600;
        }

        .input-with-prefix .form-input {
          padding-left: 40px;
        }

        .form-input.input-error {
          border-color: #f56565;
          background: #fff5f5;
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

        .field-error {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #c53030;
          font-size: 14px;
          margin-top: 8px;
          font-weight: 500;
        }

        .error-icon {
          font-size: 16px;
        }

        .field-hint {
          color: #718096;
          font-size: 13px;
          margin-top: 6px;
          line-height: 1.4;
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
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
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

        .spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 1s ease-in-out infinite;
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
          display: flex;
          align-items: center;
          gap: 8px;
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

        .empty-state-icon {
          font-size: 48px;
          margin-bottom: 20px;
          display: block;
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
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .donor-icon {
          font-size: 18px;
        }

        .anonymous-donor {
          color: #718096;
          font-style: italic;
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
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .date-icon {
          font-size: 16px;
        }

        .description-cell {
          max-width: 300px;
          color: #4a5568;
          line-height: 1.6;
        }

        .no-description {
          color: #a0aec0;
          font-style: italic;
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
            justify-content: center;
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