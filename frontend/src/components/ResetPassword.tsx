import React, { useState, useEffect } from 'react';
import { authAPI } from '../services/apiService';

interface ResetPasswordProps {
  token: string;
  onSuccess: () => void;
  onBack: () => void;
}

export const ResetPassword: React.FC<ResetPasswordProps> = ({ token, onSuccess, onBack }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [tokenValid, setTokenValid] = useState(false);
  const [userInfo, setUserInfo] = useState<{ email: string; name: string } | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    verifyToken();
  }, [token]);

  const verifyToken = async () => {
    try {
      const result = await authAPI.verifyResetToken(token);
      setTokenValid(true);
      setUserInfo({ email: result.email, name: result.name });
    } catch (err: any) {
      setError(err.message);
      setTokenValid(false);
    } finally {
      setLoading(false);
    }
  };

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/[A-Z]/.test(pwd)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(pwd)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(pwd)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password complexity
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setSubmitting(true);

    try {
      await authAPI.resetPassword(token, password);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="login-container">
        <div className="login-box" style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '2rem auto' }}></div>
          <p>Verifying reset link...</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="login-container">
        <div className="login-box">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <span style={{ fontSize: '3rem' }}>❌</span>
            <h1 style={{ margin: '1rem 0 0.5rem' }}>Invalid Link</h1>
            <p style={{ color: '#6b7280' }}>
              This password reset link is invalid or has expired.
            </p>
          </div>

          {error && (
            <div className="error-message" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <button
            onClick={onBack}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="login-container">
        <div className="login-box">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <span style={{ fontSize: '3rem' }}>✅</span>
            <h1 style={{ margin: '1rem 0 0.5rem' }}>Password Reset</h1>
            <p style={{ color: '#6b7280' }}>
              Your password has been reset successfully.
            </p>
          </div>

          <button
            onClick={onSuccess}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            Continue to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span style={{ fontSize: '3rem' }}>🔐</span>
          <h1 style={{ margin: '1rem 0 0.5rem' }}>Reset Password</h1>
          {userInfo && (
            <p style={{ color: '#6b7280' }}>
              Setting new password for <strong>{userInfo.name}</strong>
            </p>
          )}
        </div>

        {error && (
          <div className="error-message" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password">New Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
              required
              disabled={submitting}
              autoFocus
            />
            <small style={{ color: '#6b7280', display: 'block', marginTop: '0.25rem' }}>
              Min 8 characters with uppercase, lowercase, and number
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
              disabled={submitting}
            />
          </div>

          {/* Password strength indicator */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem' }}>
              {[
                password.length >= 8,
                /[A-Z]/.test(password),
                /[a-z]/.test(password),
                /[0-9]/.test(password),
              ].map((met, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: '4px',
                    borderRadius: '2px',
                    background: met ? '#10b981' : '#e5e7eb',
                    transition: 'background 0.2s',
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.75rem' }}>
              <span style={{ color: password.length >= 8 ? '#10b981' : '#9ca3af' }}>
                {password.length >= 8 ? '✓' : '○'} 8+ chars
              </span>
              <span style={{ color: /[A-Z]/.test(password) ? '#10b981' : '#9ca3af' }}>
                {/[A-Z]/.test(password) ? '✓' : '○'} Uppercase
              </span>
              <span style={{ color: /[a-z]/.test(password) ? '#10b981' : '#9ca3af' }}>
                {/[a-z]/.test(password) ? '✓' : '○'} Lowercase
              </span>
              <span style={{ color: /[0-9]/.test(password) ? '#10b981' : '#9ca3af' }}>
                {/[0-9]/.test(password) ? '✓' : '○'} Number
              </span>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginBottom: '1rem' }}
            disabled={submitting}
          >
            {submitting ? 'Resetting...' : 'Reset Password'}
          </button>

          <button
            type="button"
            onClick={onBack}
            className="btn"
            style={{ width: '100%', background: '#e5e7eb' }}
            disabled={submitting}
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
