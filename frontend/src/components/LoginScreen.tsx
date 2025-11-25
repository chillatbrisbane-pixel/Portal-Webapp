import React, { useState, useEffect } from 'react';
import { authAPI, healthCheck } from '../services/apiService';

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
}

// ============ CUSTOMIZATION CONFIG ============
// Edit these values to customize the login screen
const BRANDING_CONFIG = {
  //appName: 'Electronic Living',
 // appTagline: 'Smart Technology for Home, Business & Marine',
  logo: '🏠',
  primaryColor: '#333333',
  secondaryColor: '#555555',
  backgroundGradient: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
  showDemoCredentials: false,
  // welcomeMessage: 'Documentation Portal',
  // subMessage: 'Project Management System',
  footerText: '© 2025 Electronic Living',
  companyLogoUrl: ''https://www.electronicliving.com.au/wp-content/uploads/logo-reversed.svg',
};
export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [checkingBackend, setCheckingBackend] = useState(true);
  const [rememberMe, setRememberMe] = useState(false);



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
      const response = await authAPI.login(username, password);
      if (rememberMe) {
        localStorage.setItem('rememberedUsername', username);
      } else {
        localStorage.removeItem('rememberedUsername');
      }
      onLoginSuccess(response.user);
    } catch (err: any) {
      setError(err.message || 'Login failed. Check username and password.');
    } finally {
      setLoading(false);
    }
  };

  // Load remembered username
  useEffect(() => {
    const remembered = localStorage.getItem('rememberedUsername');
    if (remembered) {
      setUsername(remembered);
      setRememberMe(true);
    }
  }, []);

  return (
    <div className="login-container" style={{ background: BRANDING_CONFIG.backgroundGradient }}>
      <div className="login-box">
        {/* Logo Section */}
        <div className="login-logo">
          {BRANDING_CONFIG.companyLogoUrl ? (
            <img 
              src={BRANDING_CONFIG.companyLogoUrl} 
              alt="Company Logo" 
              style={{ maxWidth: '300px', marginBottom: '1rem' }}
            />
          ) : (
            <div className="logo-emoji" style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
              {BRANDING_CONFIG.logo}
            </div>
          )}
        </div>

        {/* Header */}
        <div className="login-header">
          <h1 style={{ color: BRANDING_CONFIG.primaryColor }}>
            {BRANDING_CONFIG.appName}
          </h1>
          <p style={{ color: '#666' }}>
            {BRANDING_CONFIG.appTagline}
          </p>
        </div>

        {/* Welcome Message */}
        <div className="welcome-section">
          <h2 style={{ color: '#333', marginBottom: '0.5rem' }}>
            {BRANDING_CONFIG.welcomeMessage}
          </h2>
          <p style={{ color: '#666', marginBottom: '2rem' }}>
            {BRANDING_CONFIG.subMessage}
          </p>
        </div>

        {/* Backend Status */}
        {!checkingBackend && (
          <div className="backend-check">
            <p>🔍 Checking connection...</p>
          </div>
        )}

        {!checkingBackend && backendConnected && (
          <div className="backend-status connected">
            <span>✅ Ready to connect</span>
          </div>
        )}

        !checkingBackend && !backendConnected && (
          <div className="backend-status error">
            <span>❌ Connection error</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
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

          {/* Remember Me */}
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
            <input
              id="rememberMe"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ marginRight: '0.5rem', cursor: 'pointer' }}
            />
            <label htmlFor="rememberMe" style={{ margin: 0, cursor: 'pointer' }}>
              Remember me
            </label>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            className="btn btn-login"
            disabled={loading || !backendConnected}
            style={{
              background: BRANDING_CONFIG.primaryColor,
              width: '100%',
            }}
          >
            {loading ? '🔄 Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Demo Credentials - Conditionally Shown */}
        {BRANDING_CONFIG.showDemoCredentials && (
          <div className="login-help">
            <p className="text-muted">Demo Credentials:</p>
            <div className="credentials">
              <div className="credential">
                <strong>Admin:</strong> admin / admin123
              </div>
              <div className="credential">
                <strong>Manager:</strong> manager / manager123
              </div>
              <div className="credential">
                <strong>Technician:</strong> tech / tech123
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="login-footer">
          <p style={{ fontSize: '0.8rem', color: '#999', margin: 0 }}>
            {BRANDING_CONFIG.footerText}
          </p>
        </div>
      </div>

      <style>{`
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
          margin-bottom: 1.5rem;
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

        .login-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .login-header h1 {
          font-size: 1.8rem;
          margin: 0 0 0.5rem 0;
          font-weight: 700;
        }

        .login-header p {
          font-size: 0.95rem;
          margin: 0;
        }

        .welcome-section {
          text-align: center;
          margin-bottom: 1.5rem;
        }

        .welcome-section h2 {
          font-size: 1.3rem;
        }

        .backend-status {
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 1rem;
          font-size: 0.9rem;
          font-weight: 500;
          text-align: center;
        }

        .backend-status.connected {
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }

        .backend-status.error {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }

        .backend-check {
          text-align: center;
          padding: 1rem;
          color: #666;
          margin-bottom: 1rem;
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
        .form-group input[type="password"] {
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
        .form-group input[type="password"]:focus {
          outline: none;
          border-color: ${BRANDING_CONFIG.primaryColor};
          box-shadow: 0 0 0 3px ${BRANDING_CONFIG.primaryColor}20;
        }

        .form-group input:disabled {
          background: #f5f5f5;
          cursor: not-allowed;
          color: #999;
        }

        .form-group input[type="checkbox"] {
          cursor: pointer;
          width: 18px;
          height: 18px;
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
          box-shadow: 0 8px 16px ${BRANDING_CONFIG.primaryColor}40;
        }

        .btn-login:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .login-help {
          border-top: 1px solid #eee;
          padding-top: 1.5rem;
          margin-top: 1.5rem;
        }

        .login-help .text-muted {
          color: #666;
          font-size: 0.85rem;
          margin: 0 0 0.75rem 0;
          font-weight: 600;
        }

        .credentials {
          background: #f8f9fa;
          border-radius: 6px;
          padding: 1rem;
          font-size: 0.8rem;
        }

        .credential {
          padding: 0.35rem 0;
          color: #555;
          line-height: 1.6;
        }

        .credential strong {
          color: #333;
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

          .login-header h1 {
            font-size: 1.4rem;
          }

          .welcome-section h2 {
            font-size: 1.1rem;
          }
        }
      `}</style>
    </div>
  );
};

export default LoginScreen;
