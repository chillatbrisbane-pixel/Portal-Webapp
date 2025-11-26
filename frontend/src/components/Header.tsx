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
                Project Documentation
              </h1>
            </div>
          </div>
        </div>

        {/* Right side - User Info and Actions */}
        <div className="header-right">
          <div className="user-info">
            <span>👤 {user.name}</span>
            <span className="user-role">{user.role}</span>
          </div>

          {onShowUsers && (
            <button
              onClick={onShowUsers}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                padding: '0.3rem 0.8rem',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                transition: 'all 0.3s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
            >
              {user.role === 'admin' ? '👥 Users' : '👤 Profile'}
            </button>
          )}

          <button 
            onClick={onLogout}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '0.3rem 0.8rem',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 600,
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.3s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
          >
            🚪 Logout
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header
