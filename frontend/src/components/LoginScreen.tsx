import React, { useState, useEffect } from 'react';
import { authAPI, healthCheck } from '../services/apiService';

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
  onForgotPassword?: () => void;
}

// ============ CUSTOMIZATION CONFIG ============
// Edit these values to customize the login screen
const BRANDING_CONFIG = {
  logo: '🏠',
  primaryColor: '#333333',
  secondaryColor: '#555555',
  backgroundGradient: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
  showDemoCredentials: false,
  footerText: '© 2025 Electronic Living',
  companyLogoUrl: 'https://www.electronicliving.com.au/wp-content/uploads/Electronic-Living-Logo-Rev.png',
};

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onForgotPassword }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [checkingBackend, setCheckingBackend] = useState(true);
  const [rememberMe, setRememberMe] = useState(false);
  
  // Additional states for 2FA and password change
  const [requires2FA, setRequires2FA] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [tempUser, setTempUser] = useState<any>(null);

  // Check if backend is running
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const connected = await healthCheck();
        setBackendConnected(connected);
      } catch (err) {
        setBackendConnected(false);
        setError('⚠️ Cannot connect to backend');
      } finally {
        setCheckingBackend(false);
      }
    };

    checkBackend();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!backendConnected) {
      setError('Backend not connected. Please start the backend server.');
      setLoading(false);
      return;
    }

    try {
      const response = await authAPI.login(email, password, requires2FA ? twoFactorCode : undefined);
      
      // Check if 2FA is required
      if (response.requires2FA) {
        setRequires2FA(true);
        setLoading(false);
        return;
      }

      // Store token
      localStorage.setItem('token', response.token);
      
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }

      // Check if password change is required
      if (response.mustChangePassword) {
        setTempToken(response.token);
        setTempUser(response.user);
        setShowPasswordChange(true);
        setLoading(false);
        return;
      }

      onLoginSuccess(response.user);
    } catch (err: any) {
      setError(err.message || 'Login failed. Check email and password.');
      if (requires2FA) {
        setTwoFactorCode('');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForcePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newEmail || !newPassword) {
      setError('Email and password are required');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await authAPI.forceChangePassword(newPassword, newEmail);
      localStorage.setItem('token', response.token);
      onLoginSuccess(response.user);
    } catch (err: any) {
      setError(err.message || 'Failed to update account');
    } finally {
      setLoading(false);
    }
  };

  // Load remembered email
  useEffect(() => {
    const remembered = localStorage.getItem('rememberedEmail');
    if (remembered) {
      setEmail(remembered);
      setRememberMe(true);
    }
  }, []);

  // Force Password Change Modal
  if (showPasswordChange) {
    return (
      <div className="login-container" style={{ background: BRANDING_CONFIG.backgroundGradient }}>
        <div className="login-box">
          <div className="login-logo">
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔐</div>
            <h2 style={{ margin: 0, color: '#333' }}>Setup Your Account</h2>
            <p style={{ color: '#666', marginTop: '0.5rem', fontSize: '0.9rem' }}>
              Please set your email and create a new password
            </p>
          </div>

          <form onSubmit={handleForcePasswordChange}>
            <div className="form-group">
              <label htmlFor="newEmail">Your Email</label>
              <input
                id="newEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Enter your email address"
                disabled={loading}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                disabled={loading}
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button
              type="submit"
              className="btn btn-login"
              disabled={loading}
              style={{ background: BRANDING_CONFIG.primaryColor, width: '100%' }}
            >
              {loading ? '🔄 Updating...' : 'Complete Setup'}
            </button>
          </form>
        </div>
        <style>{loginStyles}</style>
      </div>
    );
  }

  return (
    <div className="login-container" style={{ background: BRANDING_CONFIG.backgroundGradient }}>
      <div className="login-box">
        {/* Logo Section */}
        <div className="login-logo">
          {BRANDING_CONFIG.companyLogoUrl ? (
            <img 
              src={BRANDING_CONFIG.companyLogoUrl} 
              alt="Company Logo" 
              style={{ maxWidth: '480px', marginBottom: '2rem' }}
            />
          ) : (
            <div className="logo-emoji" style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
              {BRANDING_CONFIG.logo}
            </div>
          )}
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin}>
          {!requires2FA ? (
            <>
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email"
                  disabled={loading}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  disabled={loading}
                />
              </div>

              {/* Remember Me and Forgot Password Row */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '1rem',
                fontSize: '0.9rem',
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{ width: 'auto' }}
                  />
                  <span style={{ color: '#666' }}>Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={onForgotPassword}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#3b82f6',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    padding: 0,
                  }}
                >
                  Forgot password?
                </button>
              </div>
            </>
          ) : (
            <div className="form-group">
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔐</div>
                <p style={{ color: '#666', fontSize: '0.9rem' }}>
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>
              <label htmlFor="twoFactorCode">Authentication Code</label>
              <input
                id="twoFactorCode"
                type="text"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                disabled={loading}
                autoFocus
                style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' }}
              />
              <button
                type="button"
                onClick={() => {
                  setRequires2FA(false);
                  setTwoFactorCode('');
                  setError('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#666',
                  cursor: 'pointer',
                  marginTop: '1rem',
                  fontSize: '0.9rem',
                  width: '100%',
                }}
              >
                ← Back to login
              </button>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          {/* Backend Connection Status */}
          {!checkingBackend && !backendConnected && (
            <div style={{
              background: '#fef3c7',
              color: '#92400e',
              padding: '0.85rem',
              borderRadius: '6px',
              marginBottom: '1rem',
              fontSize: '0.9rem',
              border: '1px solid #fcd34d',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span>⚠️ Cannot connect to backend server</span>
              <button
                type="button"
                onClick={async () => {
                  setCheckingBackend(true);
                  setError('');
                  try {
                    const connected = await healthCheck();
                    setBackendConnected(connected);
                    if (!connected) {
                      setError('Still cannot connect. Is the backend running?');
                    }
                  } catch {
                    setBackendConnected(false);
                  } finally {
                    setCheckingBackend(false);
                  }
                }}
                style={{
                  background: '#92400e',
                  color: 'white',
                  border: 'none',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                Retry
              </button>
            </div>
          )}

          {checkingBackend && (
            <div style={{
              background: '#dbeafe',
              color: '#1e40af',
              padding: '0.85rem',
              borderRadius: '6px',
              marginBottom: '1rem',
              fontSize: '0.9rem',
              textAlign: 'center',
            }}>
              🔄 Checking backend connection...
            </div>
          )}

          <button
            type="submit"
            className="btn btn-login"
            disabled={loading || checkingBackend || !backendConnected}
            style={{
              background: backendConnected ? BRANDING_CONFIG.primaryColor : '#9ca3af',
              width: '100%',
            }}
          >
            {checkingBackend ? '🔄 Connecting...' : loading ? '🔄 Signing in...' : backendConnected ? (requires2FA ? 'Verify Code' : 'Sign In') : '⚠️ Backend Offline'}
          </button>
        </form>

        {/* Footer */}
        <div className="login-footer">
          <p style={{ fontSize: '0.8rem', color: '#999', margin: 0 }}>
            {BRANDING_CONFIG.footerText}
          </p>
        </div>
      </div>

      <style>{loginStyles}</style>
    </div>
  );
};

const loginStyles = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  .login-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu',
      'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
    padding: 1rem;
  }

  .login-box {
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    padding: 3rem 2.5rem;
    width: 100%;
    max-width: 420px;
    animation: slideUp 0.5s ease-out;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .login-logo {
    text-align: center;
    margin-bottom: 2rem;
  }

  .logo-emoji {
    animation: float 3s ease-in-out infinite;
  }

  @keyframes float {
    0%, 100% {
      transform: translateY(0px);
    }
    50% {
      transform: translateY(-10px);
    }
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.6rem;
    font-weight: 600;
    color: #333;
    font-size: 0.95rem;
  }

  .form-group input[type="text"],
  .form-group input[type="password"],
  .form-group input[type="email"] {
    width: 100%;
    padding: 0.85rem;
    border: 2px solid #e0e0e0;
    border-radius: 6px;
    font-size: 1rem;
    font-family: inherit;
    box-sizing: border-box;
    transition: all 0.3s;
  }

  .form-group input[type="text"]:focus,
  .form-group input[type="password"]:focus,
  .form-group input[type="email"]:focus {
    outline: none;
    border-color: #333333;
    box-shadow: 0 0 0 3px #33333320;
  }

  .form-group input:disabled {
    background: #f5f5f5;
    cursor: not-allowed;
    color: #999;
  }

  .error-message {
    background: #fee2e2;
    color: #991b1b;
    padding: 0.85rem;
    border-radius: 6px;
    margin-bottom: 1rem;
    font-size: 0.9rem;
    border: 1px solid #fecaca;
  }

  .btn-login {
    width: 100%;
    padding: 0.85rem;
    font-size: 1rem;
    border: none;
    border-radius: 6px;
    color: white;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
    margin-bottom: 1rem;
  }

  .btn-login:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 16px #33333340;
  }

  .btn-login:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .login-footer {
    text-align: center;
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid #eee;
  }

  @media (max-width: 480px) {
    .login-box {
      padding: 2rem 1.5rem;
    }
  }
`;

export default LoginScreen;
