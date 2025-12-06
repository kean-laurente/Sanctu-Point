import { useState, useEffect } from 'react'
import { servicesService } from '../../services/servicesService'
import { authService } from '../../auth/authService'

const ServicesPage = () => {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingService, setEditingService] = useState(null)
  const [formData, setFormData] = useState({
    service_name: '',
    description: '',
    price: ''
  })
  const [currentUser, setCurrentUser] = useState(null)

  const isAdmin = currentUser?.role === 'admin'

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
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.service_name.trim()) {
      setError('Service name is required')
      return
    }

    try {
      let result
      if (editingService) {
        result = await servicesService.updateService(
          editingService.service_id,
          formData,
          currentUser
        )
      } else {
        result = await servicesService.createService(formData, currentUser)
      }

      if (result.success) {
        setFormData({ service_name: '', description: '', price: '' })
        setShowForm(false)
        setEditingService(null)
        await loadServices()
      } else {
        setError(result.error || 'Failed to save service')
      }
    } catch (err) {
      setError('An error occurred while saving service')
    }
  }

  const handleEdit = (service) => {
    setEditingService(service)
    setFormData({
      service_name: service.service_name,
      description: service.description || '',
      price: service.price || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (serviceId, serviceName) => {
    if (!window.confirm(`Are you sure you want to delete "${serviceName}"?`)) {
      return
    }

    try {
      const result = await servicesService.deleteService(serviceId, currentUser)
      if (result.success) {
        await loadServices()
      } else {
        setError(result.error || 'Failed to delete service')
      }
    } catch (err) {
      setError('An error occurred while deleting service')
    }
  }

  const cancelForm = () => {
    setFormData({ service_name: '', description: '', price: '' })
    setShowForm(false)
    setEditingService(null)
  }

  const formatPrice = (price) => {
    if (!price || price === 0) return 'Free'
    return `₱${parseFloat(price).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="services-header">
          <h1>Church Services & Appointments</h1>
          <p>Schedule appointments for our various church services</p>
          
          {isAdmin && !showForm && (
            <button 
              className="add-service-btn"
              onClick={() => setShowForm(true)}
            >
              + Add New Service
            </button>
          )}
        </div>

        {error && (
          <div className="message error">
            {error}
          </div>
        )}

        {showForm && isAdmin && (
          <div className="service-form-container">
            <h3>{editingService ? 'Edit Service' : 'Add New Service'}</h3>
            <form onSubmit={handleSubmit} className="service-form">
              <div className="form-group">
                <label htmlFor="service_name">Service Name *</label>
                <input
                  type="text"
                  id="service_name"
                  name="service_name"
                  value={formData.service_name}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter service name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Describe the service..."
                />
              </div>

              <div className="form-group">
                <label htmlFor="price">Price (₱)</label>
                <input
                  type="number"
                  id="price"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {editingService ? 'Update Service' : 'Create Service'}
                </button>
                <button type="button" onClick={cancelForm} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading church services...</p>
          </div>
        ) : services.length === 0 ? (
          <div className="empty-state">
            <h3>No Services Available</h3>
            <p>There are no services to display at the moment.</p>
            {isAdmin && !showForm && (
              <button 
                className="add-service-btn"
                onClick={() => setShowForm(true)}
              >
                Add Your First Service
              </button>
            )}
          </div>
        ) : (
          <div className="services-grid">
            {services.map(service => (
              service && (
                <div key={service.service_id} className="service-card">
                  <div className="service-header">
                    <h3>{service.service_name}</h3>
                    <span className="service-price">{formatPrice(service.price)}</span>
                  </div>
                  
                  {service.description && (
                    <p className="service-description">{service.description}</p>
                  )}
                  
                  {isAdmin && (
                    <div className="service-actions">
                      <button 
                        onClick={() => handleEdit(service)}
                        className="btn-edit"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(service.service_id, service.service_name)}
                        className="btn-delete"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ServicesPage