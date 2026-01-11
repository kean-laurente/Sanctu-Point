import { useState, useEffect } from 'react'
import { servicesService } from '../../services/servicesService'
import { authService } from '../../auth/authService'

const ServicesPage = () => {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingService, setEditingService] = useState(null)
  const [formData, setFormData] = useState({
    service_name: '',
    description: '',
    price: '',
    duration_minutes: 60,
    allowed_days: [0, 1, 2, 3, 4, 5, 6],
    consecutive_days: 1,
    allow_concurrent: false,
    requires_multiple_days: false,
    requirements: [{ details: '', isRequired: false }]
  })
  const [currentUser, setCurrentUser] = useState(null)

  const isAdmin = currentUser?.role === 'admin'
  
  const DAYS_OF_WEEK = [
    { value: 0, label: 'Sunday', short: 'Sun' },
    { value: 1, label: 'Monday', short: 'Mon' },
    { value: 2, label: 'Tuesday', short: 'Tue' },
    { value: 3, label: 'Wednesday', short: 'Wed' },
    { value: 4, label: 'Thursday', short: 'Thu' },
    { value: 5, label: 'Friday', short: 'Fri' },
    { value: 6, label: 'Saturday', short: 'Sat' }
  ]

  useEffect(() => {
    loadCurrentUser()
    loadServices()
  }, [])

  const loadCurrentUser = () => {
    const user = authService.getCurrentUser()
    setCurrentUser(user)
  }

  const loadServices = async () => {
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const result = await servicesService.getServices()
      if (result.success) {
        setServices(Array.isArray(result.data) ? result.data : [])
      } else {
        setError(result.error || 'Failed to load services')
        setServices([])
      }
    } catch (err) {
      setError('An error occurred while loading services')
      setServices([])
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    
    if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }))
    } else if (name === 'duration_minutes' || name === 'consecutive_days') {
      setFormData(prev => ({
        ...prev,
        [name]: value ? parseInt(value) : ''
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }
  }

  const handleDaySelection = (dayValue) => {
    setFormData(prev => {
      const currentDays = [...prev.allowed_days]
      const index = currentDays.indexOf(dayValue)
      
      if (index > -1) {
        return {
          ...prev,
          allowed_days: currentDays.filter(d => d !== dayValue)
        }
      } else {
        return {
          ...prev,
          allowed_days: [...currentDays, dayValue].sort((a, b) => a - b)
        }
      }
    })
  }

  const handleRequirementChange = (index, field, value) => {
    const newRequirements = [...formData.requirements]
    if (field === 'details') {
      newRequirements[index].details = value
    } else if (field === 'isRequired') {
      newRequirements[index].isRequired = value
    }
    setFormData(prev => ({
      ...prev,
      requirements: newRequirements
    }))
  }

  const addRequirement = () => {
    setFormData(prev => ({
      ...prev,
      requirements: [...prev.requirements, { details: '', isRequired: false }]
    }))
  }

  const removeRequirement = (index) => {
    if (formData.requirements.length <= 1) return
    const newRequirements = formData.requirements.filter((_, i) => i !== index)
    setFormData(prev => ({
      ...prev,
      requirements: newRequirements
    }))
  }

  const validateForm = () => {
    const errors = []
    
    if (!formData.service_name.trim()) {
      errors.push('Service name is required')
    }
    
    if (formData.price === '' || formData.price === null) {
      errors.push('Price is required (enter 0 for free services)')
    } else {
      const price = parseFloat(formData.price)
      if (isNaN(price) || price < 0) {
        errors.push('Price must be a valid non-negative number')
      }
    }
    
    if (!formData.duration_minutes || formData.duration_minutes <= 0) {
      errors.push('Duration must be greater than 0 minutes')
    }
    
    if (formData.allowed_days.length === 0) {
      errors.push('At least one day must be selected')
    }
    
    if (formData.requires_multiple_days && (!formData.consecutive_days || formData.consecutive_days <= 0)) {
      errors.push('Number of consecutive days must be specified for multi-day services')
    }
    
    if (formData.consecutive_days && formData.consecutive_days > 30) {
      errors.push('Consecutive days cannot exceed 30')
    }
    
    const validRequirements = formData.requirements.filter(req => req.details.trim() !== '')
    if (validRequirements.length === 0 && formData.requirements.some(req => req.details.trim() !== '')) {
      errors.push('Requirements must have details if added')
    }
    
    const serviceNameLower = formData.service_name.trim().toLowerCase()
    const existingService = services.find(s => 
      s.service_name.toLowerCase() === serviceNameLower && 
      (!editingService || s.service_id !== editingService.service_id)
    )
    
    if (existingService) {
      errors.push(`Service "${existingService.service_name}" already exists`)
    }
    
    return errors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const errors = validateForm()
    if (errors.length > 0) {
      setError(errors.join(', '))
      return
    }

    try {
      const filteredRequirements = formData.requirements.filter(req => req.details.trim() !== '')
      
      const submitData = {
        ...formData,
        price: parseFloat(formData.price) || 0,
        duration_minutes: parseInt(formData.duration_minutes) || 60,
        consecutive_days: formData.requires_multiple_days ? parseInt(formData.consecutive_days) || 1 : 1,
        allowed_days: formData.allowed_days,
        allow_concurrent: formData.allow_concurrent || false,
        requirements: filteredRequirements.map(req => ({
          requirement_details: req.details,
          is_required: req.isRequired
        }))
      }

      let result
      if (editingService) {
        result = await servicesService.updateService(
          editingService.service_id,
          submitData,
          currentUser
        )
      } else {
        result = await servicesService.createService(submitData, currentUser)
      }

      if (result.success) {
        setSuccess(result.message || 'Service saved successfully!')
        resetForm()
        await loadServices()
      } else {
        setError(result.error || 'Failed to save service')
      }
    } catch (err) {
      setError('An error occurred while saving service')
    }
  }

  const resetForm = () => {
    setFormData({
      service_name: '',
      description: '',
      price: '',
      duration_minutes: 60,
      allowed_days: [0, 1, 2, 3, 4, 5, 6],
      consecutive_days: 1,
      allow_concurrent: false,
      requires_multiple_days: false,
      requirements: [{ details: '', isRequired: false }]
    })
    setShowForm(false)
    setEditingService(null)
  }

  const handleEdit = (service) => {
    setEditingService(service)
    servicesService.getServiceRequirements(service.service_id).then(result => {
      if (result.success) {
        const requirements = result.data.length > 0 
          ? result.data.map(req => ({
              details: req.requirement_details,
              isRequired: req.is_required
            }))
          : [{ details: '', isRequired: false }]
        
        setFormData({
          service_name: service.service_name,
          description: service.description || '',
          price: service.price || '',
          duration_minutes: service.duration_minutes || 60,
          allowed_days: service.allowed_days || [0, 1, 2, 3, 4, 5, 6],
          consecutive_days: service.consecutive_days || 1,
          allow_concurrent: service.allow_concurrent || false,
          requires_multiple_days: service.requires_multiple_days || false,
          requirements
        })
        setShowForm(true)
      }
    })
  }

  const handleDelete = async (serviceId, serviceName) => {
    if (!window.confirm(`Are you sure you want to delete "${serviceName}"?\n\nThis will also delete all predefined requirements for this service.`)) {
      return
    }

    try {
      const result = await servicesService.deleteService(serviceId, currentUser)
      if (result.success) {
        setSuccess(result.message || 'Service deleted successfully!')
        await loadServices()
      } else {
        setError(result.error || 'Failed to delete service')
      }
    } catch (err) {
      setError('An error occurred while deleting service')
    }
  }

  const cancelForm = () => {
    resetForm()
  }

  const formatPrice = (price) => {
    if (!price || price === 0) return 'Free'
    return `₱${parseFloat(price).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDuration = (minutes) => {
    if (!minutes) return 'N/A'
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  const formatAllowedDays = (daysArray) => {
    if (!daysArray || daysArray.length === 0) return 'No days'
    if (daysArray.length === 7) return 'Every day'
    
    return daysArray
      .sort((a, b) => a - b)
      .map(day => DAYS_OF_WEEK.find(d => d.value === day)?.short)
      .join(', ')
  }

  const getRequirementStatus = (service) => {
    if (!service.has_requirements || !service.requirements || service.requirements.length === 0) {
      return <span className="req-status none">No requirements</span>
    }
    
    const requiredCount = service.requirements.filter(r => r.is_required).length
    const toFollowCount = service.requirements.filter(r => !r.is_required).length
    
    return (
      <span className="req-status has">
        {service.requirements.length} requirement{service.requirements.length !== 1 ? 's' : ''}
        {requiredCount > 0 && ` (${requiredCount} required)`}
        {toFollowCount > 0 && ` (${toFollowCount} to be followed)`}
      </span>
    )
  }

  const getDurationCategory = (minutes) => {
    if (!minutes) return 'duration-unknown'
    if (minutes <= 30) return 'duration-short'
    if (minutes <= 90) return 'duration-medium'
    if (minutes <= 180) return 'duration-long'
    return 'duration-very-long'
  }

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="services-header">
          <div className="header-content">
            <h1>Church Services Management</h1>
            <p>Manage services, their durations, and scheduling constraints</p>
          </div>
          
          {isAdmin && !showForm && (
            <button 
              className="add-service-btn"
              onClick={() => setShowForm(true)}
            >
              <span className="icon">+</span> Add New Service
            </button>
          )}
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

        {showForm && isAdmin && (
          <div className="service-form-container">
            <div className="form-header">
              <h3>{editingService ? 'Edit Service' : 'Add New Service'}</h3>
              <button onClick={cancelForm} className="close-form-btn">×</button>
            </div>
            
            <form onSubmit={handleSubmit} className="service-form">
              <div className="form-section">
                <h4>Basic Information</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="service_name">Service Name *</label>
                    <input
                      type="text"
                      id="service_name"
                      name="service_name"
                      value={formData.service_name}
                      onChange={handleInputChange}
                      required
                      placeholder="e.g., Funeral Mass, Wedding (Special)"
                      maxLength="100"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="price">Price (₱) *</label>
                    <div className="price-input-container">
                      <span className="currency">₱</span>
                      <input
                        type="number"
                        id="price"
                        name="price"
                        value={formData.price}
                        onChange={handleInputChange}
                        step="0.01"
                        min="0"
                        required
                        placeholder="0.00"
                      />
                    </div>
                    <small className="hint">Enter 0 for free services</small>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows="2"
                    placeholder="Brief description of the service..."
                    maxLength="500"
                  />
                </div>
              </div>

              <div className="form-section scheduling-section">
                <h4>Scheduling Constraints</h4>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="duration_minutes">Duration (minutes) *</label>
                    <div className="duration-input-container">
                      <input
                        type="number"
                        id="duration_minutes"
                        name="duration_minutes"
                        value={formData.duration_minutes}
                        onChange={handleInputChange}
                        min="1"
                        max="1440"
                        required
                        placeholder="60"
                      />
                      <span className="unit">minutes</span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Allowed Days *</label>
                    <div className="days-selection">
                      {DAYS_OF_WEEK.map(day => (
                        <button
                          type="button"
                          key={day.value}
                          className={`day-btn ${formData.allowed_days.includes(day.value) ? 'selected' : ''}`}
                          onClick={() => handleDaySelection(day.value)}
                        >
                          {day.short}
                        </button>
                      ))}
                    </div>
                    <small className="hint">
                      {formData.allowed_days.length === 7 
                        ? 'Every day' 
                        : formData.allowed_days.length === 0 
                          ? 'No days selected' 
                          : `Selected: ${formData.allowed_days.map(d => DAYS_OF_WEEK.find(day => day.value === d)?.short).join(', ')}`}
                    </small>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="requires_multiple_days"
                        checked={formData.requires_multiple_days}
                        onChange={handleInputChange}
                        className="form-checkbox"
                      />
                      <span className="checkmark"></span>
                      Requires multiple consecutive days
                    </label>
                    {formData.requires_multiple_days && (
                      <div className="consecutive-days-input">
                        <label htmlFor="consecutive_days">Number of consecutive days *</label>
                        <input
                          type="number"
                          id="consecutive_days"
                          name="consecutive_days"
                          value={formData.consecutive_days}
                          onChange={handleInputChange}
                          min="2"
                          max="30"
                          placeholder="e.g., 9 for Novena"
                        />
                        <small className="hint">e.g., Novena Mass: 9 days, Pre-Cana: 2 sessions</small>
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="allow_concurrent"
                        checked={formData.allow_concurrent}
                        onChange={handleInputChange}
                        className="form-checkbox"
                      />
                      <span className="checkmark"></span>
                      Allow concurrent appointments
                    </label>
                    <small className="hint">
                      If checked, multiple appointments for this service can be scheduled at the same time.
                      Leave unchecked to prevent scheduling conflicts (recommended for most services).
                    </small>
                  </div>
                </div>
              </div>

              <div className="form-section requirements-section">
                <div className="section-header">
                  <h4>Predefined Requirements</h4>
                  <p>These requirements will appear when booking this service</p>
                </div>
                
                <div className="requirements-list">
                  {formData.requirements.map((requirement, index) => (
                    <div key={index} className="requirement-item">
                      <div className="requirement-input-row">
                        <div className="req-details">
                          <input
                            type="text"
                            value={requirement.details}
                            onChange={(e) => handleRequirementChange(index, 'details', e.target.value)}
                            placeholder="Enter requirement details (e.g., Death Certificate, PSA Birth Certificate)"
                            className="req-input"
                          />
                        </div>
                        
                        <div className="req-options">
                          <label className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={requirement.isRequired}
                              onChange={(e) => handleRequirementChange(index, 'isRequired', e.target.checked)}
                              className="req-checkbox"
                            />
                            <span className="checkmark"></span>
                            {requirement.isRequired ? 'Required (Must be checked)' : 'To be followed (Can be checked later)'}
                          </label>
                          
                          {formData.requirements.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeRequirement(index)}
                              className="remove-req-btn"
                              title="Remove requirement"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <button
                  type="button"
                  onClick={addRequirement}
                  className="add-req-btn"
                >
                  + Add Requirement
                </button>
                
                <div className="requirements-note">
                  <small>
                    💡 Requirements marked as "Required" must be provided during appointment booking.
                    Empty requirement fields will be ignored when saving.
                  </small>
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary save-btn">
                  {editingService ? 'Update Service' : 'Create Service'}
                </button>
                <button type="button" onClick={cancelForm} className="btn-secondary cancel-btn">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading services...</p>
          </div>
        ) : services.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No Services Available</h3>
            <p>Get started by adding your first church service</p>
            {isAdmin && !showForm && (
              <button 
                className="add-service-btn primary"
                onClick={() => setShowForm(true)}
              >
                + Add Your First Service
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="services-grid">
              {services.map(service => (
                <div key={service.service_id} className="service-card">
                  <div className="service-header">
                    <div className="service-title">
                      <h3>{service.service_name}</h3>
                      {getRequirementStatus(service)}
                    </div>
                    <div className="service-meta">
                      <span className={`service-duration ${getDurationCategory(service.duration_minutes)}`}>
                        ⏱️ {formatDuration(service.duration_minutes)}
                      </span>
                      <span className="service-price">{formatPrice(service.price)}</span>
                      {service.allow_concurrent && (
                        <span className="concurrent-badge">
                          🔀 Concurrent
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {service.description && (
                    <p className="service-description">{service.description}</p>
                  )}
                  
                  <div className="service-scheduling">
                    <div className="scheduling-info">
                      <div className="info-row">
                        <span className="label">Allowed Days:</span>
                        <span className="value">{formatAllowedDays(service.allowed_days)}</span>
                      </div>
                      {service.requires_multiple_days && (
                        <div className="info-row">
                          <span className="label">Consecutive Days:</span>
                          <span className="value">{service.consecutive_days} days</span>
                        </div>
                      )}
                      <div className="info-row">
                        <span className="label">Concurrent:</span>
                        <span className="value">{service.allow_concurrent ? 'Allowed' : 'Not Allowed'}</span>
                      </div>
                    </div>
                  </div>
                  
                  {service.has_requirements && service.requirements && service.requirements.length > 0 && (
                    <div className="service-requirements">
                      <div className="requirements-header">
                        <span className="req-title">Predefined Requirements:</span>
                      </div>
                      <ul className="requirements-list">
                        {service.requirements.map((req, idx) => (
                          <li key={idx} className={`requirement ${req.is_required ? 'required' : 'optional'}`}>
                            <span className="req-dot">{req.is_required ? '●' : '○'}</span>
                            <span className="req-text">{req.requirement_details}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {isAdmin && (
                    <div className="service-actions">
                      <button 
                        onClick={() => handleEdit(service)}
                        className="btn-edit"
                      >
                        <span className="icon">✏️</span> Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(service.service_id, service.service_name)}
                        className="btn-delete"
                      >
                        <span className="icon">🗑️</span> Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <style>{`
        /* Styles remain the same as before, just add the concurrent-badge style */
        .concurrent-badge {
          padding: 6px 12px;
          border-radius: 20px;
          background: linear-gradient(135deg, #805ad5 0%, #6b46c1 100%);
          color: white;
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-left: 8px;
        }
        
        /* Rest of the styles remain the same */
      `}</style>
  

      <style>{`
        .page-container {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .page-content {
          background: white;
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }

        .services-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 32px;
          flex-wrap: wrap;
          gap: 20px;
        }

        .header-content {
          flex: 1;
          min-width: 300px;
        }

        .services-header h1 {
          color: #2d3748;
          margin-bottom: 8px;
          font-size: 2rem;
          font-weight: 700;
        }

        .services-header p {
          color: #718096;
          margin: 0;
          font-size: 16px;
        }

        .add-service-btn {
          padding: 12px 24px;
          background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.3s ease;
          white-space: nowrap;
        }

        .add-service-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(66, 153, 225, 0.3);
        }

        .add-service-btn.primary {
          background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
        }

        .add-service-btn .icon {
          font-size: 18px;
          font-weight: bold;
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

        /* Form Styles */
        .service-form-container {
          background: #f8fafc;
          border-radius: 12px;
          padding: 28px;
          border: 2px solid #e2e8f0;
          margin-bottom: 32px;
        }

        .form-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .form-header h3 {
          color: #2d3748;
          margin: 0;
          font-size: 1.4rem;
          font-weight: 600;
        }

        .close-form-btn {
          background: #edf2f7;
          border: none;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 20px;
          color: #4a5568;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .close-form-btn:hover {
          background: #e2e8f0;
          color: #2d3748;
        }

        .service-form {
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        .form-section {
          background: white;
          border-radius: 8px;
          padding: 24px;
          border: 1px solid #e2e8f0;
        }

        .form-section.scheduling-section {
          border-color: #9f7aea;
          background: #faf5ff;
        }

        .form-section.requirements-section {
          border-color: #38a169;
          background: #f0fff4;
        }

        .form-section h4 {
          color: #2d3748;
          margin: 0 0 20px 0;
          font-size: 1.1rem;
          font-weight: 600;
          padding-bottom: 12px;
          border-bottom: 2px solid #edf2f7;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        @media (max-width: 768px) {
          .form-row {
            grid-template-columns: 1fr;
          }
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
        .form-group textarea,
        .form-group select {
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
        .form-group textarea:focus,
        .form-group select:focus {
          outline: none;
          border-color: #4299e1;
          box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
        }

        /* Duration Input */
        .duration-input-container {
          display: flex;
          align-items: center;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
          background: white;
        }

        .duration-input-container input {
          flex: 1;
          border: none !important;
          border-radius: 0 !important;
          padding-left: 12px !important;
        }

        .duration-input-container .unit {
          padding: 14px 16px;
          background: #edf2f7;
          color: #4a5568;
          font-weight: 600;
          border-left: 2px solid #e2e8f0;
          min-width: 80px;
          text-align: center;
        }

        /* Days Selection */
        .days-selection {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 8px;
        }

        .day-btn {
          padding: 10px 14px;
          border: 2px solid #e2e8f0;
          border-radius: 6px;
          background: white;
          color: #4a5568;
          cursor: pointer;
          font-weight: 600;
          font-size: 12px;
          transition: all 0.2s;
          min-width: 50px;
        }

        .day-btn:hover {
          border-color: #4299e1;
          color: #4299e1;
        }

        .day-btn.selected {
          background: #4299e1;
          border-color: #4299e1;
          color: white;
        }

        /* Duration Presets */
        .duration-presets {
          margin-top: 20px;
          padding: 16px;
          background: #ebf8ff;
          border-radius: 8px;
          border: 1px solid #bee3f8;
        }

        .presets-label {
          margin: 0 0 12px 0;
          font-weight: 600;
          color: #2b6cb0;
          font-size: 14px;
        }

        .preset-buttons {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 10px;
        }

        .preset-btn {
          padding: 10px;
          background: white;
          border: 2px solid #bee3f8;
          border-radius: 6px;
          color: #2b6cb0;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }

        .preset-btn:hover {
          background: #bee3f8;
          border-color: #4299e1;
        }

        /* Checkbox Styles */
        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 14px;
          color: #4a5568;
          margin-bottom: 8px;
        }

        .form-checkbox, .req-checkbox {
          display: none;
        }

        .checkmark {
          width: 18px;
          height: 18px;
          border: 2px solid #cbd5e0;
          border-radius: 4px;
          display: inline-block;
          position: relative;
          transition: all 0.2s;
        }

        .form-checkbox:checked + .checkmark,
        .req-checkbox:checked + .checkmark {
          background: #4299e1;
          border-color: #4299e1;
        }

        .form-checkbox:checked + .checkmark::after,
        .req-checkbox:checked + .checkmark::after {
          content: '✓';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: white;
          font-size: 12px;
          font-weight: bold;
        }

        .consecutive-days-input {
          margin-top: 12px;
          padding-left: 26px;
        }

        .consecutive-days-input label {
          font-size: 13px;
          font-weight: 500;
          color: #4a5568;
          margin-bottom: 6px;
        }

        .consecutive-days-input input {
          width: 100px;
          padding: 8px 12px;
          border: 2px solid #e2e8f0;
          border-radius: 6px;
          font-size: 14px;
        }

        /* Requirements List */
        .requirements-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 16px;
        }

        .requirement-item {
          background: white;
          border-radius: 8px;
          padding: 16px;
          border: 1px solid #e2e8f0;
        }

        .requirement-input-row {
          display: flex;
          gap: 16px;
          align-items: center;
        }

        @media (max-width: 768px) {
          .requirement-input-row {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
          }
        }

        .req-details {
          flex: 1;
        }

        .req-input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          background: white;
        }

        .req-input:focus {
          outline: none;
          border-color: #4299e1;
          box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
        }

        .req-options {
          display: flex;
          align-items: center;
          gap: 16px;
          min-width: 150px;
        }

        .remove-req-btn {
          padding: 8px 16px;
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

        .remove-req-btn:hover {
          background: #feb2b2;
        }

        .add-req-btn {
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
          margin-bottom: 12px;
        }

        .add-req-btn:hover {
          background: #b2f5ea;
        }

        .requirements-note {
          padding: 12px;
          background: #feebc8;
          border-radius: 6px;
          border-left: 3px solid #dd6b20;
        }

        .requirements-note small {
          color: #744210;
          font-size: 12px;
          line-height: 1.4;
        }

        .form-actions {
          display: flex;
          gap: 16px;
          justify-content: flex-end;
        }

        .save-btn {
          padding: 12px 32px;
          background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 15px;
          font-weight: 600;
          transition: all 0.3s ease;
        }

        .save-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(72, 187, 120, 0.3);
        }

        .cancel-btn {
          padding: 12px 32px;
          background: #edf2f7;
          color: #4a5568;
          border: 2px solid #cbd5e0;
          border-radius: 8px;
          cursor: pointer;
          font-size: 15px;
          font-weight: 600;
          transition: all 0.2s;
        }

        .cancel-btn:hover {
          background: #e2e8f0;
          color: #2d3748;
        }

        /* Loading State */
        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          color: #718096;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e2e8f0;
          border-radius: 50%;
          border-top-color: #4299e1;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #a0aec0;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .empty-state h3 {
          margin: 0 0 8px 0;
          color: #718096;
          font-weight: 600;
        }

        .empty-state p {
          margin: 0 0 20px 0;
          font-size: 15px;
        }

        .services-summary {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }

        .summary-card {
          background: #f8fafc;
          border-radius: 10px;
          padding: 20px;
          text-align: center;
          border: 2px solid #e2e8f0;
        }

        .summary-label {
          display: block;
          color: #718096;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 8px;
        }

        .summary-value {
          display: block;
          color: #2d3748;
          font-size: 28px;
          font-weight: 700;
        }

        /* Services Grid */
        .services-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 24px;
        }

        @media (max-width: 768px) {
          .services-grid {
            grid-template-columns: 1fr;
          }
        }

        .service-card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          border: 2px solid #e2e8f0;
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
        }

        .service-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.1);
          border-color: #4299e1;
        }

        .service-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 12px;
        }

        .service-title {
          flex: 1;
          min-width: 200px;
        }

        .service-header h3 {
          color: #2d3748;
          margin: 0 0 8px 0;
          font-size: 1.2rem;
          font-weight: 600;
          line-height: 1.4;
        }

        .req-status {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.3px;
        }

        .req-status.none {
          background: #f7fafc;
          color: #a0aec0;
          border: 1px solid #e2e8f0;
        }

        .req-status.has {
          background: #e6fffa;
          color: #285e61;
          border: 1px solid #81e6d9;
        }

        .service-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
        }

        .service-duration {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }

        .duration-short {
          background: #c6f6d5;
          color: #22543d;
          border: 1px solid #9ae6b4;
        }

        .duration-medium {
          background: #fed7d7;
          color: #742a2a;
          border: 1px solid #fc8181;
        }

        .duration-long {
          background: #feebc8;
          color: #744210;
          border: 1px solid #f6ad55;
        }

        .duration-very-long {
          background: #e9d8fd;
          color: #44337a;
          border: 1px solid #d6bcfa;
        }

        .duration-unknown {
          background: #f7fafc;
          color: #4a5568;
          border: 1px solid #e2e8f0;
        }

        .service-price {
          font-size: 1.5rem;
          font-weight: 700;
          color: #2d3748;
          white-space: nowrap;
        }

        .service-description {
          color: #718096;
          font-size: 14px;
          line-height: 1.6;
          margin: 0 0 20px 0;
          flex: 1;
        }

        .service-scheduling {
          background: #f8fafc;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
          border: 1px solid #e2e8f0;
        }

        .scheduling-info {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 0;
          border-bottom: 1px solid #edf2f7;
        }

        .info-row:last-child {
          border-bottom: none;
        }

        .info-row .label {
          font-size: 13px;
          color: #718096;
          font-weight: 500;
        }

        .info-row .value {
          font-size: 13px;
          color: #2d3748;
          font-weight: 600;
        }

        /* Service Requirements Display */
        .service-requirements {
          background: #f8fafc;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
          border: 1px solid #e2e8f0;
        }

        .requirements-header {
          margin-bottom: 12px;
        }

        .req-title {
          font-size: 13px;
          font-weight: 600;
          color: #4a5568;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .requirements-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .requirements-list .requirement {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 8px 0;
          border-bottom: 1px solid #edf2f7;
        }

        .requirements-list .requirement:last-child {
          border-bottom: none;
        }

        .requirements-list .requirement.required {
          color: #2d3748;
        }

        .requirements-list .requirement.optional {
          color: #718096;
        }

        .req-dot {
          font-size: 10px;
          line-height: 1;
          margin-top: 6px;
          flex-shrink: 0;
        }

        .requirements-list .requirement.required .req-dot {
          color: #e53e3e;
        }

        .requirements-list .requirement.optional .req-dot {
          color: #a0aec0;
        }

        .req-text {
          flex: 1;
          font-size: 13px;
          line-height: 1.5;
        }

        /* Service Actions */
        .service-actions {
          display: flex;
          gap: 12px;
          margin-top: auto;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
        }

        .service-actions button {
          flex: 1;
          padding: 10px 16px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.2s;
        }

        .btn-edit {
          background: #ebf8ff;
          color: #2b6cb0;
          border: 2px solid #90cdf4;
        }

        .btn-edit:hover {
          background: #bee3f8;
          transform: translateY(-1px);
        }

        .btn-delete {
          background: #fff5f5;
          color: #c53030;
          border: 2px solid #fc8181;
        }

        .btn-delete:hover {
          background: #fed7d7;
          transform: translateY(-1px);
        }

        .service-actions .icon {
          font-size: 14px;
        }
      `}</style>
    </div>
  )
}

export default ServicesPage