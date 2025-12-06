import { supabase } from '../config/supabaseClient'

const handleSupabaseError = (error, operation) => {
  console.error(`❌ ${operation} error:`, error)
  
  if (error.code === 'PGRST116') {
    return { success: false, error: 'No data found' }
  }
  if (error.code === '42501') {
    return { success: false, error: 'Permission denied. Check RLS policies.' }
  }
  if (error.code === '406') {
    return { success: false, error: 'Server cannot return requested format' }
  }
  
  return { success: false, error: error.message || `Failed to ${operation}` }
}

export const servicesService = {
  async getServices() {
    try {
      console.log('🔄 Fetching services...')
      
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('service_name', { ascending: true })

      if (error) {
        return handleSupabaseError(error, 'fetch services')
      }

      console.log('✅ Services fetched:', data?.length || 0)
      return { success: true, data: data || [] }
    } catch (error) {
      return handleSupabaseError(error, 'fetch services')
    }
  },

  async createService(serviceData, currentUser) {
    try {
      if (!currentUser || currentUser.role !== 'admin') {
        return { success: false, error: 'Only administrators can create services' }
      }

      console.log('🔄 Creating service:', serviceData.service_name)

      const { data, error } = await supabase
        .from('services')
        .insert([{
          service_name: serviceData.service_name,
          description: serviceData.description,
          price: serviceData.price,
          created_at: new Date().toISOString()
        }])
        .select()

      if (error) {
        return handleSupabaseError(error, 'create service')
      }

      console.log('✅ Service created successfully')
      return { 
        success: true, 
        data: data && data.length > 0 ? data[0] : null, 
        message: 'Service created successfully!' 
      }
    } catch (error) {
      return handleSupabaseError(error, 'create service')
    }
  },

  async updateService(serviceId, serviceData, currentUser) {
    try {
      if (!currentUser || currentUser.role !== 'admin') {
        return { success: false, error: 'Only administrators can update services' }
      }

      const { data, error } = await supabase
        .from('services')
        .update({
          service_name: serviceData.service_name,
          description: serviceData.description,
          price: serviceData.price
        })
        .eq('service_id', serviceId)
        .select()

      if (error) {
        return handleSupabaseError(error, 'update service')
      }

      return { 
        success: true, 
        data: data && data.length > 0 ? data[0] : null, 
        message: 'Service updated successfully!' 
      }
    } catch (error) {
      return handleSupabaseError(error, 'update service')
    }
  },

  async deleteService(serviceId, currentUser) {
    try {
      if (!currentUser || currentUser.role !== 'admin') {
        return { success: false, error: 'Only administrators can delete services' }
      }

      const { error } = await supabase
        .from('services')
        .delete()
        .eq('service_id', serviceId)

      if (error) {
        return handleSupabaseError(error, 'delete service')
      }

      return { success: true, message: 'Service deleted successfully!' }
    } catch (error) {
      return handleSupabaseError(error, 'delete service')
    }
  }
}

export default servicesService