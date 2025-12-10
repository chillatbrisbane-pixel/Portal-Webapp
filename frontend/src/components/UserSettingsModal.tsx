import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { authAPI, settingsAPI } from '../services/apiService';
import { CalendarSettings } from './CalendarSettings';

interface BrandingSettings {
  logo: { filename: string; mimeType: string; hasData: boolean } | null;
  background: { filename: string; mimeType: string; opacity: number; hasData: boolean } | null;
  companyName: string;
  companyWebsite: string;
}

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
  const [activeTab, setActiveTab] = useState<'password' | '2fa' | 'calendar' | 'backup' | 'branding'>('password');
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

  // Branding state
  const [branding, setBranding] = useState<BrandingSettings>({
    logo: null,
    background: null,
    companyName: 'Electronic Living',
    companyWebsite: 'www.electronicliving.com.au',
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);
  const [backgroundOpacity, setBackgroundOpacity] = useState(0.1);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load2FAStatus();
    if (user.role === 'admin') {
      loadBranding();
    }
  }, []);

  const loadBranding = async () => {
    try {
      const result = await settingsAPI.getBranding();
      setBranding(result.branding);
      setBackgroundOpacity(result.branding.background?.opacity || 0.1);
      
      // Load logo preview if exists
      if (result.branding.logo?.hasData) {
        try {
          const logoData = await settingsAPI.getLogo();
          setLogoPreview(`data:${logoData.mimeType};base64,${logoData.data}`);
        } catch (e) {
          console.log('Could not load logo preview');
        }
      }
      
      // Load background preview if exists
      if (result.branding.background?.hasData) {
        try {
          const bgData = await settingsAPI.getBackground();
          setBackgroundPreview(`data:${bgData.mimeType};base64,${bgData.data}`);
        } catch (e) {
          console.log('Could not load background preview');
        }
      }
    } catch (err) {
      console.error('Failed to load branding:', err);
    }
  };

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
          <button
            onClick={() => { setActiveTab('calendar'); setError(''); setSuccess(''); }}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              background: activeTab === 'calendar' ? '#3b82f6' : 'transparent',
              color: activeTab === 'calendar' ? 'white' : '#666',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            📅 Calendar
          </button>
          {user.role === 'admin' && (
            <>
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
            <button
              onClick={() => { setActiveTab('branding'); setError(''); setSuccess(''); }}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                background: activeTab === 'branding' ? '#3b82f6' : 'transparent',
                color: activeTab === 'branding' ? 'white' : '#666',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              🎨 Branding
            </button>
            </>
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

        {/* Calendar Tab */}
        {activeTab === 'calendar' && (
          <CalendarSettings />
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

        {/* Branding Tab (Admin Only) */}
        {activeTab === 'branding' && user.role === 'admin' && (
          <div>
            <p style={{ color: '#666', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Customize the branding for PDF reports. Upload your company logo and optional background watermark.
            </p>

            {/* Company Details */}
            <h4 style={{ marginBottom: '1rem' }}>🏢 Company Details</h4>
            <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Company Name</label>
                <input
                  type="text"
                  value={branding.companyName}
                  onChange={(e) => setBranding(prev => ({ ...prev, companyName: e.target.value }))}
                  placeholder="Your Company Name"
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Website</label>
                <input
                  type="text"
                  value={branding.companyWebsite}
                  onChange={(e) => setBranding(prev => ({ ...prev, companyWebsite: e.target.value }))}
                  placeholder="www.yourcompany.com"
                />
              </div>
            </div>

            {/* Logo Upload */}
            <h4 style={{ marginBottom: '1rem' }}>🖼️ PDF Logo</h4>
            <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Displayed at the top of the PDF cover page. PNG or JPEG only (WebP not supported), max 2MB.
            </p>
            
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div style={{ 
                width: '150px', 
                height: '80px', 
                border: '2px dashed #d1d5db', 
                borderRadius: '8px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                background: '#f9fafb',
                overflow: 'hidden',
              }}>
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>No logo</span>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    
                    if (file.size > 2 * 1024 * 1024) {
                      setError('Logo must be under 2MB');
                      return;
                    }
                    
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                      const base64 = (event.target?.result as string).split(',')[1];
                      setLogoPreview(event.target?.result as string);
                      
                      try {
                        setLoading(true);
                        await settingsAPI.updateBranding({
                          logo: { data: base64, mimeType: file.type, filename: file.name }
                        });
                        setSuccess('Logo uploaded successfully!');
                        loadBranding();
                      } catch (err: any) {
                        setError(err.message || 'Failed to upload logo');
                      } finally {
                        setLoading(false);
                      }
                    };
                    reader.readAsDataURL(file);
                  }}
                />
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="btn btn-secondary"
                  disabled={loading}
                  style={{ marginRight: '0.5rem' }}
                >
                  📤 Upload Logo
                </button>
                {branding.logo?.hasData && (
                  <button
                    onClick={async () => {
                      try {
                        setLoading(true);
                        await settingsAPI.deleteLogo();
                        setLogoPreview(null);
                        setBranding(prev => ({ ...prev, logo: null }));
                        setSuccess('Logo removed');
                      } catch (err: any) {
                        setError(err.message || 'Failed to remove logo');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="btn btn-danger"
                    disabled={loading}
                    style={{ padding: '0.5rem 1rem' }}
                  >
                    🗑️ Remove
                  </button>
                )}
              </div>
            </div>

            {/* Background Watermark Upload */}
            <h4 style={{ marginBottom: '1rem' }}>🌫️ Background Watermark</h4>
            <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Optional watermark displayed faded behind PDF content. PNG or JPEG only, max 5MB.
            </p>
            
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ 
                width: '150px', 
                height: '100px', 
                border: '2px dashed #d1d5db', 
                borderRadius: '8px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                background: '#f9fafb',
                overflow: 'hidden',
                position: 'relative',
              }}>
                {backgroundPreview ? (
                  <img 
                    src={backgroundPreview} 
                    alt="Background preview" 
                    style={{ 
                      maxWidth: '100%', 
                      maxHeight: '100%', 
                      objectFit: 'contain',
                      opacity: backgroundOpacity,
                    }} 
                  />
                ) : (
                  <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>No background</span>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <input
                  ref={backgroundInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    
                    if (file.size > 5 * 1024 * 1024) {
                      setError('Background must be under 5MB');
                      return;
                    }
                    
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                      const base64 = (event.target?.result as string).split(',')[1];
                      setBackgroundPreview(event.target?.result as string);
                      
                      try {
                        setLoading(true);
                        await settingsAPI.updateBranding({
                          background: { data: base64, mimeType: file.type, filename: file.name, opacity: backgroundOpacity }
                        });
                        setSuccess('Background uploaded successfully!');
                        loadBranding();
                      } catch (err: any) {
                        setError(err.message || 'Failed to upload background');
                      } finally {
                        setLoading(false);
                      }
                    };
                    reader.readAsDataURL(file);
                  }}
                />
                <button
                  onClick={() => backgroundInputRef.current?.click()}
                  className="btn btn-secondary"
                  disabled={loading}
                  style={{ marginRight: '0.5rem' }}
                >
                  📤 Upload Background
                </button>
                {branding.background?.hasData && (
                  <button
                    onClick={async () => {
                      try {
                        setLoading(true);
                        await settingsAPI.deleteBackground();
                        setBackgroundPreview(null);
                        setBranding(prev => ({ ...prev, background: null }));
                        setSuccess('Background removed');
                      } catch (err: any) {
                        setError(err.message || 'Failed to remove background');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="btn btn-danger"
                    disabled={loading}
                    style={{ padding: '0.5rem 1rem' }}
                  >
                    🗑️ Remove
                  </button>
                )}
              </div>
            </div>

            {/* Opacity Slider */}
            {branding.background?.hasData && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                  Watermark Opacity: {Math.round(backgroundOpacity * 100)}%
                </label>
                <input
                  type="range"
                  min="0.05"
                  max="0.3"
                  step="0.05"
                  value={backgroundOpacity}
                  onChange={(e) => setBackgroundOpacity(parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
                <button
                  onClick={async () => {
                    try {
                      setLoading(true);
                      await settingsAPI.updateBranding({ background: { opacity: backgroundOpacity } as any });
                      setSuccess('Opacity updated!');
                    } catch (err: any) {
                      setError(err.message || 'Failed to update opacity');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="btn btn-secondary"
                  disabled={loading}
                  style={{ marginTop: '0.5rem' }}
                >
                  Save Opacity
                </button>
              </div>
            )}

            {/* Save Company Details */}
            <button
              onClick={async () => {
                try {
                  setLoading(true);
                  await settingsAPI.updateBranding({
                    companyName: branding.companyName,
                    companyWebsite: branding.companyWebsite,
                  });
                  setSuccess('Company details saved!');
                } catch (err: any) {
                  setError(err.message || 'Failed to save company details');
                } finally {
                  setLoading(false);
                }
              }}
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%' }}
            >
              {loading ? '🔄 Saving...' : '💾 Save Company Details'}
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default UserSettingsModal;
