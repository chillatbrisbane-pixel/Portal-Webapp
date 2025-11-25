import React, { useState } from 'react'
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
    status: 'pending',
    technologies: {
      network: false,
      security: false,
      cameras: false,
      av: false,
      lighting: false,
      controlSystem: false,
    },
    networkConfig: {
      vlan1: { name: 'Management', subnet: '192.168.1.0/24', gateway: '192.168.1.1' },
      vlan20: { name: 'Cameras', subnet: '10.0.20.0/24', gateway: '10.0.20.1' },
      vlan30: { name: 'Guest Network', subnet: '10.0.30.0/24', gateway: '10.0.30.1' },
    },
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleTechnologyChange = (tech: keyof typeof formData.technologies) => {
    setFormData(prev => ({
      ...prev,
      technologies: {
        ...prev.technologies,
        [tech]: !prev.technologies[tech],
      },
    }))
  }

  const handleNetworkChange = (vlan: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      networkConfig: {
        ...prev.networkConfig,
        [vlan]: {
          ...prev.networkConfig[vlan as keyof typeof prev.networkConfig],
          [field]: value,
        },
      },
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const project = await projectsAPI.create(formData as any)
      onProjectCreated(project)
    } catch (err: any) {
      setError(err.message || 'Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  const technologies = [
    { key: 'network', label: '🌐 Network Infrastructure', description: 'LAN/WAN setup' },
    { key: 'security', label: '🔐 Security & Access Control', description: 'Locks, badges, access' },
    { key: 'cameras', label: '📹 CCTV Surveillance', description: 'Cameras, recording' },
    { key: 'av', label: '🎬 Audio Visual', description: 'Displays, speakers' },
    { key: 'lighting', label: '💡 Lighting Control', description: 'Dimmers, scenes' },
    { key: 'controlSystem', label: '🎛️ Control System', description: 'Crestron, Control4' },
  ]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        {/* Header */}
        <div className="modal-header">
          <h2>🚀 Project Setup Wizard</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Step Indicator */}
        <div style={{ padding: '1rem 1.5rem', background: '#f3f4f6', display: 'flex', gap: '0.5rem' }}>
          {[1, 2, 3].map(s => (
            <div
              key={s}
              style={{
                flex: 1,
                height: '4px',
                background: s <= step ? '#0066cc' : '#e5e7eb',
                borderRadius: '2px',
                transition: 'all 0.3s',
              }}
            />
          ))}
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            {/* Step 1: Basic Information */}
            {step === 1 && (
              <div>
                <h3 style={{ color: '#333333', marginBottom: '1rem' }}>Basic Information</h3>

                <div className="form-group">
                  <label htmlFor="name">Project Name *</label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g., Downtown Office AV System"
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
                    placeholder="Project details and scope"
                    rows={3}
                    style={{ fontFamily: 'inherit', padding: '0.75rem' }}
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
                    placeholder="Client organization name"
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
                    placeholder="client@company.com"
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
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Technologies */}
            {step === 2 && (
              <div>
                <h3 style={{ color: '#333333', marginBottom: '1rem' }}>Select Technologies</h3>
                <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
                  Which services will this project include?
                </p>

                <div style={{ display: 'grid', gap: '1rem' }}>
                  {technologies.map(tech => (
                    <div
                      key={tech.key}
                      onClick={() => handleTechnologyChange(tech.key as any)}
                      style={{
                        padding: '1rem',
                        border: '2px solid #e5e7eb',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                        background: formData.technologies[tech.key as keyof typeof formData.technologies]
                          ? '#e0f2fe'
                          : 'white',
                        borderColor: formData.technologies[tech.key as keyof typeof formData.technologies]
                          ? '#0066cc'
                          : '#e5e7eb',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={formData.technologies[tech.key as keyof typeof formData.technologies]}
                        onChange={() => {}}
                        style={{ marginRight: '0.5rem', cursor: 'pointer' }}
                      />
                      <strong>{tech.label}</strong>
                      <p style={{ margin: '0.5rem 0 0 1.5rem', color: '#6b7280', fontSize: '0.9rem' }}>
                        {tech.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Network Configuration */}
            {step === 3 && (
              <div>
                <h3 style={{ color: '#333333', marginBottom: '1rem' }}>Network Configuration</h3>
                <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
                  Configure VLANs for different device types
                </p>

                {Object.entries(formData.networkConfig).map(([vlan, config]) => (
                  <div key={vlan} style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f9fafb', borderRadius: '6px' }}>
                    <h4 style={{ color: '#333333', margin: '0 0 1rem 0' }}>
                      {config.name}
                    </h4>

                    <div className="form-group">
                      <label>Subnet</label>
                      <input
                        type="text"
                        value={config.subnet}
                        onChange={(e) => handleNetworkChange(vlan, 'subnet', e.target.value)}
                        placeholder="192.168.1.0/24"
                      />
                    </div>

                    <div className="form-group">
                      <label>Gateway</label>
                      <input
                        type="text"
                        value={config.gateway}
                        onChange={(e) => handleNetworkChange(vlan, 'gateway', e.target.value)}
                        placeholder="192.168.1.1"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer">
            {step > 1 && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStep(step - 1)}
              >
                ← Back
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                className="btn btn-accent"
                onClick={() => {
                  if (step === 1 && !formData.name.trim()) {
                    setError('Project name is required')
                    return
                  }
                  setStep(step + 1)
                }}
              >
                Next →
              </button>
            ) : (
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !formData.name.trim()}
              >
                {loading ? '⏳ Creating...' : '✓ Create Project'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

export default SetupWizardModal
