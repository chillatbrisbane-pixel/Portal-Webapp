import React, { useState, useEffect } from 'react';
import { authAPI } from '../services/apiService';

interface AcceptInviteProps {
  token: string;
  onSuccess: (user: any) => void;
  onCancel: () => void;
}

const BRANDING_CONFIG = {
  primaryColor: '#333333',
  backgroundGradient: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
  companyLogoUrl: 'https://www.electronicliving.com.au/wp-content/uploads/Electronic-Living-Logo-Rev.png',
  footerText: '© 2025 Electronic Living',
};

export const AcceptInvite: React.FC<AcceptInviteProps> = ({ token, onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState('');
  const [inviteData, setInviteData] = useState<{ email: string; name: string } | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    verifyToken();
  }, [token]);

  const verifyToken = async () => {
    try {
      const data = await authAPI.verifyInvite(token);
      setInviteData(data);
      setVerifying(false);
    } catch (err: any) {
      setError(err.message || 'Invalid or expired invite link');
      setVerifying(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const data = await authAPI.acceptInvite(token, password);
      onSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'Failed to activate account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container" style={{ background: BRANDING_CONFIG.backgroundGradient }}>
      <div className="login-box">
        {/* Logo Section */}
        <div className="login-logo">
          <img 
            src={BRANDING_CONFIG.companyLogoUrl} 
            alt="Company Logo" 
            style={{ maxWidth: '480px', marginBottom: '1rem' }}
          />
        </div>

        {verifying ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔄</div>
            <p>Verifying invite link...</p>
          </div>
        ) : error && !inviteData ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
            <h3 style={{ color: '#dc2626', marginBottom: '1rem' }}>Invalid Invite Link</h3>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>{error}</p>
            <p style={{ color: '#666', fontSize: '0.9rem' }}>
              This link may have expired or already been used.<br />
              Please contact your administrator for a new invite.
            </p>
            <button
              onClick={onCancel}
              style={{
                marginTop: '1.5rem',
                padding: '0.75rem 2rem',
                background: BRANDING_CONFIG.primaryColor,
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Back to Login
            </button>
          </div>
        ) : inviteData ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>👋</div>
              <h2 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>Welcome, {inviteData.name}!</h2>
              <p style={{ color: '#666', margin: 0, fontSize: '0.9rem' }}>
                Set your password to activate your account
              </p>
            </div>

            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem',
            }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#166534' }}>
                <strong>Email:</strong> {inviteData.email}
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="password">Create Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password (min 6 characters)"
                  disabled={loading}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
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
                {loading ? '🔄 Activating...' : '✅ Activate Account'}
              </button>
            </form>
          </>
        ) : null}

        {/* Footer */}
        <div className="login-footer">
          <p style={{ fontSize: '0.8rem', color: '#999', margin: 0 }}>
            {BRANDING_CONFIG.footerText}
          </p>
        </div>
      </div>

      <style>{`
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
        }

        .login-logo {
          text-align: center;
          margin-bottom: 1.5rem;
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

        .form-group input[type="password"]:focus {
          outline: none;
          border-color: #333333;
          box-shadow: 0 0 0 3px #33333320;
        }

        .form-group input:disabled {
          background: #f5f5f5;
          cursor: not-allowed;
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
          padding: 0.85rem;
          font-size: 1rem;
          border: none;
          border-radius: 6px;
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
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
      `}</style>
    </div>
  );
};

export default AcceptInvite;
