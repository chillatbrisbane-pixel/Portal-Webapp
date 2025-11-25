import { useState } from 'react'
import { Project } from '../types'
import { projectsAPI } from '../services/apiService'

interface SetupWizardModalProps {
  onClose: () => void
  onProjectCreated: (project: Project) => void
}

export const SetupWizardModal: React.FC<SetupWizardModalProps> = ({ onClose, onProjectCreated }) => {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    clientName: '',
    clientEmail: '',
    address: '',
    technologies: {
      network: false,
      security: false,
      cameras: false,
      av: false,
      lighting: false,
      controlSystem: false,
    },
  })

  const handleTechToggle = (tech: keyof typeof formData.technologies) => {
    setFormData({
      ...formData,
      technologies: {
        ...formData.technologies,
        [tech]: !formData.technologies[tech],
      },
    })
  }

  const handleNext = () => {
    if (step === 1 && !formData.name) {
      setError('Project name is required')
      return
    }
    setError('')
    setStep(step + 1)
  }

  const handlePrevious = () => {
    setStep(step - 1)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const project = await projectsAPI.create(formData)
      onProjectCreated(project)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>✨ Project Setup Wizard</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {/* Progress Bar */}
        <div style={{ padding: '1rem 1.5rem', background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[1, 2].map(s => (
              <div key={s} style={{
                flex: 1,
                height: '4px',
                background: s <= step ? 'var(--primary-color)' : 'var(--gray-200)',
                borderRadius: '2px',
                transition: 'all 0.3s',
              }} />
            ))}
          </div>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: 'var(--gray-500)' }}>
            Step {step} of 2
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            {/* Step 1: Project Info */}
            {step === 1 && (
              <div>
                <h3>📋 Project Information</h3>

                <div className="form-group">
                  <label>Project Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., High-End Residential Install"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Project details..."
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label>Client Name</label>
                  <input
                    type="text"
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    placeholder="Enter client name"
                  />
                </div>

                <div className="form-group">
                  <label>Client Email</label>
                  <input
                    type="email"
                    value={formData.clientEmail}
                    onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                    placeholder="Enter client email"
                  />
                </div>

                <div className="form-group">
                  <label>Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Enter project address"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Technologies */}
            {step === 2 && (
              <div>
                <h3>🏗️ Select Technologies</h3>
                <p className="text-muted">Which systems will this project include?</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                  {[
                    { key: 'network', label: '🔗 Network', desc: 'Switches, routers, WiFi' },
                    { key: 'security', label: '🔒 Security', desc: 'Access control, alarms' },
                    { key: 'cameras', label: '📹 Cameras', desc: 'Security cameras, NVR' },
                    { key: 'av', label: '📺 AV', desc: 'TVs, displays, audio' },
                    { key: 'lighting', label: '💡 Lighting', desc: 'Smart lighting control' },
                    { key: 'controlSystem', label: '🎛️ Control System', desc: 'Automation controllers' },
                  ].map(tech => (
                    <label key={tech.key} style={{
                      padding: '1rem',
                      border: '2px solid var(--gray-200)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: formData.technologies[tech.key as any] ? 'var(--primary-color)' : 'white',
                      color: formData.technologies[tech.key as any] ? 'white' : 'black',
                      transition: 'all 0.3s',
                    }}>
                      <input
                        type="checkbox"
                        checked={formData.technologies[tech.key as any]}
                        onChange={() => handleTechToggle(tech.key as any)}
                        style={{ display: 'none' }}
                      />
                      <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600 }}>{tech.label}</p>
                      <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.9 }}>{tech.desc}</p>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            {step > 1 && (
              <button type="button" className="btn btn-secondary" onClick={handlePrevious}>
                ← Previous
              </button>
            )}
            {step < 2 ? (
              <button type="button" className="btn btn-primary" onClick={handleNext}>
                Next →
              </button>
            ) : (
              <button type="submit" className="btn btn-success" disabled={loading}>
                {loading ? '🔄 Creating...' : '✅ Create Project'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}