import { supabase } from '../config/supabaseClient'

const handleSupabaseError = (error, operation) => {
  console.error(`❌ ${operation} error:`, error)
  return { success: false, error: error.message || `Failed to ${operation}` }
}

export const archivedAppointmentsService = {
  async getArchivedAppointments(currentUser) {
    try {
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'staff')) {
        return { success: false, error: 'Only administrators and staff can view archived appointments', data: [] }
      }

      console.log('🔄 Fetching archived appointments...')
      
      const { data, error } = await supabase
        .from('archived_appointments')
        .select('*')
        .order('archived_at', { ascending: false })

      if (error) {
        console.error('❌ Error fetching archived appointments:', error)
        return handleSupabaseError(error, 'fetch archived appointments')
      }

      console.log('✅ Found', data?.length || 0, 'archived appointments')

      const transformedData = data?.map(item => ({
        archived_id: item.archived_id,
        original_appointment_id: item.original_appointment_id,
        date: item.appointment_date,
        time: item.appointment_time,
        service_type: item.service_type,
        status: item.status,
        created_by: item.created_by,
        archived_at: item.archived_at,
        customer_first_name: item.customer_first_name,
        customer_last_name: item.customer_last_name,
        customer_email: item.customer_email,
        customer_phone: item.customer_phone,
        service_id: item.service_id,
        requirements: item.requirements || [],
        total_payments: item.total_payments || 0,
        payment_count: item.payment_count || 0,
        original_created_at: item.original_created_at,
        original_updated_at: item.original_updated_at
      })) || []

      return { success: true, data: transformedData }
    } catch (error) {
      console.error('💥 Unexpected error:', error)
      return handleSupabaseError(error, 'fetch archived appointments')
    }
  },

  async restoreAppointment(archivedId, currentUser) {
    try {
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'staff')) {
        return { success: false, error: 'Only administrators and staff can restore appointments' }
      }

      console.log('🔄 Restoring archived appointment:', archivedId)
      
      const { data: archivedRecord, error: fetchError } = await supabase
        .from('archived_appointments')
        .select('*')
        .eq('archived_id', archivedId)
        .single()

      if (fetchError) {
        console.error('❌ Error fetching archived record:', fetchError)
        return handleSupabaseError(fetchError, 'fetch archived record')
      }

      if (!archivedRecord) {
        return { success: false, error: 'Archived record not found' }
      }

      console.log('📋 Archived record:', archivedRecord)

      const appointmentPayload = {
        appointment_date: archivedRecord.appointment_date,
        appointment_time: archivedRecord.appointment_time,
        service_type: archivedRecord.service_type,
        status: 'pending', 
        created_by: archivedRecord.created_by,
        customer_first_name: archivedRecord.customer_first_name,
        customer_last_name: archivedRecord.customer_last_name,
        customer_email: archivedRecord.customer_email,
        customer_phone: archivedRecord.customer_phone,
        service_id: archivedRecord.service_id
      }

      const { data: newAppointment, error: createError } = await supabase
        .from('appointments')
        .insert([appointmentPayload])
        .select()
        .single()

      if (createError) {
        console.error('❌ Error creating restored appointment:', createError)
        return handleSupabaseError(createError, 'create restored appointment')
      }

      console.log('✅ New appointment created:', newAppointment)

      if (archivedRecord.requirements && Array.isArray(archivedRecord.requirements)) {
        const requirementsToRestore = archivedRecord.requirements
          .filter(req => req && req.requirement_details)
          .map(req => ({
            appointment_id: newAppointment.appointment_id,
            requirement_details: req.requirement_details
          }))

        if (requirementsToRestore.length > 0) {
          const { error: reqError } = await supabase
            .from('requirements')
            .insert(requirementsToRestore)

          if (reqError) {
            console.error('❌ Error restoring requirements:', reqError)
          }
        }
      }

      if (archivedRecord.total_payments > 0) {
        console.log(`Note: Original appointment had ${archivedRecord.payment_count} payments totaling ${archivedRecord.total_payments}`)
      }

      const { error: deleteError } = await supabase
        .from('archived_appointments')
        .delete()
        .eq('archived_id', archivedId)

      if (deleteError) {
        console.error('❌ Error deleting archived record:', deleteError)
      }

      console.log('✅ Appointment restored successfully')
      return { 
        success: true, 
        data: newAppointment, 
        message: 'Appointment restored successfully!' 
      }
    } catch (error) {
      console.error('💥 Unexpected error restoring:', error)
      return handleSupabaseError(error, 'restore appointment')
    }
  },

  async deleteArchivedAppointment(archivedId, currentUser) {
    try {
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'staff')) {
        return { success: false, error: 'Only administrators and staff can delete archived appointments' }
      }

      const { error } = await supabase
        .from('archived_appointments')
        .delete()
        .eq('archived_id', archivedId)

      if (error) {
        return handleSupabaseError(error, 'delete archived appointment')
      }

      return { 
        success: true, 
        message: 'Archived appointment deleted permanently!' 
      }
    } catch (error) {
      return handleSupabaseError(error, 'delete archived appointment')
    }
  },

  async getArchivedAppointmentStats(currentUser) {
    try {
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'staff')) {
        return { success: false, error: 'Only administrators and staff can view archived appointment stats', data: null }
      }

      const { data, error } = await supabase
        .from('archived_appointments')
        .select('status')

      if (error) {
        return handleSupabaseError(error, 'fetch archived appointment stats')
      }

      const stats = {
        total: data?.length || 0,
        completed: data?.filter(a => a.status === 'completed').length || 0,
        cancelled: data?.filter(a => a.status === 'cancelled').length || 0,
        pending: data?.filter(a => a.status === 'pending').length || 0,
        confirmed: data?.filter(a => a.status === 'confirmed').length || 0,
        expired: data?.filter(a => a.status === 'expired').length || 0,
        noshow: data?.filter(a => a.status === 'noshow').length || 0
      }

      return { success: true, data: stats }
    } catch (error) {
      return handleSupabaseError(error, 'fetch archived appointment stats')
    }
  },

  async archiveCompletedAppointments(currentUser) {
    try {
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'staff')) {
        return { success: false, error: 'Only administrators and staff can archive completed appointments' }
      }

      console.log('🔄 Archiving completed appointments...')
      
      return { 
        success: true, 
        message: 'Please run "SELECT archive_completed_appointments();" in your SQL editor to archive all completed appointments.' 
      }
    } catch (error) {
      console.error('💥 Unexpected error:', error)
      return handleSupabaseError(error, 'archive completed appointments')
    }
  },

  async getArchivedAppointmentDetails(archivedId, currentUser) {
    try {
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'staff')) {
        return { success: false, error: 'Only administrators and staff can view archived appointment details', data: null }
      }

      const { data, error } = await supabase
        .from('archived_appointments')
        .select('*')
        .eq('archived_id', archivedId)
        .single()

      if (error) {
        return handleSupabaseError(error, 'fetch archived appointment details')
      }

      const transformedData = {
        ...data,
        date: data.appointment_date,
        time: data.appointment_time
      }

      return { success: true, data: transformedData }
    } catch (error) {
      return handleSupabaseError(error, 'fetch archived appointment details')
    }
  }
}

export default archivedAppointmentsService;