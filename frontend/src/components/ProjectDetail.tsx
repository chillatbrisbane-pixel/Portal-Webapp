import { useState, useEffect } from 'react'
import { Project } from '../types'
import { projectsAPI } from '../services/apiService'
import { DeviceList } from './DeviceList'

interface ProjectDetailProps {
  project: Project
  onBack: () => void
  onProjectUpdated: (project: Project) => void
  onProjectDeleted: (projectId: string) => void
}

export const ProjectDetail: React.FC<ProjectDetailProps> = ({
  project,
  onBack,
  onProjectUpdated,
  onProjectDeleted,
}) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState(project)

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const updated = await projectsAPI.update(project._id, formData)
      onProjectUpdated(updated)
      setEditing(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this project?')) return

    setLoading(true)
    try {
      await projectsAPI.delete(project._id)
      onProjectDeleted(project._id)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <div style={{ marginBottom: '2rem' }}>
        <button className="btn btn-secondary" onClick={onBack}>
          ← Back to Projects
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '2rem' }}>
          <div>
            <h1>{formData.name}</h1>
            <p className="text-muted">{formData.description}</p>
          </div>
          {!editing && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
                ✏️ Edit
              </button>
              <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={loading}>
                🗑️ Delete
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <form onSubmit={handleUpdate} style={{ marginTop: '2rem' }}>
            <div className="form-group">
              <label>Project Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="form-group">
              <label>Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              >
                <option value="planning">Planning</option>
                <option value="in-progress">In Progress</option>
                <option value="on-hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <p className="text-muted">Status</p>
              <p style={{ fontWeight: 600 }}>{project.status}</p>
            </div>
            <div>
              <p className="text-muted">Client</p>
              <p style={{ fontWeight: 600 }}>{project.clientName || 'N/A'}</p>
            </div>
            <div>
              <p className="text-muted">Address</p>
              <p style={{ fontWeight: 600 }}>{project.address || 'N/A'}</p>
            </div>
            <div>
              <p className="text-muted">Created</p>
              <p style={{ fontWeight: 600 }}>{new Date(project.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: '2rem' }}>
        <DeviceList projectId={project._id} />
      </div>
    </div>
  )
}