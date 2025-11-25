import { useState, useEffect } from 'react'
import { User, Project } from '../types'
import { projectsAPI } from '../services/apiService'
import { SetupWizardModal } from './SetupWizardModal'
import { ProjectDetail } from './ProjectDetail'

interface DashboardProps {
  user: User
}

export const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showWizard, setShowWizard] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

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
  const inProgressCount = projects.filter(p => p.status === 'in progress').length
  const completedCount = projects.filter(p => p.status === 'completed').length

  if (selectedProject) {
    return (
      <ProjectDetail
        project={selectedProject}
        onBack={() => setSelectedProject(null)}
        onProjectUpdated={(updated) => {
          setProjects(projects.map(p => p._id === updated._id ? updated : p))
        }}
        onProjectDeleted={handleProjectDeleted}
      />
    )
  }

  return (
    <div className="container" style={{ paddingTop: '2rem' }}>
      {/* Statistics Cards */}
      {totalProjects > 0 && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', marginBottom: '2rem' }}>
          <div className="card" style={{ background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', border: 'none' }}>
            <p style={{ color: '#0369a1', margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Total Projects</p>
            <h3 style={{ color: '#0369a1', margin: 0, fontSize: '2.5rem' }}>{totalProjects}</h3>
          </div>

          <div className="card" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', border: 'none' }}>
            <p style={{ color: '#92400e', margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>In Progress</p>
            <h3 style={{ color: '#92400e', margin: 0, fontSize: '2.5rem' }}>{inProgressCount}</h3>
          </div>

          <div className="card" style={{ background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)', border: 'none' }}>
            <p style={{ color: '#166534', margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Completed</p>
            <h3 style={{ color: '#166534', margin: 0, fontSize: '2.5rem' }}>{completedCount}</h3>
          </div>
        </div>
      )}

      {/* Page Header with View Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ fontSize: '2rem', color: '#333333', margin: 0 }}>My Projects</h2>
        
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
          {projects.map(project => (
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
                  background: project.status === 'completed' ? '#dcfce7' : '#fef3c7',
                  color: project.status === 'completed' ? '#166534' : '#92400e',
                  whiteSpace: 'nowrap',
                  marginLeft: '0.5rem',
                }}>
                  {project.status}
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
                <p style={{ margin: '0.5rem 0' }}>
                  <strong>Created:</strong> {new Date(project.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // List View
        <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
          {projects.map((project, index) => (
            <div
              key={project._id}
              onClick={() => setSelectedProject(project)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1.5rem',
                borderBottom: index < projects.length - 1 ? '1px solid #e5e7eb' : 'none',
                cursor: 'pointer',
                transition: 'all 0.3s',
                background: 'white',
                ':hover': { background: '#f9fafb' },
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
            >
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#333333' }}>{project.name}</h4>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
                  {project.clientName || 'No client'} • {new Date(project.createdAt).toLocaleDateString()}
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
                background: project.status === 'completed' ? '#dcfce7' : '#fef3c7',
                color: project.status === 'completed' ? '#166534' : '#92400e',
                whiteSpace: 'nowrap',
              }}>
                {project.status}
              </span>
            </div>
          ))}
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