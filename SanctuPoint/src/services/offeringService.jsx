import { supabase } from '../config/supabaseClient'
import { productsService } from './productsService'

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

export const offeringService = {
  async processOfferingOnly(offeringData, currentUser) {
    try {
      console.log('🔄 Processing offering only...');

      const productsResult = await productsService.getProducts();
      if (!productsResult.success) {
        return productsResult;
      }

      const availableProducts = productsResult.data;
      
      const validOfferingItems = offeringData.items.filter(item => {
        const product = availableProducts.find(p => p.product_id === item.product_id);
        return product && item.quantity > 0;
      });

      if (validOfferingItems.length === 0) {
        return { success: false, error: 'No valid offering items selected' };
      }

      const purchaseData = {
        customer_name: offeringData.customer_name || 'Anonymous Donor', 
        customer_email: offeringData.customer_email || '',
        customer_phone: offeringData.customer_phone || '',
        amount_paid: offeringData.amount_paid,
        products: validOfferingItems.map(item => ({
          product_id: item.product_id,
          product_name: availableProducts.find(p => p.product_id === item.product_id)?.product_name || 'Unknown',
          quantity: item.quantity,
          unit_price: item.unit_price || availableProducts.find(p => p.product_id === item.product_id)?.price || 0
        }))
      };

      const result = await productsService.createStandalonePurchase(purchaseData, currentUser);
      
      if (result.success) {
        console.log('✅ Offering processed successfully');
        return { 
          success: true, 
          data: result.data,
          message: 'Offering recorded successfully! Receipt: ' + result.data.receipt_number 
        };
      } else {
        return result;
      }
    } catch (error) {
      return handleSupabaseError(error, 'process offering only');
    }
  },

  async getDailyOfferingsReport(date = null) {
    try {
      const reportDate = date || new Date().toISOString().split('T')[0];
      
      console.log('📅 Generating daily offerings report for:', reportDate);

      const { data: purchases, error: purchasesError } = await supabase
        .from('standalone_purchases')
        .select(`
          *,
          purchase_items:purchase_items(*)
        `)
        .eq('purchase_date', reportDate)
        .order('created_at', { ascending: true });

      if (purchasesError) {
        return handleSupabaseError(purchasesError, 'fetch daily purchases');
      }

      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          *,
          appointment_products:appointment_products(
            *,
            products:product_id(product_name)
          )
        `)
        .eq('appointment_date', reportDate)
        .gt('offering_total', 0)
        .order('appointment_time', { ascending: true });

      if (appointmentsError) {
        console.warn('Could not fetch appointments with offerings:', appointmentsError);
      }

      const standaloneTotal = purchases?.reduce((sum, p) => sum + (p.total_amount || 0), 0) || 0;
      const appointmentOfferingsTotal = appointments?.reduce((sum, a) => sum + (a.offering_total || 0), 0) || 0;
      const totalOfferings = standaloneTotal + appointmentOfferingsTotal;

      const formattedPurchases = purchases?.map(purchase => ({
        type: 'standalone',
        receipt_number: purchase.receipt_number,
        customer_name: purchase.customer_name,
        total_amount: purchase.total_amount,
        amount_paid: purchase.amount_paid,
        change_amount: purchase.change_amount,
        items: purchase.purchase_items || [],
        created_at: purchase.created_at
      })) || [];

      const formattedAppointments = appointments?.map(appointment => ({
        type: 'appointment',
        receipt_number: appointment.receipt_number,
        customer_name: `${appointment.customer_first_name} ${appointment.customer_last_name}`,
        service_type: appointment.service_type,
        total_amount: appointment.offering_total,
        items: appointment.appointment_products || [],
        appointment_time: appointment.appointment_time
      })) || [];

      const allOfferings = [...formattedPurchases, ...formattedAppointments]
        .sort((a, b) => new Date(a.created_at || b.appointment_time) - new Date(b.created_at || a.appointment_time));

      return {
        success: true,
        data: {
          reportDate,
          totals: {
            standalone_purchases: formattedPurchases.length,
            appointments_with_offerings: formattedAppointments.length,
            standalone_total: standaloneTotal,
            appointment_offerings_total: appointmentOfferingsTotal,
            total_offerings: totalOfferings
          },
          offerings: allOfferings
        },
        message: `Daily offerings report: ${allOfferings.length} offerings, ₱${totalOfferings.toFixed(2)} total`
      };
    } catch (error) {
      return handleSupabaseError(error, 'generate daily offerings report');
    }
  },

  async getOfferingsSummary(startDate, endDate, currentUser) {
    try {
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'staff')) {
        return { success: false, error: 'Only administrators and staff can view offerings summary' };
      }

      const { data: purchases, error: purchasesError } = await supabase
        .from('standalone_purchases')
        .select('total_amount, purchase_date')
        .gte('purchase_date', startDate)
        .lte('purchase_date', endDate);

      if (purchasesError) {
        console.warn('Could not fetch purchases:', purchasesError);
      }

      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select('offering_total, appointment_date')
        .gte('appointment_date', startDate)
        .lte('appointment_date', endDate)
        .gt('offering_total', 0);

      if (appointmentsError) {
        console.warn('Could not fetch appointments:', appointmentsError);
      }

      const standaloneTotal = purchases?.reduce((sum, p) => sum + (p.total_amount || 0), 0) || 0;
      const appointmentOfferingsTotal = appointments?.reduce((sum, a) => sum + (a.offering_total || 0), 0) || 0;
      const totalOfferings = standaloneTotal + appointmentOfferingsTotal;

      const { data: topProducts, error: productsError } = await supabase
        .from('purchase_items')
        .select(`
          product_name,
          quantity,
          total_price,
          standalone_purchases!inner(purchase_date)
        `)
        .gte('standalone_purchases.purchase_date', startDate)
        .lte('standalone_purchases.purchase_date', endDate)
        .order('total_price', { ascending: false })
        .limit(5);

      if (productsError) {
        console.warn('Could not fetch top products:', productsError);
      }

      const summary = {
        date_range: { startDate, endDate },
        totals: {
          standalone_purchases: purchases?.length || 0,
          appointments_with_offerings: appointments?.length || 0,
          standalone_total: standaloneTotal,
          appointment_offerings_total: appointmentOfferingsTotal,
          total_offerings: totalOfferings
        },
        top_products: topProducts || [],
        daily_average: totalOfferings / Math.max(1, Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)))
      };

      return { success: true, data: summary };
    } catch (error) {
      return handleSupabaseError(error, 'get offerings summary');
    }
  }
};

export default offeringService;