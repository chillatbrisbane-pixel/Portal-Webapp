import React, { useState, useEffect } from 'react'
import { User } from '../types'
import { usersAPI } from '../services/apiService'

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
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'technician',
  })

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
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

  const handleAddUser = () => {
    setEditingUser(null)
    setFormData({ name: '', email: '', password: '', role: 'technician' })
    setShowForm(true)
    setPasswordMode(false)
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setFormData({ name: user.name, email: user.email, password: '', role: user.role })
    setShowForm(true)
    setPasswordMode(false)
  }

  const handleChangePassword = (user: User) => {
    setEditingUser(user)
    setFormData({ name: user.name, email: user.email, password: '', role: user.role })
    setPasswordMode(true)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (passwordMode) {
        if (!formData.password) {
          setError('Password is required')
          setLoading(false)
          return
        }
        await usersAPI.changePassword(editingUser!._id, formData.password)
      } else if (editingUser) {
        await usersAPI.update(editingUser._id, {
          name: formData.name,
          email: formData.email,
          role: formData.role,
        })
      } else {
        if (!formData.password) {
          setError('Password is required for new users')
          setLoading(false)
          return
        }
        await usersAPI.create({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
        })
      }

      setShowForm(false)
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
        <div className="modal-header">
          <h2>{currentUser.role === 'admin' ? '👥 Manage Users' : '👤 My Profile'}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          {!showForm ? (
            <>
              {currentUser.role === 'admin' ? (
                <>
                  <button
                    onClick={handleAddUser}
                    className="btn btn-primary"
                    style={{ marginBottom: '1.5rem' }}
                  >
                    ➕ Add New User
                  </button>

                  {loading ? (
                    <p>Loading users...</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      {users.map(user => (
                        <div
                          key={user._id}
                          style={{
                            padding: '1rem',
                            background: '#f9fafb',
                            borderRadius: '6px',
                            border: '1px solid #e5e7eb',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <h4 style={{ margin: '0 0 0.25rem 0' }}>{user.name}</h4>
                            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#6b7280' }}>
                              {user.email}
                            </p>
                            <span
                              style={{
                                padding: '0.25rem 0.75rem',
                                borderRadius: '12px',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                background: '#e0f2fe',
                                color: '#0369a1',
                              }}
                            >
                              {user.role}
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              onClick={() => handleEditUser(user)}
                              className="btn btn-sm"
                              style={{
                                background: '#0066cc',
                                color: 'white',
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user._id)}
                              className="btn btn-sm"
                              style={{
                                background: '#ef4444',
                                color: 'white',
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
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
                  </div>

                  <button
                    onClick={() => handleEditUser(currentUser)}
                    className="btn btn-primary"
                    style={{ marginRight: '0.5rem' }}
                  >
                    ✏️ Edit Profile
                  </button>

                  <button
                    onClick={() => handleChangePassword(currentUser)}
                    className="btn btn-secondary"
                  >
                    🔐 Change Password
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <h3 style={{ color: '#333333' }}>
                {passwordMode ? '🔐 Change Password' : editingUser ? '✏️ Edit User' : '➕ Add New User'}
              </h3>

              <form onSubmit={handleSubmit}>
                {!passwordMode && (
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

                    {currentUser.role === 'admin' && !editingUser && (
                      <div className="form-group">
                        <label htmlFor="role">Role</label>
                        <select
                          id="role"
                          value={formData.role}
                          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                          disabled={loading}
                        >
                          <option value="technician">Technician</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    )}
                  </>
                )}

                <div className="form-group">
                  <label htmlFor="password">
                    {passwordMode ? 'New Password' : 'Password'}
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={passwordMode ? 'Enter new password' : 'Enter password'}
                    required={!editingUser || passwordMode}
                    disabled={loading}
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary"
                  >
                    {loading ? '⏳ Saving...' : '💾 Save'}
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
