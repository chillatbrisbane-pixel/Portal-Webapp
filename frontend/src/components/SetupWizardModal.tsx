import { useState } from 'react'
import { Project, BRAND_OPTIONS } from '../types'
import { projectsAPI, devicesAPI } from '../services/apiService'

interface SetupWizardModalProps {
  onClose: () => void
  onProjectCreated: (project: Project) => void
}

interface TechConfig {
  key: string
  label: string
  icon: string
  deviceType: string
  defaultBrands: string[]
  defaultVlan: number
}

const TECH_CONFIGS: TechConfig[] = [
  { key: 'network', label: 'Network Switches', icon: '🔀', deviceType: 'switch', defaultBrands: ['Ubiquiti', 'Araknis', 'Netgear'], defaultVlan: 1 },
  { key: 'accessPoints', label: 'Wireless Access Points', icon: '📡', deviceType: 'access-point', defaultBrands: ['Ubiquiti', 'Araknis', 'Ruckus'], defaultVlan: 1 },
  { key: 'cameras', label: 'Security Cameras', icon: '📹', deviceType: 'camera', defaultBrands: ['Dahua', 'Hikvision', 'Luma'], defaultVlan: 20 },
  { key: 'nvr', label: 'NVR', icon: '💾', deviceType: 'nvr', defaultBrands: ['Dahua', 'Hikvision', 'Luma'], defaultVlan: 20 },
  { key: 'security', label: 'Security Panel', icon: '🔒', deviceType: 'alarm-panel', defaultBrands: ['Inner Range (Inception)', 'Paradox', 'Bosch'], defaultVlan: 1 },
  { key: 'controlSystem', label: 'Control System', icon: '🎛️', deviceType: 'control-processor', defaultBrands: ['Control4', 'Crestron Home', 'RTI'], defaultVlan: 1 },
  { key: 'touchPanels', label: 'Touch Panels', icon: '📱', deviceType: 'touch-panel', defaultBrands: ['Control4', 'Crestron Home', 'RTI'], defaultVlan: 1 },
  { key: 'lighting', label: 'Lighting Gateway', icon: '💡', deviceType: 'lighting-gateway', defaultBrands: ['C-Bus', 'Lutron', 'Dynalite', 'Crestron', 'Control4'], defaultVlan: 1 },
  { key: 'av', label: 'AV Receivers', icon: '🔊', deviceType: 'receiver', defaultBrands: ['Denon', 'Marantz', 'Yamaha', 'Anthem', 'Integra', 'Trinnov'], defaultVlan: 1 },
  { key: 'multiroom', label: 'Multiroom Audio', icon: '🎵', deviceType: 'audio-matrix', defaultBrands: ['Sonance', 'Sonos', 'Control4', 'Crestron', 'Anthem', 'Episode', 'Triad'], defaultVlan: 1 },
  { key: 'videodist', label: 'Video Distribution', icon: '🖥️', deviceType: 'video-matrix', defaultBrands: ['Crestron', 'Atlona', 'Just Add Power', 'Binary'], defaultVlan: 1 },
  { key: 'tvs', label: 'TVs/Displays', icon: '📺', deviceType: 'tv', defaultBrands: ['Samsung', 'LG', 'Sony'], defaultVlan: 1 },
  { key: 'power', label: 'Power / PDU', icon: '🔌', deviceType: 'pdu', defaultBrands: ['Wattbox', 'APC', 'CyberPower', 'Panamax'], defaultVlan: 1 },
]

// Device name mappings for proper singular names
const DEVICE_SINGULAR_NAMES: Record<string, string> = {
  'switch': 'Switch',
  'access-point': 'WAP',
  'camera': 'Camera',
  'nvr': 'NVR',
  'alarm-panel': 'Alarm Panel',
  'control-processor': 'Processor',
  'touch-panel': 'Touch Panel',
  'lighting-gateway': 'Lighting Gateway',
  'receiver': 'Receiver',
  'audio-matrix': 'Audio Matrix',
  'video-matrix': 'Video Matrix',
  'tv': 'TV',
  'pdu': 'PDU',
  'ups': 'UPS',
  'cloudkey': 'Cloudkey',
}

interface DeviceSetup {
  techKey: string
  quantity: number
  brand: string
  model: string
}

