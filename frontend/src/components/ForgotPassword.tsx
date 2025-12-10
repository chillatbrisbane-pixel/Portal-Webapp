import React, { useState } from 'react';
import { authAPI } from '../services/apiService';

interface ForgotPasswordProps {
  onBack: () => void;
}

export const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onBack }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resetLink, setResetLink] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await authAPI.forgotPassword(email);
      setSuccess(true);
      // In development, show the reset link
      if (result.resetLink) {
        setResetLink(result.resetLink);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="login-container">
        <div className="login-box">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <span style={{ fontSize: '3rem' }}>✉️</span>
            <h1 style={{ margin: '1rem 0 0.5rem' }}>Check Your Email</h1>
            <p style={{ color: '#6b7280' }}>
              If an account exists with <strong>{email}</strong>, you'll receive a password reset link.
            </p>
          </div>

          {resetLink && (
            <div style={{
              background: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem',
            }}>
              <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: '#92400e' }}>
                ⚠️ Development Mode - Reset Link:
              </p>
              <p style={{ 
                margin: 0, 
                wordBreak: 'break-all', 
                fontSize: '0.85rem',
                background: '#fff',
                padding: '0.5rem',
                borderRadius: '4px',
              }}>
                <a href={resetLink}>{resetLink}</a>
              </p>
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

  return (
    <div className="login-container">
      <div className="login-box">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span style={{ fontSize: '3rem' }}>🔑</span>
          <h1 style={{ margin: '1rem 0 0.5rem' }}>Forgot Password</h1>
          <p style={{ color: '#6b7280' }}>
            Enter your email and we'll send you a reset link.
          </p>
        </div>

        {error && (
          <div className="error-message" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              disabled={loading}
              autoFocus
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginBottom: '1rem' }}
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>

          <button
            type="button"
            onClick={onBack}
            className="btn"
            style={{ width: '100%', background: '#e5e7eb' }}
            disabled={loading}
          >
            Back to Login
          </button>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;
