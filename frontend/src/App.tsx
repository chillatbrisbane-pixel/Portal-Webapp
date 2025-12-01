import { useState, useEffect } from 'react'
import { LoginScreen } from './components/LoginScreen'
import { Dashboard } from './components/Dashboard'
import { Header } from './components/Header'
import { UserManagementModal } from './components/UserManagementModal'
import { UserSettingsModal } from './components/UserSettingsModal'
import { AcceptInvite } from './components/AcceptInvite'
import { authAPI } from './services/apiService'
import { User } from './types'
import './App.css'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [showUserManagement, setShowUserManagement] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [inviteToken, setInviteToken] = useState<string | null>(null)

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
      } catch (err) {
        // Not logged in, that's fine
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  const handleLoginSuccess = (userData: User) => {
    setUser(userData)
    // Clear invite token and URL params
    setInviteToken(null)
    window.history.replaceState({}, document.title, '/')
  }

  const handleLogout = () => {
    authAPI.logout()
    setUser(null)
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
      <Header 
        user={user} 
        onLogout={handleLogout}
        onShowUsers={() => setShowUserManagement(true)}
        onShowSettings={() => setShowSettings(true)}
      />
      <main className="app-main">
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
