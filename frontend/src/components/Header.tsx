import { useState } from 'react'
import { User } from '../types'
import { UserManagementModal } from './UserManagementModal'

interface HeaderProps {
  user: User
  onLogout: () => void
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  const [showUserMgmt, setShowUserMgmt] = useState(false)

  return (
    <>
      <header className="header">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>🏠 Electronic Living Docs</h1>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--gray-500)' }}>AV Project Manager</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>👤 {user.name}</p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </p>
            </div>
            
            {/* Admin-only buttons */}
            {user.role === 'admin' && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowUserMgmt(true)}
              >
                👥 Users
              </button>
            )}
            
            <button className="btn btn-secondary btn-sm" onClick={onLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      {showUserMgmt && (
        <UserManagementModal onClose={() => setShowUserMgmt(false)} />
      )}
    </>
  )
}