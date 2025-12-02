import { useState, useEffect } from 'react'
import { User, Project } from '../types'
import { projectsAPI } from '../services/apiService'
import { SetupWizardModal } from './SetupWizardModal'
import { ProjectDetail } from './ProjectDetail'

interface DashboardProps {
  user: User
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    loadProjects()
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

  const handleProjectCreated = (newProject: Project) => {
    setProjects([newProject, ...projects])
    setShowWizard(false)
  }

  const handleProjectDeleted = (projectId: string) => {
    setProjects(projects.filter(p => p._id !== projectId))
    setSelectedProject(null)
  }

  // Calculate statistics
  const totalProjects = projects.length
  const planningCount = projects.filter(p => p.status === 'planning').length
  const inProgressCount = projects.filter(p => p.status === 'in-progress').length
  const completedCount = projects.filter(p => p.status === 'completed').length

  // Filter projects based on search and status
  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.clientName?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (selectedProject) {
    return (
      <ProjectDetail
        project={selectedProject}
        onBack={() => setSelectedProject(null)}
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
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: '1.5rem', gap: '1rem' }}>
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
          {user.role !== 'technician' && (
            <button 
              className="btn btn-primary" 
              onClick={() => setShowWizard(true)}
              style={{ fontSize: '1rem' }}
            >
              🚀 New Project
            </button>
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
            onChange={(e) => setSearchQuery(e.target.value)}
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
          {user.role !== 'technician' && (
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
    </div>
  )
}
