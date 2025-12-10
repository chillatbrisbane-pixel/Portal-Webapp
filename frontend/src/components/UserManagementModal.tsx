import React, { useState, useEffect } from 'react'
import { User, ActivityLog } from '../types'
import { usersAPI, activeUsersAPI } from '../services/apiService'

interface UserManagementModalProps {
  currentUser: User
  onClose: () => void
  onUsersUpdated?: () => void
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  currentUser,
  onClose,
  onUsersUpdated,
}) => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [passwordMode, setPasswordMode] = useState(false)
  const [selfPasswordMode, setSelfPasswordMode] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    currentPassword: '',
    role: 'viewer',
  })
  
  // Invite link state
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [inviteCopied, setInviteCopied] = useState(false)
  
  // Activity log state
  const [activeTab, setActiveTab] = useState<'users' | 'activity'>('users')
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [loginHistory, setLoginHistory] = useState<ActivityLog[]>([])
  const [viewingUserHistory, setViewingUserHistory] = useState<User | null>(null)
  
  // Active users
  const [activeUsers, setActiveUsers] = useState<User[]>([])
  const [loadingActiveUsers, setLoadingActiveUsers] = useState(false)

  useEffect(() => {
    // Only admins can load all users
    if (currentUser.role === 'admin') {
      loadUsers()
      loadActiveUsers()
      // Refresh active users every 30 seconds
      const interval = setInterval(loadActiveUsers, 30000)
      return () => clearInterval(interval)
    } else {
      setLoading(false)
    }
  }, [currentUser.role])

  const loadUsers = async () => {
    if (currentUser.role !== 'admin') return
    try {
      setLoading(true)
      const data = await usersAPI.getAll()
      setUsers(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadActiveUsers = async () => {
    if (currentUser.role !== 'admin') return
    try {
      setLoadingActiveUsers(true)
      const data = await activeUsersAPI.getActiveUsers()
      setActiveUsers(data)
    } catch (err) {
      console.error('Failed to load active users:', err)
    } finally {
      setLoadingActiveUsers(false)
    }
  }

  const loadActivityLogs = async () => {
    try {
      setLoading(true)
      const data = await usersAPI.getActivityLogs({ limit: 100 })
      setActivityLogs(data.logs)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadLoginHistory = async (userId: string) => {
    try {
      setLoading(true)
      const data = await usersAPI.getLoginHistory(userId)
      setLoginHistory(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddUser = () => {
    setEditingUser(null)
    setFormData({ name: '', email: '', password: '', currentPassword: '', role: 'viewer' })
    setShowForm(true)
    setPasswordMode(false)
    setSelfPasswordMode(false)
    setInviteLink(null)
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setFormData({ name: user.name, email: user.email, password: '', currentPassword: '', role: user.role })
    setShowForm(true)
    setPasswordMode(false)
    setSelfPasswordMode(false)
  }

  const handleResetPassword = (user: User) => {
    setEditingUser(user)
    setFormData({ name: user.name, email: user.email, password: '', currentPassword: '', role: user.role })
    setPasswordMode(true)
    setSelfPasswordMode(false)
    setShowForm(true)
  }

  const handleChangeOwnPassword = () => {
    setEditingUser(currentUser)
    setFormData({ name: currentUser.name, email: currentUser.email, password: '', currentPassword: '', role: currentUser.role })
    setPasswordMode(false)
    setSelfPasswordMode(true)
    setShowForm(true)
  }

  const handleResendInvite = async (user: User) => {
    setLoading(true)
    setError('')
    try {
      const result = await usersAPI.resendInvite(user._id)
      const baseUrl = window.location.origin
      setInviteLink(`${baseUrl}/accept-invite?token=${result.inviteToken}`)
      setInviteCopied(false)
      setShowForm(true)
      setEditingUser(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const copyInviteLink = async () => {
    if (inviteLink) {
      try {
        await navigator.clipboard.writeText(inviteLink)
        setInviteCopied(true)
        setTimeout(() => setInviteCopied(false), 3000)
      } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = inviteLink
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        setInviteCopied(true)
        setTimeout(() => setInviteCopied(false), 3000)
      }
    }
  }

  const handleViewLoginHistory = async (user: User) => {
    setViewingUserHistory(user)
    await loadLoginHistory(user._id)
  }

  const handleSuspendUser = async (user: User) => {
    if (!window.confirm(`Suspend ${user.name}? They will not be able to log in until unsuspended.`)) return
    
    setLoading(true)
    try {
      await usersAPI.suspend(user._id)
      loadUsers()
      onUsersUpdated?.()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUnsuspendUser = async (user: User) => {
    setLoading(true)
    try {
      await usersAPI.unsuspend(user._id)
      loadUsers()
      onUsersUpdated?.()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (selfPasswordMode) {
        // Changing own password - requires current password
        if (!formData.currentPassword || !formData.password) {
          setError('Current password and new password are required')
          setLoading(false)
          return
        }
        if (formData.password.length < 6) {
          setError('Password must be at least 6 characters')
          setLoading(false)
          return
        }
        await usersAPI.changePassword(currentUser._id, formData.currentPassword, formData.password)
        setShowForm(false)
        setPasswordMode(false)
        setSelfPasswordMode(false)
      } else if (passwordMode) {
        if (!formData.password) {
          setError('Password is required')
          setLoading(false)
          return
        }
        await usersAPI.resetPassword(editingUser!._id, formData.password)
        setShowForm(false)
        setPasswordMode(false)
        setSelfPasswordMode(false)
      } else if (editingUser) {
        // If editing own profile, include email
        const updateData: any = { name: formData.name }
        if (editingUser._id === currentUser._id) {
          updateData.email = formData.email
        } else if (currentUser.role === 'admin') {
          updateData.role = formData.role
        }
        await usersAPI.update(editingUser._id, updateData)
        setShowForm(false)
        setPasswordMode(false)
        setSelfPasswordMode(false)
      } else {
        // Create new user via invite system
        const result = await usersAPI.invite({
          name: formData.name,
          email: formData.email,
          role: formData.role,
        })
        // Show the invite link
        const baseUrl = window.location.origin
        setInviteLink(`${baseUrl}/accept-invite?token=${result.inviteToken}`)
        setInviteCopied(false)
      }

      loadUsers()
      onUsersUpdated?.()
    } catch (err: any) {
      setError(err.message || 'Failed to save user')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Delete this user? This cannot be undone.')) return

    setLoading(true)
    try {
      await usersAPI.delete(userId)
      loadUsers()
      onUsersUpdated?.()
    } catch (err: any) {
      setError(err.message || 'Failed to delete user')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'login': '🔓 Login',
      'login_failed': '❌ Login Failed',
      'logout': '🚪 Logout',
      'password_change': '🔑 Password Changed',
      '2fa_enabled': '🔐 2FA Enabled',
      '2fa_disabled': '🔓 2FA Disabled',
      'user_created': '👤 User Created',
      'user_updated': '✏️ User Updated',
      'user_deleted': '🗑️ User Deleted',
      'user_suspended': '⛔ User Suspended',
      'user_unsuspended': '✅ User Unsuspended',
      'user_role_changed': '🔄 Role Changed',
      'project_created': '📁 Project Created',
      'project_updated': '📝 Project Updated',
      'project_deleted': '🗑️ Project Deleted',
    }
    return labels[action] || action
  }

  // Login History View
  if (viewingUserHistory) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
          <div className="modal-header">
            <h2>🕐 Login History - {viewingUserHistory.name}</h2>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body">
            <button
              onClick={() => { setViewingUserHistory(null); setLoginHistory([]) }}
              className="btn btn-secondary"
              style={{ marginBottom: '1rem' }}
            >
              ← Back to Users
            </button>

            {loading ? (
              <p>Loading...</p>
            ) : loginHistory.length === 0 ? (
              <p style={{ color: '#666' }}>No login history found.</p>
            ) : (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                      <th style={{ padding: '0.75rem' }}>Date/Time</th>
                      <th style={{ padding: '0.75rem' }}>Status</th>
                      <th style={{ padding: '0.75rem' }}>IP Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loginHistory.map((log, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.75rem' }}>{formatDate(log.createdAt)}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.85rem',
                            background: log.action === 'login' ? '#dcfce7' : '#fee2e2',
                            color: log.action === 'login' ? '#166534' : '#991b1b',
                          }}>
                            {log.action === 'login' ? '✅ Success' : '❌ Failed'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                          {log.ipAddress || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
        <div className="modal-header">
          <h2>{currentUser.role === 'admin' ? '👥 User Management' : '👤 My Profile'}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

          {/* Admin Tabs */}
          {currentUser.role === 'admin' && !showForm && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
              <button
                onClick={() => { setActiveTab('users'); setError('') }}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: activeTab === 'users' ? '#3b82f6' : 'transparent',
                  color: activeTab === 'users' ? 'white' : '#666',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                👥 Users
              </button>
              <button
                onClick={() => { setActiveTab('activity'); loadActivityLogs(); setError('') }}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: activeTab === 'activity' ? '#3b82f6' : 'transparent',
                  color: activeTab === 'activity' ? 'white' : '#666',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                📋 Activity Log
              </button>
            </div>
          )}

          {!showForm ? (
            <>
              {currentUser.role === 'admin' && activeTab === 'users' ? (
                <>
                  {/* My Profile Quick Section for Admins */}
                  <div style={{ 
                    padding: '1rem', 
                    background: '#eff6ff', 
                    borderRadius: '8px', 
                    marginBottom: '1.5rem',
                    border: '1px solid #bfdbfe',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ margin: '0 0 0.25rem 0', color: '#1e40af' }}>👤 My Profile</h4>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#6b7280' }}>
                          {currentUser.name} • {currentUser.email}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleEditUser(currentUser)}
                          className="btn btn-sm"
                          style={{ background: '#3b82f6', color: 'white' }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={handleChangeOwnPassword}
                          className="btn btn-sm"
                          style={{ background: '#6b7280', color: 'white' }}
                        >
                          🔐 Password
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleAddUser}
                    className="btn btn-primary"
                    style={{ marginBottom: '1.5rem' }}
                  >
                    ➕ Invite New User
                  </button>

                  {loading ? (
                    <p>Loading users...</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      {users.filter(u => u._id !== currentUser._id).map(user => (
                        <div
                          key={user._id}
                          style={{
                            padding: '1rem',
                            background: user.suspended ? '#fef2f2' : user.accountStatus === 'pending' ? '#fefce8' : '#f9fafb',
                            borderRadius: '6px',
                            border: `1px solid ${user.suspended ? '#fecaca' : user.accountStatus === 'pending' ? '#fde047' : '#e5e7eb'}`,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                <h4 style={{ margin: 0 }}>{user.name}</h4>
                                {user.accountStatus === 'pending' && (
                                  <span style={{
                                    padding: '0.125rem 0.5rem',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    background: '#eab308',
                                    color: 'white',
                                  }}>
                                    PENDING
                                  </span>
                                )}
                                {user.suspended && (
                                  <span style={{
                                    padding: '0.125rem 0.5rem',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    background: '#dc2626',
                                    color: 'white',
                                  }}>
                                    SUSPENDED
                                  </span>
                                )}
                                {user.twoFactorEnabled && (
                                  <span title="2FA Enabled" style={{ fontSize: '0.9rem' }}>🔐</span>
                                )}
                              </div>
                              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#6b7280' }}>
                                {user.email}
                              </p>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span
                                  style={{
                                    padding: '0.25rem 0.75rem',
                                    borderRadius: '12px',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    background: user.role === 'admin' ? '#fee2e2' : user.role === 'project-manager' ? '#fef3c7' : user.role === 'tech' ? '#dbeafe' : '#e0f2fe',
                                    color: user.role === 'admin' ? '#991b1b' : user.role === 'project-manager' ? '#92400e' : user.role === 'tech' ? '#1e40af' : '#0369a1',
                                  }}
                                >
                                  {user.role === 'admin' ? 'Admin' : user.role === 'project-manager' ? 'Project Manager' : user.role === 'tech' ? 'Tech' : 'Viewer'}
                                </span>
                                </span>
                                {user.lastLogin && (
                                  <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                                    Last login: {formatDate(user.lastLogin)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              {user.accountStatus === 'pending' ? (
                                <>
                                  <button
                                    onClick={() => handleResendInvite(user)}
                                    className="btn btn-sm"
                                    style={{ background: '#3b82f6', color: 'white' }}
                                    title="Resend invite link"
                                  >
                                    📧 Resend Invite
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUser(user._id)}
                                    className="btn btn-sm"
                                    style={{ background: '#ef4444', color: 'white' }}
                                  >
                                    Delete
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleViewLoginHistory(user)}
                                    className="btn btn-sm"
                                    style={{ background: '#6b7280', color: 'white' }}
                                    title="View login history"
                                  >
                                    🕐
                                  </button>
                                  <button
                                    onClick={() => handleEditUser(user)}
                                    className="btn btn-sm"
                                    style={{ background: '#0066cc', color: 'white' }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleResetPassword(user)}
                                    className="btn btn-sm"
                                    style={{ background: '#f59e0b', color: 'white' }}
                                    title="Reset password"
                                  >
                                    🔑
                                  </button>
                                  {user._id !== currentUser._id && (
                                    <>
                                      {user.suspended ? (
                                        <button
                                          onClick={() => handleUnsuspendUser(user)}
                                          className="btn btn-sm"
                                          style={{ background: '#10b981', color: 'white' }}
                                        >
                                          Unsuspend
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => handleSuspendUser(user)}
                                          className="btn btn-sm"
                                          style={{ background: '#f97316', color: 'white' }}
                                        >
                                          Suspend
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleDeleteUser(user._id)}
                                        className="btn btn-sm"
                                        style={{ background: '#ef4444', color: 'white' }}
                                      >
                                        Delete
                                      </button>
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : currentUser.role === 'admin' && activeTab === 'activity' ? (
                <>
                  {loading ? (
                    <p>Loading activity logs...</p>
                  ) : activityLogs.length === 0 ? (
                    <p style={{ color: '#666' }}>No activity logs found.</p>
                  ) : (
                    <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#f3f4f6', textAlign: 'left', position: 'sticky', top: 0 }}>
                            <th style={{ padding: '0.75rem' }}>Date/Time</th>
                            <th style={{ padding: '0.75rem' }}>User</th>
                            <th style={{ padding: '0.75rem' }}>Action</th>
                            <th style={{ padding: '0.75rem' }}>Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activityLogs.map((log, i) => {
                            // Format details more helpfully
                            const formatDetails = () => {
                              const details: string[] = []
                              
                              if (log.targetUser) {
                                details.push(`👤 ${log.targetUser.name}`)
                              }
                              
                              // Only show useful details
                              if (log.details) {
                                if (log.details.newUserEmail) {
                                  details.push(`📧 ${log.details.newUserEmail}`)
                                }
                                if (log.details.newUserRole) {
                                  details.push(`Role: ${log.details.newUserRole}`)
                                }
                                if (log.details.reason) {
                                  details.push(`Reason: ${log.details.reason}`)
                                }
                              }
                              
                              return details.join(' • ') || '—'
                            }
                            
                            return (
                              <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '0.75rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                                  {formatDate(log.createdAt)}
                                </td>
                                <td style={{ padding: '0.75rem' }}>
                                  {log.user?.name || 'System'}
                                </td>
                                <td style={{ padding: '0.75rem' }}>
                                  {getActionLabel(log.action)}
                                </td>
                                <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: '#666' }}>
                                  {formatDetails()}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: '6px', marginBottom: '1.5rem' }}>
                    <h3 style={{ color: '#333333', marginTop: 0 }}>Your Profile</h3>
                    <p style={{ margin: '0.5rem 0' }}>
                      <strong>Name:</strong> {currentUser.name}
                    </p>
                    <p style={{ margin: '0.5rem 0' }}>
                      <strong>Email:</strong> {currentUser.email}
                    </p>
                    <p style={{ margin: '0.5rem 0' }}>
                      <strong>Role:</strong> {currentUser.role}
                    </p>
                    {currentUser.lastLogin && (
                      <p style={{ margin: '0.5rem 0' }}>
                        <strong>Last Login:</strong> {formatDate(currentUser.lastLogin)}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleEditUser(currentUser)}
                    className="btn btn-primary"
                    style={{ marginRight: '0.5rem' }}
                  >
                    ✏️ Edit Profile
                  </button>
                  <button
                    onClick={handleChangeOwnPassword}
                    className="btn btn-secondary"
                  >
                    🔐 Change Password
                  </button>
                </>
              )}
            </>
          ) : inviteLink ? (
            // Show invite link after user creation
            <>
              <h3 style={{ color: '#333333' }}>✅ User Invited Successfully</h3>
              
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '1.5rem',
                marginBottom: '1.5rem',
              }}>
                <p style={{ margin: '0 0 1rem 0', color: '#166534' }}>
                  Share this link with the new user. They'll use it to set their password and activate their account.
                </p>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#666' }}>
                  ⏰ Link expires in 48 hours
                </p>
              </div>

              <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '1.5rem',
              }}>
                <input
                  type="text"
                  value={inviteLink}
                  readOnly
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    background: '#f9fafb',
                  }}
                />
                <button
                  type="button"
                  onClick={copyInviteLink}
                  className="btn btn-primary"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {inviteCopied ? '✅ Copied!' : '📋 Copy Link'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => { setInviteLink(null); setShowForm(false); }}
                className="btn btn-secondary"
                style={{ width: '100%' }}
              >
                Done
              </button>
            </>
          ) : (
            <>
              <h3 style={{ color: '#333333' }}>
                {selfPasswordMode ? '🔐 Change Password' : passwordMode ? '🔐 Reset Password' : editingUser ? '✏️ Edit User' : '➕ Invite New User'}
              </h3>

              {passwordMode && (
                <p style={{ color: '#666', marginBottom: '1rem' }}>
                  User will be required to change this password on their next login.
                </p>
              )}

              {!editingUser && !passwordMode && !selfPasswordMode && (
                <p style={{ color: '#666', marginBottom: '1rem' }}>
                  An invite link will be generated for the new user to set their own password.
                </p>
              )}

              <form onSubmit={handleSubmit}>
                {!passwordMode && !selfPasswordMode && (
                  <>
                    <div className="form-group">
                      <label htmlFor="name">Name</label>
                      <input
                        id="name"
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Full name"
                        required
                        disabled={loading}
                      />
                    </div>

                    {(!editingUser || editingUser._id === currentUser._id) && (
                      <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="email@example.com"
                          required
                          disabled={loading}
                        />
                      </div>
                    )}

                    {currentUser.role === 'admin' && editingUser && editingUser._id !== currentUser._id && (
                      <div className="form-group">
                        <label htmlFor="role">Role</label>
                        <select
                          id="role"
                          value={formData.role}
                          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                          disabled={loading}
                        >
                          <option value="viewer">Viewer (View Only)</option>
                          <option value="tech">Tech (Full Access)</option>
                          <option value="project-manager">Project Manager (Full + Assign Tasks)</option>
                          <option value="admin">Admin (Full + User Management)</option>
                        </select>
                      </div>
                    )}

                    {/* Role select for new user invites */}
                    {currentUser.role === 'admin' && !editingUser && (
                      <div className="form-group">
                        <label htmlFor="role">Role</label>
                        <select
                          id="role"
                          value={formData.role}
                          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                          disabled={loading}
                        >
                          <option value="viewer">Viewer (View Only)</option>
                          <option value="tech">Tech (Full Access)</option>
                          <option value="project-manager">Project Manager (Full + Assign Tasks)</option>
                          <option value="admin">Admin (Full + User Management)</option>
                        </select>
                      </div>
                    )}
                  </>
                )}

                {selfPasswordMode && (
                  <div className="form-group">
                    <label htmlFor="currentPassword">Current Password</label>
                    <input
                      id="currentPassword"
                      type="password"
                      value={formData.currentPassword}
                      onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                      placeholder="Enter current password"
                      required
                      disabled={loading}
                    />
                  </div>
                )}

                {(passwordMode || selfPasswordMode) && (
                  <div className="form-group">
                    <label htmlFor="password">New Password</label>
                    <input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Enter new password"
                      required
                      disabled={loading}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setPasswordMode(false); setSelfPasswordMode(false); setInviteLink(null); }}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary"
                  >
                    {loading ? '⏳ Saving...' : passwordMode || selfPasswordMode ? '🔐 Change Password' : editingUser ? '💾 Save' : '📧 Send Invite'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default UserManagementModal
