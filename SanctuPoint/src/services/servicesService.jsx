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

// UPDATED: FIXED checkTimeConflicts function with proper overlap detection for all scenarios
const checkTimeConflicts = (existingAppointments, slotStartMinutes, slotEndMinutes, bufferMinutes = 60, allowConcurrent = false, serviceType = null) => {
  // If there are no existing appointments, no conflict
  if (!existingAppointments || existingAppointments.length === 0) {
    return { hasConflict: false };
  }
  
  // For all appointments, check for conflicts
  for (const appointment of existingAppointments) {
    const [appHours, appMinutes] = appointment.appointment_time.split(':').map(Number);
    const appStartMinutes = appHours * 60 + appMinutes;
    const appDuration = appointment.service_duration || 60;
    const appEndMinutes = appStartMinutes + appDuration;
    const bufferStartMinutes = appEndMinutes; // Buffer starts immediately after appointment
    const bufferEndMinutes = appEndMinutes + bufferMinutes; // Buffer ends after buffer duration
    
    let hasConflict = false;
    
    if (allowConcurrent && serviceType) {
      // For concurrent appointments:
      if (appointment.service_type === serviceType) {
        // Same service type - only check buffer violations (can run at same time)
        const violatesBuffer = 
          (slotStartMinutes >= appEndMinutes && slotStartMinutes < bufferEndMinutes) ||  // New appointment STARTS during buffer
          (slotEndMinutes > appEndMinutes && slotEndMinutes <= bufferEndMinutes);        // New appointment ENDS during buffer
        
        hasConflict = violatesBuffer;
      } else {
        // Different service type - check normal conflicts including buffer
        
        // Check for ANY overlap (even partial)
        const overlaps = 
          (slotStartMinutes >= appStartMinutes && slotStartMinutes < appEndMinutes) ||   // New starts during existing
          (slotEndMinutes > appStartMinutes && slotEndMinutes <= appEndMinutes) ||       // New ends during existing
          (slotStartMinutes <= appStartMinutes && slotEndMinutes >= appEndMinutes);      // New completely encompasses existing
        
        // Check for buffer conflicts
        const startsDuringBuffer = slotStartMinutes >= appEndMinutes && slotStartMinutes < bufferEndMinutes;
        const endsDuringBuffer = slotEndMinutes > appEndMinutes && slotEndMinutes <= bufferEndMinutes;
        
        // Check if new appointment starts BEFORE but ends DURING or AFTER existing appointment
        const startsBeforeEndsDuringOrAfter = 
          (slotStartMinutes < appStartMinutes && slotEndMinutes > appStartMinutes);
        
        hasConflict = overlaps || startsDuringBuffer || endsDuringBuffer || startsBeforeEndsDuringOrAfter;
      }
    } else {
      // Standard conflict checking for non-concurrent appointments
      
      // Check for ANY overlap (even partial)
      const overlaps = 
        (slotStartMinutes >= appStartMinutes && slotStartMinutes < appEndMinutes) ||   // New starts during existing
        (slotEndMinutes > appStartMinutes && slotEndMinutes <= appEndMinutes) ||       // New ends during existing
        (slotStartMinutes <= appStartMinutes && slotEndMinutes >= appEndMinutes);      // New completely encompasses existing
      
      // Check for buffer conflicts
      const startsDuringBuffer = slotStartMinutes >= appEndMinutes && slotStartMinutes < bufferEndMinutes;
      const endsDuringBuffer = slotEndMinutes > appEndMinutes && slotEndMinutes <= bufferEndMinutes;
      
      // Check if new appointment starts BEFORE but ends DURING or AFTER existing appointment
      const startsBeforeEndsDuringOrAfter = 
        (slotStartMinutes < appStartMinutes && slotEndMinutes > appStartMinutes);
      
      hasConflict = overlaps || startsDuringBuffer || endsDuringBuffer || startsBeforeEndsDuringOrAfter;
    }
    
    if (hasConflict) {
      // Calculate next available time based on the end of the buffer
      const nextAvailableMinutes = bufferEndMinutes; // After buffer ends
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

  // UPDATED: getAvailableTimeSlots with same-time concurrent logic
  async getAvailableTimeSlots(serviceId, date, durationMinutes = 60) {
    try {
      // Get service details including allow_concurrent
      const { data: service, error: serviceError } = await supabase
        .from('services')
        .select('duration_minutes, allowed_days, service_name, allow_concurrent')
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
      
      if (appointmentsError) {
        console.error('Appointments error:', appointmentsError);
        return handleSupabaseError(appointmentsError, 'fetch existing appointments');
      }
      
      console.log('📅 Existing appointments for', date, ':', existingAppointments?.length || 0);
      
      // Check if there are already bookings for this SAME concurrent service
      const existingSameServiceAppointments = existingAppointments?.filter(
        app => app.service_type === service.service_name && service.allow_concurrent
      ) || [];
      
      console.log('🔀 Existing same-service concurrent appointments:', existingSameServiceAppointments.length);
      
      // Generate all possible time slots for the day (8 AM to 5 PM)
      const availableSlots = [];
      const startHour = 8;
      const endHour = 17;
      const bufferMinutes = 60; // 1-hour buffer
      const serviceDuration = durationMinutes || service.duration_minutes || 60;
      
      console.log(`🔍 Checking time slots for ${date}, duration: ${serviceDuration} minutes, concurrent: ${service.allow_concurrent}, service name: ${service.service_name}`);
      
      // If there are existing concurrent appointments for this service, ONLY show that time slot
      if (service.allow_concurrent && existingSameServiceAppointments.length > 0) {
        const firstAppointment = existingSameServiceAppointments[0];
        const [appHours, appMinutes] = firstAppointment.appointment_time.split(':').map(Number);
        const appStartMinutes = appHours * 60 + appMinutes;
        
        // Calculate slot end time
        const slotStartMinutes = appStartMinutes;
        const slotEndMinutes = slotStartMinutes + serviceDuration;
        
        // Check if this slot would end after 5 PM
        const slotEndHour = Math.floor(slotEndMinutes / 60);
        const slotEndMinute = slotEndMinutes % 60;
        
        // Only include if it doesn't end after closing time
        if (!(slotEndHour > endHour || (slotEndHour === endHour && slotEndMinute > 0))) {
          const displayHour = Math.floor(appStartMinutes / 60) % 12 || 12;
          const period = Math.floor(appStartMinutes / 60) >= 12 ? 'PM' : 'AM';
          const displayMinute = appStartMinutes % 60;
          const displayTime = `${displayHour}:${displayMinute.toString().padStart(2, '0')} ${period}`;
          
          // Check if this slot has conflicts with OTHER services
          const conflictResult = checkTimeConflicts(
            existingAppointments || [],
            slotStartMinutes,
            slotEndMinutes,
            bufferMinutes,
            service.allow_concurrent,
            service.service_name
          );
          
          if (!conflictResult.hasConflict) {
            availableSlots.push({
              value: `${Math.floor(appStartMinutes / 60).toString().padStart(2, '0')}:${(appStartMinutes % 60).toString().padStart(2, '0')}`,
              display: `${displayTime} 🔀`,
              available: true,
              startMinutes: slotStartMinutes,
              endMinutes: slotEndMinutes,
              allowConcurrent: true,
              isConcurrentSlot: true,
              concurrentMessage: 'Concurrent booking - same time as existing appointments'
            });
          } else {
            console.log('❌ Concurrent slot has conflict:', conflictResult);
          }
        }
      } else {
        // No existing concurrent appointments - show all available slots
        for (let hour = startHour; hour <= endHour; hour++) {
          for (let minute = 0; minute < 60; minute += 30) {
            // Calculate slot start and end times
            const slotStartMinutes = hour * 60 + minute;
            const slotEndMinutes = slotStartMinutes + serviceDuration;
            
            // Check if slot would end after 5 PM
            const slotEndHour = Math.floor(slotEndMinutes / 60);
            const slotEndMinute = slotEndMinutes % 60;
            
            // Skip if slot ends after closing time (5 PM)
            if (slotEndHour > endHour || (slotEndHour === endHour && slotEndMinute > 0)) {
              continue;
            }
            
            // Check if this slot conflicts with existing appointments
            const conflictResult = checkTimeConflicts(
              existingAppointments || [],
              slotStartMinutes,
              slotEndMinutes,
              bufferMinutes,
              service.allow_concurrent,
              service.service_name
            );
            
            if (!conflictResult.hasConflict) {
              const displayHour = hour % 12 || 12;
              const period = hour >= 12 ? 'PM' : 'AM';
              const displayTime = `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
              
              availableSlots.push({
                value: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
                display: displayTime + (service.allow_concurrent ? ' 🔀' : ''),
                available: true,
                startMinutes: slotStartMinutes,
                endMinutes: slotEndMinutes,
                allowConcurrent: service.allow_concurrent,
                isConcurrentSlot: false
              });
            } else {
              console.log(`❌ Slot ${hour}:${minute} conflicted:`, conflictResult);
            }
          }
        }
      }
      
      console.log(`✅ Found ${availableSlots.length} available slots for ${date}`);
      
      return {
        success: true,
        data: availableSlots,
        totalAvailable: availableSlots.length,
        serviceDuration: serviceDuration,
        allowConcurrent: service.allow_concurrent,
        hasExistingConcurrent: existingSameServiceAppointments.length > 0
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
      
      // Get service details including allow_concurrent
      const { data: service, error: serviceError } = await supabase
        .from('services')
        .select('allowed_days, duration_minutes, service_name, allow_concurrent')
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
          .select('appointment_time, service_duration, service_type')
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
        
        // Check for existing concurrent appointments of same service
        const existingSameServiceAppointments = existingAppointments?.filter(
          app => app.service_type === service.service_name && service.allow_concurrent
        ) || [];
        
        // Calculate how many slots are available
        let availableSlotsCount = 0;
        const startHour = 8;
        const endHour = 17;
        const serviceDuration = service.duration_minutes || 60;
        
        // If there are existing concurrent appointments, only check that specific time
        if (service.allow_concurrent && existingSameServiceAppointments.length > 0) {
          const firstAppointment = existingSameServiceAppointments[0];
          const [appHours, appMinutes] = firstAppointment.appointment_time.split(':').map(Number);
          const appStartMinutes = appHours * 60 + appMinutes;
          const slotStartMinutes = appStartMinutes;
          const slotEndMinutes = slotStartMinutes + serviceDuration;
          
          const slotEndHour = Math.floor(slotEndMinutes / 60);
          const slotEndMinute = slotEndMinutes % 60;
          
          // Check if this slot is valid (not after closing)
          if (!(slotEndHour > endHour || (slotEndHour === endHour && slotEndMinute > 0))) {
            const conflictResult = checkTimeConflicts(
              existingAppointments || [],
              slotStartMinutes,
              slotEndMinutes,
              60,
              service.allow_concurrent,
              service.service_name
            );
            
            if (!conflictResult.hasConflict) {
              availableSlotsCount = 1; // Only one concurrent slot available
            }
          }
        } else {
          // No existing concurrent appointments - check all slots
          for (let hour = startHour; hour <= endHour; hour++) {
            for (let minute = 0; minute < 60; minute += 30) {
              const slotStartMinutes = hour * 60 + minute;
              const slotEndMinutes = slotStartMinutes + serviceDuration;
              
              const slotEndHour = Math.floor(slotEndMinutes / 60);
              const slotEndMinute = slotEndMinutes % 60;
              
              if (slotEndHour > endHour || (slotEndHour === endHour && slotEndMinute > 0)) {
                continue;
              }
              
              const conflictResult = checkTimeConflicts(
                existingAppointments || [],
                slotStartMinutes,
                slotEndMinutes,
                60,
                service.allow_concurrent,
                service.service_name
              );
              
              if (!conflictResult.hasConflict) {
                availableSlotsCount++;
              }
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
          concurrentAppointmentCount: existingSameServiceAppointments.length,
          availableSlots: availableSlotsCount,
          error: false,
          allowConcurrent: service.allow_concurrent,
          hasExistingConcurrent: existingSameServiceAppointments.length > 0
        });
        
        if (!isAllowed || !hasAvailability) {
          allDaysAvailable = false;
        }
      }
      
      console.log(`📅 Consecutive days check: ${allDaysAvailable ? 'All days available' : 'Some days unavailable'}, concurrent: ${service.allow_concurrent}`);
      
      return {
        success: true,
        data: {
          availability,
          allDaysAvailable,
          consecutiveDays,
          startDate,
          serviceName: service.service_name,
          allowConcurrent: service.allow_concurrent
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

  // UPDATED: validateServiceTime with same-time concurrent logic
  async validateServiceTime(serviceId, date, time, appointmentId = null) {
    try {
      const { data: service, error: serviceError } = await supabase
        .from('services')
        .select('duration_minutes, allowed_days, service_name, allow_concurrent')
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

      // Check for existing concurrent appointments of the same service
      if (service.allow_concurrent) {
        const existingConcurrentAppointments = existingAppointments?.filter(
          app => app.service_type === service.service_name
        ) || [];
        
        if (existingConcurrentAppointments.length > 0) {
          // Check if trying to book at different time than existing concurrent appointments
          const firstConcurrentApp = existingConcurrentAppointments[0];
          const [concurrentHours, concurrentMinutes] = firstConcurrentApp.appointment_time.split(':').map(Number);
          const concurrentStartMinutes = concurrentHours * 60 + concurrentMinutes;
          
          if (appointmentStartMinutes !== concurrentStartMinutes) {
            const displayHour = Math.floor(concurrentStartMinutes / 60);
            const displayMinute = concurrentStartMinutes % 60;
            const period = displayHour >= 12 ? 'PM' : 'AM';
            const twelveHour = displayHour % 12 || 12;
            const requiredTime = `${twelveHour}:${displayMinute.toString().padStart(2, '0')} ${period}`;
            
            return {
              success: false,
              valid: false,
              error: `This concurrent service already has bookings at ${requiredTime}. You must book at the same time for concurrent appointments.`
            };
          }
        }
      }

      // Check for conflicts using the updated checkTimeConflicts function
      const conflictResult = checkTimeConflicts(
        existingAppointments || [],
        appointmentStartMinutes,
        appointmentEndMinutes,
        60,
        service.allow_concurrent,
        service.service_name
      );
      
      if (conflictResult.hasConflict) {
        return {
          success: false,
          valid: false,
          error: conflictResult.message || `Time slot conflicts with an existing ${conflictResult.conflictWith}. ${conflictResult.nextAvailableTime ? `The next available time is ${conflictResult.nextAvailableTime}` : ''}`
        };
      }

      return {
        success: true,
        valid: true,
        serviceDuration: service.duration_minutes || 60,
        allowConcurrent: service.allow_concurrent
      };
    } catch (error) {
      console.error('Error validating service time:', error);
      return handleSupabaseError(error, 'validate service time');
    }
  },

  async getServiceRequirements(serviceId) {
    try {
      if (!serviceId) {
        return { success: true, data: [] };
      }

      const { data: requirements, error } = await supabase
        .from('requirements')
        .select('requirement_details, is_required')
        .eq('service_id', serviceId)
        .eq('is_predefined', true)
        .order('requirement_id', { ascending: true });

      if (error) {
        console.warn('Error fetching service requirements:', error);
        return { success: true, data: [] };
      }

      return { success: true, data: requirements || [] };
    } catch (error) {
      console.error('Error getting service requirements:', error);
      return { success: true, data: [] };
    }
  }
};

export default servicesService;