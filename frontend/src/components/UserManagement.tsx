import { useState, useEffect } from 'react'
import { User } from '../types'
import { usersAPI } from '../services/apiService'

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Delete this user?')) return

    try {
      await usersAPI.delete(userId)
      setUsers(users.filter(u => u._id !== userId))
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div>
      <h3>👥 User Management</h3>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <p>Loading users...</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--gray-200)' }}>
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
                    <span style={{
                      fontSize: '0.8rem',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '3px',
                      background: user.role === 'admin' ? '#fca5a5' : '#fecaca',
                      color: user.role === 'admin' ? '#7f1d1d' : '#991b1b',
                    }}>
                      {user.role}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {user.isActive ? '✅ Active' : '❌ Inactive'}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteUser(user._id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}