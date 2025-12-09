import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { authAPI } from '../services/apiService';

interface UserSettingsModalProps {
  user: User;
  onClose: () => void;
  onUserUpdated: (user: User) => void;
}

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
  user,
  onClose,
  onUserUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'password' | '2fa' | 'backup'>('password');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 2FA state
  const [twoFAStatus, setTwoFAStatus] = useState({ enabled: false, backupCodesRemaining: 0 });
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');

  // Backup state
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<any>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load2FAStatus();
  }, []);

  const load2FAStatus = async () => {
    try {
      const status = await authAPI.get2FAStatus();
      setTwoFAStatus(status);
    } catch (err) {
      console.error('Failed to load 2FA status:', err);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

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
      await authAPI.changePassword(currentPassword, newPassword);
      setSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetup2FA = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await authAPI.setup2FA();
      setQrCode(result.qrCode);
      setSecret(result.secret);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await authAPI.verify2FA(verificationCode);
      setBackupCodes(result.backupCodes);
      setShowBackupCodes(true);
      setTwoFAStatus({ enabled: true, backupCodesRemaining: 10 });
      setQrCode('');
      setSecret('');
      setVerificationCode('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authAPI.disable2FA(disablePassword);
      setTwoFAStatus({ enabled: false, backupCodesRemaining: 0 });
      setDisablePassword('');
      setSuccess('2FA disabled successfully');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h2>⚙️ Account Settings</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
          <button
            onClick={() => { setActiveTab('password'); setError(''); setSuccess(''); }}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              background: activeTab === 'password' ? '#3b82f6' : 'transparent',
              color: activeTab === 'password' ? 'white' : '#666',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            🔑 Password
          </button>
          <button
            onClick={() => { setActiveTab('2fa'); setError(''); setSuccess(''); }}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              background: activeTab === '2fa' ? '#3b82f6' : 'transparent',
              color: activeTab === '2fa' ? 'white' : '#666',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            🔐 Two-Factor Auth
          </button>
          {user.role === 'admin' && (
            <button
              onClick={() => { setActiveTab('backup'); setError(''); setSuccess(''); setImportResults(null); }}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                background: activeTab === 'backup' ? '#3b82f6' : 'transparent',
                color: activeTab === 'backup' ? 'white' : '#666',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              💾 Backup
            </button>
          )}
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{success}</div>}

        {/* Password Tab */}
        {activeTab === 'password' && (
          <form onSubmit={handlePasswordChange}>
            <div className="form-group">
              <label>Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                required
              />
            </div>

            <div className="form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
              {loading ? '🔄 Changing...' : 'Change Password'}
            </button>
          </form>
        )}

        {/* 2FA Tab */}
        {activeTab === '2fa' && (
          <div>
            {/* Show backup codes modal */}
            {showBackupCodes && (
              <div style={{ 
                background: '#fef3c7', 
                border: '1px solid #fcd34d', 
                borderRadius: '8px', 
                padding: '1.5rem',
                marginBottom: '1rem',
              }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#92400e' }}>⚠️ Save Your Backup Codes</h4>
                <p style={{ fontSize: '0.9rem', color: '#92400e', marginBottom: '1rem' }}>
                  Store these codes in a safe place. Each code can only be used once.
                </p>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: '0.5rem',
                  background: 'white',
                  padding: '1rem',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  fontSize: '1rem',
                }}>
                  {backupCodes.map((code, i) => (
                    <div key={i}>{code}</div>
                  ))}
                </div>
                <button
                  onClick={() => setShowBackupCodes(false)}
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '1rem' }}
                >
                  I've saved my codes
                </button>
              </div>
            )}

            {/* 2FA Status */}
            <div style={{ 
              padding: '1rem', 
              background: twoFAStatus.enabled ? '#ecfdf5' : '#fef2f2',
              border: `1px solid ${twoFAStatus.enabled ? '#10b981' : '#fecaca'}`,
              borderRadius: '8px',
              marginBottom: '1.5rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.5rem' }}>{twoFAStatus.enabled ? '✅' : '❌'}</span>
                <div>
                  <strong style={{ color: twoFAStatus.enabled ? '#059669' : '#dc2626' }}>
                    {twoFAStatus.enabled ? 'Two-Factor Authentication Enabled' : 'Two-Factor Authentication Disabled'}
                  </strong>
                  {twoFAStatus.enabled && (
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#666' }}>
                      {twoFAStatus.backupCodesRemaining} backup codes remaining
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Setup 2FA */}
            {!twoFAStatus.enabled && !qrCode && (
              <div>
                <p style={{ marginBottom: '1rem', color: '#666' }}>
                  Add an extra layer of security to your account by enabling two-factor authentication.
                </p>
                <button
                  onClick={handleSetup2FA}
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ width: '100%' }}
                >
                  {loading ? '🔄 Setting up...' : '🔐 Enable Two-Factor Authentication'}
                </button>
              </div>
            )}

            {/* QR Code Display */}
            {qrCode && (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <p style={{ marginBottom: '1rem', color: '#666' }}>
                    Scan this QR code with your authenticator app:
                  </p>
                  <img src={qrCode} alt="2FA QR Code" style={{ maxWidth: '200px', margin: '0 auto' }} />
                  <p style={{ fontSize: '0.85rem', color: '#999', marginTop: '0.5rem' }}>
                    Or enter this code manually: <code style={{ background: '#f3f4f6', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>{secret}</code>
                  </p>
                </div>

                <form onSubmit={handleVerify2FA}>
                  <div className="form-group">
                    <label>Enter verification code from your app</label>
                    <input
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' }}
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => { setQrCode(''); setSecret(''); }}
                      className="btn btn-secondary"
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
                      {loading ? '🔄 Verifying...' : 'Verify & Enable'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Disable 2FA */}
            {twoFAStatus.enabled && !showBackupCodes && (
              <form onSubmit={handleDisable2FA}>
                <p style={{ marginBottom: '1rem', color: '#666' }}>
                  To disable two-factor authentication, enter your password:
                </p>
                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-danger" disabled={loading} style={{ width: '100%' }}>
                  {loading ? '🔄 Disabling...' : '🔓 Disable Two-Factor Authentication'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Backup Tab (Admin Only) */}
        {activeTab === 'backup' && user.role === 'admin' && (
          <div>
            <h4 style={{ marginBottom: '1rem' }}>📦 Export Backup</h4>
            <p style={{ color: '#666', marginBottom: '1rem', fontSize: '0.9rem' }}>
              Download a full backup of all projects, devices, and tasks. This backup file can be used to restore data.
            </p>
            <button
              onClick={async () => {
                try {
                  setLoading(true);
                  const token = localStorage.getItem('token');
                  const response = await fetch('/api/backup/export', {
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  if (!response.ok) throw new Error('Export failed');
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `portal-backup-${new Date().toISOString().split('T')[0]}.json`;
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  document.body.removeChild(a);
                  setSuccess('Backup exported successfully!');
                } catch (err: any) {
                  setError(err.message || 'Export failed');
                } finally {
                  setLoading(false);
                }
              }}
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', marginBottom: '2rem' }}
            >
              {loading ? '🔄 Exporting...' : '📥 Download Full Backup'}
            </button>

            <h4 style={{ marginBottom: '1rem' }}>📤 Import Backup</h4>
            <p style={{ color: '#666', marginBottom: '1rem', fontSize: '0.9rem' }}>
              Restore projects, devices, and tasks from a backup file. Existing projects with the same name will be skipped.
            </p>
            <input
              ref={backupFileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                
                try {
                  setImporting(true);
                  setError('');
                  setImportResults(null);
                  
                  const text = await file.text();
                  const backup = JSON.parse(text);
                  
                  const token = localStorage.getItem('token');
                  const response = await fetch('/api/backup/import', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ backup, options: { overwrite: false } })
                  });
                  
                  const result = await response.json();
                  if (!response.ok) throw new Error(result.error || 'Import failed');
                  
                  setImportResults(result.results);
                  setSuccess('Backup imported successfully! Refresh the page to see changes.');
                } catch (err: any) {
                  setError(err.message || 'Import failed');
                } finally {
                  setImporting(false);
                  if (backupFileInputRef.current) backupFileInputRef.current.value = '';
                }
              }}
            />
            <button
              onClick={() => backupFileInputRef.current?.click()}
              className="btn btn-secondary"
              disabled={importing}
              style={{ width: '100%' }}
            >
              {importing ? '🔄 Importing...' : '📂 Select Backup File'}
            </button>

            {importResults && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <h5 style={{ margin: '0 0 0.5rem', color: '#166534' }}>Import Results:</h5>
                <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#166534', fontSize: '0.9rem' }}>
                  <li>Projects: {importResults.projects?.created || 0} created, {importResults.projects?.skipped || 0} skipped</li>
                  <li>Devices: {importResults.devices?.created || 0} created, {importResults.devices?.skipped || 0} skipped</li>
                  <li>Tasks: {importResults.tasks?.created || 0} created, {importResults.tasks?.skipped || 0} skipped</li>
                </ul>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default UserSettingsModal;
