import { supabase } from '../config/supabaseClient'

const handleSupabaseError = (error, operation) => {
  console.error(`❌ ${operation} error:`, error)
  return { success: false, error: error.message || `Failed to ${operation}` }
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
      
      const { data, error } = await supabase
        .from('donations')
        .insert([{
          donor_name: donationData.donor_name,
          amount: parseFloat(donationData.amount),
          description: donationData.description || null,
          donation_date: new Date().toISOString()
        }])
        .select()

      if (error) {
        return handleSupabaseError(error, 'create donation')
      }

      console.log('✅ Donation created successfully')
      return { 
        success: true, 
        data: data && data.length > 0 ? data[0] : null, 
        message: 'Donation recorded successfully! Thank you for your generosity!' 
      }
    } catch (error) {
      return handleSupabaseError(error, 'create donation')
    }
  },

  async getDonationStats() {
    try {
      // Get all donations
      const { data: donations, error } = await supabase
        .from('donations')
        .select('amount, donation_date')

      if (error) {
        return handleSupabaseError(error, 'fetch donation stats')
      }

      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000))

      const totalAmount = donations?.reduce((sum, donation) => sum + parseFloat(donation.amount || 0), 0) || 0
      const recentDonations = donations?.filter(d => new Date(d.donation_date) >= thirtyDaysAgo) || []
      const recentAmount = recentDonations.reduce((sum, donation) => sum + parseFloat(donation.amount || 0), 0)

      const stats = {
        totalAmount,
        totalCount: donations?.length || 0,
        recentAmount,
        recentCount: recentDonations.length,
        averageAmount: donations?.length > 0 ? totalAmount / donations.length : 0
      }

      return { success: true, data: stats }
    } catch (error) {
      return handleSupabaseError(error, 'fetch donation stats')
    }
  }
}

export default donationService