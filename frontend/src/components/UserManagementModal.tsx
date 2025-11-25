import { useState, useEffect } from 'react'
import { User } from '../types'
import { usersAPI } from '../services/apiService'

interface UserManagementModalProps {
  onClose: () => void
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ onClose }) => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  // Add user form
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    role: 'technician' as const,
  })

  // Password change form
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
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

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newUserForm.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    try {
      // Backend doesn't have create endpoint from frontend, but we have the API ready
      // This would require adding a POST endpoint to users routes
      setError('Note: User creation endpoint still needs to be implemented in backend')
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleResetPassword = async (userId: string) => {
    if (!window.confirm('Reset password for this user?')) return

    try {
      const newPassword = Math.random().toString(36).slice(-8)
      await usersAPI.resetPassword(userId, newPassword)
      alert(`Password reset to: ${newPassword}\n\nShare this with the user.`)
      loadUsers()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!window.confirm(`Delete user "${username}"? This cannot be undone.`)) return

    try {
      await usersAPI.delete(userId)
      setUsers(users.filter(u => u._id !== userId))
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleToggleActive = async (user: User) => {
    try {
      const updated = await usersAPI.update(user._id, {
        isActive: !user.isActive,
      })
      setUsers(users.map(u => u._id === user._id ? updated : u))
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleChangeUserRole = async (userId: string, newRole: string) => {
    try {
      const updated = await usersAPI.update(userId, {
        role: newRole,
      })
      setUsers(users.map(u => u._id === userId ? updated : u))
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>👥 User Management</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          {/* Add User Section */}
          <div style={{ marginBottom: '2rem', paddingBottom: '2rem', borderBottom: '1px solid var(--gray-200)' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowAddForm(!showAddForm)}
              style={{ marginBottom: '1rem' }}
            >
              {showAddForm ? '✕ Cancel' : '➕ Add New User'}
            </button>

            {showAddForm && (
              <form onSubmit={handleAddUser} style={{ background: 'var(--gray-50)', padding: '1rem', borderRadius: '6px' }}>
                <div className="form-group">
                  <label>Username *</label>
                  <input
                    type="text"
                    value={newUserForm.username}
                    onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    value={newUserForm.name}
                    onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={newUserForm.email}
                    onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Password *</label>
                  <input
                    type="password"
                    value={newUserForm.password}
                    onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                    placeholder="Min 6 characters"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Role</label>
                  <select
                    value={newUserForm.role}
                    onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as any })}
                  >
                    <option value="technician">Technician</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <button type="submit" className="btn btn-success">
                  Create User
                </button>
              </form>
            )}
          </div>

          {/* Users List */}
          {loading ? (
            <p>Loading users...</p>
          ) : users.length === 0 ? (
            <p className="text-muted">No users found.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--gray-200)', background: 'var(--gray-50)' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Username</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Email</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Role</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Status</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user._id} style={{ borderBottom: '1px solid var(--gray-200)' }}>
                      <td style={{ padding: '0.75rem' }}>{user.name}</td>
                      <td style={{ padding: '0.75rem' }}>{user.username}</td>
                      <td style={{ padding: '0.75rem' }}>{user.email}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <select
                          value={user.role}
                          onChange={(e) => handleChangeUserRole(user._id, e.target.value)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '3px',
                            border: '1px solid var(--gray-300)',
                            fontSize: '0.85rem',
                          }}
                        >
                          <option value="technician">Technician</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <button
                          className="btn btn-sm"
                          onClick={() => handleToggleActive(user)}
                          style={{
                            background: user.isActive ? 'var(--success-color)' : 'var(--danger-color)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                          }}
                        >
                          {user.isActive ? '✅ Active' : '❌ Inactive'}
                        </button>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleResetPassword(user._id)}
                            title="Generate new random password"
                          >
                            🔑
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteUser(user._id, user.username)}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}