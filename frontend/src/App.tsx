import { useState, useEffect, useCallback } from 'react'
import { LoginScreen } from './components/LoginScreen'
import { Dashboard } from './components/Dashboard'
import { Schedule } from './components/Schedule'
import { Header } from './components/Header'
import { UserManagementModal } from './components/UserManagementModal'
import { UserSettingsModal } from './components/UserSettingsModal'
import { AcceptInvite } from './components/AcceptInvite'
import { ResetPassword } from './components/ResetPassword'
import { authAPI } from './services/apiService'
import { User } from './types'
import './App.css'

// Session timeout constants (2 hours)
const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000 // 2 hours in milliseconds
const WARNING_BEFORE_MS = 5 * 60 * 1000 // Show warning 5 minutes before logout

// Key for storing 2FA prompt dismissal
const TWO_FA_PROMPT_KEY = 'twoFactorPromptDismissed'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [showUserManagement, setShowUserManagement] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [resetToken, setResetToken] = useState<string | null>(null)
  const [sessionWarning, setSessionWarning] = useState(false)
  const [sessionTimeLeft, setSessionTimeLeft] = useState<number | null>(null)
  const [show2FAPrompt, setShow2FAPrompt] = useState(false)
  const [currentView, setCurrentView] = useState<'projects' | 'schedule'>('projects')

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

    if (token && window.location.pathname.includes('reset-password')) {
      setResetToken(token)
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
    
    // Check if 2FA prompt should be shown
    if (!userData.twoFactorEnabled) {
      const dismissed = localStorage.getItem(TWO_FA_PROMPT_KEY)
      const dismissedTime = dismissed ? parseInt(dismissed, 10) : 0
      const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
      
      // Show prompt if never dismissed or dismissed more than a week ago
      if (!dismissed || dismissedTime < oneWeekAgo) {
        setShow2FAPrompt(true)
      }
    }
  }

  const handleLogout = () => {
    authAPI.logout()
    clearLoginTime()
    setUser(null)
    setSessionWarning(false)
    setSessionTimeLeft(null)
  }

  // Extend session (refresh token on server)
  const extendSession = async () => {
    try {
      await authAPI.refreshToken()
      setLoginTime() // Reset the client-side timer
      setSessionWarning(false)
      setSessionTimeLeft(null)
    } catch (err) {
      console.error('Failed to refresh session:', err)
      // If refresh fails, log out
      handleLogout()
    }
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

  const handleCancelReset = () => {
    setResetToken(null)
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

  // Show reset password page if token is present (admin-generated link)
  if (resetToken) {
    return (
      <ResetPassword
        token={resetToken}
        onSuccess={handleCancelReset}
        onBack={handleCancelReset}
      />
    )
  }

  if (!user) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />
  }

  return (
    <div className="app">
      {/* 2FA Prompt Modal */}
      {show2FAPrompt && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10001,
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '450px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔐</div>
              <h2 style={{ margin: '0 0 0.5rem', color: '#333' }}>Secure Your Account</h2>
              <p style={{ color: '#666', margin: 0 }}>
                Two-factor authentication adds an extra layer of security to your account.
              </p>
            </div>
            
            <div style={{
              background: '#fef3c7',
              border: '1px solid #fcd34d',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem',
            }}>
              <p style={{ margin: 0, color: '#92400e', fontSize: '0.9rem' }}>
                <strong>⚠️ Your account does not have 2FA enabled.</strong><br />
                We strongly recommend enabling two-factor authentication to protect your account from unauthorized access.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => {
                  setShow2FAPrompt(false)
                  setShowSettings(true)
                }}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                🔐 Enable 2FA Now
              </button>
              <button
                onClick={() => {
                  localStorage.setItem(TWO_FA_PROMPT_KEY, Date.now().toString())
                  setShow2FAPrompt(false)
                }}
                style={{
                  padding: '0.75rem 1rem',
                  background: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Remind Later
              </button>
            </div>
            
            <p style={{ 
              margin: '1rem 0 0', 
              fontSize: '0.8rem', 
              color: '#9ca3af',
              textAlign: 'center',
            }}>
              You can enable 2FA anytime in Settings → Two-Factor Auth
            </p>
          </div>
        </div>
      )}

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
        currentView={currentView}
        onNavigate={setCurrentView}
      />
      <main className="app-main" style={{ marginTop: sessionWarning ? '50px' : 0 }}>
        {currentView === 'projects' ? (
          <Dashboard user={user} />
        ) : (
          <Schedule user={user} />
        )}
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
