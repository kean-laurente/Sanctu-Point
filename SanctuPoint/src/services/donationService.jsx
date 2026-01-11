import { supabase } from '../config/supabaseClient'

const handleSupabaseError = (error, operation) => {
  console.error(`❌ ${operation} error:`, error)
  return { 
    success: false, 
    error: error.message || `Failed to ${operation}` 
  }
}

const VALIDATION_RULES = {
  DONOR_NAME: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 100,
    PATTERN: /^[a-zA-Z\s.'-]+$/,
    SPECIAL_CHAR_REGEX: /[!@#$%^&*()_+=\[\]{};:"\\|,<>\/?~`0-9]/,
    IS_REQUIRED: false 
  },
  AMOUNT: {
    MIN: 0.01,
    MAX: 50000, 
    MAX_DECIMALS: 2,
    IS_REQUIRED: true
  },
  DESCRIPTION: {
    MAX_LENGTH: 500,
    IS_REQUIRED: false
  }
}

const validateDonationInput = (donationData) => {
  const errors = []
  
  if (donationData.donor_name && donationData.donor_name.trim() !== '') {
    const trimmedName = donationData.donor_name.trim()
    
    if (trimmedName.length < VALIDATION_RULES.DONOR_NAME.MIN_LENGTH) {
      errors.push(`Donor name must be at least ${VALIDATION_RULES.DONOR_NAME.MIN_LENGTH} characters long if provided`)
    }
    
    if (trimmedName.length > VALIDATION_RULES.DONOR_NAME.MAX_LENGTH) {
      errors.push(`Donor name cannot exceed ${VALIDATION_RULES.DONOR_NAME.MAX_LENGTH} characters`)
    }
    
    if (VALIDATION_RULES.DONOR_NAME.SPECIAL_CHAR_REGEX.test(trimmedName)) {
      errors.push('Donor name cannot contain special characters or numbers')
    }
    
    if (!VALIDATION_RULES.DONOR_NAME.PATTERN.test(trimmedName)) {
      errors.push('Name can only contain letters, spaces, periods, apostrophes, and hyphens')
    }
  }
  
  if (!donationData.amount && donationData.amount !== 0) {
    errors.push('Amount is required')
  } else {
    const amount = parseFloat(donationData.amount)
    
    if (isNaN(amount)) {
      errors.push('Amount must be a valid number')
    } else if (amount < VALIDATION_RULES.AMOUNT.MIN) {
      errors.push(`Amount must be at least ₱${VALIDATION_RULES.AMOUNT.MIN}`)
    } else if (amount > VALIDATION_RULES.AMOUNT.MAX) {
      errors.push(`Amount cannot exceed ₱${VALIDATION_RULES.AMOUNT.MAX.toLocaleString('en-PH')}`)
    }
    
    const decimalPlaces = (amount.toString().split('.')[1] || '').length
    if (decimalPlaces > VALIDATION_RULES.AMOUNT.MAX_DECIMALS) {
      errors.push(`Amount can only have up to ${VALIDATION_RULES.AMOUNT.MAX_DECIMALS} decimal places`)
    }
  }
  
  if (donationData.description && donationData.description.length > VALIDATION_RULES.DESCRIPTION.MAX_LENGTH) {
    errors.push(`Description cannot exceed ${VALIDATION_RULES.DESCRIPTION.MAX_LENGTH} characters`)
  }
  
  return errors
}

export const donationService = {
  async getDonations() {
    try {
      console.log('🔄 Fetching donations...')
      
      const { data, error } = await supabase
        .from('donations')
        .select('*')
        .order('donation_date', { ascending: false })

      if (error) {
        return handleSupabaseError(error, 'fetch donations')
      }

      console.log('✅ Donations fetched:', data?.length || 0)
      return { success: true, data: data || [] }
    } catch (error) {
      return handleSupabaseError(error, 'fetch donations')
    }
  },

  async createDonation(donationData) {
    try {
      console.log('🔄 Creating donation:', donationData)
      
      const validationErrors = validateDonationInput(donationData)
      
      if (validationErrors.length > 0) {
        return {
          success: false,
          error: 'Validation failed',
          validationErrors: validationErrors
        }
      }
      
      const cleanDonationData = {
        donor_name: donationData.donor_name ? donationData.donor_name.trim() : null, // Can be null
        amount: parseFloat(donationData.amount),
        description: donationData.description ? donationData.description.trim() : null,
        donation_date: donationData.donation_date || new Date().toISOString()
      }
      
      if (cleanDonationData.amount < 0) {
        console.log('⚠️ Converting negative amount to positive')
        cleanDonationData.amount = Math.abs(cleanDonationData.amount)
      }
      
      if (cleanDonationData.amount > VALIDATION_RULES.AMOUNT.MAX) {
        return {
          success: false,
          error: `Amount cannot exceed ₱${VALIDATION_RULES.AMOUNT.MAX.toLocaleString('en-PH')}`,
          validationErrors: [`Amount cannot exceed ₱${VALIDATION_RULES.AMOUNT.MAX.toLocaleString('en-PH')}`]
        }
      }
      
      cleanDonationData.amount = Math.round(cleanDonationData.amount * 100) / 100
      
      console.log('📦 Clean donation data:', cleanDonationData)
      
      const { data, error } = await supabase
        .from('donations')
        .insert([cleanDonationData])
        .select()
        .single()

      if (error) {
        return handleSupabaseError(error, 'create donation')
      }

      console.log('✅ Donation created successfully')
      return { 
        success: true, 
        data: data, 
        message: 'Donation recorded successfully! Thank you for your generosity!' 
      }
    } catch (error) {
      return handleSupabaseError(error, 'create donation')
    }
  },

  async getDonationStats() {
    try {
      const { data: donations, error } = await supabase
        .from('donations')
        .select('amount, donation_date, donor_name')

      if (error) {
        return handleSupabaseError(error, 'fetch donation stats')
      }

      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000))

      const totalAmount = donations?.reduce((sum, donation) => sum + parseFloat(donation.amount || 0), 0) || 0
      const recentDonations = donations?.filter(d => new Date(d.donation_date) >= thirtyDaysAgo) || []
      const recentAmount = recentDonations.reduce((sum, donation) => sum + parseFloat(donation.amount || 0), 0)
      
      const anonymousDonations = donations?.filter(d => !d.donor_name || d.donor_name.trim() === '') || []

      const stats = {
        totalAmount,
        totalCount: donations?.length || 0,
        recentAmount,
        recentCount: recentDonations.length,
        averageAmount: donations?.length > 0 ? totalAmount / donations.length : 0,
        anonymousCount: anonymousDonations.length
      }

      return { success: true, data: stats }
    } catch (error) {
      return handleSupabaseError(error, 'fetch donation stats')
    }
  },
  
  validateDonorName(name) {
    if (!name || name.trim().length === 0) {
      return { isValid: true, message: '' }
    }
    
    const trimmedName = name.trim()
    
    if (trimmedName.length < VALIDATION_RULES.DONOR_NAME.MIN_LENGTH) {
      return { 
        isValid: false, 
        message: `Name must be at least ${VALIDATION_RULES.DONOR_NAME.MIN_LENGTH} characters if provided` 
      }
    }
    
    if (trimmedName.length > VALIDATION_RULES.DONOR_NAME.MAX_LENGTH) {
      return { 
        isValid: false, 
        message: `Name cannot exceed ${VALIDATION_RULES.DONOR_NAME.MAX_LENGTH} characters` 
      }
    }
    
    if (VALIDATION_RULES.DONOR_NAME.SPECIAL_CHAR_REGEX.test(trimmedName)) {
      return { 
        isValid: false, 
        message: 'Special characters (!@#$%^&*()_+=[]{} etc.) and numbers are not allowed' 
      }
    }
    
    if (!VALIDATION_RULES.DONOR_NAME.PATTERN.test(trimmedName)) {
      return { 
        isValid: false, 
        message: 'Name can only contain letters, spaces, periods, apostrophes, and hyphens' 
      }
    }
    
    return { isValid: true, message: '' }
  },
  
  validateAmount(amount) {
    if (amount === '' || amount === null || amount === undefined) {
      return { isValid: false, message: 'Amount is required' }
    }
    
    const numAmount = parseFloat(amount)
    
    if (isNaN(numAmount)) {
      return { isValid: false, message: 'Please enter a valid number' }
    }
    
    if (numAmount < 0) {
      return { isValid: false, message: 'Negative amounts are not allowed' }
    }
    
    if (numAmount < VALIDATION_RULES.AMOUNT.MIN) {
      return { 
        isValid: false, 
        message: `Amount must be at least ₱${VALIDATION_RULES.AMOUNT.MIN}` 
      }
    }
    
    if (numAmount > VALIDATION_RULES.AMOUNT.MAX) {
      return { 
        isValid: false, 
        message: `Amount cannot exceed ₱${VALIDATION_RULES.AMOUNT.MAX.toLocaleString('en-PH')}` 
      }
    }
    
    return { isValid: true, message: '' }
  },
  
  cleanDonorName(name) {
    if (!name || name.trim().length === 0) return ''
    
    const cleaned = name.replace(/[!@#$%^&*()_+=\[\]{};:"\\|,<>\/?~`0-9]/g, '')
    
    return cleaned.trim().substring(0, VALIDATION_RULES.DONOR_NAME.MAX_LENGTH)
  },
  
  cleanAmount(amount) {
    if (amount === '' || amount === null || amount === undefined) return ''
    
    const numAmount = parseFloat(amount)
    
    if (isNaN(numAmount)) return ''
    
    let positiveAmount = Math.abs(numAmount)
    
    if (positiveAmount > VALIDATION_RULES.AMOUNT.MAX) {
      positiveAmount = VALIDATION_RULES.AMOUNT.MAX
    }
    
    return Math.round(positiveAmount * 100) / 100
  }
}

export default donationService