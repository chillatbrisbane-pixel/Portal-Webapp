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
    clientPhone: '',
    address: '',
    status: 'in-progress',
    technologies: {
      network: false,
      security: false,
      cameras: false,
      av: false,
      lighting: false,
      controlSystem: false,
    },
    networkConfig: {
      vlan1: { name: 'Management', subnet: '192.168.210.0/24', gateway: '192.168.210.1' },
      vlan20: { name: 'Cameras', subnet: '192.168.220.0/24', gateway: '192.168.220.1' },
      vlan30: { name: 'Guest Network', subnet: '192.168.230.0/24', gateway: '192.168.230.1' },
    },
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleTechToggle = (tech: keyof typeof formData.technologies) => {
    setFormData(prev => ({
      ...prev,
      technologies: {
        ...prev.technologies,
        [tech]: !prev.technologies[tech],
      },
    }))
  }

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault()
    if (step === 1 && !formData.name.trim()) {
      setError('Project name is required')
      return
    }
    setError('')
    setStep(step + 1)
  }

  const handlePrevious = (e: React.MouseEvent) => {
    e.preventDefault()
    setError('')
    setStep(step - 1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const project = await projectsAPI.create(formData as any)
      onProjectCreated(project)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        {/* Header */}
        <div className="modal-header">
          <h2>🚀 Project Setup Wizard</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Progress Bar */}
        <div style={{ padding: '1rem 1.5rem', background: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {[1, 2].map(s => (
              <div key={s} style={{
                flex: 1,
                height: '4px',
                background: s <= step ? '#0066cc' : '#e5e7eb',
                borderRadius: '2px',
              }} />
            ))}
          </div>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#6b7280' }}>
            Step {step} of 2
          </p>
        </div>

        {/* Body */}
        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          {/* Step 1: Basic Info */}
          {step === 1 && (
            <>
              <h3 style={{ color: '#333333' }}>📋 Project Information</h3>

              <div className="form-group">
                <label htmlFor="name">Project Name *</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g., High-End Residential Install"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Project details..."
                  rows={3}
                  style={{ fontFamily: 'inherit' }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="clientName">Client Name</label>
                <input
                  id="clientName"
                  name="clientName"
                  type="text"
                  value={formData.clientName}
                  onChange={handleInputChange}
                  placeholder="Enter client name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="clientEmail">Client Email</label>
                <input
                  id="clientEmail"
                  name="clientEmail"
                  type="email"
                  value={formData.clientEmail}
                  onChange={handleInputChange}
                  placeholder="Enter client email"
                />
              </div>

              <div className="form-group">
                <label htmlFor="clientPhone">Client Phone</label>
                <input
                  id="clientPhone"
                  name="clientPhone"
                  type="tel"
                  value={formData.clientPhone}
                  onChange={handleInputChange}
                  placeholder="Enter client phone"
                />
              </div>

              <div className="form-group">
                <label htmlFor="address">Address</label>
                <input
                  id="address"
                  name="address"
                  type="text"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="Enter project address"
                />
              </div>
            </>
          )}

          {/* Step 2: Technologies */}
          {step === 2 && (
            <>
              <h3 style={{ color: '#333333' }}>🏗️ Select Technologies</h3>
              <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>Which systems will this project include?</p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                {[
                  { key: 'network', label: '🔗 Network', desc: 'Switches, routers, WiFi' },
                  { key: 'security', label: '🔒 Security', desc: 'Access control, alarms' },
                  { key: 'cameras', label: '📹 Cameras', desc: 'Security cameras, NVR' },
                  { key: 'av', label: '📺 AV', desc: 'TVs, displays, audio' },
                  { key: 'lighting', label: '💡 Lighting', desc: 'Smart lighting control' },
                  { key: 'controlSystem', label: '🎛️ Control System', desc: 'Automation controllers' },
                ].map(tech => (
                  <label
                    key={tech.key}
                    style={{
                      padding: '1rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: formData.technologies[tech.key as any] ? '#0066cc' : 'white',
                      color: formData.technologies[tech.key as any] ? 'white' : 'black',
                      transition: 'all 0.3s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formData.technologies[tech.key as any]}
                      onChange={() => handleTechToggle(tech.key as any)}
                      style={{ marginRight: '0.5rem' }}
                    />
                    <div>
                      <p style={{ margin: 0, fontWeight: 600 }}>{tech.label}</p>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', opacity: 0.8 }}>{tech.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
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
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? '⏳ Creating...' : '✅ Create Project'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default SetupWizardModal
