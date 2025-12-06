// src/components/TestConnection.jsx
import { useEffect } from 'react'
import { supabase } from '../config/supabaseClient'
import { servicesService } from '../services/servicesService'

const TestConnection = () => {
  useEffect(() => {
    testConnection()
  }, [])

  const testConnection = async () => {
    console.log('🧪 Testing Supabase connection...')
    
    // Test 1: Basic Supabase connection
    try {
      const { data, error } = await supabase
        .from('services')
        .select('count')
        .limit(1)
      
      if (error) {
        console.error('❌ Supabase connection failed:', error)
      } else {
        console.log('✅ Supabase connection successful')
      }
    } catch (error) {
      console.error('❌ Supabase connection error:', error)
    }

    // Test 2: Services fetch
    try {
      const result = await servicesService.getServices()
      if (result.success) {
        console.log('✅ Services fetch successful:', result.data.length, 'services')
      } else {
        console.error('❌ Services fetch failed:', result.error)
      }
    } catch (error) {
      console.error('❌ Services fetch error:', error)
    }
  }

  return (
    <div style={{ padding: '20px', background: '#f5f5f5' }}>
      <h3>Connection Test</h3>
      <p>Check browser console for connection status</p>
    </div>
  )
}

export default TestConnection