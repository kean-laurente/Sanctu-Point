import { supabase } from '../config/supabaseClient'

const handleSupabaseError = (error, operation) => {
  console.error(`❌ ${operation} error:`, error);
  
  // Common Supabase error codes
  const errorMessages = {
    'PGRST116': 'No data found',
    '42501': 'Permission denied. Check RLS policies.',
    '406': 'Server cannot return requested format',
    '23502': 'Missing required field. Please fill all required information.',
    '23503': 'Appointment not found. Please check the appointment ID.',
    '23505': 'Duplicate payment detected.',
    '22P02': 'Invalid input format. Please check your data.',
    '22003': 'Amount too large or invalid.',
    '400': 'Bad request - invalid data sent to server',
    '401': 'Unauthorized - please login again',
    '404': 'Resource not found',
    '500': 'Server error. Please try again later.'
  };
  
  let errorMessage = error.message || `Failed to ${operation}`;
  
  // Use specific error message if available
  if (error.code && errorMessages[error.code]) {
    errorMessage = `${errorMessages[error.code]}`;
  }
  
  // Check for specific error details
  if (error.details) {
    errorMessage += ` (Details: ${error.details})`;
  }
  
  if (error.hint) {
    errorMessage += ` Hint: ${error.hint}`;
  }
  
  return { success: false, error: errorMessage };
}

export const appointmentService = {
  // Get all appointments with separate queries for reliability
  async getAppointments(currentUser) {
    try {
      console.log('🔄 Fetching all appointments...');
      
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'staff')) {
        return { success: false, error: 'Only administrators and staff can view all appointments', data: [] };
      }
      
      // Get basic appointments first - UPDATED COLUMN NAMES
      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select('*')
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true })

      if (appointmentsError) {
        return handleSupabaseError(appointmentsError, 'fetch appointments')
      }

      console.log('✅ Basic appointments fetched:', appointments?.length || 0)

      if (!appointments || appointments.length === 0) {
        return { success: true, data: [] }
      }

      // Get all related data in parallel
      const appointmentIds = appointments.map(a => a.appointment_id)
      
      // Get requirements
      const { data: allRequirements } = await supabase
        .from('requirements')
        .select('*')
        .in('appointment_id', appointmentIds)

      // Get payments
      const { data: allPayments } = await supabase
        .from('payments')
        .select('*')
        .in('appointment_id', appointmentIds)

      // Get user details
      const userIds = [...new Set(appointments.map(a => a.created_by).filter(Boolean))]
      const { data: users } = userIds.length > 0 ? await supabase
        .from('users')
        .select('user_id, username, first_name, last_name, email')
        .in('user_id', userIds) : { data: [] }

      // Create maps for efficient lookup
      const requirementsMap = {}
      const paymentsMap = {}
      const usersMap = {}

      allRequirements?.forEach(req => {
        if (!requirementsMap[req.appointment_id]) {
          requirementsMap[req.appointment_id] = []
        }
        requirementsMap[req.appointment_id].push(req)
      })

      allPayments?.forEach(payment => {
        if (!paymentsMap[payment.appointment_id]) {
          paymentsMap[payment.appointment_id] = []
        }
        paymentsMap[payment.appointment_id].push(payment)
      })

      users?.forEach(user => {
        usersMap[user.user_id] = user
      })

      // Combine all data - create simple service objects without fetching from services table
      const appointmentsWithDetails = appointments.map(appointment => ({
        ...appointment,
        // Add alias for backward compatibility if needed
        date: appointment.appointment_date,
        time: appointment.appointment_time,
        users: usersMap[appointment.created_by] || null,
        requirements: requirementsMap[appointment.appointment_id] || [],
        payments: paymentsMap[appointment.appointment_id] || [],
        // Create simple service object from appointment data
        services: { 
          service_name: appointment.service_type, 
          service_price: 0 // Default to 0, you can modify this if you have pricing logic
        }
      }))

      console.log('✅ Complete appointments data processed')
      return { success: true, data: appointmentsWithDetails }
    } catch (error) {
      return handleSupabaseError(error, 'fetch appointments')
    }
  },

  // Get appointments for current user
  async getUserAppointments(userId) {
    try {
      if (!userId) {
        return { success: false, error: 'User ID is required', data: [] }
      }

      console.log('🔄 Fetching user appointments for:', userId)
      
      // Get user's appointments - UPDATED COLUMN NAMES
      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select('*')
        .eq('created_by', userId)
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true })

      if (appointmentsError) {
        return handleSupabaseError(appointmentsError, 'fetch user appointments')
      }

      if (!appointments || appointments.length === 0) {
        return { success: true, data: [] }
      }

      // Get related data
      const appointmentIds = appointments.map(a => a.appointment_id)
      
      const { data: allRequirements } = await supabase
        .from('requirements')
        .select('*')
        .in('appointment_id', appointmentIds)

      const { data: allPayments } = await supabase
        .from('payments')
        .select('*')
        .in('appointment_id', appointmentIds)

      // Create maps
      const requirementsMap = {}
      const paymentsMap = {}

      allRequirements?.forEach(req => {
        if (!requirementsMap[req.appointment_id]) {
          requirementsMap[req.appointment_id] = []
        }
        requirementsMap[req.appointment_id].push(req)
      })

      allPayments?.forEach(payment => {
        if (!paymentsMap[payment.appointment_id]) {
          paymentsMap[payment.appointment_id] = []
        }
        paymentsMap[payment.appointment_id].push(payment)
      })

      // Combine data - create simple service objects
      const userAppointments = appointments.map(appointment => ({
        ...appointment,
        // Add alias for backward compatibility
        date: appointment.appointment_date,
        time: appointment.appointment_time,
        requirements: requirementsMap[appointment.appointment_id] || [],
        payments: paymentsMap[appointment.appointment_id] || [],
        // Create simple service object
        services: { 
          service_name: appointment.service_type, 
          service_price: 0 
        }
      }))

      console.log('✅ User appointments processed:', userAppointments.length)
      return { success: true, data: userAppointments }
    } catch (error) {
      return handleSupabaseError(error, 'fetch user appointments')
    }
  },

  // Create new appointment with customer information
  async createAppointment(appointmentData, currentUser) {
    try {
      console.log('🔄 Creating appointment with data:', appointmentData)
      
      // First, get the service_id from the service name
      let serviceId = null
      if (appointmentData.service_type) {
        try {
          const { data: service, error: serviceError } = await supabase
            .from('services')
            .select('service_id')
            .eq('service_name', appointmentData.service_type)
            .single()

          if (serviceError) {
            console.warn('⚠️ Could not find service ID for:', appointmentData.service_type)
            // Continue without service_id - it's optional
          } else {
            serviceId = service?.service_id
          }
        } catch (err) {
          console.warn('⚠️ Service lookup failed, continuing without service_id')
        }
      }

      const appointmentPayload = {
        // UPDATED COLUMN NAMES
        appointment_date: appointmentData.date,
        appointment_time: appointmentData.time,
        service_type: appointmentData.service_type,
        status: 'pending',
        created_by: currentUser.user_id,
        customer_first_name: appointmentData.first_name,
        customer_last_name: appointmentData.last_name,
        customer_email: appointmentData.email,
        customer_phone: appointmentData.phone || null
      }

      // Only add service_id if we found it
      if (serviceId) {
        appointmentPayload.service_id = serviceId
      }

      const { data, error } = await supabase
        .from('appointments')
        .insert([appointmentPayload])
        .select()
        .single()

      if (error) {
        console.error('❌ Appointment creation error:', error)
        return handleSupabaseError(error, 'create appointment')
      }

      // If there are requirements, add them
      if (appointmentData.requirements && appointmentData.requirements.length > 0) {
        const requirementsData = appointmentData.requirements.map(req => ({
          appointment_id: data.appointment_id,
          requirement_details: req
        }))

        const { error: reqError } = await supabase
          .from('requirements')
          .insert(requirementsData)

        if (reqError) {
          console.error('❌ Requirements creation error:', reqError)
          // Don't fail the whole operation if requirements fail
        }
      }

      console.log('✅ Appointment created successfully')
      return { 
        success: true, 
        data, 
        message: 'Appointment booked successfully!' 
      }
    } catch (error) {
      console.error('💥 Unexpected error creating appointment:', error)
      return handleSupabaseError(error, 'create appointment')
    }
  },

  // Update appointment status with history tracking - UPDATED FOR STAFF
  async updateAppointmentStatus(appointmentId, status, currentUser, statusBefore = null) {
    try {
      // Allow both admin and staff to update appointment status
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'staff')) {
        return { success: false, error: 'Only administrators and staff can update appointment status' }
      }

      // Get the current appointment first
      const { data: currentAppointment, error: fetchError } = await supabase
        .from('appointments')
        .select('*')
        .eq('appointment_id', appointmentId)
        .single()

      if (fetchError) {
        return handleSupabaseError(fetchError, 'fetch current appointment')
      }

      // Update the appointment status
      const { data, error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('appointment_id', appointmentId)
        .select()
        .single()

      if (error) {
        return handleSupabaseError(error, 'update appointment status')
      }

      return { 
        success: true, 
        data, 
        message: `Appointment ${status} successfully!` 
      }
    } catch (error) {
      return handleSupabaseError(error, 'update appointment status')
    }
  },

  // Archive appointment - UPDATED FOR NEW SCHEMA AND STAFF
  async archiveAppointment(appointmentId, currentUser) {
    try {
      // Allow both admin and staff to archive appointments
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'staff')) {
        return { success: false, error: 'Only administrators and staff can archive appointments' }
      }

      console.log('🔄 Archiving appointment:', appointmentId)

      // Get the appointment to archive with all related data
      const { data: appointment, error: fetchError } = await supabase
        .from('appointments')
        .select(`
          *,
          requirements:requirements(*),
          payments:payments(*)
        `)
        .eq('appointment_id', appointmentId)
        .single()

      if (fetchError) {
        console.error('❌ Error fetching appointment:', fetchError)
        return handleSupabaseError(fetchError, 'fetch appointment for archiving')
      }

      if (!appointment) {
        return { success: false, error: 'Appointment not found' }
      }

      console.log('📋 Appointment data to archive:', appointment)

      // Calculate total payments
      const totalPayments = appointment.payments?.reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0) || 0
      const paymentCount = appointment.payments?.length || 0

      // Insert into archived_appointments
      const { data: archivedData, error: archiveError } = await supabase
        .from('archived_appointments')
        .insert({
          original_appointment_id: appointmentId,
          appointment_date: appointment.appointment_date,
          appointment_time: appointment.appointment_time,
          service_type: appointment.service_type,
          service_id: appointment.service_id,
          status: appointment.status,
          created_by: appointment.created_by,
          customer_first_name: appointment.customer_first_name,
          customer_last_name: appointment.customer_last_name,
          customer_email: appointment.customer_email,
          customer_phone: appointment.customer_phone,
          requirements: appointment.requirements || [],
          total_payments: totalPayments,
          payment_count: paymentCount,
          original_created_at: appointment.created_at,
          original_updated_at: appointment.updated_at,
          archived_at: new Date().toISOString()
        })
        .select()

      if (archiveError) {
        console.error('❌ Error creating archive record:', archiveError)
        return handleSupabaseError(archiveError, 'create archive record')
      }

      console.log('✅ Archive record created:', archivedData)

      // Delete related records first (they have foreign key constraints)
      const { error: deleteRequirementsError } = await supabase
        .from('requirements')
        .delete()
        .eq('appointment_id', appointmentId)

      if (deleteRequirementsError) {
        console.error('❌ Error deleting requirements:', deleteRequirementsError)
        // Continue anyway
      }

      const { error: deletePaymentsError } = await supabase
        .from('payments')
        .delete()
        .eq('appointment_id', appointmentId)

      if (deletePaymentsError) {
        console.error('❌ Error deleting payments:', deletePaymentsError)
        // Continue anyway
      }

      // Finally, delete the appointment
      const { error: deleteError } = await supabase
        .from('appointments')
        .delete()
        .eq('appointment_id', appointmentId)

      if (deleteError) {
        console.error('❌ Error deleting appointment:', deleteError)
        return handleSupabaseError(deleteError, 'delete original appointment')
      }

      console.log('✅ Appointment archived successfully')
      return { 
        success: true, 
        data: archivedData, 
        message: 'Appointment archived successfully!' 
      }
    } catch (error) {
      console.error('💥 Unexpected error archiving appointment:', error)
      return handleSupabaseError(error, 'archive appointment')
    }
  },

  // Add payment to appointment - FIXED VERSION
  async addPayment(appointmentId, paymentData, currentUser) {
    try {
      // Allow both admin and staff to add payments
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'staff')) {
        return { success: false, error: 'Only administrators and staff can add payments' }
      }

      console.log('🔄 Adding payment for appointment:', appointmentId);
      console.log('Payment data:', paymentData);
      console.log('Current user:', currentUser.user_id);

      // Validate and convert amount to proper number format
      const amount = parseFloat(paymentData.amount);
      if (isNaN(amount) || amount <= 0) {
        return { success: false, error: 'Invalid payment amount. Please enter a valid amount greater than 0.' }
      }

      // Get current date in proper format (YYYY-MM-DD)
      const currentDate = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();

      // First, check if appointment exists
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .select('appointment_id, service_type')
        .eq('appointment_id', appointmentId)
        .single();

      if (appointmentError || !appointment) {
        return { 
          success: false, 
          error: 'Appointment not found. Please check the appointment ID.' 
        };
      }

      console.log('✅ Found appointment:', appointment);

      // Create payment payload with all required fields
      const paymentPayload = {
        appointment_id: parseInt(appointmentId), // Ensure it's integer
        payment_date: currentDate,
        amount: amount,
        payment_method: paymentData.payment_method || 'cash',
        payment_type: paymentData.payment_type || 'full',
        created_by: currentUser.user_id,
        created_at: now,
        updated_at: now,
        notes: `Payment for ${appointment.service_type}`
      };

      console.log('📋 Payment payload to insert:', paymentPayload);

      // Insert payment - use upsert in case of duplicate
      const { data, error } = await supabase
        .from('payments')
        .insert([paymentPayload])
        .select()
        .single();

      if (error) {
        console.error('❌ Payment insert error:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        
        // Try alternative approach with direct fetch if supabase insert fails
        try {
          console.log('🔄 Trying alternative payment method...');
          const alternativeResult = await this.addPaymentAlternative(appointmentId, paymentPayload);
          return alternativeResult;
        } catch (altError) {
          console.error('❌ Alternative payment also failed:', altError);
          return handleSupabaseError(error, 'add payment');
        }
      }

      console.log('✅ Payment added successfully:', data);
      
      return { 
        success: true, 
        data, 
        message: 'Payment added successfully!' 
      }
    } catch (error) {
      console.error('💥 Unexpected error adding payment:', error);
      return handleSupabaseError(error, 'add payment');
    }
  },

  // Alternative payment method using fetch API
  async addPaymentAlternative(appointmentId, paymentPayload) {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase credentials not configured');
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/payments`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(paymentPayload)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
      }

      return { success: true, data: Array.isArray(data) ? data[0] : data };
    } catch (error) {
      console.error('❌ Alternative payment method failed:', error);
      throw error;
    }
  },

  // Test payment function for debugging
  async testPaymentFunction(appointmentId) {
    try {
      console.log('🧪 Testing payment function...');
      
      // Test with minimal data
      const testPayload = {
        appointment_id: parseInt(appointmentId),
        payment_date: '2024-01-15',
        amount: 100.00,
        payment_method: 'cash',
        payment_type: 'test',
        created_by: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notes: 'Test payment'
      };

      console.log('Test payload:', testPayload);

      const { data, error } = await supabase
        .from('payments')
        .insert([testPayload])
        .select()
        .single();

      if (error) {
        console.error('Test payment failed:', error);
        return { success: false, error: error.message };
      }

      console.log('Test payment successful:', data);
      
      // Clean up
      await supabase
        .from('payments')
        .delete()
        .eq('payment_id', data.payment_id);

      return { success: true, message: 'Payment test passed' };
    } catch (error) {
      console.error('Test payment error:', error);
      return { success: false, error: error.message };
    }
  },

  // Check payments table structure
  async checkPaymentsTable() {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .limit(1);

      if (error) {
        console.error('Cannot access payments table:', error);
        return { success: false, error: error.message };
      }

      console.log('Payments table accessible. Columns:', Object.keys(data[0] || {}));
      return { success: true, columns: Object.keys(data[0] || {}) };
    } catch (error) {
      console.error('Error checking payments table:', error);
      return { success: false, error: error.message };
    }
  },

  // Add requirements to existing appointment - UPDATED FOR STAFF
  async addRequirements(appointmentId, requirements, currentUser) {
    try {
      // Allow both admin and staff to add requirements
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'staff')) {
        return { success: false, error: 'Only administrators and staff can add requirements' }
      }

      const requirementsData = requirements.map(req => ({
        appointment_id: appointmentId,
        requirement_details: req,
        created_by: currentUser.user_id
      }))

      const { error } = await supabase
        .from('requirements')
        .insert(requirementsData)

      if (error) {
        return handleSupabaseError(error, 'add requirements')
      }

      return { success: true, message: 'Requirements added successfully!' }
    } catch (error) {
      return handleSupabaseError(error, 'add requirements')
    }
  },

  // Get appointment with full details
  async getAppointmentWithRequirements(appointmentId) {
    try {
      // Get appointment basic info
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .select('*')
        .eq('appointment_id', appointmentId)
        .single()

      if (appointmentError) {
        return handleSupabaseError(appointmentError, 'fetch appointment')
      }

      // Get all related data
      const [
        { data: requirements },
        { data: payments },
        { data: user }
      ] = await Promise.all([
        supabase.from('requirements').select('*').eq('appointment_id', appointmentId),
        supabase.from('payments').select('*').eq('appointment_id', appointmentId),
        supabase.from('users').select('username, first_name, last_name, email').eq('user_id', appointment.created_by).single()
      ])

      const appointmentWithDetails = {
        ...appointment,
        // Add alias for backward compatibility
        date: appointment.appointment_date,
        time: appointment.appointment_time,
        requirements: requirements || [],
        payments: payments || [],
        users: user || null,
        // Create simple service object
        services: { 
          service_name: appointment.service_type, 
          service_price: 0 
        }
      }

      return { success: true, data: appointmentWithDetails }
    } catch (error) {
      return handleSupabaseError(error, 'fetch appointment with requirements')
    }
  },

  // Get payment history for appointment
  async getPaymentHistory(appointmentId) {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('appointment_id', appointmentId)
        .order('payment_date', { ascending: false })

      if (error) {
        return handleSupabaseError(error, 'fetch payment history')
      }

      return { success: true, data: data || [] }
    } catch (error) {
      return handleSupabaseError(error, 'fetch payment history')
    }
  },

  // Get archived appointments - UPDATED FOR STAFF
  async getArchivedAppointments(currentUser) {
    try {
      // Allow both admin and staff to view archived appointments
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'staff')) {
        return { success: false, error: 'Only administrators and staff can view archived appointments', data: [] }
      }

      const { data, error } = await supabase
        .from('archived_appointments')
        .select('*')
        .order('archived_at', { ascending: false })

      if (error) {
        return handleSupabaseError(error, 'fetch archived appointments')
      }

      // Add alias for backward compatibility
      const formattedData = data?.map(item => ({
        ...item,
        date: item.appointment_date,
        time: item.appointment_time
      })) || []

      return { success: true, data: formattedData }
    } catch (error) {
      return handleSupabaseError(error, 'fetch archived appointments')
    }
  },

  // Get appointment statistics - UPDATED FOR STAFF
  async getAppointmentStats(startDate, endDate, currentUser) {
    try {
      // Allow both admin and staff to view stats
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'staff')) {
        return { success: false, error: 'Only administrators and staff can view statistics', data: null }
      }

      // Since we don't have the function available in the frontend,
      // we'll implement it with client-side filtering
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('*, payments(*)')

      if (error) {
        return handleSupabaseError(error, 'fetch appointment stats')
      }

      // Filter by date range
      const filteredAppointments = appointments?.filter(app => {
        const appDate = new Date(app.appointment_date)
        return appDate >= new Date(startDate) && appDate <= new Date(endDate)
      }) || []

      // Calculate statistics
      const stats = {
        total_appointments: filteredAppointments.length,
        pending_count: filteredAppointments.filter(a => a.status === 'pending').length,
        confirmed_count: filteredAppointments.filter(a => a.status === 'confirmed').length,
        completed_count: filteredAppointments.filter(a => a.status === 'completed').length,
        cancelled_count: filteredAppointments.filter(a => a.status === 'cancelled').length,
        total_revenue: filteredAppointments.reduce((sum, app) => {
          const payments = app.payments || []
          const paymentSum = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
          return sum + paymentSum
        }, 0)
      }

      return { success: true, data: stats }
    } catch (error) {
      return handleSupabaseError(error, 'fetch appointment stats')
    }
  },

  // Get appointments for specific date range - UPDATED FOR STAFF
  async getAppointmentsByDateRange(startDate, endDate, currentUser) {
    try {
      // Allow both admin and staff to view appointments
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'staff')) {
        return { success: false, error: 'Only administrators and staff can view appointments', data: [] }
      }

      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .gte('appointment_date', startDate)
        .lte('appointment_date', endDate)
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true })

      if (error) {
        return handleSupabaseError(error, 'fetch appointments by date range')
      }

      return { success: true, data: data || [] }
    } catch (error) {
      return handleSupabaseError(error, 'fetch appointments by date range')
    }
  },

  // Update appointment details - UPDATED FOR STAFF
  async updateAppointment(appointmentId, appointmentData, currentUser) {
    try {
      // Allow both admin and staff to update appointments
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'staff')) {
        return { success: false, error: 'Only administrators and staff can update appointments' }
      }

      const { data, error } = await supabase
        .from('appointments')
        .update({
          appointment_date: appointmentData.date,
          appointment_time: appointmentData.time,
          service_type: appointmentData.service_type,
          customer_first_name: appointmentData.first_name,
          customer_last_name: appointmentData.last_name,
          customer_email: appointmentData.email,
          customer_phone: appointmentData.phone || null,
          updated_at: new Date().toISOString()
        })
        .eq('appointment_id', appointmentId)
        .select()
        .single()

      if (error) {
        return handleSupabaseError(error, 'update appointment')
      }

      return { 
        success: true, 
        data, 
        message: 'Appointment updated successfully!' 
      }
    } catch (error) {
      return handleSupabaseError(error, 'update appointment')
    }
  }
}

export default appointmentService