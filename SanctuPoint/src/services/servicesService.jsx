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
  };
  
  let errorMessage = error.message || `Failed to ${operation}`;
  
  if (error.code && errorMessages[error.code]) {
    errorMessage = `${errorMessages[error.code]}`;
  }
  
  return { success: false, error: errorMessage };
}

// Helper function to check time conflicts
const checkTimeConflicts = (existingAppointments, slotStartMinutes, slotEndMinutes, bufferMinutes = 60) => {
  for (const appointment of existingAppointments || []) {
    const [appHours, appMinutes] = appointment.appointment_time.split(':').map(Number);
    const appStartMinutes = appHours * 60 + appMinutes;
    const appDuration = appointment.service_duration || 60;
    const appEndMinutes = appStartMinutes + appDuration;
    const bufferEndMinutes = appEndMinutes + bufferMinutes;
    
    const hasConflict = 
      (slotStartMinutes < appEndMinutes && slotEndMinutes > appStartMinutes) ||
      (slotStartMinutes >= appEndMinutes && slotStartMinutes < bufferEndMinutes) ||
      (slotEndMinutes > appEndMinutes && slotEndMinutes <= bufferEndMinutes);
    
    if (hasConflict) {
      return true;
    }
  }
  
  return false;
};

export const servicesService = {
  async getServices() {
    try {
      const { data, error } = await supabase
        .from('services')
        .select(`
          *,
          requirements:requirements(*)
        `)
        .order('service_name', { ascending: true })

      if (error) {
        return handleSupabaseError(error, 'fetch services')
      }

      return { success: true, data: data || [] }
    } catch (error) {
      return handleSupabaseError(error, 'fetch services')
    }
  },

  async getServiceDetails(serviceId) {
    try {
      const { data, error } = await supabase
        .from('services')
        .select(`
          *,
          requirements:requirements(*)
        `)
        .eq('service_id', serviceId)
        .single()
      
      if (error) throw error
      return { success: true, data }
    } catch (error) {
      console.error('Error fetching service details:', error)
      return handleSupabaseError(error, 'fetch service details')
    }
  },

  async getAvailableTimeSlots(serviceId, date, durationMinutes = 60) {
    try {
      // Get service details
      const { data: service, error: serviceError } = await supabase
        .from('services')
        .select('duration_minutes, allowed_days, service_name')
        .eq('service_id', serviceId)
        .single()
      
      if (serviceError) {
        console.error('Service error:', serviceError);
        return handleSupabaseError(serviceError, 'fetch service details');
      }
      
      // Check if date is in allowed days
      const selectedDate = new Date(date);
      const dayOfWeek = selectedDate.getDay();
      
      if (service.allowed_days && service.allowed_days.length > 0 && !service.allowed_days.includes(dayOfWeek)) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return { 
          success: false, 
          error: `${service.service_name} is not available on ${dayNames[dayOfWeek]}` 
        };
      }
      
      // Get existing appointments for the date
      const { data: existingAppointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select('appointment_time, service_duration, service_type')
        .eq('appointment_date', date)
        .in('status', ['pending', 'confirmed'])
        .order('appointment_time', { ascending: true })
      
      if (appointmentsError) {
        console.error('Appointments error:', appointmentsError);
        return handleSupabaseError(appointmentsError, 'fetch existing appointments');
      }
      
      // Generate all possible time slots for the day (8 AM to 5 PM)
      const availableSlots = [];
      const startHour = 8;
      const endHour = 17;
      const bufferMinutes = 60; // 1-hour buffer
      const serviceDuration = durationMinutes || service.duration_minutes || 60;
      
      console.log(`🔍 Checking time slots for ${date}, duration: ${serviceDuration} minutes`);
      
      for (let hour = startHour; hour <= endHour; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          // Skip slots that would end after closing time (5 PM)
          const slotEndHour = hour + Math.floor((minute + serviceDuration) / 60);
          const slotEndMinute = (minute + serviceDuration) % 60;
          
          if (slotEndHour > endHour || (slotEndHour === endHour && slotEndMinute > 0)) {
            continue;
          }
          
          const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          const slotStartMinutes = hour * 60 + minute;
          const slotEndMinutes = slotStartMinutes + serviceDuration;
          
          // Check if this slot conflicts with existing appointments
          const hasConflict = checkTimeConflicts(
            existingAppointments,
            slotStartMinutes,
            slotEndMinutes,
            bufferMinutes
          );
          
          if (!hasConflict) {
            const displayHour = hour % 12 || 12;
            const period = hour >= 12 ? 'PM' : 'AM';
            const displayTime = `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
            
            availableSlots.push({
              value: timeString,
              display: displayTime,
              available: true,
              startMinutes: slotStartMinutes,
              endMinutes: slotEndMinutes
            });
          }
        }
      }
      
      console.log(`✅ Found ${availableSlots.length} available slots for ${date}`);
      
      return {
        success: true,
        data: availableSlots,
        totalAvailable: availableSlots.length,
        serviceDuration: serviceDuration
      };
    } catch (error) {
      console.error('Error getting available time slots:', error);
      return handleSupabaseError(error, 'get available time slots');
    }
  },
  
  async checkConsecutiveDaysAvailability(serviceId, startDate, consecutiveDays) {
    try {
      const availability = [];
      let allDaysAvailable = true;
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      // Get service details
      const { data: service, error: serviceError } = await supabase
        .from('services')
        .select('allowed_days, duration_minutes, service_name')
        .eq('service_id', serviceId)
        .single();
      
      if (serviceError) {
        console.error('Service error:', serviceError);
        return handleSupabaseError(serviceError, 'fetch service details');
      }
      
      for (let i = 0; i < consecutiveDays; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + i);
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayOfWeek = currentDate.getDay();
        
        const isAllowed = !service.allowed_days || service.allowed_days.length === 0 || service.allowed_days.includes(dayOfWeek);
        
        // Get existing appointments for this day
        const { data: existingAppointments, error: dayError } = await supabase
          .from('appointments')
          .select('appointment_time, service_duration')
          .eq('appointment_date', dateStr)
          .in('status', ['pending', 'confirmed']);
        
        if (dayError) {
          console.error(`Error checking day ${i + 1}:`, dayError);
          allDaysAvailable = false;
          availability.push({
            date: dateStr,
            dayName: dayNames[dayOfWeek],
            isAllowed: false,
            hasAvailability: false,
            appointmentCount: 0,
            error: true
          });
          continue;
        }
        
        // Calculate how many slots are available
        let availableSlotsCount = 0;
        const startHour = 8;
        const endHour = 17;
        const serviceDuration = service.duration_minutes || 60;
        
        for (let hour = startHour; hour <= endHour; hour++) {
          for (let minute = 0; minute < 60; minute += 30) {
            const slotEndHour = hour + Math.floor((minute + serviceDuration) / 60);
            const slotEndMinute = (minute + serviceDuration) % 60;
            
            if (slotEndHour > endHour || (slotEndHour === endHour && slotEndMinute > 0)) {
              continue;
            }
            
            const slotStartMinutes = hour * 60 + minute;
            const slotEndMinutes = slotStartMinutes + serviceDuration;
            
            const hasConflict = checkTimeConflicts(
              existingAppointments,
              slotStartMinutes,
              slotEndMinutes,
              60 // 1-hour buffer
            );
            
            if (!hasConflict) {
              availableSlotsCount++;
            }
          }
        }
        
        const hasAvailability = availableSlotsCount > 0;
        
        availability.push({
          date: dateStr,
          dayName: dayNames[dayOfWeek],
          isAllowed,
          hasAvailability,
          appointmentCount: existingAppointments?.length || 0,
          availableSlots: availableSlotsCount,
          error: false
        });
        
        if (!isAllowed || !hasAvailability) {
          allDaysAvailable = false;
        }
      }
      
      console.log(`📅 Consecutive days check: ${allDaysAvailable ? 'All days available' : 'Some days unavailable'}`);
      
      return {
        success: true,
        data: {
          availability,
          allDaysAvailable,
          consecutiveDays,
          startDate,
          serviceName: service.service_name
        }
      };
    } catch (error) {
      console.error('Error checking consecutive days:', error);
      return handleSupabaseError(error, 'check consecutive days availability');
    }
  },

  async createService(serviceData, currentUser) {
    try {
      if (!currentUser || currentUser.role !== 'admin') {
        return { success: false, error: 'Only administrators can create services' };
      }

      const { data, error } = await supabase
        .from('services')
        .insert([{
          service_name: serviceData.service_name,
          price: serviceData.price || 0,
          duration_minutes: serviceData.duration_minutes || 60,
          description: serviceData.description || null,
          allowed_days: serviceData.allowed_days || [1, 2, 3, 4, 5],
          allow_concurrent: serviceData.allow_concurrent || false,
          requires_multiple_days: serviceData.requires_multiple_days || false,
          consecutive_days: serviceData.consecutive_days || 1,
          has_requirements: serviceData.has_requirements || false,
          created_by: currentUser.user_id
        }])
        .select()
        .single()

      if (error) {
        return handleSupabaseError(error, 'create service');
      }

      // Add predefined requirements if provided
      if (serviceData.requirements && serviceData.requirements.length > 0) {
        const requirements = serviceData.requirements.map(req => ({
          service_id: data.service_id,
          requirement_details: req.requirement_details,
          is_required: req.is_required || false,
          is_predefined: true,
          created_at: new Date().toISOString()
        }));

        await supabase
          .from('requirements')
          .insert(requirements);
      }

      return { success: true, data, message: 'Service created successfully!' };
    } catch (error) {
      return handleSupabaseError(error, 'create service');
    }
  },

  async updateService(serviceId, serviceData, currentUser) {
    try {
      if (!currentUser || currentUser.role !== 'admin') {
        return { success: false, error: 'Only administrators can update services' };
      }

      const { data, error } = await supabase
        .from('services')
        .update({
          service_name: serviceData.service_name,
          price: serviceData.price,
          duration_minutes: serviceData.duration_minutes,
          description: serviceData.description,
          allowed_days: serviceData.allowed_days,
          allow_concurrent: serviceData.allow_concurrent,
          requires_multiple_days: serviceData.requires_multiple_days,
          consecutive_days: serviceData.consecutive_days,
          has_requirements: serviceData.has_requirements,
          updated_at: new Date().toISOString()
        })
        .eq('service_id', serviceId)
        .select()
        .single()

      if (error) {
        return handleSupabaseError(error, 'update service');
      }

      // Update requirements if provided
      if (serviceData.requirements) {
        // Delete existing predefined requirements
        await supabase
          .from('requirements')
          .delete()
          .eq('service_id', serviceId)
          .eq('is_predefined', true);

        // Add new requirements
        if (serviceData.requirements.length > 0) {
          const requirements = serviceData.requirements.map(req => ({
            service_id: serviceId,
            requirement_details: req.requirement_details,
            is_required: req.is_required || false,
            is_predefined: true,
            created_at: new Date().toISOString()
          }));

          await supabase
            .from('requirements')
            .insert(requirements);
        }
      }

      return { success: true, data, message: 'Service updated successfully!' };
    } catch (error) {
      return handleSupabaseError(error, 'update service');
    }
  },

  async deleteService(serviceId, currentUser) {
    try {
      if (!currentUser || currentUser.role !== 'admin') {
        return { success: false, error: 'Only administrators can delete services' };
      }

      // Check if service has appointments
      const { data: appointments, error: checkError } = await supabase
        .from('appointments')
        .select('appointment_id')
        .eq('service_id', serviceId)
        .limit(1);

      if (checkError) {
        return handleSupabaseError(checkError, 'check service appointments');
      }

      if (appointments && appointments.length > 0) {
        return { 
          success: false, 
          error: 'Cannot delete service that has existing appointments' 
        };
      }

      // Delete service requirements first
      await supabase
        .from('requirements')
        .delete()
        .eq('service_id', serviceId);

      // Delete the service
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('service_id', serviceId);

      if (error) {
        return handleSupabaseError(error, 'delete service');
      }

      return { success: true, message: 'Service deleted successfully!' };
    } catch (error) {
      return handleSupabaseError(error, 'delete service');
    }
  },

  async validateServiceTime(serviceId, date, time, appointmentId = null) {
    try {
      const { data: service, error: serviceError } = await supabase
        .from('services')
        .select('duration_minutes, allowed_days, service_name')
        .eq('service_id', serviceId)
        .single();
      
      if (serviceError) {
        return handleSupabaseError(serviceError, 'fetch service details');
      }

      // Check if date is allowed
      const selectedDate = new Date(date);
      const dayOfWeek = selectedDate.getDay();
      
      if (service.allowed_days && service.allowed_days.length > 0 && !service.allowed_days.includes(dayOfWeek)) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return {
          success: false,
          valid: false,
          error: `${service.service_name} is not available on ${dayNames[dayOfWeek]}`
        };
      }

      // Check for time conflicts
      const [hours, minutes] = time.split(':').map(Number);
      const appointmentStartMinutes = hours * 60 + minutes;
      const appointmentEndMinutes = appointmentStartMinutes + (service.duration_minutes || 60);

      let query = supabase
        .from('appointments')
        .select('appointment_time, service_duration, service_type')
        .eq('appointment_date', date)
        .in('status', ['pending', 'confirmed']);

      if (appointmentId) {
        query = query.neq('appointment_id', appointmentId);
      }

      const { data: existingAppointments, error: appointmentsError } = await query;

      if (appointmentsError) {
        return handleSupabaseError(appointmentsError, 'fetch existing appointments');
      }

      // Check for conflicts
      for (const existingApp of existingAppointments || []) {
        const [appHours, appMinutes] = existingApp.appointment_time.split(':').map(Number);
        const appStartMinutes = appHours * 60 + appMinutes;
        const appDuration = existingApp.service_duration || 60;
        const appEndMinutes = appStartMinutes + appDuration;
        const bufferEndMinutes = appEndMinutes + 60; // 1-hour buffer
        
        const hasConflict = 
          (appointmentStartMinutes < appEndMinutes && appointmentEndMinutes > appStartMinutes) ||
          (appointmentStartMinutes >= appEndMinutes && appointmentStartMinutes < bufferEndMinutes) ||
          (appointmentEndMinutes > appEndMinutes && appointmentEndMinutes <= bufferEndMinutes);
        
        if (hasConflict) {
          const nextAvailableMinutes = appEndMinutes + 60;
          const nextAvailableHour = Math.floor(nextAvailableMinutes / 60);
          const nextAvailableMinute = nextAvailableMinutes % 60;
          const displayHour = nextAvailableHour % 12 || 12;
          const period = nextAvailableHour >= 12 ? 'PM' : 'AM';
          const nextAvailableTime = `${displayHour}:${nextAvailableMinute.toString().padStart(2, '0')} ${period}`;
          
          return {
            success: false,
            valid: false,
            error: `Time conflicts with existing appointment. Next available: ${nextAvailableTime}`
          };
        }
      }

      return {
        success: true,
        valid: true,
        serviceDuration: service.duration_minutes || 60
      };
    } catch (error) {
      console.error('Error validating service time:', error);
      return handleSupabaseError(error, 'validate service time');
    }
  }
};