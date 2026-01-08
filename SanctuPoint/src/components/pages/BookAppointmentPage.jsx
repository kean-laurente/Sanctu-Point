import { useState, useEffect, useRef } from 'react'
import { appointmentService } from '../../services/appointmentService'
import { servicesService } from '../../services/servicesService'
import { productsService } from '../../services/productsService'
import { offeringService } from '../../services/offeringService'
import { authService } from '../../auth/authService'
import { printReceipt } from '../../utils/receiptUtils'

const BookAppointmentPage = () => {
  const [services, setServices] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [selectedService, setSelectedService] = useState(null)
  const [serviceRequirements, setServiceRequirements] = useState([])
  const [customRequirements, setCustomRequirements] = useState([''])
  const [selectedProducts, setSelectedProducts] = useState([])
  const [isOfferingOnly, setIsOfferingOnly] = useState(false)
  const [isAnonymousBooking, setIsAnonymousBooking] = useState(false)
  
  const [availableTimeSlots, setAvailableTimeSlots] = useState([])
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false)
  const [consecutiveDaysAvailability, setConsecutiveDaysAvailability] = useState(null)
  const [dayConstraints, setDayConstraints] = useState(null)
  
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    service_type: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    amount_paid: '',
  })
  
  const [offeringData, setOfferingData] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    amount_paid: '',
  })
  
  const amountInputRef = useRef(null)
  const offeringAmountRef = useRef(null)

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
    loadProducts()
  }, [])

  useEffect(() => {
    if (formData.date && selectedService && formData.service_type) {
      checkAvailability()
    } else {
      setAvailableTimeSlots([])
      setConsecutiveDaysAvailability(null)
      setDayConstraints(null)
    }
  }, [formData.date, selectedService])

  useEffect(() => {
    if (isAnonymousBooking) {
      // Auto-fill with anonymous data
      setFormData(prev => ({
        ...prev,
        first_name: 'Anonymous',
        last_name: 'Customer',
        email: 'anonymous@example.com',
        phone: ''
      }))
    } else {
      // Clear the fields when turning off anonymous booking
      setFormData(prev => ({
        ...prev,
        first_name: '',
        last_name: '',
        email: '',
        phone: ''
      }))
    }
  }, [isAnonymousBooking])

  const loadCurrentUser = () => {
    const user = authService.getCurrentUser()
    setCurrentUser(user)
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

  const loadProducts = async () => {
    try {
      const result = await productsService.getProducts()
      if (result.success) {
        setProducts(result.data)
      }
    } catch (err) {
      console.error('Error loading products:', err)
    }
  }

  const checkAvailability = async () => {
    if (!formData.date || !selectedService) return
    
    setIsCheckingAvailability(true)
    setAvailableTimeSlots([])
    setConsecutiveDaysAvailability(null)
    setDayConstraints(null)

    try {
      const selectedDate = new Date(formData.date)
      const dayOfWeek = selectedDate.getDay()
      
      console.log('📅 Checking availability for:', {
        date: formData.date,
        dayOfWeek,
        serviceId: selectedService.service_id,
        serviceName: selectedService.service_name,
        allowConcurrent: selectedService.allow_concurrent
      });
      
      if (!selectedService.allowed_days.includes(dayOfWeek)) {
        const allowedDays = selectedService.allowed_days
          .map(d => DAYS_OF_WEEK.find(day => day.value === d)?.short)
          .join(', ')
        
        setDayConstraints({
          isValid: false,
          message: `This service is only available on: ${allowedDays}`,
          allowedDays: selectedService.allowed_days
        })
        setIsCheckingAvailability(false)
        return
      }

      setDayConstraints({
        isValid: true,
        message: `Available on ${DAYS_OF_WEEK[dayOfWeek].label}`,
        allowedDays: selectedService.allowed_days
      })

      if (selectedService.requires_multiple_days && selectedService.consecutive_days > 1) {
        const result = await servicesService.checkConsecutiveDaysAvailability(
          selectedService.service_id,
          formData.date,
          selectedService.consecutive_days
        )
        
        if (result.success) {
          setConsecutiveDaysAvailability(result.data)
          
          if (result.data.allDaysAvailable) {
            const duration = selectedService.duration_minutes || 60
            const slotsResult = await servicesService.getAvailableTimeSlots(
              selectedService.service_id,
              formData.date,
              duration
            )
            
            console.log('📊 Multi-day time slots result:', slotsResult);
            
            if (slotsResult.success) {
              setAvailableTimeSlots(slotsResult.data)
              console.log('✅ Multi-day available slots:', slotsResult.data.length, slotsResult.data);
            } else {
              console.error('❌ Multi-day error getting time slots:', slotsResult.error)
            }
          }
        }
      } else {
        const duration = selectedService.duration_minutes || 60
        const result = await servicesService.getAvailableTimeSlots(
          selectedService.service_id,
          formData.date,
          duration
        )
        
        console.log('📊 Time slots result:', result);
        
        if (result.success) {
          setAvailableTimeSlots(result.data)
          console.log('✅ Available slots:', result.data.length, result.data);
        } else {
          console.error('❌ Error getting time slots:', result.error)
        }
      }
    } catch (err) {
      console.error('Error checking availability:', err)
    } finally {
      setIsCheckingAvailability(false)
    }
  }

  const sanitizeName = (value) => {
    return value.replace(/[^a-zA-Z\s\-']/g, '')
  }

  const sanitizeEmail = (value) => {
    return value.toLowerCase()
  }

  const sanitizePhone = (value) => {
    return value.replace(/\D/g, '')
  }

  const sanitizeAmount = (value) => {
    const sanitized = value.replace(/[^\d.]/g, '')
    
    const parts = sanitized.split('.')
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('')
    }
    
    if (parts[1] && parts[1].length > 2) {
      return parts[0] + '.' + parts[1].substring(0, 2)
    }
    
    return sanitized
  }

  const handleServiceChange = async (e) => {
    const serviceName = e.target.value
    setFormData(prev => ({ ...prev, service_type: serviceName }))
    
    const service = services.find(s => s.service_name === serviceName)
    if (!service) {
      setSelectedService(null)
      return
    }
    
    const serviceWithDuration = {
      ...service,
      duration_minutes: service.duration_minutes || 60
    }
    
    setSelectedService(serviceWithDuration)
    
    setServiceRequirements([])
    
    if (service.has_requirements && service.requirements) {
      const requirements = service.requirements.map(req => ({
        id: `predefined-${req.requirement_id}`,
        details: req.requirement_details,
        isRequired: req.is_required,
        isPredefined: true,
        isChecked: false
      }))
      setServiceRequirements(requirements)
    }
    
    setFormData(prev => ({ 
      ...prev, 
      time: '',
      amount_paid: ''
    }))
    setAvailableTimeSlots([])
    setConsecutiveDaysAvailability(null)
    setDayConstraints(null)
    
    setTimeout(() => {
      document.getElementById('date')?.focus()
    }, 100)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    
    switch (name) {
      case 'first_name':
      case 'last_name':
        setFormData(prev => ({
          ...prev,
          [name]: sanitizeName(value).slice(0, 50)
        }))
        break
        
      case 'email':
        setFormData(prev => ({
          ...prev,
          [name]: sanitizeEmail(value).slice(0, 100)
        }))
        break
        
      case 'phone':
        const phone = sanitizePhone(value).slice(0, 10)
        setFormData(prev => ({
          ...prev,
          [name]: phone
        }))
        break
        
      case 'amount_paid':
        const sanitizedAmount = sanitizeAmount(value)
        
        let processedAmount = sanitizedAmount
        if (sanitizedAmount && !sanitizedAmount.includes('.')) {
          processedAmount = sanitizedAmount.replace(/^0+/, '')
          if (processedAmount === '') processedAmount = '0'
        }
        
        const parts = processedAmount.split('.')
        if (parts[0].length > 10) {
          processedAmount = parts[0].slice(0, 10) + (parts[1] ? '.' + parts[1] : '')
        }
        
        setFormData(prev => ({
          ...prev,
          [name]: processedAmount
        }))
        break
        
      case 'date':
        setFormData(prev => ({
          ...prev,
          [name]: value,
          time: ''
        }))
        break
        
      case 'time':
      case 'service_type':
        setFormData(prev => ({
          ...prev,
          [name]: value
        }))
        break
        
      default:
        setFormData(prev => ({
          ...prev,
          [name]: value
        }))
    }
  }

  const handleOfferingInputChange = (e) => {
    const { name, value } = e.target
    
    switch (name) {
      case 'customer_name':
        setOfferingData(prev => ({
          ...prev,
          [name]: sanitizeName(value).slice(0, 100)
        }))
        break
        
      case 'customer_email':
        setOfferingData(prev => ({
          ...prev,
          [name]: sanitizeEmail(value).slice(0, 100)
        }))
        break
        
      case 'customer_phone':
        const phone = sanitizePhone(value).slice(0, 10)
        setOfferingData(prev => ({
          ...prev,
          [name]: phone
        }))
        break
        
      case 'amount_paid':
        const sanitizedAmount = sanitizeAmount(value)
        
        let processedAmount = sanitizedAmount
        if (sanitizedAmount && !sanitizedAmount.includes('.')) {
          processedAmount = sanitizedAmount.replace(/^0+/, '')
          if (processedAmount === '') processedAmount = '0'
        }
        
        const parts = processedAmount.split('.')
        if (parts[0].length > 10) {
          processedAmount = parts[0].slice(0, 10) + (parts[1] ? '.' + parts[1] : '')
        }
        
        setOfferingData(prev => ({
          ...prev,
          [name]: processedAmount
        }))
        break
        
      default:
        setOfferingData(prev => ({
          ...prev,
          [name]: value
        }))
    }
  }

  const handleQuickAmount = (amount) => {
    const currentAmount = parseFloat(formData.amount_paid) || 0
    const newAmount = (currentAmount + amount).toFixed(2)
    setFormData(prev => ({
      ...prev,
      amount_paid: newAmount
    }))
  }

  const handleOfferingQuickAmount = (amount) => {
    const currentAmount = parseFloat(offeringData.amount_paid) || 0
    const newAmount = (currentAmount + amount).toFixed(2)
    setOfferingData(prev => ({
      ...prev,
      amount_paid: newAmount
    }))
  }

  const handleClearAmount = () => {
    setFormData(prev => ({
      ...prev,
      amount_paid: ''
    }))
    if (amountInputRef.current) {
      amountInputRef.current.focus()
    }
  }

  const handleClearOfferingAmount = () => {
    setOfferingData(prev => ({
      ...prev,
      amount_paid: ''
    }))
    if (offeringAmountRef.current) {
      offeringAmountRef.current.focus()
    }
  }

  const handleProductSelect = (productId) => {
    const product = products.find(p => p.product_id === productId)
    if (!product) return

    const existingProductIndex = selectedProducts.findIndex(p => p.product_id === productId)
    
    if (existingProductIndex >= 0) {
      const updatedProducts = [...selectedProducts]
      updatedProducts[existingProductIndex].quantity += 1
      setSelectedProducts(updatedProducts)
    } else {
      const newProduct = {
        product_id: productId,
        product_name: product.product_name,
        price: product.price,
        quantity: 1,
        unit_price: product.price,
        max_quantity: product.max_quantity || 10,
        min_quantity: product.min_quantity || 1,
        requires_quantity: product.requires_quantity !== false
      }
      setSelectedProducts([...selectedProducts, newProduct])
    }
  }

  const handleProductQuantityChange = (productId, quantity) => {
    const updatedProducts = selectedProducts.map(product => {
      if (product.product_id === productId) {
        const maxQty = product.max_quantity || 10
        const minQty = product.min_quantity || (product.requires_quantity ? 1 : 0)
        const newQuantity = Math.max(minQty, Math.min(maxQty, quantity))
        return { ...product, quantity: newQuantity }
      }
      return product
    })
    setSelectedProducts(updatedProducts)
  }

  const handleRemoveProduct = (productId) => {
    setSelectedProducts(selectedProducts.filter(p => p.product_id !== productId))
  }

  const handleServiceRequirementChange = (index, checked) => {
    const newRequirements = [...serviceRequirements]
    newRequirements[index].isChecked = checked
    setServiceRequirements(newRequirements)
  }

  const handleCustomRequirementChange = (index, value) => {
    const newRequirements = [...customRequirements]
    newRequirements[index] = value
    setCustomRequirements(newRequirements)
  }

  const addCustomRequirement = () => {
    setCustomRequirements([...customRequirements, ''])
  }

  const removeCustomRequirement = (index) => {
    const newRequirements = customRequirements.filter((_, i) => i !== index)
    setCustomRequirements(newRequirements)
  }

  const formatDuration = (minutes) => {
    if (!minutes) return 'N/A'
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  const formatAllowedDays = (daysArray) => {
    if (!daysArray || daysArray.length === 0) return 'Every day'
    if (daysArray.length === 7) return 'Every day'
    
    return daysArray
      .sort((a, b) => a - b)
      .map(day => DAYS_OF_WEEK.find(d => d.value === day)?.short)
      .join(', ')
  }

  const calculateServiceTotal = () => {
    return selectedService ? selectedService.price : 0
  }

  const calculateOfferingTotal = () => {
    return selectedProducts.reduce((total, product) => {
      return total + (product.quantity * product.unit_price)
    }, 0)
  }

  const calculateGrandTotal = () => {
    return calculateServiceTotal() + calculateOfferingTotal()
  }

  const generateTimeSlots = () => {
    const slots = []
    const startHour = 8
    const endHour = 17
    
    for (let hour = startHour; hour <= endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        if (hour === endHour && minute > 0) continue
        
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        const displayHour = hour % 12 || 12
        const period = hour >= 12 ? 'PM' : 'AM'
        const displayTime = `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`
        
        slots.push({ value: timeString, display: displayTime })
      }
    }
    return slots
  }

  const timeSlots = generateTimeSlots()
  const today = new Date().toISOString().split('T')[0]
  const maxDate = new Date()
  maxDate.setMonth(maxDate.getMonth() + 6)
  const maxDateString = maxDate.toISOString().split('T')[0]

  const calculateChange = () => {
    if (!selectedService || !formData.amount_paid) return 0
    const amountPaid = parseFloat(formData.amount_paid) || 0
    const grandTotal = calculateGrandTotal()
    
    return Math.max(0, amountPaid - grandTotal)
  }

  const calculateOfferingChange = () => {
    if (!offeringData.amount_paid) return 0
    const amountPaid = parseFloat(offeringData.amount_paid) || 0
    const offeringTotal = calculateOfferingTotal()
    
    return Math.max(0, amountPaid - offeringTotal)
  }

  const validateForm = () => {
    const errors = []
    
    if (!formData.date.trim()) errors.push('Date is required')
    if (!formData.time.trim()) errors.push('Time is required')
    if (!formData.service_type.trim()) errors.push('Service type is required')
    
    // Only validate personal info if not anonymous booking
    if (!isAnonymousBooking) {
      if (!formData.first_name.trim()) errors.push('First name is required')
      if (!formData.last_name.trim()) errors.push('Last name is required')
      
      const nameRegex = /^[a-zA-Z\s\-']+$/
      if (formData.first_name.trim() && !nameRegex.test(formData.first_name)) {
        errors.push('First name can only contain letters, spaces, hyphens, and apostrophes')
      }
      if (formData.last_name.trim() && !nameRegex.test(formData.last_name)) {
        errors.push('Last name can only contain letters, spaces, hyphens, and apostrophes')
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!formData.email.trim()) {
        errors.push('Email is required')
      } else if (!emailRegex.test(formData.email)) {
        errors.push('Please enter a valid email address')
      }
      
      if (formData.phone.trim()) {
        const cleanPhone = formData.phone.replace(/\D/g, '')
        if (cleanPhone.length < 10) {
          errors.push('Phone number must be at least 10 digits')
        } else if (!/^(09|9)/.test(cleanPhone)) {
          errors.push('Philippine phone numbers must start with 09 or 9')
        }
      }
    }
    
    if (selectedService && formData.date) {
      const selectedDate = new Date(formData.date)
      const dayOfWeek = selectedDate.getDay()
      
      if (!selectedService.allowed_days.includes(dayOfWeek)) {
        const dayName = DAYS_OF_WEEK[dayOfWeek].label
        errors.push(`This service is not available on ${dayName}`)
      }
    }
    
    if (selectedService?.requires_multiple_days && consecutiveDaysAvailability && !consecutiveDaysAvailability.allDaysAvailable) {
      errors.push('Selected dates do not have availability for all required consecutive days')
    }
    
    const amountPaid = parseFloat(formData.amount_paid) || 0
    const grandTotal = calculateGrandTotal()
    
    if (!formData.amount_paid || isNaN(amountPaid)) {
      errors.push('Payment amount must be a valid number')
    }
    
    if (amountPaid <= 0) {
      errors.push('Payment amount must be greater than 0')
    }
    
    if (amountPaid < grandTotal) {
      errors.push(`Payment must be at least ₱${grandTotal.toFixed(2)}`)
    }
    
    const uncheckedRequiredReqs = serviceRequirements.filter(
      req => req.isRequired && !req.isChecked
    )
    if (uncheckedRequiredReqs.length > 0) {
      errors.push('Please check all required service requirements')
    }
    
    return errors
  }

  const validateOfferingForm = () => {
    const errors = []
    
    const nameRegex = /^[a-zA-Z\s\-']+$/
    if (offeringData.customer_name.trim() && !nameRegex.test(offeringData.customer_name)) {
      errors.push('Customer name can only contain letters, spaces, hyphens, and apostrophes')
    }
    
    if (offeringData.customer_email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(offeringData.customer_email)) {
        errors.push('Please enter a valid email address')
      }
    }
    
    if (offeringData.customer_phone.trim()) {
      const cleanPhone = offeringData.customer_phone.replace(/\D/g, '')
      if (cleanPhone.length < 10) {
        errors.push('Phone number must be at least 10 digits')
      } else if (!/^(09|9)/.test(cleanPhone)) {
        errors.push('Philippine phone numbers must start with 09 or 9')
      }
    }
    
    if (selectedProducts.length === 0) {
      errors.push('Please select at least one offering')
    }
    
    const amountPaid = parseFloat(offeringData.amount_paid) || 0
    const offeringTotal = calculateOfferingTotal()
    
    if (!offeringData.amount_paid || isNaN(amountPaid)) {
      errors.push('Payment amount must be a valid number')
    }
    
    if (amountPaid <= 0) {
      errors.push('Payment amount must be greater than 0')
    }
    
    if (amountPaid < offeringTotal) {
      errors.push(`Payment must be at least ₱${offeringTotal.toFixed(2)}`)
    }
    
    return errors
  }

  const handleSubmitAppointment = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    const errors = validateForm()
    if (errors.length > 0) {
      setError(errors.join(', '))
      setLoading(false)
      return
    }

    try {
      const allRequirements = []
      
      serviceRequirements
        .filter(req => req.isChecked)
        .forEach(req => {
          allRequirements.push(req.details)
        })
      
      const validCustomReqs = customRequirements.filter(req => req.trim() !== '')
      allRequirements.push(...validCustomReqs)

      // Prepare data WITHOUT is_anonymous field
      const cleanedData = {
        ...formData,
        // These fields are already auto-filled by the useEffect
        // when isAnonymousBooking is true
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone ? formData.phone.replace(/\D/g, '') : '',
        amount_paid: formData.amount_paid,
        requirements: allRequirements
        // REMOVE: is_anonymous: isAnonymousBooking
      }

      console.log('Submitting appointment data:', cleanedData)

      const appointmentResult = await appointmentService.createAppointment(cleanedData, currentUser)

      if (appointmentResult.success) {
        if (selectedProducts.length > 0) {
          await productsService.addProductsToAppointment(
            appointmentResult.data.appointment_id,
            selectedProducts,
            currentUser
          )
          
          const updatedAppointment = await appointmentService.getAppointmentWithProducts(appointmentResult.data.appointment_id)
          
          if (updatedAppointment.success) {
            setSuccess('Appointment booked and offerings recorded successfully! Printing receipt...')
            
            setTimeout(() => {
              printReceipt(updatedAppointment.data)
            }, 1500)
          } else {
            setSuccess('Appointment booked successfully! (Offerings may not be included in receipt)')
          }
        } else {
          setSuccess('Appointment booked and paid successfully! Printing receipt...')
          
          setTimeout(() => {
            printReceipt(appointmentResult.data)
          }, 1500)
        }
        
        resetForm()
      } else {
        setError(appointmentResult.error || 'Failed to book appointment')
      }
    } catch (err) {
      setError('An error occurred while booking appointment')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitOfferingOnly = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    const errors = validateOfferingForm()
    if (errors.length > 0) {
      setError(errors.join(', '))
      setLoading(false)
      return
    }

    try {
      const result = await offeringService.processOfferingOnly(
        {
          ...offeringData,
          customer_name: offeringData.customer_name.trim() || 'Anonymous Donor', // Default value
          items: selectedProducts
        },
        currentUser
      )

      if (result.success) {
        setSuccess('Offering recorded successfully! Printing receipt...')
        
        setTimeout(() => {
          printReceipt(result.data)
        }, 1500)
        
        resetOfferingForm()
      } else {
        setError(result.error || 'Failed to record offering')
      }
    } catch (err) {
      setError('An error occurred while recording offering')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      date: '',
      time: '',
      service_type: '',
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      amount_paid: '',
    })
    setIsAnonymousBooking(false)
    setSelectedService(null)
    setServiceRequirements([])
    setCustomRequirements([''])
    setSelectedProducts([])
    setAvailableTimeSlots([])
    setConsecutiveDaysAvailability(null)
    setDayConstraints(null)
  }

  const resetOfferingForm = () => {
    setOfferingData({
      customer_name: '',
      customer_email: '',
      customer_phone: '',
      amount_paid: '',
    })
    setSelectedProducts([])
  }

  const changeAmount = calculateChange()
  const offeringChangeAmount = calculateOfferingChange()

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="appointment-header">
          <h1>Book Service / Record Offering</h1>
          <p>Schedule services or record offerings for the church</p>
          
          <div className="mode-toggle">
            <button 
              className={`mode-btn ${!isOfferingOnly ? 'active' : ''}`}
              onClick={() => setIsOfferingOnly(false)}
              disabled={loading}
            >
              Book Service
            </button>
            <button 
              className={`mode-btn ${isOfferingOnly ? 'active' : ''}`}
              onClick={() => setIsOfferingOnly(true)}
              disabled={loading}
            >
              Offering Only
            </button>
          </div>
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

        {isOfferingOnly ? (
          <form onSubmit={handleSubmitOfferingOnly} className="offering-form">
            {/* Offering form remains the same - you can add anonymous option here too if needed */}
            <div className="form-section">
              <div className="section-title">
                <h3>Customer Information</h3>
                <p>Provide customer details for the offering</p>
              </div>
              
              <div className="form-group">
                <label htmlFor="customer_name">Customer Name (Optional)</label>
                <input
                  type="text"
                  id="customer_name"
                  name="customer_name"
                  value={offeringData.customer_name}
                  onChange={handleOfferingInputChange}
                  placeholder="Enter customer name"
                  disabled={loading}
                  maxLength="100"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="customer_email">Email (Optional)</label>
                  <input
                    type="email"
                    id="customer_email"
                    name="customer_email"
                    value={offeringData.customer_email}
                    onChange={handleOfferingInputChange}
                    placeholder="Enter email"
                    disabled={loading}
                    maxLength="100"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="customer_phone">Phone Number (Optional)</label>
                  <div className="phone-input-container">
                    <span className="phone-prefix">+63</span>
                    <input
                      type="tel"
                      id="customer_phone"
                      name="customer_phone"
                      value={offeringData.customer_phone}
                      onChange={handleOfferingInputChange}
                      placeholder="9123456789"
                      maxLength="10"
                      pattern="[0-9]*"
                      inputMode="numeric"
                      disabled={loading}
                      className="phone-input"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Products selection and payment sections remain the same */}
            <div className="form-section offerings-section">
              <div className="section-title">
                <h3>Select Offerings</h3>
                <p>Choose offerings to record</p>
              </div>
              
              <div className="offerings-grid">
                {products.map(product => (
                  <div key={product.product_id} className="offering-card">
                    <div className="offering-info">
                      <h4>{product.product_name}</h4>
                      <p className="offering-price">₱{product.price.toFixed(2)}</p>
                      {product.description && (
                        <p className="offering-description">{product.description}</p>
                      )}
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => handleProductSelect(product.product_id)}
                      className="add-offering-btn"
                      disabled={loading}
                    >
                      Add Offering
                    </button>
                  </div>
                ))}
              </div>
              
              {selectedProducts.length > 0 && (
                <div className="selected-offerings">
                  <h4>Selected Offerings:</h4>
                  <ul>
                    {selectedProducts.map(product => (
                      <li key={product.product_id}>
                        <span>{product.product_name} x{product.quantity}</span>
                        <span>₱{(product.quantity * product.unit_price).toFixed(2)}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveProduct(product.product_id)}
                          className="remove-offering-btn"
                          disabled={loading}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="offerings-total">
                    <span>Total Offerings:</span>
                    <span>₱{calculateOfferingTotal().toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="form-section payment-section">
              <div className="section-title">
                <h3>Payment Information</h3>
                <p>Record payment for offerings</p>
              </div>
              
              <div className="payment-summary">
                <div className="quick-amounts">
                  <p className="quick-amounts-label">Quick Amounts:</p>
                  <div className="quick-amount-buttons">
                    <button type="button" onClick={() => handleOfferingQuickAmount(100)} className="quick-amount-btn">
                      ₱100
                    </button>
                    <button type="button" onClick={() => handleOfferingQuickAmount(500)} className="quick-amount-btn">
                      ₱500
                    </button>
                    <button type="button" onClick={() => handleOfferingQuickAmount(1000)} className="quick-amount-btn">
                      ₱1,000
                    </button>
                    <button type="button" onClick={() => handleOfferingQuickAmount(2000)} className="quick-amount-btn">
                      ₱2,000
                    </button>
                    <button type="button" onClick={() => handleOfferingQuickAmount(calculateOfferingTotal())} className="quick-amount-btn exact">
                      Exact: ₱{calculateOfferingTotal().toFixed(2)}
                    </button>
                  </div>
                </div>
                
                <div className="form-group">
                  <label htmlFor="offering_amount_paid">Amount Paid (₱) *</label>
                  <div className="amount-input-container">
                    <span className="currency-symbol">₱</span>
                    <input
                      ref={offeringAmountRef}
                      type="text"
                      id="offering_amount_paid"
                      name="amount_paid"
                      value={offeringData.amount_paid}
                      onChange={handleOfferingInputChange}
                      required
                      placeholder="0.00"
                      disabled={loading}
                      className="amount-input"
                      inputMode="decimal"
                    />
                    <button
                      type="button"
                      onClick={handleClearOfferingAmount}
                      className="clear-amount-btn"
                      disabled={loading}
                      title="Clear amount"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                
                {offeringData.amount_paid && (
                  <div className="change-calculation">
                    <div className="calculation-row subtotal">
                      <span className="label">Offerings Total:</span>
                      <span className="value">₱{calculateOfferingTotal().toFixed(2)}</span>
                    </div>
                    <div className="calculation-row">
                      <span className="label">Amount Paid:</span>
                      <span className="value">₱{parseFloat(offeringData.amount_paid || 0).toFixed(2)}</span>
                    </div>
                    <div className="calculation-row total">
                      <span className="label">Change to give:</span>
                      <span className={`value ${offeringChangeAmount < 0 ? 'error' : ''}`}>
                        ₱{offeringChangeAmount.toFixed(2)}
                      </span>
                    </div>
                    {offeringChangeAmount < 0 && (
                      <div className="payment-warning">
                        ⚠️ Amount paid is less than total!
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="form-actions">
              <button 
                type="submit" 
                disabled={loading || selectedProducts.length === 0}
                className="btn-primary submit-btn"
              >
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    Processing...
                  </>
                ) : (
                  <>
                    <span className="icon">💰</span>
                    {offeringData.customer_name.trim() ? 'Record Offering & Print Receipt' : 'Record Anonymous Offering'}
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmitAppointment} className="appointment-form">
            <div className="form-section">
              <div className="section-title">
                <h3>Personal Information</h3>
                <p>Provide your contact details</p>
              </div>
              
              {/* Anonymous Booking Toggle */}
              <div className="anonymous-booking-toggle">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={isAnonymousBooking}
                    onChange={(e) => setIsAnonymousBooking(e.target.checked)}
                    disabled={loading}
                  />
                  <span className="toggle-slider"></span>
                  <span className="toggle-text">Book Anonymously (No personal information required)</span>
                </label>
                <small className="toggle-hint">
                  If checked, only service details and payment will be recorded
                </small>
              </div>
              
              {isAnonymousBooking && (
                <div className="anonymous-notice">
                  <div className="notice-icon">👤</div>
                  <div className="notice-content">
                    <h4>Anonymous Booking Selected</h4>
                    <p>
                      Your appointment will be recorded as: <strong>{formData.first_name} {formData.last_name}</strong><br/>
                      Email: <strong>{formData.email}</strong><br/>
                      Only service details and payment information will be saved. 
                      Please keep your receipt for reference.
                    </p>
                    <small>
                      Note: Without contact information, we cannot send reminders or updates about your appointment.
                    </small>
                  </div>
                </div>
              )}{!isAnonymousBooking && (
                <>
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
                        pattern="[a-zA-Z\s\-']+"
                        title="Only letters, spaces, hyphens, and apostrophes are allowed"
                        maxLength="50"
                      />
                      <small className="input-hint">Letters, spaces, hyphens, and apostrophes only</small>
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
                        pattern="[a-zA-Z\s\-']+"
                        title="Only letters, spaces, hyphens, and apostrophes are allowed"
                        maxLength="50"
                      />
                      <small className="input-hint">Letters, spaces, hyphens, and apostrophes only</small>
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
                        maxLength="100"
                        pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
                        title="Please enter a valid email address"
                      />
                      <small className="input-hint">Enter a valid email address</small>
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
                          onChange={handleInputChange}
                          placeholder="9123456789"
                          maxLength="10"
                          pattern="[0-9]*"
                          inputMode="numeric"
                          disabled={loading}
                          className="phone-input"
                          title="Enter 10-digit Philippine phone number"
                        />
                      </div>
                      <small className="input-hint">Optional. Enter 10-digit number starting with 9</small>
                    </div>
                  </div>
                </>
              )}
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
                    disabled={loading || !selectedService}
                  />
                  <small className="input-hint">
                    {selectedService 
                      ? ''
                      : 'Select a service first'}
                  </small>
                </div>

                <div className="form-group">
                  <label htmlFor="time">Time *</label>
                  {isCheckingAvailability ? (
                    <div className="loading-slots">
                      <div className="spinner-small"></div>
                      <span>Checking available time slots...</span>
                    </div>
                  ) : availableTimeSlots.length === 0 && formData.date && selectedService ? (
                    <div className="no-slots-available">
                      <p>⚠️ No available time slots for this date.</p>
                      {dayConstraints && !dayConstraints.isValid && (
                        <p className="day-constraint-error">{dayConstraints.message}</p>
                      )}
                      {consecutiveDaysAvailability && !consecutiveDaysAvailability.allDaysAvailable && (
                        <div className="multi-day-warning">
                          <p>This service requires {selectedService.consecutive_days} consecutive days.</p>
                          <ul>
                            {consecutiveDaysAvailability.availability.map((day, idx) => (
                              <li key={idx} className={day.isAllowed && day.hasAvailability ? 'available' : 'unavailable'}>
                                {day.dayName}: {day.isAllowed && day.hasAvailability ? '✅ Available' : '❌ Not Available'}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <select
                      id="time"
                      name="time"
                      value={formData.time}
                      onChange={handleInputChange}
                      required
                      disabled={loading || availableTimeSlots.length === 0}
                    >
                      <option value="">Select a time</option>
                      {availableTimeSlots
                        .filter(slot => slot.available)
                        .map(slot => (
                          <option key={slot.value} value={slot.value}>
                            {slot.display}
                            {slot.allowConcurrent && ' 🔀'}
                          </option>
                        ))}
                    </select>
                  )}
                  <small className="input-hint">
                    {selectedService && (
                      <>
                        Duration: {formatDuration(selectedService.duration_minutes)}
                        {selectedService.requires_multiple_days && ` | ${selectedService.consecutive_days} consecutive days required`}
                        {selectedService.allow_concurrent && ' | 🔀 Concurrent appointments allowed'}
                      </>
                    )}
                  </small>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="service_type">Service Type *</label>
                <select
                  id="service_type"
                  name="service_type"
                  value={formData.service_type}
                  onChange={handleServiceChange}
                  required
                  disabled={loading}
                >
                  <option value="">Select a service</option>
                  {services.map(service => (
                    <option key={service.service_id} value={service.service_name}>
                      {service.service_name} {service.price > 0 ? `(₱${service.price.toFixed(2)})` : '(Free)'}
                      {service.has_requirements && ' 📋'}
                      {service.requires_multiple_days && ` 🔄 ${service.consecutive_days} days`}
                      {service.duration_minutes && ` ⏱️ ${formatDuration(service.duration_minutes)}`}
                      {service.allow_concurrent && ' 🔀 Concurrent'}
                    </option>
                  ))}
                </select>
                <small className="input-hint">
                  📋 = Has requirements | 🔄 = Multi-day service | ⏱️ = Duration | 🔀 = Concurrent allowed
                </small>
              </div>
            </div>

            {selectedService && serviceRequirements.length > 0 && (
              <div className="form-section requirements-section">
                <div className="section-title">
                  <h3>Service Requirements</h3>
                  <p>Check all requirements that apply to this appointment</p>
                </div>
                
                <div className="requirements-list">
                  {serviceRequirements.map((req, index) => (
                    <div key={req.id} className="requirement-item">
                      <label className="requirement-label">
                        <input
                          type="checkbox"
                          checked={req.isChecked}
                          onChange={(e) => handleServiceRequirementChange(index, e.target.checked)}
                          disabled={loading}
                          className="requirement-checkbox"
                          required={req.isRequired}
                        />
                        <span className={`requirement-text ${req.isRequired ? 'required' : 'optional'}`}>
                          {req.details}
                          <span className="requirement-type">
                            {req.isRequired ? ' (Required)' : ' (Optional)'}
                          </span>
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
                
                <div className="requirements-note">
                  <small>
                    ⚠️ Required items must be checked before booking. 
                    Optional items can be selected as needed.
                  </small>
                </div>
              </div>
            )}

            <div className="form-section">
              <div className="section-title">
                <h3>Additional Requirements</h3>
                <p>Add any extra requirements or notes (optional)</p>
              </div>
              
              <div className="form-group">
                <label>Custom Requirements (Optional)</label>
                <div className="requirements-container">
                  {customRequirements.map((requirement, index) => (
                    <div key={index} className="requirement-row">
                      <input
                        type="text"
                        value={requirement}
                        onChange={(e) => handleCustomRequirementChange(index, e.target.value)}
                        placeholder="Enter additional requirement details..."
                        disabled={loading}
                        className="requirement-input"
                        maxLength="200"
                      />
                      {customRequirements.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCustomRequirement(index)}
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
                  onClick={addCustomRequirement}
                  className="add-requirement-btn"
                  disabled={loading}
                >
                  + Add Another Custom Requirement
                </button>
              </div>
            </div>

            <div className="form-section offerings-section">
              <div className="section-title">
                <h3>Additional Offerings (Optional)</h3>
                <p>Add offerings to accompany this service</p>
              </div>
              
              <div className="offerings-grid">
                {products.map(product => (
                  <div key={product.product_id} className="offering-card">
                    <div className="offering-info">
                      <h4>{product.product_name}</h4>
                      <p className="offering-price">₱{product.price.toFixed(2)}</p>
                      {product.description && (
                        <p className="offering-description">{product.description}</p>
                      )}
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => handleProductSelect(product.product_id)}
                      className="add-offering-btn"
                      disabled={loading}
                    >
                      Add to Service
                    </button>
                  </div>
                ))}
              </div>
              
              {selectedProducts.length > 0 && (
                <div className="selected-offerings">
                  <h4>Selected Offerings:</h4>
                  <ul>
                    {selectedProducts.map(product => (
                      <li key={product.product_id}>
                        <span>{product.product_name} x{product.quantity}</span>
                        <span>₱{(product.quantity * product.unit_price).toFixed(2)}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveProduct(product.product_id)}
                          className="remove-offering-btn"
                          disabled={loading}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="offerings-total">
                    <span>Total Offerings:</span>
                    <span>₱{calculateOfferingTotal().toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="form-section payment-section">
              <div className="section-title">
                <h3>Payment Information</h3>
                <p>Full cash payment is required to book appointment</p>
              </div>
              
              {selectedService ? (
                <div className="payment-summary">
                  <div className="payment-summary-header">
                    {isAnonymousBooking && (
                      <div className="anonymous-booking-indicator">
                        <span className="anonymous-badge">👤 Anonymous Booking</span>
                      </div>
                    )}
                    <div className="service-fee">
                      <span className="label">Service Fee:</span>
                      <span className="amount">₱{selectedService.price.toFixed(2)}</span>
                    </div>
                    {selectedProducts.length > 0 && (
                      <div className="offerings-fee">
                        <span className="label">Additional Offerings:</span>
                        <span className="amount">₱{calculateOfferingTotal().toFixed(2)}</span>
                      </div>
                    )}
                    <div className="grand-total-fee">
                      <span className="label">Grand Total:</span>
                      <span className="amount total">₱{calculateGrandTotal().toFixed(2)}</span>
                    </div>
                    <div className="payment-instruction">
                      <small>💰 Cash payment only. Please prepare exact amount or change will be provided.</small>
                    </div>
                  </div>
                  
                  <div className="quick-amounts">
                    <p className="quick-amounts-label">Quick Amounts:</p>
                    <div className="quick-amount-buttons">
                      <button type="button" onClick={() => handleQuickAmount(100)} className="quick-amount-btn">
                        ₱100
                      </button>
                      <button type="button" onClick={() => handleQuickAmount(500)} className="quick-amount-btn">
                        ₱500
                      </button>
                      <button type="button" onClick={() => handleQuickAmount(1000)} className="quick-amount-btn">
                        ₱1,000
                      </button>
                      <button type="button" onClick={() => handleQuickAmount(2000)} className="quick-amount-btn">
                        ₱2,000
                      </button>
                      <button type="button" onClick={() => handleQuickAmount(calculateGrandTotal())} className="quick-amount-btn exact">
                        Exact: ₱{calculateGrandTotal().toFixed(2)}
                      </button>
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="amount_paid">Amount Paid (₱) *</label>
                    <div className="amount-input-container">
                      <span className="currency-symbol">₱</span>
                      <input
                        ref={amountInputRef}
                        type="text"
                        id="amount_paid"
                        name="amount_paid"
                        value={formData.amount_paid}
                        onChange={handleInputChange}
                        required
                        placeholder="0.00"
                        disabled={loading}
                        className="amount-input"
                        inputMode="decimal"
                        pattern="\d*\.?\d{0,2}"
                        title="Enter amount in Philippine Peso"
                      />
                      <button
                        type="button"
                        onClick={handleClearAmount}
                        className="clear-amount-btn"
                        disabled={loading}
                        title="Clear amount"
                      >
                        ✕
                      </button>
                    </div>
                    <small className="input-hint">
                      Enter the exact cash amount received
                    </small>
                  </div>
                  
                  {formData.amount_paid && (
                    <div className="change-calculation">
                      <div className="calculation-row">
                        <span className="label">Service Fee:</span>
                        <span className="value">₱{selectedService.price.toFixed(2)}</span>
                      </div>
                      {selectedProducts.length > 0 && (
                        <div className="calculation-row">
                          <span className="label">Additional Offerings:</span>
                          <span className="value">₱{calculateOfferingTotal().toFixed(2)}</span>
                        </div>
                      )}
                      <div className="calculation-row subtotal">
                        <span className="label">Grand Total:</span>
                        <span className="value">₱{calculateGrandTotal().toFixed(2)}</span>
                      </div>
                      <div className="calculation-row">
                        <span className="label">Amount Paid:</span>
                        <span className="value">₱{parseFloat(formData.amount_paid || 0).toFixed(2)}</span>
                      </div>
                      <div className="calculation-row total">
                        <span className="label">Change to give:</span>
                        <span className={`value ${changeAmount < 0 ? 'error' : ''}`}>
                          ₱{changeAmount.toFixed(2)}
                        </span>
                      </div>
                      {changeAmount < 0 && (
                        <div className="payment-warning">
                          ⚠️ Amount paid is less than total!
                        </div>
                      )}
                      {changeAmount > 0 && (
                        <div className="payment-note">
                          ✅ Amount paid is sufficient. Change to give: ₱{changeAmount.toFixed(2)}
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="payment-method-display">
                    <div className="receipt-note">
                    <small>A receipt will be automatically printed after booking</small>
                    {isAnonymousBooking && (
                      <small className="anonymous-receipt-note">
                        <br/>Receipt will show "{formData.first_name} {formData.last_name}" as the customer name
                      </small>
                    )}
                  </div>
                  </div>
                </div>
              ) : (
                <div className="no-service-selected">
                  <p>Please select a service first to see payment details</p>
                </div>
              )}
            </div>

            <div className="form-actions">
              <button 
                type="submit" 
                disabled={loading || !selectedService || !formData.time}
                className="btn-primary submit-btn"
              >
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    Processing...
                  </>
                ) : (
                  <>
                    <span className="icon">✓</span>
                    {isAnonymousBooking ? 'Book Anonymous Appointment' : 'Book & Pay Appointment'}
                  </>
                )}
              </button>
              
              <div className="form-note">
                <small>
                  By booking, you agree to pay the full amount in cash. 
                  Appointment will be automatically confirmed upon payment.
                  {isAnonymousBooking && ' Anonymous bookings will not receive appointment reminders.'}
                </small>
              </div>
            </div>
          </form>
        )}
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
          margin: 0 auto 20px;
        }

        .mode-toggle {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-top: 20px;
        }
        
        .mode-btn {
          padding: 12px 30px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          background: white;
          color: #4a5568;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          font-size: 14px;
        }
        
        .mode-btn:hover:not(:disabled) {
          border-color: #4299e1;
          color: #4299e1;
        }
        
        .mode-btn.active {
          background: #4299e1;
          border-color: #4299e1;
          color: white;
        }
        
        .mode-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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

        .appointment-form, .offering-form {
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

        .form-section.requirements-section {
          border-color: #9f7aea;
          background: #faf5ff;
        }

        .form-section.payment-section {
          border-color: #4299e1;
          background: #ebf8ff;
        }

        .form-section.offerings-section {
          border-color: #38a169;
          background: #f0fff4;
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

        /* Anonymous Booking Toggle Styles */
        .anonymous-booking-toggle {
          margin-bottom: 24px;
          padding: 16px;
          background: white;
          border-radius: 8px;
          border: 2px solid #e2e8f0;
        }

        .toggle-label {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          font-weight: 500;
          color: #2d3748;
        }

        .toggle-label input[type="checkbox"] {
          display: none;
        }

        .toggle-slider {
          position: relative;
          display: inline-block;
          width: 52px;
          height: 28px;
          background-color: #cbd5e0;
          border-radius: 14px;
          transition: background-color 0.3s;
        }

        .toggle-slider:before {
          content: "";
          position: absolute;
          width: 24px;
          height: 24px;
          left: 2px;
          bottom: 2px;
          background-color: white;
          border-radius: 50%;
          transition: transform 0.3s;
        }

        .toggle-label input:checked + .toggle-slider {
          background-color: #4299e1;
        }

        .toggle-label input:checked + .toggle-slider:before {
          transform: translateX(24px);
        }

        .toggle-text {
          font-size: 15px;
          font-weight: 600;
          color: #4a5568;
        }

        .toggle-hint {
          display: block;
          margin-top: 8px;
          color: #718096;
          font-size: 13px;
          margin-left: 64px;
        }

        .anonymous-notice {
          display: flex;
          gap: 16px;
          padding: 20px;
          background: linear-gradient(135deg, #f0fff4 0%, #e6fffa 100%);
          border-radius: 8px;
          border-left: 4px solid #38a169;
          margin-top: 16px;
        }

        .notice-icon {
          font-size: 32px;
          display: flex;
          align-items: center;
        }

        .notice-content h4 {
          margin: 0 0 8px 0;
          color: #22543d;
          font-size: 16px;
        }

        .notice-content p {
          margin: 0 0 8px 0;
          color: #2d3748;
          font-size: 14px;
          line-height: 1.5;
        }

        .notice-content small {
          color: #4a5568;
          font-size: 12px;
          font-style: italic;
        }

        .anonymous-booking-indicator {
          margin-bottom: 15px;
          text-align: center;
        }

        .anonymous-badge {
          display: inline-block;
          padding: 6px 12px;
          background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
          color: white;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
        }

        .anonymous-receipt-note {
          color: #4a5568;
          font-style: italic;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        .form-group {
          margin-bottom: 20px;
          position: relative;
        }

        .form-group label {
          display: block;
          margin-bottom: 10px;
          font-weight: 600;
          color: #4a5568;
          font-size: 14px;
        }

        .form-group input,
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
        .form-group select:focus {
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

        .form-group input:invalid {
          border-color: #f56565;
        }

        .form-group input:valid {
          border-color: #48bb78;
        }

        .input-hint {
          display: block;
          margin-top: 8px;
          color: #718096;
          font-size: 12px;
          font-style: normal;
        }

        .loading-slots {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
          background: #f7fafc;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          color: #718096;
        }

        .spinner-small {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(66, 153, 225, 0.3);
          border-radius: 50%;
          border-top-color: #4299e1;
          animation: spin 1s linear infinite;
        }

        .no-slots-available {
          padding: 14px 16px;
          background: #fff5f5;
          border: 2px solid #fed7d7;
          border-radius: 8px;
          color: #9b2c2c;
          font-size: 14px;
        }

        .day-constraint-error {
          margin-top: 8px;
          padding: 8px;
          background: #feebc8;
          border-radius: 4px;
          color: #744210;
          font-size: 13px;
        }

        .multi-day-warning {
          margin-top: 10px;
          padding: 10px;
          background: #feebc8;
          border-radius: 6px;
          border-left: 3px solid #dd6b20;
        }

        .multi-day-warning p {
          margin: 0 0 8px 0;
          font-weight: 600;
        }

        .multi-day-warning ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .multi-day-warning li {
          padding: 4px 0;
          font-size: 12px;
        }

        .multi-day-warning li.available {
          color: #22543d;
        }

        .multi-day-warning li.unavailable {
          color: #742a2a;
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
          transition: all 0.2s;
        }

        .requirement-item:hover {
          border-color: #9f7aea;
        }

        .requirement-label {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          cursor: pointer;
          width: 100%;
        }

        .requirement-checkbox {
          width: 18px;
          height: 18px;
          margin-top: 2px;
          accent-color: #9f7aea;
        }

        .requirement-checkbox:required:not(:checked) {
          outline: 2px solid #f56565;
        }

        .requirement-text {
          flex: 1;
          color: #2d3748;
          font-size: 14px;
          line-height: 1.5;
        }

        .requirement-text.required {
          font-weight: 600;
        }

        .requirement-type {
          color: #718096;
          font-size: 12px;
          font-weight: 500;
          margin-left: 4px;
        }

        .requirements-note {
          padding: 12px;
          background: #feebc8;
          border-radius: 6px;
          border-left: 3px solid #dd6b20;
          margin-top: 16px;
        }

        .requirements-note small {
          color: #744210;
          font-size: 12px;
          line-height: 1.4;
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

        .products-grid,
        .offerings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 15px;
          margin-bottom: 20px;
        }
        
        .product-card,
        .offering-card {
          background: white;
          border: 2px solid #e2e8f0;
          border-radius: 10px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 15px;
          transition: all 0.3s ease;
        }
        
        .product-card:hover,
        .offering-card:hover {
          border-color: #4299e1;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(66, 153, 225, 0.1);
        }
        
        .product-info h4,
        .offering-info h4 {
          margin: 0 0 8px 0;
          color: #2d3748;
          font-size: 16px;
          font-weight: 600;
        }
        
        .product-price,
        .offering-price {
          font-size: 18px;
          font-weight: 700;
          color: #48bb78;
          margin: 0;
        }
        
        .product-description,
        .offering-description {
          font-size: 13px;
          color: #718096;
          margin: 5px 0 0 0;
          line-height: 1.4;
        }
        
        .product-actions {
          margin-top: auto;
        }
        
        .add-product-btn,
        .add-offering-btn {
          width: 100%;
          padding: 10px;
          background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }
        
        .add-product-btn:hover:not(:disabled),
        .add-offering-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #3ac569 0%, #2f855a 100%);
        }
        
        .add-product-btn:disabled,
        .add-offering-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .selected-products-list {
          margin-bottom: 20px;
        }
        
        .selected-product {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 15px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          margin-bottom: 10px;
        }
        
        .product-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .product-name {
          font-weight: 600;
          color: #2d3748;
        }
        
        .product-unit-price {
          font-size: 13px;
          color: #718096;
        }
        
        .product-quantity-controls {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0 20px;
        }
        
        .quantity-btn {
          width: 30px;
          height: 30px;
          border: 2px solid #e2e8f0;
          border-radius: 50%;
          background: white;
          color: #4a5568;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .quantity-btn:hover:not(:disabled) {
          border-color: #4299e1;
          color: #4299e1;
        }
        
        .quantity-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .quantity-display {
          min-width: 30px;
          text-align: center;
          font-weight: 600;
          color: #2d3748;
        }
        
        .remove-product-btn,
        .remove-offering-btn {
          padding: 6px 12px;
          background: #fed7d7;
          color: #c53030;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .remove-product-btn:hover:not(:disabled),
        .remove-offering-btn:hover:not(:disabled) {
          background: #feb2b2;
        }
        
        .remove-product-btn:disabled,
        .remove-offering-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .product-total {
          font-weight: 700;
          color: #2d3748;
          font-size: 16px;
          min-width: 80px;
          text-align: right;
        }
        
        .offering-summary {
          background: white;
          border-radius: 8px;
          padding: 20px;
          border: 2px solid #e2e8f0;
        }
        
        .summary-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
        }
        
        .summary-label {
          font-weight: 600;
          color: #4a5568;
        }
        
        .summary-value {
          font-weight: 700;
          color: #2d3748;
          font-size: 18px;
        }
        
        .selected-offerings {
          margin-top: 20px;
          padding: 20px;
          background: #f0fff4;
          border-radius: 8px;
          border: 2px solid #c6f6d5;
        }
        
        .selected-offerings h4 {
          margin: 0 0 15px 0;
          color: #22543d;
        }
        
        .selected-offerings ul {
          list-style: none;
          padding: 0;
          margin: 0 0 15px 0;
        }
        
        .selected-offerings li {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid #c6f6d5;
        }
        
        .selected-offerings li:last-child {
          border-bottom: none;
        }
        
        .offerings-total {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: 700;
          color: #22543d;
          font-size: 16px;
          padding: 15px 0 0 0;
          border-top: 2px solid #38a169;
          margin-top: 15px;
        }

        .payment-summary {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .payment-summary-header {
          background: white;
          padding: 20px;
          border-radius: 8px;
          border-left: 4px solid #4299e1;
        }

        .service-fee,
        .offerings-fee,
        .grand-total-fee {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #e2e8f0;
        }

        .service-fee:last-child,
        .offerings-fee:last-child,
        .grand-total-fee:last-child {
          border-bottom: none;
        }

        .service-fee .label,
        .offerings-fee .label,
        .grand-total-fee .label {
          font-size: 16px;
          font-weight: 600;
          color: #4a5568;
        }

        .service-fee .amount,
        .offerings-fee .amount {
          font-size: 18px;
          font-weight: 700;
          color: #2d3748;
        }

        .grand-total-fee .amount.total {
          font-size: 24px;
          color: #2b6cb0;
        }

        .payment-instruction {
          padding: 10px;
          background: #e6fffa;
          border-radius: 6px;
          border-left: 3px solid #38b2ac;
          margin-top: 10px;
        }

        .payment-instruction small {
          color: #285e61;
          font-size: 13px;
        }

        .quick-amounts {
          background: white;
          padding: 20px;
          border-radius: 8px;
          border: 2px solid #e2e8f0;
        }

        .quick-amounts-label {
          margin: 0 0 12px 0;
          font-weight: 600;
          color: #4a5568;
          font-size: 14px;
        }

        .quick-amount-buttons {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 10px;
        }

        .quick-amount-btn {
          padding: 12px;
          background: #edf2f7;
          border: 2px solid #cbd5e0;
          border-radius: 8px;
          color: #4a5568;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }

        .quick-amount-btn:hover:not(:disabled) {
          background: #e2e8f0;
          border-color: #a0aec0;
          transform: translateY(-1px);
        }

        .quick-amount-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .quick-amount-btn.exact {
          background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
          border-color: #38a169;
          color: white;
          grid-column: span 2;
        }

        .quick-amount-btn.exact:hover:not(:disabled) {
          background: linear-gradient(135deg, #3ac569 0%, #2f855a 100%);
        }

        .amount-input-container {
          display: flex;
          align-items: center;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
          background: white;
          transition: all 0.2s;
        }

        .amount-input-container:focus-within {
          border-color: #4299e1;
          box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
        }

        .currency-symbol {
          padding: 14px 16px;
          background: #edf2f7;
          color: #4a5568;
          font-weight: 600;
          border-right: 2px solid #e2e8f0;
          min-width: 50px;
          text-align: center;
          font-size: 18px;
        }

        .amount-input {
          flex: 1;
          border: none !important;
          border-radius: 0 !important;
          padding-left: 12px !important;
          font-size: 24px;
          font-weight: 700;
          text-align: right;
          padding-right: 12px;
          font-family: 'Courier New', monospace;
          letter-spacing: 1px;
        }

        .amount-input::placeholder {
          color: #cbd5e0;
          font-weight: normal;
        }

        .clear-amount-btn {
          padding: 14px 16px;
          background: #fed7d7;
          color: #c53030;
          border: none;
          border-left: 2px solid #e2e8f0;
          cursor: pointer;
          font-size: 18px;
          transition: all 0.2s;
          min-width: 50px;
        }

        .clear-amount-btn:hover:not(:disabled) {
          background: #feb2b2;
        }

        .clear-amount-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .change-calculation {
          background: white;
          border-radius: 8px;
          padding: 20px;
          border: 2px solid #e2e8f0;
        }

        .calculation-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid #edf2f7;
        }

        .calculation-row.subtotal {
          font-weight: bold;
          border-bottom: 2px solid #e2e8f0;
          margin-bottom: 5px;
        }

        .calculation-row.total {
          border-bottom: 2px solid #2d3748;
          font-weight: bold;
          margin-top: 10px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
        }

        .calculation-row .label {
          color: #4a5568;
          font-weight: 500;
          font-size: 15px;
        }

        .calculation-row .value {
          color: #2d3748;
          font-weight: 600;
          font-size: 16px;
          font-family: 'Courier New', monospace;
        }

        .calculation-row .value.error {
          color: #e53e3e;
        }

        .payment-warning {
          background: #fed7d7;
          color: #9b2c2c;
          padding: 12px;
          border-radius: 6px;
          margin-top: 16px;
          font-size: 14px;
          text-align: center;
          border-left: 3px solid #e53e3e;
          font-weight: 600;
        }

        .payment-note {
          background: #c6f6d5;
          color: #22543d;
          padding: 12px;
          border-radius: 6px;
          margin-top: 16px;
          font-size: 14px;
          text-align: center;
          border-left: 3px solid #38a169;
          font-weight: 600;
        }

        .payment-method-display {
          background: white;
          padding: 20px;
          border-radius: 8px;
          border: 2px solid #e2e8f0;
        }

        .method-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .method-row .label {
          color: #4a5568;
          font-weight: 500;
          font-size: 15px;
        }

        .method-row .value.cash-method {
          background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
          color: white;
          padding: 10px 20px;
          border-radius: 20px;
          font-weight: 700;
          font-size: 15px;
        }

        .receipt-note {
          padding: 10px;
          background: #e6fffa;
          border-radius: 6px;
          border-left: 3px solid #38b2ac;
        }

        .receipt-note small {
          color: #285e61;
          font-size: 12px;
        }

        .no-service-selected {
          text-align: center;
          padding: 40px;
          background: white;
          border-radius: 8px;
          border: 2px dashed #e2e8f0;
          color: #a0aec0;
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

        .submit-btn .icon {
          font-size: 18px;
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

        .form-note {
          margin-top: 15px;
          padding: 10px;
          background: #f7fafc;
          border-radius: 6px;
          max-width: 500px;
          margin: 15px auto 0;
        }

        .form-note small {
          color: #718096;
          font-size: 12px;
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

          .mode-toggle {
            flex-direction: column;
            gap: 10px;
          }

          .mode-btn {
            width: 100%;
          }

          .anonymous-notice {
            flex-direction: column;
            text-align: center;
          }
          
          .notice-icon {
            justify-content: center;
          }
          
          .toggle-hint {
            margin-left: 0;
            margin-top: 12px;
          }
          
          .toggle-label {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
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

          .requirement-label {
            align-items: flex-start;
          }

          .products-grid,
          .offerings-grid {
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          }
          
          .selected-product {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
          }
          
          .product-quantity-controls {
            margin: 10px 0;
            justify-content: center;
          }
          
          .product-total {
            text-align: center;
          }

          .quick-amount-buttons {
            grid-template-columns: repeat(2, 1fr);
          }

          .quick-amount-btn.exact {
            grid-column: span 2;
          }

          .amount-input {
            font-size: 20px;
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

          .products-grid,
          .offerings-grid {
            grid-template-columns: 1fr;
          }

          .quick-amount-buttons {
            grid-template-columns: 1fr;
          }

          .quick-amount-btn.exact {
            grid-column: span 1;
          }

          .amount-input {
            font-size: 18px;
          }

          .service-fee .amount,
          .grand-total-fee .amount.total {
            font-size: 20px;
          }
        }
      `}</style>
    </div>
  )
}

export default BookAppointmentPage