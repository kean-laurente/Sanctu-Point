import { supabase } from '../config/supabaseClient'

const rolePermissions = {
  admin: ['*', 'manage_users', 'manage_staff', 'manage_schedules', 'view_all_appointments'],
  staff: ['view_schedules', 'manage_own_appointments', 'view_own_calendar']
};

const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (password.length < minLength) return 'Password must be at least 8 characters long';
  if (!hasUpperCase) return 'Password must contain at least one uppercase letter';
  if (!hasLowerCase) return 'Password must contain at least one lowercase letter';
  if (!hasNumbers) return 'Password must contain at least one number';
  if (!hasSpecialChar) return 'Password must contain at least one special character';
  return null;
};

export const authService = {
  async login(identifier, password) {
    try {
      console.log('Login attempt for:', identifier);
      
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .or(`username.eq.${identifier},email.eq.${identifier}`)
        .eq('password', password)
        .single();

      if (error || !user) {
        return {
          success: false,
          user: null,
          message: 'Invalid username/email or password'
        };
      }

      const userSession = {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        full_name: `${user.first_name} ${user.last_name}`,
        phone_number: user.phone_number,
        role: user.role,
        permissions: rolePermissions[user.role] || [],
        isAuthenticated: true,
        loginTime: new Date().toISOString(),
        created_by: user.created_by
      };

      localStorage.setItem('user', JSON.stringify(userSession));
      
      return {
        success: true,
        user: userSession,
        message: `Login successful! Welcome ${user.first_name}`
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        user: null,
        message: 'An error occurred during login'
      };
    }
  },

  // ... rest of your authService methods remain the same
  async logout() {
    localStorage.removeItem('user');
    return { success: true, message: 'Logout successful!' };
  },

  isAuthenticated() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user).isAuthenticated === true : false;
  },

  getCurrentUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  hasRole(role) {
    const user = this.getCurrentUser();
    return user && user.role === role;
  },

  async registerStaff(userData, currentAdmin) {
    try {
      if (!currentAdmin || currentAdmin.role !== 'admin') {
        return { success: false, message: 'Only administrators can register staff accounts' };
      }

      const { username, password, first_name, last_name, email, phone_number = '' } = userData;

      // Phone validation
      if (phone_number) {
        const cleanNumber = phone_number.replace(/[\s\-\(\)]/g, '');
        const phPattern = /^(\+63|09|9)\d{9}$/;
        if (!phPattern.test(cleanNumber)) {
          return { success: false, message: 'Please enter a valid Philippine phone number' };
        }
      }

      // Password validation
      const passwordError = validatePassword(password);
      if (passwordError) return { success: false, message: passwordError };

      // Check existing users
      const { data: existingUser } = await supabase
        .from('users')
        .select('user_id')
        .or(`username.eq.${username},email.eq.${email}`)
        .single();

      if (existingUser) {
        return { success: false, message: 'Username or email already exists' };
      }

      // Create staff
      const { data: newStaff, error } = await supabase
        .from('users')
        .insert([{
          username, password, first_name, last_name, email,
          phone_number: phone_number || null, role: 'staff',
          created_by: currentAdmin.username, created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      return { success: true, message: `Staff account for ${first_name} ${last_name} created!` };
    } catch (error) {
      console.error('Staff creation error:', error);
      return { success: false, message: 'Failed to create staff account' };
    }
  },

  async getStaffMembers() {
    try {
      const { data: staff, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'staff')
        .order('created_at', { ascending: false });

      return error ? [] : staff || [];
    } catch (error) {
      return [];
    }
  },

  async deleteStaff(staffId, currentAdmin) {
    try {
      if (!currentAdmin || currentAdmin.role !== 'admin') {
        return { success: false, message: 'Only administrators can delete staff accounts' };
      }

      const { error } = await supabase
        .from('users')
        .delete()
        .eq('user_id', staffId);

      if (error) throw error;

      return { success: true, message: 'Staff account deleted successfully' };
    } catch (error) {
      return { success: false, message: 'Failed to delete staff account' };
    }
  }
};

export default authService;