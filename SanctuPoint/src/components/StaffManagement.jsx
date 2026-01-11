import { useState, useEffect } from 'react';
import { authService } from '../auth/authService';
import { supabase } from '../config/supabaseClient';

const StaffManagement = ({ currentUser, onStaffUpdate }) => {
  const [showForm, setShowForm] = useState(false);
  const [staffMembers, setStaffMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [formData, setFormData] = useState({
    username: '', 
    first_name: '', 
    last_name: '', 
    email: '', 
    phone_number: '', 
    password: ''
  });

  const [adminProfile, setAdminProfile] = useState({
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    phone_number: ''
  });
  
  const [passwordChange, setPasswordChange] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffEditForm, setStaffEditForm] = useState({
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    phone_number: ''
  });

  const isValidPhilippineNumber = (phone) => {
    if (!phone) return true;
    const clean = phone.replace(/[^\d]/g, '');
    return /^(09\d{9}|9\d{9})$/.test(clean);
  };

  const validatePhoneNumber = (phone) => {
    if (!phone) return null; 
    
    const clean = phone.replace(/[^\d]/g, '');
    
    if (clean.length < 10) {
      return 'Phone number must be at least 10 digits';
    }
    
    if (clean.length > 11) {
      return 'Phone number cannot exceed 11 digits';
    }
    
    if (!/^(09|9)/.test(clean)) {
      return 'Philippine numbers must start with 09 or 9';
    }
    
    if (!isValidPhilippineNumber(phone)) {
      return 'Please enter a valid Philippine phone number';
    }
    
    return null;
  };

  const validatePassword = (password) => {
    const errors = [];
    
    if (password.length < 8) errors.push('Minimum 8 characters');
    if (!/[A-Z]/.test(password)) errors.push('Need uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('Need lowercase letter');
    if (!/\d/.test(password)) errors.push('Need number');
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('Need special character');
    
    return errors.length > 0 ? errors.join(', ') : null;
  };

  useEffect(() => {
    loadStaffMembers();
    loadAdminProfile();
  }, []);

  const loadStaffMembers = async () => {
    const staff = await authService.getStaffMembers();
    setStaffMembers(staff);
  };

  const loadAdminProfile = () => {
    if (currentUser && currentUser.role === 'admin') {
      setAdminProfile({
        username: currentUser.username || '',
        first_name: currentUser.first_name || '',
        last_name: currentUser.last_name || '',
        email: currentUser.email || '',
        phone_number: currentUser.phone_number || ''
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    if (!formData.username || !formData.first_name || !formData.last_name || 
        !formData.email || !formData.password) {
      setMessage('Please fill in all required fields');
      setLoading(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setMessage('Please enter a valid email address');
      setLoading(false);
      return;
    }

    if (formData.phone_number) {
      const phoneError = validatePhoneNumber(formData.phone_number);
      if (phoneError) {
        setMessage(phoneError);
        setLoading(false);
        return;
      }
    }

    const passwordError = validatePassword(formData.password);
    if (passwordError) {
      setMessage(`Password error: ${passwordError}`);
      setLoading(false);
      return;
    }

    const submissionData = {
      ...formData,
      phone_number: formData.phone_number ? formData.phone_number.replace(/[^\d]/g, '') : ''
    };

    const result = await authService.registerStaff(submissionData, currentUser);
    setMessage(result.message);
    
    if (result.success) {
      setFormData({ 
        username: '', 
        first_name: '', 
        last_name: '', 
        email: '', 
        phone_number: '', 
        password: '' 
      });
      setShowForm(false);
      loadStaffMembers();
      onStaffUpdate?.();
    }
    
    setLoading(false);
  };

  const handleStaffEdit = (staff) => {
    setEditingStaff(staff);
    setStaffEditForm({
      username: staff.username || '',
      first_name: staff.first_name || '',
      last_name: staff.last_name || '',
      email: staff.email || '',
      phone_number: staff.phone_number || ''
    });
  };

  const handleStaffUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (!editingStaff) {
      setMessage('No staff selected for editing');
      setLoading(false);
      return;
    }

    const errors = [];
    
    if (!staffEditForm.username.trim()) errors.push('Username is required');
    if (!staffEditForm.first_name.trim()) errors.push('First name is required');
    if (!staffEditForm.last_name.trim()) errors.push('Last name is required');
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!staffEditForm.email.trim()) {
      errors.push('Email is required');
    } else if (!emailRegex.test(staffEditForm.email)) {
      errors.push('Please enter a valid email address');
    }
    
    if (staffEditForm.phone_number && staffEditForm.phone_number.trim()) {
      const phoneError = validatePhoneNumber(staffEditForm.phone_number);
      if (phoneError) errors.push(phoneError);
    }
    
    if (errors.length > 0) {
      setMessage(errors.join(', '));
      setLoading(false);
      return;
    }

    try {
      const cleanedPhone = staffEditForm.phone_number ? 
        staffEditForm.phone_number.replace(/[^\d]/g, '') : '';

      const { error } = await supabase
        .from('users')
        .update({
          username: staffEditForm.username,
          first_name: staffEditForm.first_name,
          last_name: staffEditForm.last_name,
          email: staffEditForm.email,
          phone_number: cleanedPhone || null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', editingStaff.user_id)
        .eq('role', 'staff');

      if (error) {
        throw error;
      }

      setMessage('Staff profile updated successfully!');
      setEditingStaff(null);
      loadStaffMembers();
      
    } catch (error) {
      console.error('Staff update error:', error);
      setMessage('Failed to update staff profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMessage('');

    const errors = [];
    
    if (!adminProfile.username.trim()) errors.push('Username is required');
    if (!adminProfile.first_name.trim()) errors.push('First name is required');
    if (!adminProfile.last_name.trim()) errors.push('Last name is required');
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!adminProfile.email.trim()) {
      errors.push('Email is required');
    } else if (!emailRegex.test(adminProfile.email)) {
      errors.push('Please enter a valid email address');
    }
    
    if (adminProfile.phone_number && adminProfile.phone_number.trim()) {
      const phoneError = validatePhoneNumber(adminProfile.phone_number);
      if (phoneError) errors.push(phoneError);
    }
    
    if (errors.length > 0) {
      setProfileMessage(errors.join(', '));
      setProfileLoading(false);
      return;
    }

    try {
      const cleanedPhone = adminProfile.phone_number ? 
        adminProfile.phone_number.replace(/[^\d]/g, '') : '';

      const { error } = await supabase
        .from('users')
        .update({
          username: adminProfile.username,
          first_name: adminProfile.first_name,
          last_name: adminProfile.last_name,
          email: adminProfile.email,
          phone_number: cleanedPhone || null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', currentUser.user_id)
        .eq('role', 'admin');

      if (error) {
        throw error;
      }

      const updatedUser = {
        ...currentUser,
        username: adminProfile.username,
        first_name: adminProfile.first_name,
        last_name: adminProfile.last_name,
        full_name: `${adminProfile.first_name} ${adminProfile.last_name}`,
        email: adminProfile.email,
        phone_number: cleanedPhone || ''
      };

      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      onStaffUpdate?.();
      
      setProfileMessage('Profile updated successfully!');
      setIsEditingProfile(false);
      
    } catch (error) {
      console.error('Update error:', error);
      setProfileMessage('Failed to update profile. Please try again.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMessage('');

    const errors = [];
    
    if (!passwordChange.currentPassword) {
      errors.push('Current password is required');
    }
    
    if (!passwordChange.newPassword) {
      errors.push('New password is required');
    } else {
      const passwordError = validatePassword(passwordChange.newPassword);
      if (passwordError) errors.push(`New password: ${passwordError}`);
    }
    
    if (!passwordChange.confirmPassword) {
      errors.push('Please confirm your new password');
    } else if (passwordChange.newPassword !== passwordChange.confirmPassword) {
      errors.push('New password and confirmation do not match');
    }
    
    if (errors.length > 0) {
      setProfileMessage(errors.join(', '));
      setProfileLoading(false);
      return;
    }

    try {
      const { data: user, error: verifyError } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', currentUser.user_id)
        .eq('password', passwordChange.currentPassword)
        .single();

      if (verifyError || !user) {
        setProfileMessage('Current password is incorrect');
        setProfileLoading(false);
        return;
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({
          password: passwordChange.newPassword,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', currentUser.user_id);

      if (updateError) {
        throw updateError;
      }

      setProfileMessage('Password changed successfully!');
      setPasswordChange({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setShowPasswordForm(false);
      
    } catch (error) {
      console.error('Password change error:', error);
      setProfileMessage('Failed to change password. Please try again.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleCancelProfileEdit = () => {
    setAdminProfile({
      username: currentUser.username || '',
      first_name: currentUser.first_name || '',
      last_name: currentUser.last_name || '',
      email: currentUser.email || '',
      phone_number: currentUser.phone_number || ''
    });
    setIsEditingProfile(false);
    setProfileMessage('');
  };

  const handleCancelStaffEdit = () => {
    setEditingStaff(null);
    setMessage('');
  };

  const handleCancelPasswordChange = () => {
    setPasswordChange({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setShowPasswordForm(false);
    setProfileMessage('');
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return 'Not provided';
    const clean = phone.replace(/[^\d]/g, '');
    if (clean.length === 11) {
      return `${clean.substring(0, 4)} ${clean.substring(4, 7)} ${clean.substring(7)}`;
    }
    if (clean.length === 10) {
      return `${clean.substring(0, 3)} ${clean.substring(3, 6)} ${clean.substring(6)}`;
    }
    return clean;
  };

  return (
    <div className="staff-management">
      <div className="management-section">
        <div className="section-header">
          <h3>Staff Management</h3>
          <button 
            onClick={() => setShowForm(!showForm)} 
            className="add-staff-button"
            disabled={loading || profileLoading || editingStaff}
          >
            {showForm ? 'Cancel' : 'Add Staff'}
          </button>
        </div>

        {message && (
          <div className={`message ${message.includes('successfully') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}

        {showForm && !editingStaff && (
          <form onSubmit={handleSubmit} className="staff-form">
            <h4>Add New Staff</h4>
            
            <div className="form-row">
              <div className="form-field">
                <label>First Name *</label>
                <input 
                  type="text" 
                  name="first_name" 
                  placeholder="First Name" 
                  value={formData.first_name} 
                  onChange={(e) => setFormData({...formData, first_name: e.target.value})} 
                  required 
                  disabled={loading}
                />
              </div>
              
              <div className="form-field">
                <label>Last Name *</label>
                <input 
                  type="text" 
                  name="last_name" 
                  placeholder="Last Name" 
                  value={formData.last_name} 
                  onChange={(e) => setFormData({...formData, last_name: e.target.value})} 
                  required 
                  disabled={loading}
                />
              </div>
            </div>
            
            <div className="form-field">
              <label>Username *</label>
              <input 
                type="text" 
                name="username" 
                placeholder="Username" 
                value={formData.username} 
                onChange={(e) => setFormData({...formData, username: e.target.value})} 
                required 
                disabled={loading}
              />
            </div>
            
            <div className="form-field">
              <label>Email *</label>
              <input 
                type="email" 
                name="email" 
                placeholder="Email" 
                value={formData.email} 
                onChange={(e) => setFormData({...formData, email: e.target.value})} 
                required 
                disabled={loading}
              />
            </div>
            
            <div className="form-field">
              <label>Phone Number</label>
              <div className="phone-input-container">
                <span className="phone-prefix">+63</span>
                <input 
                  type="tel" 
                  name="phone_number" 
                  placeholder="9XXXXXXXXX" 
                  value={formData.phone_number} 
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\d]/g, '').slice(0, 10);
                    setFormData({...formData, phone_number: value});
                  }}
                  maxLength="10"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  disabled={loading}
                  className="phone-input"
                />
              </div>
              <small className="phone-hint">Optional. Enter 10-digit number (e.g., 9123456789)</small>
            </div>
            
            <div className="form-field">
              <label>Password *</label>
              <input 
                type="password" 
                name="password" 
                placeholder="Password" 
                value={formData.password} 
                onChange={(e) => setFormData({...formData, password: e.target.value})} 
                required 
                disabled={loading}
              />
              <small className="password-hint">
                Must contain: 8+ characters, uppercase, lowercase, number, special character
              </small>
            </div>
            
            <button 
              type="submit" 
              disabled={loading} 
              className="submit-button"
            >
              {loading ? 'Creating Staff...' : 'Create Staff'}
            </button>
          </form>
        )}

        {editingStaff && (
          <form onSubmit={handleStaffUpdate} className="staff-edit-form">
            <div className="form-header">
              <h4>Edit Staff: {editingStaff.first_name} {editingStaff.last_name}</h4>
              <button 
                type="button" 
                onClick={handleCancelStaffEdit}
                className="cancel-edit-btn"
              >
                Cancel
              </button>
            </div>
            
            <div className="form-row">
              <div className="form-field">
                <label>First Name *</label>
                <input 
                  type="text" 
                  name="first_name" 
                  placeholder="First Name" 
                  value={staffEditForm.first_name} 
                  onChange={(e) => setStaffEditForm({...staffEditForm, first_name: e.target.value})} 
                  required 
                  disabled={loading}
                />
              </div>
              
              <div className="form-field">
                <label>Last Name *</label>
                <input 
                  type="text" 
                  name="last_name" 
                  placeholder="Last Name" 
                  value={staffEditForm.last_name} 
                  onChange={(e) => setStaffEditForm({...staffEditForm, last_name: e.target.value})} 
                  required 
                  disabled={loading}
                />
              </div>
            </div>
            
            <div className="form-field">
              <label>Username *</label>
              <input 
                type="text" 
                name="username" 
                placeholder="Username" 
                value={staffEditForm.username} 
                onChange={(e) => setStaffEditForm({...staffEditForm, username: e.target.value})} 
                required 
                disabled={loading}
              />
            </div>
            
            <div className="form-field">
              <label>Email *</label>
              <input 
                type="email" 
                name="email" 
                placeholder="Email" 
                value={staffEditForm.email} 
                onChange={(e) => setStaffEditForm({...staffEditForm, email: e.target.value})} 
                required 
                disabled={loading}
              />
            </div>
            
            <div className="form-field">
              <label>Phone Number</label>
              <div className="phone-input-container">
                <span className="phone-prefix">+63</span>
                <input 
                  type="tel" 
                  name="phone_number" 
                  placeholder="9XXXXXXXXX" 
                  value={staffEditForm.phone_number} 
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\d]/g, '').slice(0, 10);
                    setStaffEditForm({...staffEditForm, phone_number: value});
                  }}
                  maxLength="10"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  disabled={loading}
                  className="phone-input"
                />
              </div>
              <small className="phone-hint">Optional. Enter 10-digit number (e.g., 9123456789)</small>
            </div>
            
            <button 
              type="submit" 
              disabled={loading} 
              className="submit-button"
            >
              {loading ? 'Updating...' : 'Update Staff'}
            </button>
          </form>
        )}

        <div className="staff-list">
          <h4>Staff Members ({staffMembers.length})</h4>
          {staffMembers.length === 0 ? (
            <div className="no-staff-message">
              No staff members found. Add your first staff member above.
            </div>
          ) : (
            staffMembers.map(staff => (
              <div key={staff.user_id} className="staff-card">
                <div className="staff-info">
                  <h5>{staff.first_name} {staff.last_name}</h5>
                  <p className="staff-details">
                    <span className="detail-item">
                      <strong>Username:</strong> {staff.username}
                    </span>
                    <span className="detail-separator">•</span>
                    <span className="detail-item">
                      <strong>Email:</strong> {staff.email}
                    </span>
                    {staff.phone_number && (
                      <>
                        <span className="detail-separator">•</span>
                        <span className="detail-item">
                          <strong>Phone:</strong> {formatPhoneNumber(staff.phone_number)}
                        </span>
                      </>
                    )}
                  </p>
                  <p className="staff-meta">
                    Created on: {new Date(staff.created_at).toLocaleDateString()} • 
                    Created by: {staff.created_by || 'System'}
                  </p>
                </div>
                <div className="staff-actions">
                  <button 
                    onClick={() => handleStaffEdit(staff)}
                    className="edit-button"
                    disabled={loading || profileLoading || showForm}
                  >
                    Edit
                  </button>
                  <button 
                    onClick={async () => {
                      if (window.confirm(`Are you sure you want to delete "${staff.first_name} ${staff.last_name}"? This action cannot be undone.`)) {
                        await authService.deleteStaff(staff.user_id, currentUser);
                        loadStaffMembers();
                      }
                    }} 
                    className="delete-button"
                    disabled={loading || profileLoading || showForm || editingStaff}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="admin-profile-section">
        <div className="section-header">
          <h3>My Admin Profile</h3>
          <div className="profile-actions">
            {!isEditingProfile && !showPasswordForm && (
              <>
                <button 
                  onClick={() => setIsEditingProfile(true)}
                  className="edit-profile-button"
                  disabled={profileLoading || loading}
                >
                  Edit Profile
                </button>
                <button 
                  onClick={() => setShowPasswordForm(true)}
                  className="change-password-button"
                  disabled={profileLoading || loading}
                >
                  Change Password
                </button>
              </>
            )}
          </div>
        </div>

        {profileMessage && (
          <div className={`message ${profileMessage.includes('successfully') ? 'success' : 'error'}`}>
            {profileMessage}
          </div>
        )}

        {isEditingProfile && !showPasswordForm ? (
          <form onSubmit={handleProfileUpdate} className="profile-form">
            <div className="form-header">
              <h4>Edit Profile Information</h4>
              <button 
                type="button" 
                onClick={handleCancelProfileEdit}
                className="cancel-edit-btn"
              >
                Cancel
              </button>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label>Username *</label>
                <input 
                  type="text" 
                  name="username" 
                  placeholder="Username" 
                  value={adminProfile.username} 
                  onChange={(e) => setAdminProfile({...adminProfile, username: e.target.value})} 
                  required 
                  disabled={profileLoading}
                />
              </div>
              
              <div className="form-field">
                <label>Email *</label>
                <input 
                  type="email" 
                  name="email" 
                  placeholder="Email" 
                  value={adminProfile.email} 
                  onChange={(e) => setAdminProfile({...adminProfile, email: e.target.value})} 
                  required 
                  disabled={profileLoading}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label>First Name *</label>
                <input 
                  type="text" 
                  name="first_name" 
                  placeholder="First Name" 
                  value={adminProfile.first_name} 
                  onChange={(e) => setAdminProfile({...adminProfile, first_name: e.target.value})} 
                  required 
                  disabled={profileLoading}
                />
              </div>
              
              <div className="form-field">
                <label>Last Name *</label>
                <input 
                  type="text" 
                  name="last_name" 
                  placeholder="Last Name" 
                  value={adminProfile.last_name} 
                  onChange={(e) => setAdminProfile({...adminProfile, last_name: e.target.value})} 
                  required 
                  disabled={profileLoading}
                />
              </div>
            </div>

            <div className="form-field">
              <label>Phone Number</label>
              <div className="phone-input-container">
                <span className="phone-prefix">+63</span>
                <input 
                  type="tel" 
                  name="phone_number" 
                  placeholder="9XXXXXXXXX" 
                  value={adminProfile.phone_number} 
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\d]/g, '').slice(0, 10);
                    setAdminProfile({...adminProfile, phone_number: value});
                  }}
                  maxLength="10"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  disabled={profileLoading}
                  className="phone-input"
                />
              </div>
              <small className="phone-hint">Optional. Enter 10-digit number (e.g., 9123456789)</small>
            </div>

            <button 
              type="submit" 
              disabled={profileLoading}
              className="submit-button"
            >
              {profileLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        ) : showPasswordForm ? (
          <form onSubmit={handlePasswordChange} className="password-form">
            <div className="form-header">
              <h4>Change Password</h4>
              <button 
                type="button" 
                onClick={handleCancelPasswordChange}
                className="cancel-edit-btn"
              >
                Cancel
              </button>
            </div>

            <div className="form-field">
              <label>Current Password *</label>
              <input 
                type="password" 
                name="currentPassword" 
                placeholder="Enter current password" 
                value={passwordChange.currentPassword} 
                onChange={(e) => setPasswordChange({...passwordChange, currentPassword: e.target.value})} 
                required 
                disabled={profileLoading}
              />
            </div>

            <div className="form-field">
              <label>New Password *</label>
              <input 
                type="password" 
                name="newPassword" 
                placeholder="Enter new password" 
                value={passwordChange.newPassword} 
                onChange={(e) => setPasswordChange({...passwordChange, newPassword: e.target.value})} 
                required 
                disabled={profileLoading}
              />
              <small className="password-hint">
                Must contain: 8+ characters, uppercase, lowercase, number, special character
              </small>
            </div>

            <div className="form-field">
              <label>Confirm New Password *</label>
              <input 
                type="password" 
                name="confirmPassword" 
                placeholder="Confirm new password" 
                value={passwordChange.confirmPassword} 
                onChange={(e) => setPasswordChange({...passwordChange, confirmPassword: e.target.value})} 
                required 
                disabled={profileLoading}
              />
            </div>

            <button 
              type="submit" 
              disabled={profileLoading}
              className="submit-button"
            >
              {profileLoading ? 'Changing Password...' : 'Change Password'}
            </button>
          </form>
        ) : (
          <div className="profile-details">
            <div className="profile-info-grid">
              <div className="info-item">
                <span className="info-label">Username:</span>
                <span className="info-value">{currentUser.username}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Email:</span>
                <span className="info-value">{currentUser.email}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Full Name:</span>
                <span className="info-value">{currentUser.first_name} {currentUser.last_name}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Phone:</span>
                <span className="info-value">
                  {currentUser.phone_number ? 
                    formatPhoneNumber(currentUser.phone_number) : 
                    'Not provided'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Role:</span>
                <span className="info-value">
                  <span className="role-badge admin">Administrator</span>
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">User ID:</span>
                <span className="info-value">{currentUser.user_id}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .staff-management {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .management-section,
        .admin-profile-section {
          background: white;
          border-radius: 12px;
          padding: 28px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 28px;
          border-bottom: 2px solid #f1f3f5;
          padding-bottom: 20px;
        }

        .section-header h3 {
          color: #2d3748;
          margin: 0;
          font-size: 1.6rem;
          font-weight: 600;
        }

        .profile-actions {
          display: flex;
          gap: 12px;
        }

        .add-staff-button,
        .edit-profile-button,
        .change-password-button,
        .edit-button,
        .delete-button {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .add-staff-button,
        .edit-profile-button,
        .edit-button {
          background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
          color: white;
        }

        .change-password-button {
          background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
          color: white;
        }

        .delete-button {
          background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%);
          color: white;
        }

        .add-staff-button:hover:not(:disabled),
        .edit-profile-button:hover:not(:disabled),
        .change-password-button:hover:not(:disabled),
        .edit-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(66, 153, 225, 0.3);
        }

        .delete-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(245, 101, 101, 0.3);
        }

        .add-staff-button:disabled,
        .edit-profile-button:disabled,
        .change-password-button:disabled,
        .edit-button:disabled,
        .delete-button:disabled {
          background: #cbd5e0;
          cursor: not-allowed;
          transform: none;
        }

        .message {
          padding: 14px 18px;
          border-radius: 8px;
          margin-bottom: 20px;
          font-weight: 500;
          border-left: 4px solid transparent;
        }

        .message.success {
          background: #f0fff4;
          border-color: #48bb78;
          color: #276749;
        }

        .message.error {
          background: #fff5f5;
          border-color: #f56565;
          color: #c53030;
        }

        /* Form Styles */
        .staff-form,
        .staff-edit-form,
        .profile-form,
        .password-form {
          background: #f8fafc;
          border-radius: 12px;
          padding: 28px;
          margin-bottom: 32px;
          border: 2px solid #e2e8f0;
        }

        .form-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .form-header h4 {
          color: #2d3748;
          margin: 0;
          font-size: 1.3rem;
          font-weight: 600;
        }

        .cancel-edit-btn {
          padding: 8px 16px;
          background: #718096;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: background-color 0.2s;
        }

        .cancel-edit-btn:hover {
          background: #4a5568;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }

        .form-field {
          margin-bottom: 20px;
        }

        .form-field label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #4a5568;
          font-size: 14px;
        }

        input[type="text"],
        input[type="email"],
        input[type="tel"],
        input[type="password"] {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 15px;
          color: #2d3748;
          background: white;
          box-sizing: border-box;
          transition: all 0.2s;
        }

        input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        input:disabled {
          background: #f7fafc;
          cursor: not-allowed;
        }

        .phone-input-container {
          display: flex;
          align-items: center;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
          background: white;
        }

        .phone-prefix {
          padding: 12px 16px;
          background: #f7fafc;
          color: #718096;
          font-weight: 600;
          border-right: 2px solid #e2e8f0;
        }

        .phone-input {
          flex: 1;
          border: none !important;
          border-radius: 0 !important;
          padding-left: 12px !important;
        }

        .phone-hint, .password-hint {
          display: block;
          margin-top: 6px;
          color: #718096;
          font-size: 12px;
        }

        .submit-button {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 500;
          transition: all 0.3s ease;
          margin-top: 10px;
        }

        .submit-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(72, 187, 120, 0.3);
        }

        .submit-button:disabled {
          background: #cbd5e0;
          cursor: not-allowed;
          transform: none;
        }

        /* Staff List Styles */
        .staff-list h4 {
          color: #2d3748;
          margin: 0 0 20px 0;
          font-size: 1.3rem;
          font-weight: 600;
        }

        .no-staff-message {
          text-align: center;
          padding: 40px;
          color: #718096;
          background: #f8fafc;
          border-radius: 8px;
          border: 2px dashed #e2e8f0;
        }

        .staff-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: white;
          border: 2px solid #edf2f7;
          border-radius: 10px;
          padding: 20px;
          margin-bottom: 16px;
          transition: all 0.3s ease;
        }

        .staff-card:hover {
          border-color: #cbd5e0;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          transform: translateY(-1px);
        }

        .staff-info {
          flex: 1;
        }

        .staff-card h5 {
          color: #2d3748;
          margin: 0 0 8px 0;
          font-size: 1.1rem;
          font-weight: 600;
        }

        .staff-details {
          color: #718096;
          margin: 0 0 8px 0;
          font-size: 0.9rem;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }

        .detail-item {
          display: inline-flex;
          align-items: center;
        }

        .detail-separator {
          color: #cbd5e0;
        }

        .staff-meta {
          color: #a0aec0;
          font-size: 0.85rem;
          margin: 0;
        }

        .staff-actions {
          display: flex;
          gap: 12px;
        }

        /* Profile Details Styles */
        .profile-details {
          margin-top: 20px;
        }

        .profile-info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }

        .info-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 16px;
          background: #f8fafc;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        .info-label {
          font-weight: 600;
          color: #4a5568;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .info-value {
          color: #2d3748;
          font-size: 15px;
          font-weight: 500;
        }

        .role-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: bold;
          text-transform: uppercase;
        }

        .role-badge.admin {
          background: #667eea;
          color: white;
        }

        @media (max-width: 768px) {
          .management-section,
          .admin-profile-section {
            padding: 20px;
          }

          .section-header {
            flex-direction: column;
            gap: 16px;
            align-items: flex-start;
          }

          .profile-actions {
            flex-direction: column;
            width: 100%;
          }

          .edit-profile-button,
          .change-password-button {
            width: 100%;
          }

          .form-row {
            grid-template-columns: 1fr;
          }

          .staff-card {
            flex-direction: column;
            gap: 16px;
            align-items: stretch;
            padding: 16px;
          }

          .staff-details {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }

          .detail-separator {
            display: none;
          }

          .staff-actions {
            flex-direction: column;
            width: 100%;
          }

          .edit-button,
          .delete-button {
            width: 100%;
          }

          .profile-info-grid {
            grid-template-columns: 1fr;
          }

          .phone-input-container {
            flex-direction: column;
            align-items: stretch;
          }

          .phone-prefix {
            border-right: none;
            border-bottom: 2px solid #e2e8f0;
            text-align: center;
          }

          .form-header {
            flex-direction: column;
            gap: 12px;
            align-items: flex-start;
          }

          .cancel-edit-btn {
            align-self: flex-start;
          }
        }

        @media (max-width: 480px) {
          .staff-form,
          .staff-edit-form,
          .profile-form,
          .password-form {
            padding: 20px;
          }

          .phone-input-container {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};

export default StaffManagement;