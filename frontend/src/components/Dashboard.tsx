import { useState, useEffect } from 'react'
import { User, Project } from '../types'
import { projectsAPI } from '../services/apiService'
import { CreateProjectModal } from './CreateProjectModal'
import { ProjectDetail } from './ProjectDetail'

interface DashboardProps {
  user: User
}

export const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

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
    setShowCreateModal(false)
  }

  const handleProjectDeleted = (projectId: string) => {
    setProjects(projects.filter(p => p._id !== projectId))
    setSelectedProject(null)
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'status-active'
      case 'pending':
        return 'status-pending'
      case 'completed':
        return 'status-completed'
      case 'on hold':
        return 'status-on-hold'
      default:
        return 'status-pending'
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

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
    <div className="container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2>📋 Projects</h2>
          <p style={{ color: '#6b7280', margin: '0.5rem 0 0 0' }}>
            Manage and track your AV installation projects
          </p>
        </div>
        <div className="page-header-actions">
          {user.role !== 'technician' && (
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              ➕ New Project
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <span>Loading projects...</span>
        </div>
      ) : projects.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <h3>No Projects Yet</h3>
            <p className="text-muted">
              Create your first project to get started with managing AV installations
            </p>
            {user.role !== 'technician' && (
              <button className="btn btn-accent" onClick={() => setShowCreateModal(true)}>
                ➕ Create Your First Project
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid">
          {projects.map(project => (
            <div
              key={project._id}
              className="card"
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedProject(project)}
            >
              {/* Card Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.25rem 0' }}>{project.name}</h3>
                  <p className="text-muted" style={{ margin: 0 }}>
                    {project.clientName || 'No Client'}
                  </p>
                </div>
                <span className={`status-badge ${getStatusColor(project.status)}`}>
                  {project.status}
                </span>
              </div>

              {/* Card Description */}
              {project.description && (
                <p className="text-muted" style={{ marginBottom: '1rem', lineHeight: 1.5 }}>
                  {project.description}
                </p>
              )}

              {/* Card Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                <div>
                  <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: 0 }}>Created</p>
                  <p style={{ fontWeight: 600, color: '#333333', margin: '0.25rem 0 0 0' }}>
                    {formatDate(project.createdAt)}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: 0 }}>Devices</p>
                  <p style={{ fontWeight: 600, color: '#333333', margin: '0.25rem 0 0 0' }}>
                    {project.devices?.length || 0} devices
                  </p>
                </div>
              </div>

              {/* Card Footer Action */}
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                <p style={{ fontSize: '0.85rem', color: '#0066cc', margin: 0, fontWeight: 600 }}>
                  Click to view details →
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onProjectCreated={handleProjectCreated}
        />
      )}
    </div>
  )
}