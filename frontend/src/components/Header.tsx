import React from 'react'
import { User } from '../types'

interface HeaderProps {
  user: User
  onLogout: () => void
  onShowUsers?: () => void
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout, onShowUsers }) => {
  return (
    <header className="header">
      <div className="header-content">
        {/* Left side - Logo and Title */}
        <div className="header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <img
              src="https://www.electronicliving.com.au/wp-content/uploads/Electronic-Living-Logo-Rev.png"
              alt="Electronic Living Logo"
              style={{ height: '40px', width: 'auto' }}
            />
            <div>
              <h1 style={{ color: '#00a8ff', fontSize: '1.5rem', margin: 0, fontWeight: 700 }}>
                AV Project Manager
              </h1>
              <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.9 }}>
                Electronic Living
              </p>
            </div>
          </div>
        </div>

        {/* Right side - User Info and Actions */}
        <div className="header-right">
          <div className="user-info">
            <span>👤 {user.name}</span>
            <span className="user-role">{user.role}</span>
          </div>

          {user.role === 'admin' && onShowUsers && (
            <button className="btn" onClick={onShowUsers} style={{ fontSize: '0.9rem' }}>
              👥 Users
            </button>
          )}

          <button className="btn" onClick={onLogout} style={{ fontSize: '0.9rem' }}>
            🚪 Logout
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header