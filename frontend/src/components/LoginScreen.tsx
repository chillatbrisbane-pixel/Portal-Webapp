import React, { useState, useEffect } from 'react';
import { authAPI, healthCheck } from '../services/apiService';

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
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

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [checkingBackend, setCheckingBackend] = useState(true);
  const [rememberMe, setRememberMe] = useState(false);

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
      `}</style>
    </div>
  );
};

export default LoginScreen;
