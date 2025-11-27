import { useState, useEffect } from 'react'
import { Project, Device } from '../types'
import { projectsAPI, reportsAPI, devicesAPI } from '../services/apiService'
import { DeviceList } from './DeviceList'

interface ProjectDetailProps {
  project: Project
  onBack: () => void
  onProjectUpdated: (project: Project) => void
  onProjectDeleted: (projectId: string) => void
  onProjectCloned?: (project: Project) => void
}

interface WiFiNetwork {
  _id?: string
  name: string
  password: string
  vlan: number
  band: string
}

export const ProjectDetail: React.FC<ProjectDetailProps> = ({
  project,
  onBack,
  onProjectUpdated,
  onProjectDeleted,
  onProjectCloned,
}) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState(project)
  const [activeTab, setActiveTab] = useState<'devices' | 'wifi' | 'notes'>('devices')
  
  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  
  // Clone modal
  const [showCloneModal, setShowCloneModal] = useState(false)
  const [cloneName, setCloneName] = useState('')
  const [cloneDevices, setCloneDevices] = useState(true)
  
  // WiFi networks (standalone, not from devices)
  const [wifiNetworks, setWifiNetworks] = useState<WiFiNetwork[]>(project.wifiNetworks || [])
  const [showAddWifi, setShowAddWifi] = useState(false)
  const [newWifi, setNewWifi] = useState<WiFiNetwork>({ name: '', password: '', vlan: 1, band: '5GHz' })
  
  // Devices for WiFi display
  const [devices, setDevices] = useState<Device[]>([])

  useEffect(() => {
    loadDevices()
  }, [project._id])

  const loadDevices = async () => {
    try {
      const data = await devicesAPI.getByProject(project._id)
      setDevices(data)
    } catch (err) {
      console.error('Failed to load devices:', err)
    }
  }

  // Get WiFi networks from access points
  const getWifiFromDevices = () => {
    return devices
      .filter(d => d.deviceType === 'access-point' && d.ssids && d.ssids.length > 0)
      .flatMap(d => d.ssids || [])
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const updated = await projectsAPI.update(project._id, { ...formData, wifiNetworks })
      onProjectUpdated(updated)
      setEditing(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (deleteConfirmText !== 'DELETE') {
      setError('Please type DELETE to confirm')
      return
    }

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

  const handleClone = async () => {
    if (!cloneName.trim()) {
      setError('Please enter a name for the cloned project')
      return
    }

    setLoading(true)
    try {
      // Create new project with same data
      const newProjectData = {
        name: cloneName,
        description: project.description,
        clientName: project.clientName,
        clientEmail: project.clientEmail,
        clientPhone: project.clientPhone,
        address: project.address,
        status: 'planning' as const,
        technologies: project.technologies,
        wifiNetworks: project.wifiNetworks,
      }

      const newProject = await projectsAPI.create(newProjectData)

      // Clone devices if selected
      if (cloneDevices && devices.length > 0) {
        const deviceClones = devices.map(d => ({
          name: d.name,
          category: d.category,
          deviceType: d.deviceType,
          manufacturer: d.manufacturer,
          model: d.model,
          vlan: d.vlan,
          location: d.location,
          room: d.room,
          configNotes: d.configNotes,
          status: 'not-installed',
          autoAssignIP: true,
        }))
        await devicesAPI.bulkCreate(newProject._id, deviceClones)
      }

      setShowCloneModal(false)
      setCloneName('')
      if (onProjectCloned) {
        onProjectCloned(newProject)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddWifi = () => {
    if (!newWifi.name.trim()) {
      setError('WiFi name is required')
      return
    }
    setWifiNetworks([...wifiNetworks, { ...newWifi, _id: Date.now().toString() }])
    setNewWifi({ name: '', password: '', vlan: 1, band: '5GHz' })
    setShowAddWifi(false)
  }

  const handleRemoveWifi = (index: number) => {
    setWifiNetworks(wifiNetworks.filter((_, i) => i !== index))
  }

  const handleExportPDF = () => {
    reportsAPI.downloadPDF(project._id)
  }

  const handleExportJSON = () => {
    reportsAPI.downloadJSON(project._id)
  }

  const handleExportCSV = () => {
    reportsAPI.downloadCSV(project._id)
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      'planning': { bg: '#fef3c7', text: '#92400e' },
      'in-progress': { bg: '#dbeafe', text: '#1e40af' },
      'on-hold': { bg: '#fee2e2', text: '#991b1b' },
      'completed': { bg: '#d1fae5', text: '#065f46' },
      'archived': { bg: '#e5e7eb', text: '#374151' },
    }
    const style = colors[status] || colors['planning']
    return (
      <span style={{
        padding: '0.25rem 0.75rem',
        borderRadius: '9999px',
        background: style.bg,
        color: style.text,
        fontWeight: 600,
        fontSize: '0.85rem',
      }}>
        {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
      </span>
    )
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const allWifiNetworks = [...wifiNetworks, ...getWifiFromDevices()]

  return (
    <div className="container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <button className="btn btn-secondary" onClick={onBack}>
          ← Back to Projects
        </button>
        
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => {
            setCloneName(`${project.name} (Copy)`)
            setShowCloneModal(true)
          }}>
            📋 Clone
          </button>
          
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary"
              onClick={() => {
                const dropdown = document.getElementById('export-dropdown')
                if (dropdown) dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none'
              }}
            >
              📥 Export ▾
            </button>
            <div
              id="export-dropdown"
              style={{
                display: 'none',
                position: 'absolute',
                right: 0,
                top: '100%',
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                zIndex: 100,
                minWidth: '180px',
              }}
            >
              <button onClick={handleExportPDF} style={{ display: 'block', width: '100%', padding: '0.75rem 1rem', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer' }}>
                📄 PDF Handover Report
              </button>
              <button onClick={handleExportCSV} style={{ display: 'block', width: '100%', padding: '0.75rem 1rem', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer' }}>
                📊 CSV (Devices)
              </button>
              <button onClick={handleExportJSON} style={{ display: 'block', width: '100%', padding: '0.75rem 1rem', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer' }}>
                💾 JSON (Backup)
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Project Info Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
              <h1 style={{ margin: 0 }}>{formData.name}</h1>
              {getStatusBadge(project.status)}
            </div>
            {formData.description && (
              <p style={{ color: '#6b7280', margin: 0 }}>{formData.description}</p>
            )}
          </div>
          {!editing && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
                ✏️ Edit
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => setShowDeleteConfirm(true)}>
                🗑️ Delete
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <form onSubmit={handleUpdate}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Project Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
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

              <div className="form-group" style={{ margin: 0 }}>
                <label>Client Name</label>
                <input
                  type="text"
                  value={formData.clientName}
                  onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Client Email</label>
                <input
                  type="email"
                  value={formData.clientEmail}
                  onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Client Phone</label>
                <input
                  type="tel"
                  value={formData.clientPhone}
                  onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : '💾 Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Client</p>
              <p style={{ fontWeight: 600, margin: 0 }}>{project.clientName || 'N/A'}</p>
            </div>
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '0.25rem' }}>📧 Email</p>
              <p style={{ fontWeight: 600, margin: 0 }}>
                {project.clientEmail ? (
                  <a href={`mailto:${project.clientEmail}`}>{project.clientEmail}</a>
                ) : 'N/A'}
              </p>
            </div>
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '0.25rem' }}>📱 Phone</p>
              <p style={{ fontWeight: 600, margin: 0 }}>
                {project.clientPhone ? (
                  <a href={`tel:${project.clientPhone}`}>{project.clientPhone}</a>
                ) : 'N/A'}
              </p>
            </div>
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '0.25rem' }}>📍 Address</p>
              <p style={{ fontWeight: 600, margin: 0 }}>{project.address || 'N/A'}</p>
            </div>
          </div>
        )}
      </div>

      {/* WiFi Quick Display */}
      {allWifiNetworks.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, #667eea15, #764ba215)' }}>
          <h3 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📶 WiFi Networks
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
            {allWifiNetworks.map((wifi, i) => (
              <div key={i} style={{ background: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{wifi.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <code style={{ background: '#f3f4f6', padding: '0.25rem 0.5rem', borderRadius: '4px', flex: 1 }}>
                    {wifi.password || '(no password)'}
                  </code>
                  {wifi.password && (
                    <button
                      onClick={() => copyToClipboard(wifi.password)}
                      style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      📋
                    </button>
                  )}
                </div>
                {wifi.band && <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem' }}>{wifi.band}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ borderBottom: '2px solid #e5e7eb', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0' }}>
          {[
            { id: 'devices', label: '🎛️ Devices' },
            { id: 'wifi', label: '📶 WiFi Networks' },
            { id: 'notes', label: '📝 Notes' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontWeight: activeTab === tab.id ? 600 : 400,
                color: activeTab === tab.id ? '#0066cc' : '#6b7280',
                borderBottom: activeTab === tab.id ? '2px solid #0066cc' : '2px solid transparent',
                marginBottom: '-2px',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'devices' && (
        <DeviceList projectId={project._id} />
      )}

      {activeTab === 'wifi' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>📶 WiFi Networks</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddWifi(true)}>
              ➕ Add Network
            </button>
          </div>

          {showAddWifi && (
            <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: '8px', marginBottom: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Network Name (SSID)</label>
                  <input
                    type="text"
                    value={newWifi.name}
                    onChange={(e) => setNewWifi({ ...newWifi, name: e.target.value })}
                    placeholder="e.g., SmithHome"
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Password</label>
                  <input
                    type="text"
                    value={newWifi.password}
                    onChange={(e) => setNewWifi({ ...newWifi, password: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>VLAN</label>
                  <input
                    type="number"
                    value={newWifi.vlan}
                    onChange={(e) => setNewWifi({ ...newWifi, vlan: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Band</label>
                  <select value={newWifi.band} onChange={(e) => setNewWifi({ ...newWifi, band: e.target.value })}>
                    <option value="2.4GHz">2.4GHz</option>
                    <option value="5GHz">5GHz</option>
                    <option value="6GHz">6GHz</option>
                    <option value="Dual">Dual Band</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowAddWifi(false)}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={handleAddWifi}>Add Network</button>
              </div>
            </div>
          )}

          {wifiNetworks.length === 0 && getWifiFromDevices().length === 0 ? (
            <p style={{ color: '#6b7280' }}>No WiFi networks configured.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {wifiNetworks.map((wifi, i) => (
                <div key={wifi._id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: '#f9fafb', borderRadius: '8px' }}>
                  <div>
                    <strong>{wifi.name}</strong>
                    <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                      Password: <code>{wifi.password || '(none)'}</code> • VLAN {wifi.vlan} • {wifi.band}
                    </div>
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={() => handleRemoveWifi(i)}>✕</button>
                </div>
              ))}
              {getWifiFromDevices().map((wifi, i) => (
                <div key={`device-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: '#eff6ff', borderRadius: '8px' }}>
                  <div>
                    <strong>{wifi.name}</strong>
                    <span style={{ fontSize: '0.75rem', color: '#3b82f6', marginLeft: '0.5rem' }}>(from WAP)</span>
                    <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                      Password: <code>{wifi.password || '(none)'}</code> • {wifi.band || 'Dual'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={async () => {
              try {
                await projectsAPI.update(project._id, { wifiNetworks })
                alert('WiFi networks saved!')
              } catch (err: any) {
                setError(err.message)
              }
            }}
            style={{ marginTop: '1rem' }}
          >
            💾 Save WiFi Networks
          </button>
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="card">
          <h3>📝 Project Notes</h3>
          <textarea
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={10}
            placeholder="Add project notes here..."
            style={{ width: '100%', fontFamily: 'inherit' }}
          />
          <button
            className="btn btn-primary"
            onClick={async () => {
              try {
                await projectsAPI.update(project._id, { notes: formData.notes })
                alert('Notes saved!')
              } catch (err: any) {
                setError(err.message)
              }
            }}
            style={{ marginTop: '1rem' }}
          >
            💾 Save Notes
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header" style={{ background: '#fee2e2' }}>
              <h2>⚠️ Delete Project</h2>
              <button className="close-btn" onClick={() => setShowDeleteConfirm(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#991b1b', fontWeight: 600 }}>
                Are you sure you want to delete "{project.name}"?
              </p>
              <p style={{ color: '#6b7280' }}>
                This will permanently delete the project and all {devices.length} associated devices. This action cannot be undone.
              </p>
              <div className="form-group">
                <label>Type <strong>DELETE</strong> to confirm:</label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  style={{ borderColor: deleteConfirmText === 'DELETE' ? '#10b981' : undefined }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button 
                className="btn btn-danger" 
                onClick={handleDelete} 
                disabled={deleteConfirmText !== 'DELETE' || loading}
              >
                {loading ? 'Deleting...' : '🗑️ Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clone Modal */}
      {showCloneModal && (
        <div className="modal-overlay" onClick={() => setShowCloneModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h2>📋 Clone Project</h2>
              <button className="close-btn" onClick={() => setShowCloneModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
                Create a copy of "{project.name}" with all its settings.
              </p>
              <div className="form-group">
                <label>New Project Name</label>
                <input
                  type="text"
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                  placeholder="Enter name for cloned project"
                />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={cloneDevices}
                    onChange={(e) => setCloneDevices(e.target.checked)}
                  />
                  Clone devices ({devices.length} devices)
                </label>
                <small style={{ color: '#6b7280' }}>New IP addresses will be auto-assigned</small>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCloneModal(false)}>Cancel</button>
              <button 
                className="btn btn-primary" 
                onClick={handleClone} 
                disabled={!cloneName.trim() || loading}
              >
                {loading ? 'Cloning...' : '📋 Clone Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProjectDetail
