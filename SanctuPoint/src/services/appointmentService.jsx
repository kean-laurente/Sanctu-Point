import { supabase } from '../config/supabaseClient'

const handleSupabaseError = (error, operation) => {
  console.error(`❌ ${operation} error:`, error);
  
  const errorMessages = {
    'PGRST116': 'No data found',
    '42501': 'Permission denied',
    '23502': 'Missing required field',
    '23505': 'Duplicate entry',
    '22P02': 'Invalid input format',
    '23503': 'Foreign key violation',
    '23514': 'Check violation',
  };
  
  let errorMessage = error.message || `Failed to ${operation}`;
  
  if (error.code && errorMessages[error.code]) {
    errorMessage = `${errorMessages[error.code]}`;
  }
  
  return { success: false, error: errorMessage };
}

const calculateOfferingTotal = (appointmentProducts) => {
  return appointmentProducts?.reduce(
    (sum, item) => sum + (item.total_price || 0), 
    0
  ) || 0;
};

const combineAppointmentData = (appointment, requirementsMap, paymentsMap) => ({
  ...appointment,
  date: appointment.appointment_date,
  time: appointment.appointment_time,
  requirements: requirementsMap[appointment.appointment_id] || [],
  payments: paymentsMap[appointment.appointment_id] || [],
  service_price: appointment.services?.price || 0,
  service_duration: appointment.service_duration || 60,
  offering_total: calculateOfferingTotal(appointment.appointment_products)
});

const fetchRequirementsAndPayments = async (appointmentIds) => {
  const [requirementsResult, paymentsResult] = await Promise.all([
    supabase
      .from('requirements')
      .select('*')
      .in('appointment_id', appointmentIds)
      .order('is_required', { ascending: false }) 
      .order('requirement_id', { ascending: true }),
    supabase
      .from('payments')
      .select('*')
      .in('appointment_id', appointmentIds)
  ]);

  const requirementsMap = {};
  const paymentsMap = {};

  requirementsResult.data?.forEach(req => {
    if (!requirementsMap[req.appointment_id]) {
      requirementsMap[req.appointment_id] = [];
    }
    requirementsMap[req.appointment_id].push({
      ...req,
      is_checked: req.is_checked || false
    });
  });

  paymentsResult.data?.forEach(payment => {
    if (!paymentsMap[payment.appointment_id]) {
      paymentsMap[payment.appointment_id] = [];
    }
    paymentsMap[payment.appointment_id].push(payment);
  });

  return { requirementsMap, paymentsMap };
};

const generateReceiptNumber = () => {
  const now = new Date();
  return 'RCPT-' + 
    now.getFullYear().toString().slice(-2) +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0') + '-' +
    Math.floor(Math.random() * 10000).toString().padStart(4, '0');
};

const validateDateInAdvance = (date) => {
  const appointmentDate = new Date(date);
  const today = new Date();
  
  appointmentDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  
  return appointmentDate > today; 
};

const checkTimeConflicts = (existingAppointments, slotStartMinutes, slotEndMinutes, bufferMinutes = 60, allowConcurrent = false, serviceType = null) => {
  if (!existingAppointments || existingAppointments.length === 0) {
    return { hasConflict: false };
  }
  
  for (const appointment of existingAppointments) {
    const [appHours, appMinutes] = appointment.appointment_time.split(':').map(Number);
    const appStartMinutes = appHours * 60 + appMinutes;
    const appDuration = appointment.service_duration || 60;
    const appEndMinutes = appStartMinutes + appDuration;
    const bufferStartMinutes = appEndMinutes; 
    const bufferEndMinutes = appEndMinutes + bufferMinutes;
    
    let hasConflict = false;
    
    if (allowConcurrent && serviceType) {
      if (appointment.service_type === serviceType) {
        const violatesBuffer = 
          (slotStartMinutes >= appEndMinutes && slotStartMinutes < bufferEndMinutes) || 
          (slotEndMinutes > appEndMinutes && slotEndMinutes <= bufferEndMinutes);        
        
        hasConflict = violatesBuffer;
      } else {
        const overlaps = 
          (slotStartMinutes >= appStartMinutes && slotStartMinutes < appEndMinutes) ||  
          (slotEndMinutes > appStartMinutes && slotEndMinutes <= appEndMinutes) ||      
          (slotStartMinutes <= appStartMinutes && slotEndMinutes >= appEndMinutes);     
        
        const startsDuringBuffer = slotStartMinutes >= appEndMinutes && slotStartMinutes < bufferEndMinutes;
        const endsDuringBuffer = slotEndMinutes > appEndMinutes && slotEndMinutes <= bufferEndMinutes;
        
        const startsBeforeEndsDuringOrAfter = 
          (slotStartMinutes < appStartMinutes && slotEndMinutes > appStartMinutes);
        
        hasConflict = overlaps || startsDuringBuffer || endsDuringBuffer || startsBeforeEndsDuringOrAfter;
      }
    } else {
      const overlaps = 
        (slotStartMinutes >= appStartMinutes && slotStartMinutes < appEndMinutes) ||   
        (slotEndMinutes > appStartMinutes && slotEndMinutes <= appEndMinutes) ||      
        (slotStartMinutes <= appStartMinutes && slotEndMinutes >= appEndMinutes);    
      
      const startsDuringBuffer = slotStartMinutes >= appEndMinutes && slotStartMinutes < bufferEndMinutes;
      const endsDuringBuffer = slotEndMinutes > appEndMinutes && slotEndMinutes <= bufferEndMinutes;
      
      const startsBeforeEndsDuringOrAfter = 
        (slotStartMinutes < appStartMinutes && slotEndMinutes > appStartMinutes);
      
      hasConflict = overlaps || startsDuringBuffer || endsDuringBuffer || startsBeforeEndsDuringOrAfter;
    }
    
    if (hasConflict) {
      const nextAvailableMinutes = bufferEndMinutes; 
      const nextAvailableHour = Math.floor(nextAvailableMinutes / 60);
      const nextAvailableMinute = nextAvailableMinutes % 60;
      const displayHour = nextAvailableHour % 12 || 12;
      const period = nextAvailableHour >= 12 ? 'PM' : 'AM';
      
      const conflictReason = (() => {
        if (slotStartMinutes <= appStartMinutes && slotEndMinutes >= appEndMinutes) {
          return "completely overlaps with";
        } else if (slotStartMinutes < appStartMinutes && slotEndMinutes > appStartMinutes) {
          return "starts before and overlaps with";
        } else if (slotStartMinutes >= appStartMinutes && slotStartMinutes < appEndMinutes) {
          return "starts during";
        } else if (slotStartMinutes >= appEndMinutes && slotStartMinutes < bufferEndMinutes) {
          return "starts during buffer period after";
        } else if (slotEndMinutes > appEndMinutes && slotEndMinutes <= bufferEndMinutes) {
          return "ends during buffer period after";
        }
        return "conflicts with";
      })();
      
      return {
        hasConflict: true,
        conflictWith: appointment.service_type || 'appointment',
        nextAvailableTime: `${displayHour}:${nextAvailableMinute.toString().padStart(2, '0')} ${period}`,
        message: `Time slot ${conflictReason} an existing ${appointment.service_type || 'appointment'}. The next available time is ${nextAvailableHour}:${nextAvailableMinute.toString().padStart(2, '0')} ${period}`
      };
    }
  }
  
  return { hasConflict: false };
};

export const appointmentService = {
  async getAppointments(currentUser) {
    try {
      console.log('🔄 Fetching appointments...');
      
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'staff')) {
        return { 
          success: false, 
          error: 'Only administrators and staff can view all appointments', 
          data: [] 
        };
      }
      
      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          *,
          services:service_id(service_name, price, duration_minutes, allow_concurrent),
          users:created_by(first_name, last_name, email),
          appointment_products:appointment_products(
            *,
            products:product_id(product_name, description)
          ),
          requirements:requirements(*)
        `)
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true })

      if (appointmentsError) {
        return handleSupabaseError(appointmentsError, 'fetch appointments')
      }

      console.log('✅ Appointments fetched:', appointments?.length || 0);
      console.log('✅ Sample appointment with requirements:', appointments?.[0]?.requirements || 'No requirements');
      
      const appointmentsWithDetails = appointments?.map(appointment => {
        const requirements = (appointment.requirements || []).map(req => ({
          requirement_id: req.requirement_id,
          appointment_id: req.appointment_id,
          requirement_details: req.requirement_details,
          is_required: req.is_required || false,
          is_checked: req.is_checked || false,
          is_predefined: req.is_predefined || false,
          created_at: req.created_at
        }));
        
        return {
          ...appointment,
          date: appointment.appointment_date,
          time: appointment.appointment_time,
          requirements: requirements,
          payments: appointment.payments || [],
          service_price: appointment.services?.price || 0,
          service_duration: appointment.service_duration || 60,
          offering_total: calculateOfferingTotal(appointment.appointment_products)
        };
      }) || [];

      return { success: true, data: appointmentsWithDetails }
    } catch (error) {
      return handleSupabaseError(error, 'fetch appointments')
    }
  },

  async getAppointmentWithProducts(appointmentId) {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          requirements:requirements(*),
          payments:payments(*),
          appointment_products:appointment_products(
            *,
            products:product_id(product_name, description, category)
          ),
          services:service_id(service_name, price, duration_minutes, allow_concurrent),
          users:created_by(first_name, last_name)
        `)
        .eq('appointment_id', appointmentId)
        .single()

      if (error) {
        return handleSupabaseError(error, 'fetch appointment with products')
      }

      return { 
        success: true, 
        data: { 
          ...data, 
          offering_total: calculateOfferingTotal(data.appointment_products)
        } 
      }
    } catch (error) {
      return handleSupabaseError(error, 'fetch appointment with products')
    }
  },

  async getUserAppointments(userId) {
    try {
      if (!userId) {
        return { success: false, error: 'User ID is required', data: [] }
      }

      console.log('🔄 Fetching user appointments for:', userId);
      
      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          *,
          services:service_id(service_name, price, duration_minutes, allow_concurrent),
          appointment_products:appointment_products(
            *,
            products:product_id(product_name)
          ),
          requirements:requirements(*)
        `)
        .eq('created_by', userId)
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true })

      if (appointmentsError) {
        return handleSupabaseError(appointmentsError, 'fetch user appointments')
      }

      console.log('✅ User appointments raw data:', appointments?.length || 0);
      
      const userAppointments = appointments?.map(appointment => {
        const requirements = (appointment.requirements || []).map(req => ({
          requirement_id: req.requirement_id,
          appointment_id: req.appointment_id,
          requirement_details: req.requirement_details,
          is_required: req.is_required || false,
          is_checked: req.is_checked || false,
          is_predefined: req.is_predefined || false,
          created_at: req.created_at
        }));
        
        return {
          ...appointment,
          date: appointment.appointment_date,
          time: appointment.appointment_time,
          requirements: requirements,
          payments: appointment.payments || [],
          service_price: appointment.services?.price || 0,
          service_duration: appointment.service_duration || 60,
          offering_total: calculateOfferingTotal(appointment.appointment_products)
        };
      }) || [];

      console.log('✅ User appointments processed:', userAppointments.length);
      return { success: true, data: userAppointments }
    } catch (error) {
      return handleSupabaseError(error, 'fetch user appointments')
    }
  },

  async validateAppointment(appointmentData, serviceId) {
    try {
      if (!validateDateInAdvance(appointmentData.date)) {
        return {
          success: false,
          error: 'Appointments must be booked at least 1 day in advance. Please select a future date.'
        };
      }

      const { data: service, error: serviceError } = await supabase
        .from('services')
        .select(`
          duration_minutes,
          allowed_days,
          allow_concurrent,
          requires_multiple_days,
          consecutive_days
        `)
        .eq('service_id', serviceId)
        .single();

      if (serviceError) {
        return { success: false, error: 'Service not found or error fetching service details' };
      }

      if (service.allowed_days && service.allowed_days.length > 0) {
        const appointmentDate = new Date(appointmentData.date);
        const dayOfWeek = appointmentDate.getDay();
        
        if (!service.allowed_days.includes(dayOfWeek)) {
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          return {
            success: false,
            error: `This service is not available on ${dayNames[dayOfWeek]}. Please choose another date.`
          };
        }
      }

      const [hours, minutes] = appointmentData.time.split(':').map(Number);
      const appointmentStartMinutes = hours * 60 + minutes;
      const appointmentEndMinutes = appointmentStartMinutes + service.duration_minutes;
      
      const { data: dayAppointments } = await supabase
        .from('appointments')
        .select('appointment_time, service_duration, service_type')
        .eq('appointment_date', appointmentData.date)
        .in('status', ['pending', 'confirmed'])
        .order('appointment_time', { ascending: true });

      const conflictCheck = checkTimeConflicts(
        dayAppointments, 
        appointmentStartMinutes, 
        appointmentEndMinutes,
        60,
        service.allow_concurrent,
        appointmentData.service_type
      );

      if (!service.allow_concurrent && conflictCheck.hasConflict) {
        return {
          success: false,
          error: conflictCheck.message || `Time slot conflicts with an existing ${conflictCheck.conflictWith}. The next available time is ${conflictCheck.nextAvailableTime}.`
        };
      }

      if (service.requires_multiple_days && service.consecutive_days > 1) {
        const appointmentDate = new Date(appointmentData.date);
        for (let i = 0; i < service.consecutive_days; i++) {
          const currentDate = new Date(appointmentDate);
          currentDate.setDate(appointmentDate.getDate() + i);
          const dateStr = currentDate.toISOString().split('T')[0];
          const currentDayOfWeek = currentDate.getDay();
          
          if (service.allowed_days && !service.allowed_days.includes(currentDayOfWeek)) {
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            return {
              success: false,
              error: `Day ${i + 1} of this multi-day service falls on ${dayNames[currentDayOfWeek]} which is not available. Please choose a different start date.`
            };
          }
          
          const { data: dayConflicts } = await supabase
            .from('appointments')
            .select('appointment_time, service_duration, service_type')
            .eq('appointment_date', dateStr)
            .in('status', ['pending', 'confirmed']);
          
          const dayConflictCheck = checkTimeConflicts(
            dayConflicts,
            appointmentStartMinutes,
            appointmentEndMinutes,
            60,
            service.allow_concurrent
          );
          
          if (!service.allow_concurrent && dayConflictCheck.hasConflict) {
            return {
              success: false,
              error: dayConflictCheck.message || `Day ${i + 1} of this multi-day service conflicts with an existing appointment at ${dayConflictCheck.nextAvailableTime}.`
            };
          }
        }
      }

      return { success: true, service };
    } catch (error) {
      console.error('Validation error:', error);
      return { 
        success: false, 
        error: 'Error validating appointment details' 
      };
    }
  },

  async createAppointment(appointmentData, currentUser) {
    try {
      console.log('🔄 Creating appointment...', appointmentData);
      
      let serviceId = null;
      let servicePrice = 0;
      let serviceDuration = 60;
      let serviceAllowConcurrent = false;
      let predefinedRequirements = [];
      
      if (appointmentData.service_type) {
        const { data: service, error: serviceError } = await supabase
          .from('services')
          .select(`
            service_id, 
            price,
            duration_minutes,
            allow_concurrent,
            allowed_days,
            requires_multiple_days,
            consecutive_days,
            requirements:requirements(
              requirement_details,
              is_required
            )
          `)
          .eq('service_name', appointmentData.service_type)
          .single();
        
        if (serviceError || !service) {
          return { success: false, error: 'Service not found' };
        }
        
        serviceId = service.service_id;
        servicePrice = service.price || 0;
        serviceDuration = service.duration_minutes || 60;
        serviceAllowConcurrent = service.allow_concurrent || false;
        
        if (service.requirements?.length > 0) {
          predefinedRequirements = service.requirements.map(req => ({
            requirement_details: req.requirement_details,
            is_required: req.is_required,
            is_checked: false 
          }));
        }
      }

      const validation = await this.validateAppointment(appointmentData, serviceId);
      if (!validation.success) {
        return validation;
      }

      const amountPaid = parseFloat(appointmentData.amount_paid) || 0;
      if (amountPaid < servicePrice) {
        return {
          success: false,
          error: `Payment amount (₱${amountPaid.toFixed(2)}) is less than service fee (₱${servicePrice.toFixed(2)})`
        };
      }

      const changeAmount = Math.max(0, amountPaid - servicePrice);
      const receiptNumber = generateReceiptNumber();

      const appointmentPayload = {
        appointment_date: appointmentData.date,
        appointment_time: appointmentData.time,
        service_type: appointmentData.service_type,
        service_id: serviceId,
        status: 'confirmed',
        created_by: currentUser.user_id,
        customer_first_name: appointmentData.first_name,
        customer_last_name: appointmentData.last_name,
        customer_email: appointmentData.email,
        customer_phone: appointmentData.phone || null,
        payment_amount: servicePrice,
        amount_paid: amountPaid,
        change_amount: changeAmount,
        receipt_number: receiptNumber,
        payment_method: 'cash',
        payment_status: 'paid',
        offering_total: 0,
        service_duration: serviceDuration
      };

      console.log('📋 Appointment payload:', appointmentPayload);

      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .insert([appointmentPayload])
        .select()
        .single();

      if (appointmentError) {
        console.error('❌ Appointment creation error:', appointmentError);
        return handleSupabaseError(appointmentError, 'create appointment');
      }

      console.log('✅ Appointment created:', appointment.appointment_id);

      console.log('📝 Creating requirements with data:', {
        appointmentId: appointment.appointment_id,
        predefinedRequirements: predefinedRequirements,
        userRequirements: appointmentData.requirements || [],
        allRequirementsData: {
          total: appointmentData.requirements?.length || 0,
          details: appointmentData.requirements?.map(r => ({
            details: r.requirement_details,
            required: r.is_required,
            checked: r.is_checked
          })) || []
        }
      });

      const requirementsToSave = [];
      
      if (appointmentData.requirements && appointmentData.requirements.length > 0) {
        const userRequirements = appointmentData.requirements || [];
        
        predefinedRequirements.forEach(predefinedReq => {
          const userReq = userRequirements.find(ur => 
            ur.requirement_details === predefinedReq.requirement_details
          );
          
          requirementsToSave.push({
            appointment_id: appointment.appointment_id,
            requirement_details: predefinedReq.requirement_details,
            is_required: predefinedReq.is_required,
            is_predefined: true,
            is_checked: userReq ? userReq.is_checked : (predefinedReq.is_required ? true : false),
            created_at: new Date().toISOString()
          });
        });

        const customRequirements = userRequirements.filter(req => 
          !predefinedRequirements.some(pre => pre.requirement_details === req.requirement_details)
        );
        
        customRequirements.forEach(customReq => {
          if (customReq.requirement_details && customReq.requirement_details.trim()) {
            requirementsToSave.push({
              appointment_id: appointment.appointment_id,
              requirement_details: customReq.requirement_details.trim(),
              is_required: customReq.is_required || false,
              is_predefined: false,
              is_checked: customReq.is_checked || false,
              created_at: new Date().toISOString()
            });
          }
        });
      } else {
        predefinedRequirements.forEach(predefinedReq => {
          requirementsToSave.push({
            appointment_id: appointment.appointment_id,
            requirement_details: predefinedReq.requirement_details,
            is_required: predefinedReq.is_required,
            is_predefined: true,
            is_checked: predefinedReq.is_required ? true : false,
            created_at: new Date().toISOString()
          });
        });
      }

      if (requirementsToSave.length > 0) {
        console.log('💾 Saving requirements to database:', {
          count: requirementsToSave.length,
          details: requirementsToSave.map(r => ({
            details: r.requirement_details,
            required: r.is_required,
            checked: r.is_checked
          }))
        });

        const { error: reqError } = await supabase
          .from('requirements')
          .insert(requirementsToSave);

        if (reqError) {
          console.error('❌ Requirements creation error:', reqError);
        } else {
          console.log('✅ Requirements saved successfully:', requirementsToSave.length);
        }
      } else {
        console.log('ℹ️ No requirements to save');
      }

      if (amountPaid > 0) {
        await supabase
          .from('payments')
          .insert([{
            appointment_id: appointment.appointment_id,
            amount: amountPaid,
            payment_method: 'cash',
            payment_type: 'full',
            payment_date: new Date().toISOString().split('T')[0]
          }]);
      }

      console.log('✅ Appointment created and confirmed with payment');
      
      return { 
        success: true, 
        data: appointment, 
        message: 'Appointment booked and paid successfully! Receipt: ' + receiptNumber 
      };
    } catch (error) {
      console.error('💥 Unexpected error:', error);
      return handleSupabaseError(error, 'create appointment');
    }
  },

  async createAppointmentRequirements(appointmentId, predefinedRequirements, customRequirements) {
    try {
      let allRequirements = []
      
      if (predefinedRequirements.length > 0) {
        allRequirements = predefinedRequirements.map(req => ({
          appointment_id: appointmentId,
          requirement_details: req.requirement_details,
          is_required: req.is_required,
          is_predefined: true,
          is_checked: req.is_checked || false,
          created_at: new Date().toISOString()
        }))
      }

      if (customRequirements?.length > 0) {
        const customReqs = customRequirements
          .filter(req => req.trim() !== '')
          .map(req => ({
            appointment_id: appointmentId,
            requirement_details: req.trim(),
            is_required: false,
            is_predefined: false,
            is_checked: false,
            created_at: new Date().toISOString()
          }))
        
        allRequirements = [...allRequirements, ...customReqs]
      }

      if (allRequirements.length > 0) {
        const { error: reqError } = await supabase
          .from('requirements')
          .insert(allRequirements)

        if (reqError) {
          console.error('❌ Requirements creation error:', reqError)
        } else {
          console.log('✅ Requirements added:', allRequirements.length)
          console.log('✅ Requirement statuses:', allRequirements.map(r => ({ 
            details: r.requirement_details, 
            required: r.is_required, 
            checked: r.is_checked 
          })))
        }
      }
    } catch (error) {
      console.error('Error creating requirements:', error)
    }
  },

  async updateAppointmentOfferings(appointmentId, offeringTotal) {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ 
          offering_total: offeringTotal,
          updated_at: new Date().toISOString()
        })
        .eq('appointment_id', appointmentId)

      if (error) {
        return handleSupabaseError(error, 'update appointment offerings')
      }

      return { success: true }
    } catch (error) {
      return handleSupabaseError(error, 'update appointment offerings')
    }
  },

  async updateAppointmentStatus(appointmentId, status, currentUser) {
    try {
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'staff')) {
        return { success: false, error: 'Only administrators and staff can update appointment status' }
      }

      const { data, error } = await supabase
        .from('appointments')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
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

  async archiveAppointment(appointmentId, currentUser) {
    try {
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'staff')) {
        return { success: false, error: 'Only administrators and staff can archive appointments' }
      }

      console.log('🔄 Archiving appointment:', appointmentId);

      const { data: appointment, error: fetchError } = await supabase
        .from('appointments')
        .select(`
          *,
          requirements:requirements(*),
          payments:payments(*),
          appointment_products:appointment_products(
            *,
            products:product_id(product_name, description)
          ),
          services:service_id(service_name, price, duration_minutes, allow_concurrent),
          users:created_by(first_name, last_name, email)
        `)
        .eq('appointment_id', appointmentId)
        .single()

      if (fetchError || !appointment) {
        return handleSupabaseError(
          fetchError || new Error('Appointment not found'), 
          'fetch appointment for archiving'
        )
      }

      const totalPayments = appointment.payments?.reduce(
        (sum, payment) => sum + (parseFloat(payment.amount) || 0), 
        0
      ) || 0;
      const offeringTotal = calculateOfferingTotal(appointment.appointment_products);

      const archivedRequirements = appointment.requirements?.map(req => ({
        requirement_details: req.requirement_details,
        is_required: req.is_required,
        is_predefined: req.is_predefined
      })) || [];

      const archivedOfferings = appointment.appointment_products?.map(item => ({
        product_name: item.products?.product_name || 'Unknown',
        description: item.products?.description || '',
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price
      })) || [];

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
          payment_amount: appointment.payment_amount,
          amount_paid: appointment.amount_paid,
          change_amount: appointment.change_amount,
          offering_total: offeringTotal,
          service_duration: appointment.service_duration,
          receipt_number: appointment.receipt_number,
          requirements: archivedRequirements,
          offerings: archivedOfferings,
          total_payments: totalPayments,
          payment_count: appointment.payments?.length || 0,
          original_created_at: appointment.created_at,
          original_updated_at: appointment.updated_at,
          archived_at: new Date().toISOString()
        })
        .select()
        .single();

      if (archiveError) {
        console.error('❌ Error creating archive record:', archiveError);
        return handleSupabaseError(archiveError, 'create archive record');
      }

      console.log('✅ Archive record created:', archivedData);

      await Promise.all([
        supabase.from('requirements').delete().eq('appointment_id', appointmentId),
        supabase.from('payments').delete().eq('appointment_id', appointmentId),
        supabase.from('appointment_products').delete().eq('appointment_id', appointmentId)
      ]);

      const { error: deleteError } = await supabase
        .from('appointments')
        .delete()
        .eq('appointment_id', appointmentId);

      if (deleteError) {
        console.error('❌ Error deleting appointment:', deleteError);
        return handleSupabaseError(deleteError, 'delete original appointment');
      }

      console.log('✅ Appointment archived successfully');
      return { 
        success: true, 
        data: archivedData, 
        message: 'Appointment archived successfully!' 
      };
    } catch (error) {
      console.error('💥 Unexpected error archiving appointment:', error);
      return handleSupabaseError(error, 'archive appointment');
    }
  },

  async reprintReceipt(appointmentId, currentUser) {
    try {
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'staff')) {
        return { success: false, error: 'Only administrators and staff can reprint receipts' }
      }

      const { data: appointment, error } = await supabase
        .from('appointments')
        .select(`
          *,
          appointment_products:appointment_products(
            *,
            products:product_id(product_name)
          )
        `)
        .eq('appointment_id', appointmentId)
        .single()

      if (error || !appointment) {
        return { success: false, error: 'Appointment not found' }
      }

      if (!appointment.receipt_number) {
        return { success: false, error: 'No receipt found for this appointment' }
      }

      await supabase
        .from('appointments')
        .update({
          reprint_count: (appointment.reprint_count || 0) + 1,
          last_reprinted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('appointment_id', appointmentId)

      return {
        success: true,
        data: appointment,
        message: 'Receipt ready for reprinting'
      }
    } catch (error) {
      return handleSupabaseError(error, 'reprint receipt')
    }
  },

  async checkAppointmentAvailability(date, time, serviceId, appointmentId = null) {
    try {
      const { data: service } = await supabase
        .from('services')
        .select('duration_minutes, service_name, allow_concurrent')
        .eq('service_id', serviceId)
        .single();

      if (!service) {
        return { success: false, error: 'Service not found' };
      }

      const [hours, minutes] = time.split(':').map(Number);
      const appointmentStartMinutes = hours * 60 + minutes;
      const appointmentEndMinutes = appointmentStartMinutes + service.duration_minutes;

      let query = supabase
        .from('appointments')
        .select('appointment_time, service_duration, service_type')
        .eq('appointment_date', date)
        .in('status', ['pending', 'confirmed']);

      if (appointmentId) {
        query = query.neq('appointment_id', appointmentId);
      }

      const { data: dayAppointments } = await query;

      const conflictCheck = checkTimeConflicts(
        dayAppointments, 
        appointmentStartMinutes, 
        appointmentEndMinutes,
        60,
        service.allow_concurrent,
        service.service_name
      );

      if (!service.allow_concurrent && conflictCheck.hasConflict) {
        return {
          success: false,
          available: false,
          conflictWith: conflictCheck.conflictWith,
          nextAvailableTime: conflictCheck.nextAvailableTime,
          message: conflictCheck.message
        };
      }

      return {
        success: true,
        available: true,
        serviceDuration: service.duration_minutes,
        allowConcurrent: service.allow_concurrent
      };
    } catch (error) {
      return handleSupabaseError(error, 'check appointment availability');
    }
  },

  async getDailyReport(date = null) {
    try {
      const reportDate = date || new Date().toISOString().split('T')[0];
      console.log('📅 Generating daily report for (by payment date):', reportDate);

      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .eq('payment_date', reportDate)
        .order('created_at', { ascending: true });

      if (paymentsError) {
        return handleSupabaseError(paymentsError, 'fetch payments for daily report');
      }

      const appointmentIds = [...new Set((payments || []).map(p => p.appointment_id).filter(Boolean))];

      let appointments = [];
      if (appointmentIds.length > 0) {
        const { data: appts, error: apptError } = await supabase
          .from('appointments')
          .select(`
            *,
            services:service_id(service_name),
            appointment_products:appointment_products(
              *,
              products:product_id(product_name)
            )
          `)
          .in('appointment_id', appointmentIds)
          .order('appointment_time', { ascending: true });

        if (apptError) {
          return handleSupabaseError(apptError, 'fetch appointments for payments');
        }

        appointments = appts || [];
      }

      const paymentsByAppointment = {};
      (payments || []).forEach(p => {
        if (!paymentsByAppointment[p.appointment_id]) paymentsByAppointment[p.appointment_id] = [];
        paymentsByAppointment[p.appointment_id].push(p);
      });

      const formattedAppointments = (appointments || []).map(app => {
        const todaysPayments = paymentsByAppointment[app.appointment_id] || [];
        const paidToday = todaysPayments.reduce((s, x) => s + (Number(x.amount) || 0), 0);

        return {
          ...app,
          date: app.appointment_date,
          time: app.appointment_time,
          customer_name: `${app.customer_first_name} ${app.customer_last_name}`,
          service_name: app.services?.service_name || app.service_type,
          offering_items: app.appointment_products?.map(item => ({
            name: item.products?.product_name || 'Unknown',
            quantity: item.quantity,
            total: item.total_price
          })) || [],
          amount_paid: paidToday,
          payment_amount: app.payment_amount || 0,
          change_amount: app.change_amount || 0,
          payments: todaysPayments
        };
      }) || [];

      const { data: standalonePurchases, error: purchasesError } = await supabase
        .from('standalone_purchases')
        .select(`
          *,
          purchase_items:purchase_items(
            *,
            products:product_id(product_name)
          )
        `)
        .eq('purchase_date', reportDate)
        .order('created_at', { ascending: true });

      if (purchasesError) {
        return handleSupabaseError(purchasesError, 'fetch standalone purchases for report');
      }

      const formattedStandalonePurchases = standalonePurchases?.map(purchase => ({
        type: 'standalone_offering',
        purchase_id: purchase.purchase_id,
        receipt_number: purchase.receipt_number,
        customer_name: purchase.customer_name,
        total_amount: purchase.total_amount || 0,
        amount_paid: purchase.amount_paid || 0,
        change_amount: purchase.change_amount || 0,
        created_at: purchase.created_at,
        items: purchase.purchase_items?.map(i => ({
          name: i.products?.product_name || 'Unknown',
          quantity: i.quantity,
          total: i.total_price
        })) || []
      })) || [];

      let totalPayments = 0;
      let totalChange = 0;

      totalPayments += (payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);

      totalChange += (appointments || []).reduce((s, a) => s + (Number(a.change_amount) || 0), 0);

      formattedStandalonePurchases.forEach(p => {
        totalPayments += Number(p.amount_paid || p.total_amount || 0);
        totalChange += Number(p.change_amount || 0);
      });

      const totals = {
        totalAppointments: formattedAppointments.length,
        totalStandalonePurchases: formattedStandalonePurchases.length,
        totalPayments,
        totalChange,
        netRevenue: totalPayments - totalChange
      };

      return {
        success: true,
        data: {
          reportDate,
          totals,
          appointments: formattedAppointments,
          standaloneOfferings: formattedStandalonePurchases
        },
        message: `Daily report generated successfully`
      }
    } catch (error) {
      return handleSupabaseError(error, 'generate daily report')
    }
  },

  async getAppointmentByReceipt(receiptNumber) {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          requirements:requirements(*),
          payments:payments(*),
          appointment_products:appointment_products(
            *,
            products:product_id(product_name, description)
          ),
          services:service_id(service_name, price)
        `)
        .eq('receipt_number', receiptNumber)
        .single()

      if (error) {
        return handleSupabaseError(error, 'fetch appointment by receipt')
      }

      return { success: true, data }
    } catch (error) {
      return handleSupabaseError(error, 'fetch appointment by receipt')
    }
  },

  async getAppointmentDetails(appointmentId) {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          requirements:requirements(*),
          payments:payments(*),
          appointment_products:appointment_products(
            *,
            products:product_id(product_name, description)
          ),
          services:service_id(service_name, price, allow_concurrent),
          users:created_by(first_name, last_name, email)
        `)
        .eq('appointment_id', appointmentId)
        .single()

      if (error) {
        return handleSupabaseError(error, 'fetch appointment details')
      }

      if (data.requirements) {
        data.requirements = data.requirements.map(req => ({
          ...req,
          is_checked: req.is_checked || false
        }))
      }

      return { success: true, data }
    } catch (error) {
      return handleSupabaseError(error, 'fetch appointment details')
    }
  },

  async searchAppointments(searchTerm, currentUser) {
    try {
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'staff')) {
        return { success: false, error: 'Only administrators and staff can search appointments', data: [] }
      }

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          services:service_id(service_name),
          appointment_products:appointment_products(
            *,
            products:product_id(product_name)
          )
        `)
        .or(`customer_first_name.ilike.%${searchTerm}%,customer_last_name.ilike.%${searchTerm}%,customer_email.ilike.%${searchTerm}%,receipt_number.ilike.%${searchTerm}%,service_type.ilike.%${searchTerm}%`)
        .order('appointment_date', { ascending: false })
        .limit(50)

      if (error) {
        return handleSupabaseError(error, 'search appointments')
      }

      return { success: true, data: data || [] }
    } catch (error) {
      return handleSupabaseError(error, 'search appointments')
    }
  },

  async getAppointmentStats(startDate, endDate, currentUser) {
    try {
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'staff')) {
        return { success: false, error: 'Only administrators and staff can view statistics', data: null }
      }

      const { data: appointments, error } = await supabase
        .from('appointments')
        .select(`
          *,
          appointment_products:appointment_products(total_price)
        `)
        .gte('appointment_date', startDate)
        .lte('appointment_date', endDate)

      if (error) {
        return handleSupabaseError(error, 'fetch appointment stats')
      }

      const offeringTotals = appointments?.reduce((sum, app) => {
        return sum + calculateOfferingTotal(app.appointment_products);
      }, 0) || 0;

      const stats = {
        total_appointments: appointments?.length || 0,
        pending_count: appointments?.filter(a => a.status === 'pending').length || 0,
        confirmed_count: appointments?.filter(a => a.status === 'confirmed').length || 0,
        completed_count: appointments?.filter(a => a.status === 'completed').length || 0,
        cancelled_count: appointments?.filter(a => a.status === 'cancelled').length || 0,
        paid_count: appointments?.filter(a => a.payment_status === 'paid').length || 0,
        total_revenue: appointments?.reduce((sum, app) => sum + (app.amount_paid || 0), 0) || 0,
        total_change: appointments?.reduce((sum, app) => sum + (app.change_amount || 0), 0) || 0,
        total_offerings: offeringTotals,
        total_service_revenue: appointments?.reduce((sum, app) => sum + (app.payment_amount || 0), 0) || 0,
      };
      
      stats.net_revenue = stats.total_service_revenue - stats.total_change;

      return { success: true, data: stats }
    } catch (error) {
      return handleSupabaseError(error, 'fetch appointment stats')
    }
  },

  async getServiceRequirements(serviceName) {
    try {
      if (!serviceName) {
        return { success: true, data: [] };
      }

      console.log('🔄 Fetching requirements for service:', serviceName);

      const { data: service, error: serviceError } = await supabase
        .from('services')
        .select('service_id')
        .eq('service_name', serviceName)
        .single();

      if (serviceError || !service) {
        console.log('No service found or service has no requirements');
        return { success: true, data: [] };
      }

      const { data: requirements, error } = await supabase
        .from('requirements')
        .select('requirement_details, is_required')
        .eq('service_id', service.service_id)
        .eq('is_predefined', true)
        .order('requirement_id', { ascending: true });

      if (error) {
        console.warn('Error fetching service requirements:', error);
        return { success: true, data: [] };
      }

      console.log('✅ Service requirements fetched:', requirements?.length || 0);
      return { success: true, data: requirements || [] };
    } catch (error) {
      console.error('Error getting service requirements:', error);
      return { success: true, data: [] };
    }
  },


  async updateAppointmentRequirements(appointmentId, requirementUpdates, currentUser) {
    try {
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'staff')) {
        return { success: false, error: 'Only administrators and staff can update requirements' };
      }

      console.log('DEBUG: Updating requirements for appointment:', appointmentId);
      console.log('DEBUG: Updates to apply:', requirementUpdates);

      for (const update of requirementUpdates) {
        const { error } = await supabase
          .from('requirements')
          .update({
            is_checked: update.is_checked
          })
          .eq('requirement_id', update.requirement_id)
          .eq('appointment_id', appointmentId);

        if (error) {
          console.error('Error updating requirement:', error);
          return { 
            success: false, 
            error: `Failed to update requirement: ${error.message}` 
          };
        }
      }

      console.log('DEBUG: Requirements updated successfully');
      return { 
        success: true, 
        message: 'Requirements updated successfully!' 
      };
    } catch (error) {
      console.error('Error updating appointment requirements:', error);
      return handleSupabaseError(error, 'update appointment requirements');
    }
  },

  async getUpcomingAppointments(limit = 10, currentUser = null) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      let query = supabase
        .from('appointments')
        .select(`
          *,
          services:service_id(service_name, allow_concurrent),
          users:created_by(first_name, last_name),
          appointment_products:appointment_products(
            *,
            products:product_id(product_name)
          )
        `)
        .gte('appointment_date', today)
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true })
        .limit(limit);

      if (currentUser && currentUser.role !== 'admin' && currentUser.role !== 'staff') {
        query = query.eq('created_by', currentUser.user_id);
      }

      const { data, error } = await query;

      if (error) {
        return handleSupabaseError(error, 'fetch upcoming appointments');
      }

      return { success: true, data: data || [] };
    } catch (error) {
      return handleSupabaseError(error, 'fetch upcoming appointments');
    }
  },

  async getAppointmentSummary(appointmentId) {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          services:service_id(service_name, price, allow_concurrent),
          appointment_products:appointment_products(
            *,
            products:product_id(product_name, description)
          )
        `)
        .eq('appointment_id', appointmentId)
        .single();

      if (error) {
        return handleSupabaseError(error, 'fetch appointment summary');
      }

      const serviceTotal = data.services?.price || 0;
      const offeringTotal = calculateOfferingTotal(data.appointment_products);
      const grandTotal = serviceTotal + offeringTotal;

      const summary = {
        appointment_id: data.appointment_id,
        service_name: data.services?.service_name || data.service_type,
        service_price: serviceTotal,
        service_duration: data.service_duration || 60,
        allow_concurrent: data.services?.allow_concurrent || false,
        offering_items: data.appointment_products?.map(item => ({
          name: item.products?.product_name || 'Unknown',
          description: item.products?.description || '',
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total_price
        })) || [],
        offering_total: offeringTotal,
        grand_total: grandTotal,
        amount_paid: data.amount_paid || 0,
        change_amount: data.change_amount || 0,
        receipt_number: data.receipt_number,
        customer_name: `${data.customer_first_name} ${data.customer_last_name}`
      };

      return { success: true, data: summary };
    } catch (error) {
      return handleSupabaseError(error, 'fetch appointment summary');
    }
  },

  async validateDate(date) {
    try {
      const appointmentDate = new Date(date);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      if (appointmentDate < tomorrow) {
        return {
          success: false,
          valid: false,
          error: 'Appointments must be booked at least 1 day in advance'
        };
      }
      
      return {
        success: true,
        valid: true
      };
    } catch (error) {
      return handleSupabaseError(error, 'validate date');
    }
  }
};

export default appointmentService;