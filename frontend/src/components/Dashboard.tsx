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
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '2rem', color: '#333333', margin: 0 }}>My Projects</h2>
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
      ) : (
        <div className="grid">
          {projects.map(project => (
            <div
              key={project._id}
              className="card"
              onClick={() => setSelectedProject(project)}
              style={{ cursor: 'pointer' }}
            >
              <h3 style={{ marginBottom: '0.5rem' }}>{project.name}</h3>
              {project.description && (
                <p className="text-muted" style={{ marginBottom: '1rem' }}>
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
                  <strong>Status:</strong> 
                  <span style={{
                    marginLeft: '0.5rem',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '12px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    display: 'inline-block',
                    background: project.status === 'completed' ? '#dcfce7' : '#fef3c7',
                    color: project.status === 'completed' ? '#166534' : '#92400e',
                  }}>
                    {project.status}
                  </span>
                </p>
                <p style={{ margin: '0.5rem 0' }}>
                  <strong>Created:</strong> {new Date(project.createdAt).toLocaleDateString()}
                </p>
              </div>
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