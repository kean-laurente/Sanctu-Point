import { useState, useEffect } from 'react'
import { appointmentService } from '../../services/appointmentService'
import { servicesService } from '../../services/servicesService'
import { authService } from '../../auth/authService'

const BookAppointmentPage = () => {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    service_type: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    requirements: ['']
  })

  useEffect(() => {
    loadCurrentUser()
    loadServices()
  }, [])

  const loadCurrentUser = () => {
    const user = authService.getCurrentUser()
    setCurrentUser(user)
    // Form starts empty - no auto-filling
  }

  const loadServices = async () => {
    try {
      const result = await servicesService.getServices()
      if (result.success) {
        setServices(result.data)
      }
    } catch (err) {
      console.error('Error loading services:', err)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleRequirementChange = (index, value) => {
    const newRequirements = [...formData.requirements]
    newRequirements[index] = value
    setFormData(prev => ({
      ...prev,
      requirements: newRequirements
    }))
  }

  const addRequirement = () => {
    setFormData(prev => ({
      ...prev,
      requirements: [...prev.requirements, '']
    }))
  }

  const removeRequirement = (index) => {
    const newRequirements = formData.requirements.filter((_, i) => i !== index)
    setFormData(prev => ({
      ...prev,
      requirements: newRequirements
    }))
  }

  const validateForm = () => {
    const errors = []
    
    // Check required fields
    if (!formData.date.trim()) errors.push('Date is required')
    if (!formData.time.trim()) errors.push('Time is required')
    if (!formData.service_type.trim()) errors.push('Service type is required')
    if (!formData.first_name.trim()) errors.push('First name is required')
    if (!formData.last_name.trim()) errors.push('Last name is required')
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!formData.email.trim()) {
      errors.push('Email is required')
    } else if (!emailRegex.test(formData.email)) {
      errors.push('Please enter a valid email address')
    }
    
    // Phone validation (optional but if provided, must be valid)
    if (formData.phone.trim()) {
      const cleanPhone = formData.phone.replace(/[^\d]/g, '')
      if (cleanPhone.length < 10) {
        errors.push('Phone number must be at least 10 digits')
      } else if (!/^(09|9)/.test(cleanPhone)) {
        errors.push('Philippine phone numbers must start with 09 or 9')
      }
    }
    
    return errors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    // Validate form
    const errors = validateForm()
    if (errors.length > 0) {
      setError(errors.join(', '))
      setLoading(false)
      return
    }

    // Filter out empty requirements
    const filteredRequirements = formData.requirements.filter(req => req.trim() !== '')

    try {
      // Clean phone number (remove any non-numeric characters)
      const cleanedData = {
        ...formData,
        phone: formData.phone ? formData.phone.replace(/[^\d]/g, '') : '',
        requirements: filteredRequirements
      }

      const result = await appointmentService.createAppointment(
        cleanedData,
        currentUser
      )

      if (result.success) {
        setSuccess(result.message)
        // Reset form to empty state
        setFormData({
          date: '',
          time: '',
          service_type: '',
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
          requirements: ['']
        })
      } else {
        setError(result.error || 'Failed to book appointment')
      }
    } catch (err) {
      setError('An error occurred while booking appointment')
    } finally {
      setLoading(false)
    }
  }

  // Generate time slots (8 AM to 5 PM, every 30 minutes)
  const generateTimeSlots = () => {
    const slots = []
    const startHour = 8 // 8 AM
    const endHour = 17 // 5 PM
    
    for (let hour = startHour; hour <= endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        if (hour === endHour && minute > 0) continue // Stop at 5:00 PM
        
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        // Convert to 12-hour format for display
        const displayHour = hour % 12 || 12
        const period = hour >= 12 ? 'PM' : 'AM'
        const displayTime = `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`
        
        slots.push({ value: timeString, display: displayTime })
      }
    }
    return slots
  }

  const timeSlots = generateTimeSlots()

  // Get minimum date (today)
  const today = new Date().toISOString().split('T')[0]
  // Get maximum date (6 months from now)
  const maxDate = new Date()
  maxDate.setMonth(maxDate.getMonth() + 6)
  const maxDateString = maxDate.toISOString().split('T')[0]

  const formatPhoneForDisplay = (phone) => {
    if (!phone) return ''
    const clean = phone.replace(/[^\d]/g, '')
    if (clean.length === 10) {
      return `+63 ${clean.substring(0, 3)} ${clean.substring(3, 6)} ${clean.substring(6)}`
    }
    return `+63 ${clean}`
  }

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="appointment-header">
          <h1>Book an Appointment</h1>
          <p>Schedule your church service appointment</p>
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

        <form onSubmit={handleSubmit} className="appointment-form">
          <div className="form-section">
            <div className="section-title">
              <h3>Personal Information</h3>
              <p>Provide your contact details</p>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="first_name">First Name *</label>
                <input
                  type="text"
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter your first name"
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="last_name">Last Name *</label>
                <input
                  type="text"
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter your last name"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="email">Email *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter your email"
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone">Phone Number (Optional)</label>
                <div className="phone-input-container">
                  <span className="phone-prefix">+63</span>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={(e) => {
                      // Only allow numbers, limit to 10 digits
                      const value = e.target.value.replace(/[^\d]/g, '').slice(0, 10);
                      setFormData(prev => ({...prev, phone: value}));
                    }}
                    placeholder="9123456789"
                    maxLength="10"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    disabled={loading}
                    className="phone-input"
                  />
                </div>
                <small className="phone-hint">Optional. Enter 10-digit number (e.g., 9123456789)</small>
                {formData.phone && (
                  <div className="phone-preview">
                    Preview: {formatPhoneForDisplay(formData.phone)}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="section-title">
              <h3>Appointment Details</h3>
              <p>Select your preferred date and time</p>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="date">Date *</label>
                <input
                  type="date"
                  id="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  min={today}
                  max={maxDateString}
                  required
                  disabled={loading}
                />
                <small className="date-hint">Select a date within the next 6 months</small>
              </div>

              <div className="form-group">
                <label htmlFor="time">Time *</label>
                <select
                  id="time"
                  name="time"
                  value={formData.time}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                >
                  <option value="">Select a time</option>
                  {timeSlots.map(slot => (
                    <option key={slot.value} value={slot.value}>
                      {slot.display}
                    </option>
                  ))}
                </select>
                <small className="time-hint">Available: 8:00 AM - 5:00 PM</small>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="service_type">Service Type *</label>
              <select
                id="service_type"
                name="service_type"
                value={formData.service_type}
                onChange={handleInputChange}
                required
                disabled={loading}
              >
                <option value="">Select a service</option>
                {services.map(service => (
                  <option key={service.service_id} value={service.service_name}>
                    {service.service_name} {service.price > 0 ? `(₱${service.price.toFixed(2)})` : '(Free)'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-section">
            <div className="section-title">
              <h3>Additional Information</h3>
              <p>Add any special requirements or notes</p>
            </div>
            
            <div className="form-group">
              <label>Requirements (Optional)</label>
              <div className="requirements-container">
                {formData.requirements.map((requirement, index) => (
                  <div key={index} className="requirement-row">
                    <input
                      type="text"
                      value={requirement}
                      onChange={(e) => handleRequirementChange(index, e.target.value)}
                      placeholder="Enter requirement details..."
                      disabled={loading}
                      className="requirement-input"
                    />
                    {formData.requirements.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRequirement(index)}
                        className="remove-requirement-btn"
                        disabled={loading}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addRequirement}
                className="add-requirement-btn"
                disabled={loading}
              >
                + Add Another Requirement
              </button>
            </div>
          </div>

          <div className="form-actions">
            <button 
              type="submit" 
              disabled={loading}
              className="btn-primary submit-btn"
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Booking Appointment...
                </>
              ) : 'Book Appointment'}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .page-container {
          padding: 20px;
          max-width: 1000px;
          margin: 0 auto;
        }

        .page-content {
          background: white;
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }

        .appointment-header {
          margin-bottom: 40px;
          text-align: center;
        }

        .appointment-header h1 {
          color: #2d3748;
          margin-bottom: 12px;
          font-size: 2rem;
          font-weight: 700;
        }

        .appointment-header p {
          color: #718096;
          font-size: 16px;
          max-width: 600px;
          margin: 0 auto;
        }

        .message {
          padding: 16px 20px;
          border-radius: 10px;
          margin-bottom: 24px;
          font-weight: 500;
          border-left: 4px solid transparent;
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

        .appointment-form {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .form-section {
          background: #f8fafc;
          border-radius: 12px;
          padding: 28px;
          border: 2px solid #e2e8f0;
        }

        .section-title {
          margin-bottom: 24px;
        }

        .section-title h3 {
          color: #2d3748;
          margin: 0 0 8px 0;
          font-size: 1.3rem;
          font-weight: 600;
        }

        .section-title p {
          color: #718096;
          margin: 0;
          font-size: 14px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          margin-bottom: 10px;
          font-weight: 600;
          color: #4a5568;
          font-size: 14px;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 14px 16px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 15px;
          color: #2d3748;
          background: white;
          box-sizing: border-box;
          transition: all 0.2s;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #4299e1;
          box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
        }

        .form-group input:disabled,
        .form-group select:disabled {
          background: #f7fafc;
          cursor: not-allowed;
          opacity: 0.7;
        }

        .phone-input-container {
          display: flex;
          align-items: center;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
          background: white;
        }

        .phone-prefix {
          padding: 14px 16px;
          background: #edf2f7;
          color: #4a5568;
          font-weight: 600;
          border-right: 2px solid #e2e8f0;
          min-width: 60px;
          text-align: center;
        }

        .phone-input {
          flex: 1;
          border: none !important;
          border-radius: 0 !important;
          padding-left: 12px !important;
        }

        .phone-hint,
        .date-hint,
        .time-hint {
          display: block;
          margin-top: 8px;
          color: #718096;
          font-size: 12px;
          font-style: italic;
        }

        .phone-preview {
          margin-top: 8px;
          padding: 8px 12px;
          background: #edf2f7;
          border-radius: 6px;
          color: #4a5568;
          font-size: 13px;
          border-left: 3px solid #4299e1;
        }

        .requirements-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 16px;
        }

        .requirement-row {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .requirement-input {
          flex: 1;
        }

        .remove-requirement-btn {
          padding: 10px 16px;
          background: #fed7d7;
          color: #c53030;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .remove-requirement-btn:hover:not(:disabled) {
          background: #feb2b2;
        }

        .remove-requirement-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .add-requirement-btn {
          padding: 12px 20px;
          background: #e6fffa;
          color: #285e61;
          border: 2px dashed #38b2ac;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
          width: 100%;
        }

        .add-requirement-btn:hover:not(:disabled) {
          background: #b2f5ea;
        }

        .add-requirement-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .form-actions {
          margin-top: 20px;
          text-align: center;
        }

        .submit-btn {
          padding: 16px 48px;
          background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
          color: white;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 600;
          transition: all 0.3s ease;
          min-width: 200px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(66, 153, 225, 0.3);
        }

        .submit-btn:disabled {
          background: #cbd5e0;
          cursor: not-allowed;
          transform: none;
        }

        .spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .page-content {
            padding: 24px;
          }

          .form-row {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .form-section {
            padding: 20px;
          }

          .appointment-header h1 {
            font-size: 1.6rem;
          }

          .requirement-row {
            flex-direction: column;
            gap: 8px;
            align-items: stretch;
          }

          .remove-requirement-btn {
            align-self: flex-start;
          }

          .phone-input-container {
            flex-direction: column;
            align-items: stretch;
          }

          .phone-prefix {
            border-right: none;
            border-bottom: 2px solid #e2e8f0;
            text-align: left;
            padding: 12px 16px;
          }
        }

        @media (max-width: 480px) {
          .page-content {
            padding: 16px;
          }

          .submit-btn {
            width: 100%;
          }

          .appointment-header h1 {
            font-size: 1.4rem;
          }
        }
      `}</style>
    </div>
  )
}

export default BookAppointmentPage