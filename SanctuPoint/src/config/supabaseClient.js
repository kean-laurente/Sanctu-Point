import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('🔧 Supabase Configuration:', {
  url: supabaseUrl ? '✅ Set' : '❌ Missing',
  key: supabaseAnonKey ? '✅ Set' : '❌ Missing'
})

// Validate URL format
if (supabaseUrl && !supabaseUrl.startsWith('https://')) {
  console.error('❌ Supabase URL must start with https://')
}

// Singleton instance
let supabaseInstance = null

export const getSupabaseClient = () => {
  if (!supabaseInstance) {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('⚠️ Supabase environment variables not configured. Using mock mode.')
      supabaseInstance = createMockClient()
    } else {
      try {
        supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: false, // We're using custom auth, disable Supabase auth persistence
            autoRefreshToken: false,
            detectSessionInUrl: false
          },
          global: {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          }
        })
        console.log('✅ Supabase client created successfully')
      } catch (error) {
        console.error('❌ Failed to create Supabase client:', error)
        supabaseInstance = createMockClient()
      }
    }
  }
  return supabaseInstance
}

export const supabase = getSupabaseClient()

// Mock client for development
function createMockClient() {
  console.log('🔄 Using mock Supabase client')
  return {
    from: (table) => ({
      select: (columns = '*') => ({
        single: () => Promise.resolve({ 
          data: null, 
          error: { message: 'Supabase not configured', code: 'MOCK_ERROR' } 
        }),
        order: (column, options = { ascending: true }) => Promise.resolve({ 
          data: getMockData(table), 
          error: null 
        }),
        eq: (column, value) => ({
          single: () => Promise.resolve({ 
            data: null, 
            error: { message: 'Supabase not configured', code: 'MOCK_ERROR' } 
          }),
          order: (column, options = { ascending: true }) => Promise.resolve({ 
            data: [], 
            error: null 
          })
        }),
        or: (conditions) => ({
          eq: (column, value) => ({
            single: () => Promise.resolve({ 
              data: null, 
              error: { message: 'Supabase not configured', code: 'MOCK_ERROR' } 
            })
          })
        })
      }),
      insert: (data) => ({
        select: (columns = '*') => ({
          single: () => Promise.resolve({ 
            data: data && data[0] ? { ...data[0], id: Date.now() } : null, 
            error: { message: 'Supabase not configured', code: 'MOCK_ERROR' } 
          })
        })
      }),
      update: (data) => ({
        select: (columns = '*') => ({
          single: () => Promise.resolve({ 
            data: data, 
            error: { message: 'Supabase not configured', code: 'MOCK_ERROR' } 
          })
        }),
        eq: (column, value) => Promise.resolve({ 
          error: { message: 'Supabase not configured', code: 'MOCK_ERROR' } 
        })
      }),
      delete: () => ({
        eq: (column, value) => Promise.resolve({ 
          error: { message: 'Supabase not configured', code: 'MOCK_ERROR' } 
        })
      })
    })
  }
}

function getMockData(table) {
  if (table === 'services') {
    return [
      {
        service_id: 1,
        service_name: 'Sunday Worship Service',
        description: 'Join us for our main Sunday worship service',
        price: 0.00,
        created_at: new Date().toISOString()
      },
      {
        service_id: 2,
        service_name: 'Baptism Ceremony',
        description: 'Water baptism ceremony for new believers',
        price: 0.00,
        created_at: new Date().toISOString()
      }
    ]
  }
  if (table === 'users') {
    return [
      {
        user_id: 1,
        username: 'admin',
        password: 'Admin123!',
        first_name: 'System',
        last_name: 'Administrator',
        email: 'admin@example.com',
        role: 'admin'
      }
    ]
  }
  return []
}