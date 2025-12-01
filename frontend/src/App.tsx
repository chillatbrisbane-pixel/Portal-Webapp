import { useState, useEffect } from 'react'
import { LoginScreen } from './components/LoginScreen'
import { Dashboard } from './components/Dashboard'
import { Header } from './components/Header'
import { UserManagementModal } from './components/UserManagementModal'
import { UserSettingsModal } from './components/UserSettingsModal'
import { authAPI } from './services/apiService'
import { User } from './types'
import './App.css'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [showUserManagement, setShowUserManagement] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
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

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Loading...</p>
      </div>
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
