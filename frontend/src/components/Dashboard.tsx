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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>📋 Projects</h2>
        {user.role !== 'technician' && (
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            ➕ New Project
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <p>Loading projects...</p>
      ) : projects.length === 0 ? (
        <p className="text-muted">No projects yet. Create one to get started!</p>
      ) : (
        <div className="grid">
          {projects.map(project => (
            <div key={project._id} className="card" style={{ cursor: 'pointer' }} onClick={() => setSelectedProject(project)}>
              <h3>{project.name}</h3>
              <p className="text-muted">{project.description}</p>
              <div style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                <p>
                  <strong>Client:</strong> {project.clientName || 'N/A'}
                </p>
                <p>
                  <strong>Status:</strong> {project.status}
                </p>
                <p>
                  <strong>Created:</strong> {new Date(project.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onProjectCreated={handleProjectCreated}
        />
      )}
    </div>
  )
}