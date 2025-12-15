import { useState, useEffect, useRef } from 'react'
import { User, Project } from '../types'
import { projectsAPI, reportsAPI, tasksAPI } from '../services/apiService'
import { SetupWizardModal } from './SetupWizardModal'
import { ProjectDetail } from './ProjectDetail'
import { LegacyImportModal } from './LegacyImportModal'

interface DashboardProps {
  user: User
}

interface WiFiNetwork {
  _id?: string
  name: string
  password: string
  vlan: number
  band: string
}

interface MyTask {
  _id: string
  title: string
  description?: string
  project: { _id: string; name: string }
  stage: string
  priority: 'low' | 'medium' | 'high'
  dueDate?: string
  completed: boolean
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Projects', color: '#6b7280' },
  { value: 'planning', label: 'Planning', color: '#f59e0b' },
  { value: 'in-progress', label: 'In Progress', color: '#3b82f6' },
  { value: 'completed', label: 'Completed', color: '#10b981' },
]

export const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showWizard, setShowWizard] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [initialTab, setInitialTab] = useState<'devices' | 'tasks' | null>(null)
  const [showTasksPanel, setShowTasksPanel] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('in-progress')
  const [sortBy, setSortBy] = useState<'alpha' | 'created' | 'modified'>('alpha')
  
  // My Tasks
  const [myTasks, setMyTasks] = useState<MyTask[]>([])
  const [loadingTasks, setLoadingTasks] = useState(true)
  
  // WiFi QR code modal
  const [qrProject, setQrProject] = useState<Project | null>(null)
  const [qrWifi, setQrWifi] = useState<WiFiNetwork | null>(null)
  
  // Import from JSON
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showLegacyImport, setShowLegacyImport] = useState(false)

  useEffect(() => {
    loadProjects()
    loadMyTasks()
  }, [])

  const loadProjects = async () => {
    try {
      setLoading(true)
      const data = await projectsAPI.getAll()
      setProjects(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadMyTasks = async () => {
    try {
      setLoadingTasks(true)
      const data = await tasksAPI.getMyTasks()
      setMyTasks(data)
    } catch (err: any) {
      console.error('Failed to load my tasks:', err)
    } finally {
      setLoadingTasks(false)
    }
  }

  const handleProjectCreated = (newProject: Project) => {
    setProjects([newProject, ...projects])
    setShowWizard(false)
    setSelectedProject(newProject) // Auto-open the newly created project
  }

  const handleProjectDeleted = (projectId: string) => {
    setProjects(projects.filter(p => p._id !== projectId))
    setSelectedProject(null)
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset file input so same file can be selected again
    e.target.value = ''

    try {
      setImporting(true)
      setError('')

      // Read file content
      const text = await file.text()
      const backupData = JSON.parse(text)

      // Validate structure
      if (!backupData.project || !backupData.devices) {
        throw new Error('Invalid backup file. Expected project and devices data.')
      }

      // Import
      const result = await reportsAPI.importJSON(backupData)
      
      // Reload projects to show the new one
      await loadProjects()
      
      alert(`✅ ${result.message}\n\nProject "${result.projectName}" has been created.`)

    } catch (err: any) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON file. Please select a valid backup file.')
      } else {
        setError(err.message || 'Failed to import project')
      }
    } finally {
      setImporting(false)
    }
  }

  // Calculate statistics
  const totalProjects = projects.length
  const planningCount = projects.filter(p => p.status === 'planning').length
  const inProgressCount = projects.filter(p => p.status === 'in-progress').length
  const completedCount = projects.filter(p => p.status === 'completed').length

  // Filter and sort projects
  const filteredProjects = projects.filter(project => {
    const query = searchQuery.toLowerCase()
    const matchesSearch = 
      project.name.toLowerCase().includes(query) ||
      project.description?.toLowerCase().includes(query) ||
      project.clientName?.toLowerCase().includes(query) ||
      project.clientEmail?.toLowerCase().includes(query) ||
      project.address?.toLowerCase().includes(query)
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter
    return matchesSearch && matchesStatus
  }).sort((a, b) => {
    switch (sortBy) {
      case 'alpha':
        return a.name.localeCompare(b.name, undefined, { numeric: true })
      case 'created':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case 'modified':
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      default:
        return 0
    }
  })

  if (selectedProject) {
    return (
      <ProjectDetail
        project={selectedProject}
        initialTab={initialTab}
        onBack={() => {
          setSelectedProject(null)
          setInitialTab(null)
          loadMyTasks() // Refresh tasks in case any were completed
        }}
        onProjectUpdated={(updated) => {
          setProjects(projects.map(p => p._id === updated._id ? updated : p))
          setSelectedProject(updated) // Also update the selected project!
        }}
        onProjectDeleted={handleProjectDeleted}
        onProjectCloned={(newProject) => {
          setProjects([newProject, ...projects])
          setSelectedProject(newProject)
        }}
        currentUser={user}
      />
    )
  }

  return (
    <div className="container" style={{ paddingTop: '2rem' }}>
      {/* Statistics Cards */}
      {totalProjects > 0 && (
        <div className="grid stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: '1.5rem', gap: '1rem' }}>
          <div 
            className="card" 
            style={{ background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', border: 'none', padding: '1rem', cursor: 'pointer' }}
            onClick={() => setStatusFilter('all')}
          >
            <p style={{ color: '#0369a1', margin: '0 0 0.25rem 0', fontSize: '0.8rem' }}>Total</p>
            <h3 style={{ color: '#0369a1', margin: 0, fontSize: '1.75rem' }}>{totalProjects}</h3>
          </div>

          <div 
            className="card" 
            style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', border: 'none', padding: '1rem', cursor: 'pointer' }}
            onClick={() => setStatusFilter('planning')}
          >
            <p style={{ color: '#92400e', margin: '0 0 0.25rem 0', fontSize: '0.8rem' }}>Planning</p>
            <h3 style={{ color: '#92400e', margin: 0, fontSize: '1.75rem' }}>{planningCount}</h3>
          </div>

          <div 
            className="card" 
            style={{ background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)', border: 'none', padding: '1rem', cursor: 'pointer' }}
            onClick={() => setStatusFilter('in-progress')}
          >
            <p style={{ color: '#1e40af', margin: '0 0 0.25rem 0', fontSize: '0.8rem' }}>In Progress</p>
            <h3 style={{ color: '#1e40af', margin: 0, fontSize: '1.75rem' }}>{inProgressCount}</h3>
          </div>

          <div 
            className="card" 
            style={{ background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)', border: 'none', padding: '1rem', cursor: 'pointer' }}
            onClick={() => setStatusFilter('completed')}
          >
            <p style={{ color: '#166534', margin: '0 0 0.25rem 0', fontSize: '0.8rem' }}>Completed</p>
            <h3 style={{ color: '#166534', margin: 0, fontSize: '1.75rem' }}>{completedCount}</h3>
          </div>

          {myTasks.length > 0 && (
            <div 
              className="card" 
              style={{ 
                background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)', 
                border: showTasksPanel ? '2px solid #dc2626' : 'none', 
                padding: '1rem', 
                cursor: 'pointer',
                position: 'relative',
              }}
              onClick={() => setShowTasksPanel(!showTasksPanel)}
            >
              <p style={{ color: '#991b1b', margin: '0 0 0.25rem 0', fontSize: '0.8rem' }}>📋 My Tasks</p>
              <h3 style={{ color: '#991b1b', margin: 0, fontSize: '1.75rem' }}>{myTasks.length}</h3>
              {myTasks.some(t => t.dueDate && new Date(t.dueDate) < new Date()) && (
                <span style={{ 
                  position: 'absolute', 
                  top: '0.5rem', 
                  right: '0.5rem', 
                  background: '#dc2626', 
                  color: 'white', 
                  borderRadius: '50%', 
                  width: '12px', 
                  height: '12px',
                  fontSize: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>!</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* My Tasks Panel - shown when clicking red Tasks button */}
      {showTasksPanel && myTasks.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', border: '2px solid #fecaca' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#991b1b' }}>📋 My Tasks</h3>
            <button 
              onClick={() => setShowTasksPanel(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#6b7280' }}
            >
              ✕
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
            {myTasks.map((task) => {
              const isOverdue = task.dueDate && new Date(task.dueDate) < new Date()
              const priorityColors: Record<string, { bg: string; color: string }> = {
                high: { bg: '#fee2e2', color: '#991b1b' },
                medium: { bg: '#fef3c7', color: '#92400e' },
                low: { bg: '#dcfce7', color: '#166534' },
              }
              const priority = priorityColors[task.priority] || priorityColors.medium
              
              return (
                <div
                  key={task._id}
                  onClick={() => {
                    const project = projects.find(p => p._id === task.project._id)
                    if (project) {
                      setInitialTab('tasks')
                      setSelectedProject(project)
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    background: '#f9fafb',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#f9fafb'}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: '0.9rem', color: '#111827', marginBottom: '0.25rem' }}>
                      {task.title}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                      {task.project.name}
                    </div>
                  </div>
                  {task.priority === 'high' && (
                    <span style={{ 
                      padding: '0.15rem 0.4rem', 
                      background: priority.bg, 
                      color: priority.color, 
                      borderRadius: '4px', 
                      fontSize: '0.7rem', 
                      fontWeight: 600 
                    }}>
                      HIGH
                    </span>
                  )}
                  {task.dueDate && (
                    <span style={{ 
                      fontSize: '0.8rem', 
                      color: isOverdue ? '#dc2626' : '#6b7280',
                      fontWeight: isOverdue ? 600 : 400,
                    }}>
                      📅 {new Date(task.dueDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                      {isOverdue && ' ⚠️'}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Page Header with View Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ fontSize: '2rem', color: '#333333', margin: 0 }}>EL Projects</h2>
        
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* View Toggle Buttons */}
          <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '6px', padding: '0.25rem' }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                background: viewMode === 'grid' ? 'white' : 'transparent',
                border: 'none',
                padding: '0.5rem 0.75rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
                color: viewMode === 'grid' ? '#333333' : '#6b7280',
                transition: 'all 0.3s',
              }}
              title="Grid view"
            >
              ⊞ Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                background: viewMode === 'list' ? 'white' : 'transparent',
                border: 'none',
                padding: '0.5rem 0.75rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
                color: viewMode === 'list' ? '#333333' : '#6b7280',
                transition: 'all 0.3s',
              }}
              title="List view"
            >
              ☰ List
            </button>
          </div>

          {/* New Project Button */}
          {user.role !== 'viewer' && user.role !== 'sales' && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                className="btn btn-primary" 
                onClick={() => setShowWizard(true)}
                style={{ fontSize: '1rem' }}
              >
                🚀 New Project
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={handleImportClick}
                disabled={importing}
                style={{ fontSize: '1rem' }}
                title="Import project from JSON backup"
              >
                {importing ? '⏳ Importing...' : '📥 Import'}
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowLegacyImport(true)}
                style={{ fontSize: '1rem' }}
                title="Import from legacy text file"
              >
                📄 Legacy Import
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportFile}
                style={{ display: 'none' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Search Bar and Filters */}
      {projects.length > 0 && (
        <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="🔍 Search projects..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              // Auto-switch to "All" when user starts typing
              if (e.target.value && statusFilter !== 'all') {
                setStatusFilter('all')
              }
            }}
            style={{
              flex: '1',
              minWidth: '200px',
              maxWidth: '400px',
              padding: '0.75rem',
              border: '2px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '1rem',
              transition: 'border-color 0.3s',
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = '#0066cc'}
            onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
          />
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '0.75rem 1rem',
              border: '2px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '1rem',
              background: 'white',
              cursor: 'pointer',
            }}
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'alpha' | 'created' | 'modified')}
            style={{
              padding: '0.75rem 1rem',
              border: '2px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '1rem',
              background: 'white',
              cursor: 'pointer',
            }}
          >
            <option value="alpha">🔤 A-Z</option>
            <option value="created">📅 Newest</option>
            <option value="modified">🔄 Recently Modified</option>
          </select>
          
          {(searchQuery || statusFilter !== 'all') && (
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter('all') }}
              style={{
                padding: '0.75rem 1rem',
                border: 'none',
                background: '#f3f4f6',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              ✕ Clear Filters
            </button>
          )}
          
          {(searchQuery || statusFilter !== 'all') && (
            <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>
              Found {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
          <p>Loading projects...</p>
        </div>
      ) : projects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#6b7280' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>No projects yet</p>
          {user.role !== 'viewer' && user.role !== 'sales' && (
            <button 
              className="btn btn-primary"
              onClick={() => setShowWizard(true)}
            >
              🚀 Create Your First Project
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        // Grid View
        <div className="grid">
          {filteredProjects.map(project => {
            const statusColors: Record<string, { bg: string; text: string }> = {
              'planning': { bg: '#fef3c7', text: '#92400e' },
              'in-progress': { bg: '#dbeafe', text: '#1e40af' },
              'completed': { bg: '#dcfce7', text: '#166534' },
            }
            const colors = statusColors[project.status] || statusColors['planning']
            
            return (
              <div
                key={project._id}
                className="card"
                onClick={() => setSelectedProject(project)}
                style={{ cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                  <h3 style={{ marginBottom: 0, flex: 1 }}>{project.name}</h3>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    display: 'inline-block',
                    background: colors.bg,
                    color: colors.text,
                    whiteSpace: 'nowrap',
                    marginLeft: '0.5rem',
                    textTransform: 'capitalize',
                  }}>
                    {project.status.replace('-', ' ')}
                  </span>
                </div>
                
                {project.description && (
                  <p className="text-muted" style={{ marginBottom: '1rem', lineHeight: 1.5 }}>
                    {project.description}
                  </p>
                )}
                
                <div style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
                  {project.clientName && (
                    <p style={{ margin: '0.5rem 0' }}>
                      <strong>Client:</strong> {project.clientName}
                    </p>
                  )}
                  <p style={{ margin: '0.5rem 0', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <span><strong>Created:</strong> {new Date(project.createdAt).toLocaleDateString()}</span>
                    <span><strong>Modified:</strong> {new Date(project.updatedAt).toLocaleDateString()}</span>
                  </p>
                  
                  {/* WiFi QR Button */}
                  {project.wifiNetworks && project.wifiNetworks.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setQrProject(project)
                      }}
                      style={{
                        marginTop: '0.5rem',
                        padding: '0.35rem 0.75rem',
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                      title="Show WiFi QR codes"
                    >
                      📶 WiFi ({project.wifiNetworks.length})
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        // List View
        <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
          {filteredProjects.map((project, index) => {
            const statusColors: Record<string, { bg: string; text: string }> = {
              'planning': { bg: '#fef3c7', text: '#92400e' },
              'in-progress': { bg: '#dbeafe', text: '#1e40af' },
              'completed': { bg: '#dcfce7', text: '#166534' },
            }
            const colors = statusColors[project.status] || statusColors['planning']
            
            return (
              <div
                key={project._id}
                onClick={() => setSelectedProject(project)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1.5rem',
                  borderBottom: index < filteredProjects.length - 1 ? '1px solid #e5e7eb' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  background: 'white',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
              >
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#333333' }}>{project.name}</h4>
                  <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
                    {project.clientName || 'No client'} • Created: {new Date(project.createdAt).toLocaleDateString()} • Modified: {new Date(project.updatedAt).toLocaleDateString()}
                  </p>
                </div>

                {project.description && (
                  <p style={{ margin: '0 1rem', color: '#6b7280', fontSize: '0.9rem', maxWidth: '400px' }}>
                    {project.description.substring(0, 50)}...
                  </p>
                )}

                {/* WiFi QR Button in list view */}
                {project.wifiNetworks && project.wifiNetworks.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setQrProject(project)
                    }}
                    style={{
                      padding: '0.35rem 0.75rem',
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      marginRight: '1rem',
                    }}
                    title="Show WiFi QR codes"
                  >
                    📶
                  </button>
                )}

                <span style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  background: colors.bg,
                  color: colors.text,
                  whiteSpace: 'nowrap',
                  textTransform: 'capitalize',
                }}>
                  {project.status.replace('-', ' ')}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Setup Wizard Modal */}
      {showWizard && (
        <SetupWizardModal
          onClose={() => setShowWizard(false)}
          onProjectCreated={handleProjectCreated}
        />
      )}

      {/* Legacy Import Modal */}
      {showLegacyImport && (
        <LegacyImportModal
          onClose={() => setShowLegacyImport(false)}
          onSuccess={() => {
            loadProjects()
            alert('✅ Project imported successfully!')
          }}
        />
      )}

      {/* WiFi Networks Modal */}
      {qrProject && (
        <div className="modal-overlay" onClick={() => { setQrProject(null); setQrWifi(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>📶 WiFi Networks - {qrProject.name}</h3>
              <button className="close-btn" onClick={() => { setQrProject(null); setQrWifi(null); }}>✕</button>
            </div>
            <div className="modal-body">
              {qrWifi ? (
                // Show QR code for selected network
                <div style={{ textAlign: 'center', padding: '1rem' }}>
                  <button
                    onClick={() => setQrWifi(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      marginBottom: '1rem',
                      color: '#3b82f6',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    ← Back to networks
                  </button>
                  
                  <p style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '1rem' }}>{qrWifi.name}</p>
                  
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`WIFI:T:WPA;S:${qrWifi.name};P:${qrWifi.password};;`)}`}
                    alt="WiFi QR Code"
                    style={{ 
                      border: '1px solid #e5e7eb', 
                      borderRadius: '8px',
                      padding: '1rem',
                      background: 'white',
                    }}
                  />
                  
                  <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#6b7280' }}>
                    Scan with your phone camera to connect
                  </p>
                  
                  <div style={{ 
                    marginTop: '1rem', 
                    padding: '0.75rem', 
                    background: '#f3f4f6', 
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    textAlign: 'left',
                  }}>
                    <strong>Network:</strong> {qrWifi.name}<br />
                    <strong>Password:</strong> {qrWifi.password}<br />
                    <strong>Security:</strong> WPA/WPA2
                  </div>
                </div>
              ) : (
                // Show list of networks
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {qrProject.wifiNetworks?.map((wifi, index) => (
                    <div 
                      key={index}
                      style={{
                        padding: '1rem',
                        background: '#f9fafb',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <strong>{wifi.name}</strong>
                        <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.25rem' }}>
                          Password: <code style={{ background: '#e5e7eb', padding: '0.1rem 0.4rem', borderRadius: '3px' }}>{wifi.password}</code>
                          <span style={{ marginLeft: '0.5rem' }}>VLAN {wifi.vlan}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setQrWifi(wifi)}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        📱 QR Code
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setQrProject(null); setQrWifi(null); }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