export const SetupWizardModal: React.FC<SetupWizardModalProps> = ({ onClose, onProjectCreated }) => {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Step 1: Project Info
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    address: '',
    status: 'in-progress',
  })

  // Step 2: Technologies selection
  const [selectedTechs, setSelectedTechs] = useState<string[]>([])

  // Step 3+: Device configurations for each selected tech
  const [deviceSetups, setDeviceSetups] = useState<Record<string, DeviceSetup>>({})
  
  // Current tech being configured (for step 3+)
  const [currentTechIndex, setCurrentTechIndex] = useState(0)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleTechToggle = (techKey: string) => {
    setSelectedTechs(prev => {
      if (prev.includes(techKey)) {
        // Remove
        const newSetups = { ...deviceSetups }
        delete newSetups[techKey]
        setDeviceSetups(newSetups)
        return prev.filter(t => t !== techKey)
      } else {
        // Add with defaults
        const techConfig = TECH_CONFIGS.find(t => t.key === techKey)
        if (techConfig) {
          setDeviceSetups(prev => ({
            ...prev,
            [techKey]: {
              techKey,
              quantity: techKey === 'cameras' ? 4 : 1,
              brand: techConfig.defaultBrands[0],
              model: '',
            }
          }))
        }
        return [...prev, techKey]
      }
    })
  }

  const handleDeviceSetupChange = (techKey: string, field: string, value: any) => {
    setDeviceSetups(prev => {
      const updated = {
        ...prev,
        [techKey]: {
          ...prev[techKey],
          [field]: value,
        }
      }
      
      // Sync touch panel brand when control system brand changes
      if (techKey === 'controlSystem' && field === 'brand' && selectedTechs.includes('touchPanels')) {
        updated.touchPanels = {
          ...prev.touchPanels,
          brand: value,
        }
      }
      
      return updated
    })
  }

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault()
    
    if (step === 1 && !formData.name.trim()) {
      setError('Project name is required')
      return
    }
    
    setError('')
    
    if (step === 2 && selectedTechs.length > 0) {
      // Moving to tech config steps
      setCurrentTechIndex(0)
    }
    
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
      // Create the project
      const project = await projectsAPI.create({
        ...formData,
        technologies: {
          network: selectedTechs.includes('network') || selectedTechs.includes('accessPoints'),
          security: selectedTechs.includes('security'),
          cameras: selectedTechs.includes('cameras') || selectedTechs.includes('nvr'),
          av: selectedTechs.includes('av') || selectedTechs.includes('tvs'),
          lighting: selectedTechs.includes('lighting'),
          controlSystem: selectedTechs.includes('controlSystem') || selectedTechs.includes('touchPanels'),
        }
      } as any)

      // Create devices for each selected technology
      for (const techKey of selectedTechs) {
        const setup = deviceSetups[techKey]
        const techConfig = TECH_CONFIGS.find(t => t.key === techKey)
        
        if (setup && techConfig && setup.quantity > 0) {
          const devices = []
          const baseName = DEVICE_SINGULAR_NAMES[techConfig.deviceType] || techConfig.label
          for (let i = 0; i < setup.quantity; i++) {
            devices.push({
              name: `${baseName}${setup.quantity > 1 ? ` ${i + 1}` : ''}`,
              category: getCategoryFromDeviceType(techConfig.deviceType),
              deviceType: techConfig.deviceType,
              manufacturer: setup.brand,
              model: setup.model,
              vlan: techConfig.defaultVlan,
              autoAssignIP: true,
              status: 'not-installed',
            })
          }
          
          if (devices.length > 0) {
            await devicesAPI.bulkCreate(project._id, devices)
          }
        }
      }

      onProjectCreated(project)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  const getCategoryFromDeviceType = (deviceType: string): string => {
    const mapping: Record<string, string> = {
      'switch': 'network',
      'router': 'network',
      'access-point': 'network',
      'camera': 'camera',
      'nvr': 'camera',
      'alarm-panel': 'security',
      'control-processor': 'control-system',
      'touch-panel': 'control-system',
      'lighting-gateway': 'lighting',
      'receiver': 'av',
      'tv': 'av',
    }
    return mapping[deviceType] || 'other'
  }

  // Calculate total steps: 1 (info) + 1 (tech select) + selected techs count + 1 (review)
  const totalSteps = 2 + (selectedTechs.length > 0 ? selectedTechs.length + 1 : 0)
  const isOnTechConfig = step > 2 && step <= 2 + selectedTechs.length
  const isOnReview = step === totalSteps && selectedTechs.length > 0

  const getCurrentTech = () => {
    if (isOnTechConfig) {
      const techKey = selectedTechs[step - 3]
      return TECH_CONFIGS.find(t => t.key === techKey)
    }
    return null
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px', maxHeight: '90vh', overflow: 'auto' }}>
        {/* Header */}
        <div className="modal-header">
          <h2>🚀 Project Setup Wizard</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Progress Bar */}
        <div style={{ padding: '1rem 1.5rem', background: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.75rem' }}>
            {Array.from({ length: Math.max(totalSteps, 2) }).map((_, i) => (
              <div key={i} style={{
                flex: 1,
                height: '4px',
                background: i < step ? '#0066cc' : '#e5e7eb',
                borderRadius: '2px',
              }} />
            ))}
          </div>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#6b7280' }}>
            Step {step} of {Math.max(totalSteps, 2)}
            {step === 1 && ' - Project Info'}
            {step === 2 && ' - Select Technologies'}
            {isOnTechConfig && ` - Configure ${getCurrentTech()?.label}`}
            {isOnReview && ' - Review & Create'}
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
                  placeholder="e.g., Smith Residence"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="clientName">Client Name</label>
                  <input
                    id="clientName"
                    name="clientName"
                    type="text"
                    value={formData.clientName}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="clientPhone">Client Phone</label>
                  <input
                    id="clientPhone"
                    name="clientPhone"
                    type="tel"
                    value={formData.clientPhone}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="clientEmail">Client Email</label>
                <input
                  id="clientEmail"
                  name="clientEmail"
                  type="email"
                  value={formData.clientEmail}
                  onChange={handleInputChange}
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
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Project notes..."
                  rows={2}
                  style={{ fontFamily: 'inherit' }}
                />
              </div>
            </>
          )}

          {/* Step 2: Technologies */}
          {step === 2 && (
            <>
              <h3 style={{ color: '#333333' }}>🏗️ What's being installed?</h3>
              <p style={{ color: '#6b7280', marginBottom: '1rem' }}>Select the systems for this project. You'll configure quantities next.</p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                {TECH_CONFIGS.map(tech => (
                  <label
                    key={tech.key}
                    style={{
                      padding: '1rem',
                      border: '2px solid',
                      borderColor: selectedTechs.includes(tech.key) ? '#0066cc' : '#e5e7eb',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: selectedTechs.includes(tech.key) ? '#eff6ff' : 'white',
                      transition: 'all 0.2s',
                      textAlign: 'center',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTechs.includes(tech.key)}
                      onChange={() => handleTechToggle(tech.key)}
                      style={{ display: 'none' }}
                    />
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{tech.icon}</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{tech.label}</div>
                  </label>
                ))}
              </div>

              {selectedTechs.length === 0 && (
                <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: '1rem', fontStyle: 'italic' }}>
                  Select at least one technology, or skip to create an empty project
                </p>
              )}
            </>
          )}

          {/* Step 3+: Configure each technology */}
          {isOnTechConfig && getCurrentTech() && (
            <>
              <h3 style={{ color: '#333333' }}>
                {getCurrentTech()?.icon} Configure {getCurrentTech()?.label}
              </h3>
              
              <div style={{ padding: '1.5rem', background: '#f9fafb', borderRadius: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Quantity</label>
                    <input
                      type="number"
                      value={deviceSetups[getCurrentTech()!.key]?.quantity || 1}
                      onChange={(e) => handleDeviceSetupChange(getCurrentTech()!.key, 'quantity', parseInt(e.target.value) || 1)}
                      min={1}
                      max={50}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Brand</label>
                    <select
                      value={deviceSetups[getCurrentTech()!.key]?.brand || ''}
                      onChange={(e) => handleDeviceSetupChange(getCurrentTech()!.key, 'brand', e.target.value)}
                    >
                      {getCurrentTech()?.defaultBrands.map(brand => (
                        <option key={brand} value={brand}>{brand}</option>
                      ))}
                      <option value="Custom">Custom</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                    <label>Model (optional)</label>
                    <input
                      type="text"
                      value={deviceSetups[getCurrentTech()!.key]?.model || ''}
                      onChange={(e) => handleDeviceSetupChange(getCurrentTech()!.key, 'model', e.target.value)}
                      placeholder="e.g., IPC-HDW2831TM-AS-S2"
                    />
                  </div>
                </div>

                <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#dbeafe', borderRadius: '6px', fontSize: '0.85rem' }}>
                  <strong>Auto-configured:</strong>
                  <br />
                  • VLAN: {getCurrentTech()?.defaultVlan}
                  <br />
                  • IP addresses will be auto-assigned from the correct range
                </div>
              </div>
            </>
          )}

          {/* Review Step */}
          {isOnReview && (
            <>
              <h3 style={{ color: '#333333' }}>✅ Review & Create</h3>
              
              <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                <h4 style={{ margin: '0 0 0.5rem' }}>{formData.name}</h4>
                <p style={{ color: '#6b7280', margin: 0, fontSize: '0.9rem' }}>
                  {formData.clientName && `Client: ${formData.clientName}`}
                  {formData.address && ` • ${formData.address}`}
                </p>
              </div>

              <h4 style={{ marginBottom: '0.5rem' }}>Devices to be created:</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {selectedTechs.map(techKey => {
                  const tech = TECH_CONFIGS.find(t => t.key === techKey)
                  const setup = deviceSetups[techKey]
                  if (!tech || !setup) return null
                  
                  return (
                    <div
                      key={techKey}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem',
                        background: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>{tech.icon}</span>
                        <span>{tech.label}</span>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '0.9rem' }}>
                        <strong>{setup.quantity}x</strong> {setup.brand}
                        {setup.model && <span style={{ color: '#6b7280' }}> ({setup.model})</span>}
                      </div>
                    </div>
                  )
                })}
              </div>

              {selectedTechs.length === 0 && (
                <p style={{ color: '#6b7280', fontStyle: 'italic' }}>
                  No devices selected. An empty project will be created.
                </p>
              )}
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
              ← Back
            </button>
          )}

          {(step < totalSteps || (step === 2 && selectedTechs.length === 0)) ? (
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={step === 2 && selectedTechs.length === 0 ? handleSubmit : handleNext}
              disabled={loading}
            >
              {step === 2 && selectedTechs.length === 0 ? '✅ Create Empty Project' : 'Next →'}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? '⏳ Creating...' : `✅ Create Project${selectedTechs.length > 0 ? ` & ${Object.values(deviceSetups).reduce((sum, d) => sum + d.quantity, 0)} Devices` : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default SetupWizardModal
