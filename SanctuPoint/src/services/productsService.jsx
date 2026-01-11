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

export const productsService = {
  async getProducts() {
    try {
      console.log('🔄 Fetching products...');
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_available', true)
        .order('product_name', { ascending: true });

      if (error) {
        return handleSupabaseError(error, 'fetch products');
      }

      console.log('✅ Products fetched:', data?.length || 0);
      return { success: true, data: data || [] };
    } catch (error) {
      return handleSupabaseError(error, 'fetch products');
    }
  },

  async createProduct(productData, currentUser) {
    try {
      if (!currentUser || currentUser.role !== 'admin') {
        return { success: false, error: 'Only administrators can create products' };
      }

      console.log('🔄 Creating product:', productData.product_name);

      const { data, error } = await supabase
        .from('products')
        .insert([{
          product_name: productData.product_name,
          description: productData.description,
          price: productData.price,
          category: productData.category || 'offering',
          requires_quantity: productData.requires_quantity !== false,
          max_quantity: productData.max_quantity || 10,
          min_quantity: productData.min_quantity || 1,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        return handleSupabaseError(error, 'create product');
      }

      console.log('✅ Product created successfully');
      return { 
        success: true, 
        data, 
        message: 'Product created successfully!' 
      };
    } catch (error) {
      return handleSupabaseError(error, 'create product');
    }
  },

  async updateProduct(productId, productData, currentUser) {
    try {
      if (!currentUser || currentUser.role !== 'admin') {
        return { success: false, error: 'Only administrators can update products' };
      }

      const { data, error } = await supabase
        .from('products')
        .update({
          product_name: productData.product_name,
          description: productData.description,
          price: productData.price,
          category: productData.category,
          requires_quantity: productData.requires_quantity,
          max_quantity: productData.max_quantity,
          min_quantity: productData.min_quantity,
          is_available: productData.is_available,
          updated_at: new Date().toISOString()
        })
        .eq('product_id', productId)
        .select()
        .single();

      if (error) {
        return handleSupabaseError(error, 'update product');
      }

      return { 
        success: true, 
        data, 
        message: 'Product updated successfully!' 
      };
    } catch (error) {
      return handleSupabaseError(error, 'update product');
    }
  },

  async deleteProduct(productId, currentUser) {
    try {
      if (!currentUser || currentUser.role !== 'admin') {
        return { success: false, error: 'Only administrators can delete products' };
      }

      const [appointmentsCheck, purchasesCheck] = await Promise.all([
        supabase
          .from('appointment_products')
          .select('appointment_product_id')
          .eq('product_id', productId)
          .limit(1),
        supabase
          .from('purchase_items')
          .select('purchase_item_id')
          .eq('product_id', productId)
          .limit(1)
      ]);

      if ((appointmentsCheck.data && appointmentsCheck.data.length > 0) ||
          (purchasesCheck.data && purchasesCheck.data.length > 0)) {
        return { 
          success: false, 
          error: 'Cannot delete product. It is being used in existing appointments or purchases.' 
        };
      }

      const { error } = await supabase
        .from('products')
        .delete()
        .eq('product_id', productId);

      if (error) {
        return handleSupabaseError(error, 'delete product');
      }

      return { success: true, message: 'Product deleted successfully!' };
    } catch (error) {
      return handleSupabaseError(error, 'delete product');
    }
  },

  async getAppointmentProducts(appointmentId) {
    try {
      const { data, error } = await supabase
        .from('appointment_products')
        .select(`
          *,
          products:product_id(
            product_name,
            description,
            category
          )
        `)
        .eq('appointment_id', appointmentId)
        .order('created_at', { ascending: true });

      if (error) {
        return handleSupabaseError(error, 'fetch appointment products');
      }

      return { success: true, data: data || [] };
    } catch (error) {
      return handleSupabaseError(error, 'fetch appointment products');
    }
  },

  async addProductsToAppointment(appointmentId, products, currentUser) {
    try {
      if (!currentUser) {
        return { success: false, error: 'Authentication required' };
      }

      if (!products || !Array.isArray(products) || products.length === 0) {
        return { success: true, data: [] }; 
      }

      const validProducts = products.filter(p => 
        p.product_id && p.quantity > 0 && p.unit_price >= 0
      );

      if (validProducts.length === 0) {
        return { success: true, data: [] };
      }

      const productData = validProducts.map(product => ({
        appointment_id: appointmentId,
        product_id: product.product_id,
        quantity: product.quantity,
        unit_price: product.unit_price,
        total_price: product.quantity * product.unit_price,
        created_at: new Date().toISOString()
      }));

      const totalOffering = productData.reduce((sum, p) => sum + p.total_price, 0);

      const { data, error } = await supabase
        .from('appointment_products')
        .insert(productData)
        .select();

      if (error) {
        return handleSupabaseError(error, 'add products to appointment');
      }

      await supabase
        .from('appointments')
        .update({ 
          offering_total: totalOffering,
          updated_at: new Date().toISOString()
        })
        .eq('appointment_id', appointmentId);

      console.log('✅ Products added to appointment:', data?.length || 0);
      return { 
        success: true, 
        data: data || [], 
        message: 'Products added successfully!' 
      };
    } catch (error) {
      return handleSupabaseError(error, 'add products to appointment');
    }
  },

  async removeProductFromAppointment(appointmentProductId, currentUser) {
    try {
      if (!currentUser) {
        return { success: false, error: 'Authentication required' };
      }

      const { data: product, error: fetchError } = await supabase
        .from('appointment_products')
        .select('appointment_id, total_price')
        .eq('appointment_product_id', appointmentProductId)
        .single();

      if (fetchError) {
        return handleSupabaseError(fetchError, 'fetch appointment product');
      }

      const { error: deleteError } = await supabase
        .from('appointment_products')
        .delete()
        .eq('appointment_product_id', appointmentProductId);

      if (deleteError) {
        return handleSupabaseError(deleteError, 'remove product from appointment');
      }

      const { data: remainingProducts } = await supabase
        .from('appointment_products')
        .select('total_price')
        .eq('appointment_id', product.appointment_id);

      const newTotal = remainingProducts?.reduce((sum, p) => sum + p.total_price, 0) || 0;

      await supabase
        .from('appointments')
        .update({ 
          offering_total: newTotal,
          updated_at: new Date().toISOString()
        })
        .eq('appointment_id', product.appointment_id);

      return { 
        success: true, 
        message: 'Product removed successfully!' 
      };
    } catch (error) {
      return handleSupabaseError(error, 'remove product from appointment');
    }
  },

  async createStandalonePurchase(purchaseData, currentUser) {
    try {
      console.log('🔄 Creating standalone purchase...');

      const receiptNumber = 'OFFR-' + 
        new Date().getFullYear().toString().slice(-2) +
        (new Date().getMonth() + 1).toString().padStart(2, '0') +
        new Date().getDate().toString().padStart(2, '0') + '-' +
        Math.floor(Math.random() * 10000).toString().padStart(4, '0');

      const totalAmount = purchaseData.products.reduce(
        (sum, product) => sum + (product.quantity * product.unit_price), 
        0
      );

      const amountPaid = parseFloat(purchaseData.amount_paid) || 0;
      const changeAmount = Math.max(0, amountPaid - totalAmount);

      if (amountPaid < totalAmount) {
        return {
          success: false,
          error: `Payment amount (₱${amountPaid.toFixed(2)}) is less than total (₱${totalAmount.toFixed(2)})`
        };
      }

      const purchasePayload = {
        receipt_number: receiptNumber,
        customer_name: purchaseData.customer_name,
        customer_email: purchaseData.customer_email,
        customer_phone: purchaseData.customer_phone,
        total_amount: totalAmount,
        amount_paid: amountPaid,
        change_amount: changeAmount,
        payment_method: 'cash',
        purchase_date: new Date().toISOString().split('T')[0],
        created_by: currentUser.user_id
      };

      const { data: purchase, error: purchaseError } = await supabase
        .from('standalone_purchases')
        .insert([purchasePayload])
        .select()
        .single();

      if (purchaseError) {
        return handleSupabaseError(purchaseError, 'create standalone purchase');
      }

      const purchaseItems = purchaseData.products.map(product => ({
        purchase_id: purchase.purchase_id,
        product_id: product.product_id,
        product_name: product.product_name,
        quantity: product.quantity,
        unit_price: product.unit_price,
        total_price: product.quantity * product.unit_price
      }));

      const { error: itemsError } = await supabase
        .from('purchase_items')
        .insert(purchaseItems);

      if (itemsError) {
        await supabase.from('standalone_purchases').delete().eq('purchase_id', purchase.purchase_id);
        return handleSupabaseError(itemsError, 'create purchase items');
      }

      console.log('✅ Standalone purchase created:', purchase.purchase_id);
      return { 
        success: true, 
        data: purchase, 
        message: 'Offering recorded successfully! Receipt: ' + receiptNumber 
      };
    } catch (error) {
      return handleSupabaseError(error, 'create standalone purchase');
    }
  },

  async getStandalonePurchases(currentUser, filters = {}) {
    try {
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'staff')) {
        return { success: false, error: 'Only administrators and staff can view standalone purchases' };
      }

      let query = supabase
        .from('standalone_purchases')
        .select(`
          *,
          purchase_items:purchase_items(
            *,
            products:product_id(product_name, description)
          )
        `)
        .order('created_at', { ascending: false });

      if (filters.startDate) {
        query = query.gte('purchase_date', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('purchase_date', filters.endDate);
      }
      if (filters.customerName) {
        query = query.ilike('customer_name', `%${filters.customerName}%`);
      }
      if (filters.receiptNumber) {
        query = query.ilike('receipt_number', `%${filters.receiptNumber}%`);
      }

      const { data, error } = await query;

      if (error) {
        return handleSupabaseError(error, 'fetch standalone purchases');
      }

      return { success: true, data: data || [] };
    } catch (error) {
      return handleSupabaseError(error, 'fetch standalone purchases');
    }
  },

  async getPurchaseByReceipt(receiptNumber, currentUser) {
    try {
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'staff')) {
        return { success: false, error: 'Only administrators and staff can view purchases' };
      }

      const { data, error } = await supabase
        .from('standalone_purchases')
        .select(`
          *,
          purchase_items:purchase_items(
            *,
            products:product_id(product_name, description)
          )
        `)
        .eq('receipt_number', receiptNumber)
        .single();

      if (error) {
        return handleSupabaseError(error, 'fetch purchase by receipt');
      }

      return { success: true, data };
    } catch (error) {
      return handleSupabaseError(error, 'fetch purchase by receipt');
    }
  }
};

export default productsService;