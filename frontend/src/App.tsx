import { useState, useEffect, useCallback } from 'react'
import { LoginScreen } from './components/LoginScreen'
import { Dashboard } from './components/Dashboard'
import { Header } from './components/Header'
import { UserManagementModal } from './components/UserManagementModal'
import { UserSettingsModal } from './components/UserSettingsModal'
import { AcceptInvite } from './components/AcceptInvite'
import { authAPI } from './services/apiService'
import { User } from './types'
import './App.css'

// Session timeout constants (2 hours)
const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000 // 2 hours in milliseconds
const WARNING_BEFORE_MS = 5 * 60 * 1000 // Show warning 5 minutes before logout

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [showUserManagement, setShowUserManagement] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [sessionWarning, setSessionWarning] = useState(false)
  const [sessionTimeLeft, setSessionTimeLeft] = useState<number | null>(null)

  // Get login timestamp from localStorage
  const getLoginTime = () => {
    const loginTime = localStorage.getItem('loginTime')
    return loginTime ? parseInt(loginTime, 10) : null
  }

  // Set login time when user logs in
  const setLoginTime = () => {
    localStorage.setItem('loginTime', Date.now().toString())
  }

  // Clear login time on logout
  const clearLoginTime = () => {
    localStorage.removeItem('loginTime')
  }

  // Check session validity
  const checkSession = useCallback(() => {
    if (!user) return
    
    const loginTime = getLoginTime()
    if (!loginTime) {
      // No login time recorded, set it now
      setLoginTime()
      return
    }

    const elapsed = Date.now() - loginTime
    const remaining = SESSION_TIMEOUT_MS - elapsed

    if (remaining <= 0) {
      // Session expired
      handleLogout()
      alert('Your session has expired. Please log in again.')
    } else if (remaining <= WARNING_BEFORE_MS && !sessionWarning) {
      // Show warning
      setSessionWarning(true)
      setSessionTimeLeft(Math.ceil(remaining / 60000)) // minutes
    } else if (remaining > WARNING_BEFORE_MS && sessionWarning) {
      // Reset warning (in case time was extended somehow)
      setSessionWarning(false)
      setSessionTimeLeft(null)
    } else if (sessionWarning) {
      // Update time left
      setSessionTimeLeft(Math.ceil(remaining / 60000))
    }
  }, [user, sessionWarning])

  // Check session every 30 seconds when logged in
  useEffect(() => {
    if (!user) return

    // Initial check
    checkSession()

    const interval = setInterval(checkSession, 30000) // Check every 30 seconds
    return () => clearInterval(interval)
  }, [user, checkSession])

  useEffect(() => {
    // Check for invite token in URL
    const urlParams = new URLSearchParams(window.location.search)
    const token = urlParams.get('token')
    if (token && window.location.pathname.includes('accept-invite')) {
      setInviteToken(token)
      setLoading(false)
      return
    }

    // Check if user is already logged in
    const checkAuth = async () => {
      try {
        const currentUser = await authAPI.getCurrentUser()
        setUser(currentUser)
        // Ensure login time is set
        if (!getLoginTime()) {
          setLoginTime()
        }
      } catch (err) {
        // Not logged in or token expired
        clearLoginTime()
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  const handleLoginSuccess = (userData: User) => {
    setUser(userData)
    setLoginTime() // Record login time
    setSessionWarning(false)
    setSessionTimeLeft(null)
    // Clear invite token and URL params
    setInviteToken(null)
    window.history.replaceState({}, document.title, '/')
  }

  const handleLogout = () => {
    authAPI.logout()
    clearLoginTime()
    setUser(null)
    setSessionWarning(false)
    setSessionTimeLeft(null)
  }

  // Extend session (re-login in background)
  const extendSession = async () => {
    setLoginTime() // Reset the timer
    setSessionWarning(false)
    setSessionTimeLeft(null)
  }

  const refreshUser = async () => {
    try {
      const currentUser = await authAPI.getCurrentUser()
      setUser(currentUser)
    } catch (err) {
      console.error('Failed to refresh user:', err)
    }
  }

  const handleCancelInvite = () => {
    setInviteToken(null)
    window.history.replaceState({}, document.title, '/')
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Loading...</p>
      </div>
    )
  }

  // Show invite acceptance page if token is present
  if (inviteToken) {
    return (
      <AcceptInvite 
        token={inviteToken} 
        onSuccess={handleLoginSuccess}
        onCancel={handleCancelInvite}
      />
    )
  }

  if (!user) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />
  }

  return (
    <div className="app">
      {/* Session timeout warning banner */}
      {sessionWarning && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          color: 'white',
          padding: '0.75rem 1rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '1rem',
          zIndex: 10000,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}>
          <span style={{ fontWeight: 500 }}>
            ⚠️ Your session will expire in {sessionTimeLeft} minute{sessionTimeLeft !== 1 ? 's' : ''}
          </span>
          <button
            onClick={extendSession}
            style={{
              background: 'white',
              color: '#d97706',
              border: 'none',
              padding: '0.4rem 1rem',
              borderRadius: '4px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Stay Logged In
          </button>
          <button
            onClick={handleLogout}
            style={{
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.4)',
              padding: '0.4rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Logout Now
          </button>
        </div>
      )}
      
      <Header 
        user={user} 
        onLogout={handleLogout}
        onShowUsers={() => setShowUserManagement(true)}
        onShowSettings={() => setShowSettings(true)}
      />
      <main className="app-main" style={{ marginTop: sessionWarning ? '50px' : 0 }}>
        <Dashboard user={user} />
      </main>

      {showUserManagement && (
        <UserManagementModal
          currentUser={user}
          onClose={() => setShowUserManagement(false)}
          onUsersUpdated={refreshUser}
        />
      )}

      {showSettings && (
        <UserSettingsModal
          user={user}
          onClose={() => setShowSettings(false)}
          onUserUpdated={(updatedUser) => {
            setUser(updatedUser)
            setShowSettings(false)
          }}
        />
      )}
    </div>
  )
}

export default App
