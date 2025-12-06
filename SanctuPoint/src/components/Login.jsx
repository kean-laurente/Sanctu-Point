import { useState } from 'react';
import { authService } from '../auth/authService';

const Login = ({ onLoginSuccess }) => {
  const [formData, setFormData] = useState({
    identifier: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const result = await authService.login(formData.identifier, formData.password);
      
      if (result.success) {
        setMessage('Login successful! Redirecting...');
        setTimeout(() => onLoginSuccess(result.user), 1000);
      } else {
        setMessage(result.message);
      }
    } catch (error) {
      setMessage('An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form">
        <h2 className="text-2xl font-semibold text-center mb-4">SanctuPoint Login</h2>
        <p className="form-description text-center mb-6 text-gray-600">Staff & Administrator Access</p>
        
        {message && (
          <div className={`message ${message.includes('successful') ? 'message-success' : 'message-error'} mb-4`}>
            {message}
          </div>
        )}

        <div className="form-group mb-4">
          <label className="form-label">Username or Email:</label>
          <input
            type="text"
            name="identifier"
            value={formData.identifier}
            onChange={handleChange}
            required
            disabled={loading}
            placeholder="Enter username or email"
            className="form-input"
          />
        </div>

        <div className="form-group mb-6">
          <label className="form-label">Password:</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            disabled={loading}
            placeholder="Enter password"
            className="form-input"
          />
        </div>

        <button 
          type="submit" 
          disabled={loading} 
          className="btn btn-primary w-full mb-6"
        >
          {loading ? (
            <>
              <span className="spinner mr-2"></span>
              Logging in...
            </>
          ) : 'Login'}
        </button>

      </form>
    </div>
  );
};

export default Login;