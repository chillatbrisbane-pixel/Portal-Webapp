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

// Helper to parse IP for sorting
const parseIP = (ip: string): number => {
  if (!ip) return Infinity
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(isNaN)) return Infinity
  return parts[0] * 16777216 + parts[1] * 65536 + parts[2] * 256 + parts[3]
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
  const [activeTab, setActiveTab] = useState<'devices' | 'wifi' | 'ports' | 'notes'>('devices')
  
  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  
  // Clone modal
  const [showCloneModal, setShowCloneModal] = useState(false)
  const [cloneName, setCloneName] = useState('')
  const [cloneDevices, setCloneDevices] = useState(true)
  
  // WiFi networks - sync with project
  const [wifiNetworks, setWifiNetworks] = useState<WiFiNetwork[]>(project.wifiNetworks || [])
  const [showAddWifi, setShowAddWifi] = useState(false)
  const [newWifi, setNewWifi] = useState<WiFiNetwork>({ name: '', password: '', vlan: 1, band: '5GHz' })
  const [showNewWifiPassword, setShowNewWifiPassword] = useState(false)
  const [editingWifiIndex, setEditingWifiIndex] = useState<number | null>(null)
  const [editingWifi, setEditingWifi] = useState<WiFiNetwork | null>(null)
  const [showEditWifiPassword, setShowEditWifiPassword] = useState(false)
  const [wifiPasswordWarning, setWifiPasswordWarning] = useState(false)
  
  // Devices
  const [devices, setDevices] = useState<Device[]>([])
  
  // Ports tab
  const [selectedSwitchId, setSelectedSwitchId] = useState<string>('')

  // Sync wifiNetworks when project changes
  useEffect(() => {
    setWifiNetworks(project.wifiNetworks || [])
    setFormData(project)
  }, [project])

  useEffect(() => {
    loadDevices()
  }, [project._id])

  const loadDevices = async () => {
    try {
      const data = await devicesAPI.getByProject(project._id)
      setDevices(data)
      
      const switches = data.filter((d: Device) => d.deviceType === 'switch')
      if (switches.length > 0 && !selectedSwitchId) {
        setSelectedSwitchId(switches[0]._id)
      }
    } catch (err) {
      console.error('Failed to load devices:', err)
    }
  }

  // Get switches for port management
  const switches = devices.filter(d => d.deviceType === 'switch')
  const selectedSwitch = switches.find(s => s._id === selectedSwitchId)
  
  // Get non-switch devices for port assignment, sorted by IP
  const assignableDevices = devices
    .filter(d => d.deviceType !== 'switch')
    .sort((a, b) => parseIP(a.ipAddress || '') - parseIP(b.ipAddress || ''))

  // Get WiFi from access points
  const getWifiFromDevices = () => {
    return devices
      .filter(d => d.deviceType === 'access-point' && d.ssids && d.ssids.length > 0)
      .flatMap(d => d.ssids || [])
  }

  const allWifiNetworks = [...wifiNetworks, ...getWifiFromDevices()]

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Only update form fields, not wifiNetworks (they're saved separately)
      const updateData = {
        name: formData.name,
        description: formData.description,
        clientName: formData.clientName,
        clientEmail: formData.clientEmail,
        clientPhone: formData.clientPhone,
        address: formData.address,
        status: formData.status,
        notes: formData.notes,
      }
      const updated = await projectsAPI.update(project._id, updateData)
      onProjectUpdated({ ...updated, wifiNetworks })
      setEditing(false)
    } catch (err: any) {
      setError(err.message || 'Failed to update project')
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
      const newProjectData = {
        name: cloneName,
        description: project.description,
        clientName: project.clientName,
        clientEmail: project.clientEmail,
        clientPhone: project.clientPhone,
        address: project.address,
        status: 'planning' as const,
        technologies: project.technologies,
        wifiNetworks: wifiNetworks,
      }

      const newProject = await projectsAPI.create(newProjectData)

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

  // WiFi handlers
  const generatePassword = async () => {
    try {
      const { password } = await devicesAPI.generatePassword()
      return password
    } catch (err) {
      console.error('Failed to generate password:', err)
      return ''
    }
  }

  const saveWifiNetworks = async (networks: WiFiNetwork[]) => {
    try {
      await projectsAPI.update(project._id, { wifiNetworks: networks })
      // Update local project state
      onProjectUpdated({ ...project, wifiNetworks: networks })
    } catch (err) {
      console.error('Failed to save WiFi:', err)
      throw err
    }
  }

  const handleAddWifi = async () => {
    if (!newWifi.name.trim()) {
      setError('WiFi name is required')
      return
    }
    // Don't add _id - let MongoDB handle it
    const updatedNetworks = [...wifiNetworks, { name: newWifi.name, password: newWifi.password, vlan: newWifi.vlan, band: newWifi.band }]
    
    try {
      await saveWifiNetworks(updatedNetworks)
      setWifiNetworks(updatedNetworks)
      setNewWifi({ name: '', password: '', vlan: 1, band: '5GHz' })
      setShowAddWifi(false)
      setShowNewWifiPassword(false)
      setError('')
    } catch (err: any) {
      setError('Failed to save WiFi network')
    }
  }

  const handleEditWifi = (index: number) => {
    setEditingWifiIndex(index)
    setEditingWifi({ ...wifiNetworks[index] })
    setShowEditWifiPassword(false)
    setWifiPasswordWarning(false)
  }

  const handleSaveEditWifi = async () => {
    if (editingWifiIndex === null || !editingWifi) return
    
    const updatedNetworks = [...wifiNetworks]
    updatedNetworks[editingWifiIndex] = editingWifi
    
    try {
      await saveWifiNetworks(updatedNetworks)
      setWifiNetworks(updatedNetworks)
      setEditingWifiIndex(null)
      setEditingWifi(null)
      setWifiPasswordWarning(false)
    } catch (err: any) {
      setError('Failed to save WiFi network')
    }
  }

  const handleRemoveWifi = async (index: number) => {
    if (!window.confirm('Remove this WiFi network?')) return
    const updatedNetworks = wifiNetworks.filter((_, i) => i !== index)
    
    try {
      await saveWifiNetworks(updatedNetworks)
      setWifiNetworks(updatedNetworks)
    } catch (err: any) {
      setError('Failed to remove WiFi network')
    }
  }

  // Port assignment handlers
  const getDeviceOnPort = (portNumber: number): Device | undefined => {
    return devices.find(d => {
      const switchId = typeof d.boundToSwitch === 'string' 
        ? d.boundToSwitch 
        : d.boundToSwitch?._id
      return switchId === selectedSwitchId && d.switchPort === portNumber
    })
  }

  const handlePortAssignment = async (portNumber: number, deviceId: string) => {
    if (!selectedSwitch) return
    
    // Check if trying to assign to an already-used port
    const currentDeviceOnPort = getDeviceOnPort(portNumber)
    if (currentDeviceOnPort && deviceId && currentDeviceOnPort._id !== deviceId) {
      if (!window.confirm(`⚠️ Port ${portNumber} is currently assigned to "${currentDeviceOnPort.name}". Do you want to replace it?`)) {
        return
      }
      // Clear the old device's binding
      try {
        await devicesAPI.update(currentDeviceOnPort._id, { 
          boundToSwitch: null, 
          switchPort: null 
        })
      } catch (err) {
        console.error('Failed to clear old binding:', err)
      }
    }
    
    try {
      // If unassigning (empty deviceId), clear the device's binding
      if (currentDeviceOnPort && !deviceId) {
        await devicesAPI.update(currentDeviceOnPort._id, { 
          boundToSwitch: null, 
          switchPort: null 
        })
      }
      
      // If assigning a device
      if (deviceId) {
        const deviceToAssign = devices.find(d => d._id === deviceId)
        if (deviceToAssign) {
          const oldSwitchId = typeof deviceToAssign.boundToSwitch === 'string' 
            ? deviceToAssign.boundToSwitch 
            : deviceToAssign.boundToSwitch?._id
          
          // Warn if device is already assigned to another port
          if (oldSwitchId && deviceToAssign.switchPort) {
            const oldSwitch = switches.find(s => s._id === oldSwitchId)
            const switchName = oldSwitch ? oldSwitch.name : 'another switch'
            if (oldSwitchId !== selectedSwitchId || deviceToAssign.switchPort !== portNumber) {
              if (!window.confirm(`⚠️ "${deviceToAssign.name}" is currently assigned to ${switchName} Port ${deviceToAssign.switchPort}. Move it to Port ${portNumber}?`)) {
                return
              }
            }
          }
        }
        
        await devicesAPI.update(deviceId, { 
          boundToSwitch: selectedSwitch._id, 
          switchPort: portNumber 
        })
      }
      
      loadDevices()
    } catch (err: any) {
      setError(err.message)
    }
  }

  // Export handlers
  const handleExportPDF = () => reportsAPI.downloadPDF(project._id)
  const handleExportJSON = () => reportsAPI.downloadJSON(project._id)
  const handleExportCSV = () => reportsAPI.downloadCSV(project._id)

  // Port export functions
  const exportPortsToCSV = () => {
    if (!selectedSwitch) return
    
    const portCount = selectedSwitch.portCount || 24
    const rows = [['Port', 'Device Name', 'IP Address', 'MAC Address', 'Manufacturer', 'Model', 'VLAN']]
    
    for (let portNum = 1; portNum <= portCount; portNum++) {
      const device = getDeviceOnPort(portNum)
      rows.push([
        portNum.toString(),
        device?.name || '',
        device?.ipAddress || '',
        device?.macAddress || '',
        device?.manufacturer || '',
        device?.model || '',
        device?.vlan?.toString() || ''
      ])
    }
    
    const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.name}_${selectedSwitch.name}_ports.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPortsToPDF = () => {
    if (!selectedSwitch) return
    
    const portCount = selectedSwitch.portCount || 24
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${project.name} - ${selectedSwitch.name} Port Allocation</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #333; }
          h2 { color: #666; margin-top: 10px; }
          table { border-collapse: collapse; width: 100%; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #f5f5f5; font-weight: bold; }
          tr:nth-child(even) { background: #fafafa; }
          .empty { color: #999; font-style: italic; }
          .info { margin-bottom: 20px; color: #666; }
        </style>
      </head>
      <body>
        <h1>${project.name}</h1>
        <h2>Switch Port Allocation: ${selectedSwitch.name}</h2>
        <p class="info">${selectedSwitch.manufacturer || ''} ${selectedSwitch.model || ''} ${selectedSwitch.ipAddress ? '• IP: ' + selectedSwitch.ipAddress : ''}</p>
        <table>
          <thead>
            <tr>
              <th>Port</th>
              <th>Device Name</th>
              <th>IP Address</th>
              <th>MAC Address</th>
              <th>Manufacturer</th>
              <th>Model</th>
              <th>VLAN</th>
            </tr>
          </thead>
          <tbody>
    `
    
    for (let portNum = 1; portNum <= portCount; portNum++) {
      const device = getDeviceOnPort(portNum)
      html += `
        <tr>
          <td>${portNum}</td>
          <td>${device?.name || '<span class="empty">Unassigned</span>'}</td>
          <td>${device?.ipAddress || ''}</td>
          <td>${device?.macAddress || ''}</td>
          <td>${device?.manufacturer || ''}</td>
          <td>${device?.model || ''}</td>
          <td>${device?.vlan || ''}</td>
        </tr>
      `
    }
    
    html += `
          </tbody>
        </table>
        <p style="margin-top: 20px; font-size: 12px; color: #999;">Generated: ${new Date().toLocaleString()}</p>
      </body>
      </html>
    `
    
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.print()
    }
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

  const copyToClipboard = async (text: string | undefined, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    if (text) {
      try {
        await navigator.clipboard.writeText(text)
        const btn = e?.currentTarget as HTMLButtonElement
        if (btn) {
          const original = btn.textContent
          btn.textContent = '✓'
          setTimeout(() => { btn.textContent = original }, 1000)
        }
      } catch (err) {
        const textarea = document.createElement('textarea')
        textarea.value = text
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
    }
  }

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

      {/* Project Info Card with WiFi */}
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

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setEditing(false); setFormData(project) }}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : '💾 Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Client Info Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '0.25rem' }}>👤 Client</p>
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

            {/* WiFi Networks in Header */}
            {allWifiNetworks.length > 0 && (
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
                <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '0.75rem' }}>📶 WiFi Networks</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  {allWifiNetworks.map((wifi, i) => (
                    <div key={i} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      background: '#f0f9ff', 
                      padding: '0.5rem 0.75rem', 
                      borderRadius: '6px',
                      border: '1px solid #bae6fd'
                    }}>
                      <strong style={{ fontSize: '0.9rem' }}>{wifi.name}:</strong>
                      <code style={{ background: '#e0f2fe', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}>
                        {wifi.password || '(open)'}
                      </code>
                      {wifi.password && (
                        <button
                          onClick={(e) => copyToClipboard(wifi.password, e)}
                          style={{ padding: '0.15rem 0.35rem', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}
                          title="Copy password"
                        >
                          📋
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '2px solid #e5e7eb', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0' }}>
          {[
            { id: 'devices', label: '🎛️ Devices' },
            { id: 'wifi', label: '📶 WiFi' },
            { id: 'ports', label: '🔌 Ports' },
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

          {/* Add WiFi Form */}
          {showAddWifi && (
            <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: '8px', marginBottom: '1rem' }}>
              <h4 style={{ margin: '0 0 1rem' }}>Add New WiFi Network</h4>
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
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type={showNewWifiPassword ? 'text' : 'password'}
                      value={newWifi.password}
                      onChange={(e) => setNewWifi({ ...newWifi, password: e.target.value })}
                      style={{ flex: 1 }}
                    />
                    <button type="button" onClick={() => setShowNewWifiPassword(!showNewWifiPassword)}
                      style={{ padding: '0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}>
                      {showNewWifiPassword ? '🙈' : '👁️'}
                    </button>
                    <button type="button" onClick={async () => {
                      const pw = await generatePassword()
                      setNewWifi({ ...newWifi, password: pw })
                      setShowNewWifiPassword(true)
                    }}
                      style={{ padding: '0.5rem', background: '#0066cc', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      title="Generate Password">
                      🎲
                    </button>
                    {newWifi.password && (
                      <button type="button" onClick={(e) => copyToClipboard(newWifi.password, e)}
                        style={{ padding: '0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}>
                        📋
                      </button>
                    )}
                  </div>
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
                <button className="btn btn-secondary btn-sm" onClick={() => { setShowAddWifi(false); setShowNewWifiPassword(false) }}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={handleAddWifi}>Add Network</button>
              </div>
            </div>
          )}

          {/* WiFi List */}
          {wifiNetworks.length === 0 && getWifiFromDevices().length === 0 ? (
            <p style={{ color: '#6b7280' }}>No WiFi networks configured.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {wifiNetworks.map((wifi, i) => (
                <div key={wifi._id || i} style={{ padding: '1rem', background: '#f9fafb', borderRadius: '8px' }}>
                  {editingWifiIndex === i && editingWifi ? (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label>Network Name</label>
                          <input
                            type="text"
                            value={editingWifi.name}
                            onChange={(e) => setEditingWifi({ ...editingWifi, name: e.target.value })}
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label>Password</label>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                              type={showEditWifiPassword ? 'text' : 'password'}
                              value={editingWifi.password}
                              onChange={(e) => {
                                setEditingWifi({ ...editingWifi, password: e.target.value })
                                if (e.target.value !== wifi.password) {
                                  setWifiPasswordWarning(true)
                                }
                              }}
                              style={{ flex: 1 }}
                            />
                            <button type="button" onClick={() => setShowEditWifiPassword(!showEditWifiPassword)}
                              style={{ padding: '0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}>
                              {showEditWifiPassword ? '🙈' : '👁️'}
                            </button>
                            <button type="button" onClick={async () => {
                              if (editingWifi.password && !window.confirm('Generate new password? This will replace the existing password.')) return
                              const pw = await generatePassword()
                              setEditingWifi({ ...editingWifi, password: pw })
                              setShowEditWifiPassword(true)
                              setWifiPasswordWarning(true)
                            }}
                              style={{ padding: '0.5rem', background: '#0066cc', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                              title="Generate Password">
                              🎲
                            </button>
                            {editingWifi.password && (
                              <button type="button" onClick={(e) => copyToClipboard(editingWifi.password, e)}
                                style={{ padding: '0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}>
                                📋
                              </button>
                            )}
                          </div>
                          {wifiPasswordWarning && (
                            <small style={{ color: '#f59e0b', marginTop: '0.25rem', display: 'block' }}>
                              ⚠️ Password changed - update any connected devices!
                            </small>
                          )}
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label>VLAN</label>
                          <input
                            type="number"
                            value={editingWifi.vlan}
                            onChange={(e) => setEditingWifi({ ...editingWifi, vlan: parseInt(e.target.value) || 1 })}
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label>Band</label>
                          <select value={editingWifi.band} onChange={(e) => setEditingWifi({ ...editingWifi, band: e.target.value })}>
                            <option value="2.4GHz">2.4GHz</option>
                            <option value="5GHz">5GHz</option>
                            <option value="6GHz">6GHz</option>
                            <option value="Dual">Dual Band</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setEditingWifiIndex(null); setEditingWifi(null); setWifiPasswordWarning(false) }}>Cancel</button>
                        <button className="btn btn-primary btn-sm" onClick={handleSaveEditWifi}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{wifi.name}</strong>
                        <div style={{ fontSize: '0.9rem', color: '#6b7280', marginTop: '0.25rem' }}>
                          Password: <code style={{ background: '#e5e7eb', padding: '0.1rem 0.4rem', borderRadius: '3px' }}>{wifi.password || '(none)'}</code>
                          {wifi.password && (
                            <button onClick={(e) => copyToClipboard(wifi.password, e)}
                              style={{ marginLeft: '0.5rem', padding: '0.1rem 0.3rem', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                              📋
                            </button>
                          )}
                          <span style={{ marginLeft: '0.75rem' }}>VLAN {wifi.vlan}</span>
                          <span style={{ marginLeft: '0.75rem' }}>{wifi.band}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleEditWifi(i)}>✏️</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleRemoveWifi(i)}>✕</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {/* WiFi from devices */}
              {getWifiFromDevices().map((wifi, i) => (
                <div key={`device-${i}`} style={{ padding: '1rem', background: '#eff6ff', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{wifi.name}</strong>
                      <span style={{ fontSize: '0.75rem', color: '#3b82f6', marginLeft: '0.5rem' }}>(from WAP)</span>
                      <div style={{ fontSize: '0.9rem', color: '#6b7280', marginTop: '0.25rem' }}>
                        Password: <code style={{ background: '#dbeafe', padding: '0.1rem 0.4rem', borderRadius: '3px' }}>{wifi.password || '(none)'}</code>
                        {wifi.password && (
                          <button onClick={(e) => copyToClipboard(wifi.password, e)}
                            style={{ marginLeft: '0.5rem', padding: '0.1rem 0.3rem', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                            📋
                          </button>
                        )}
                        <span style={{ marginLeft: '0.75rem' }}>{wifi.band || 'Dual'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'ports' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ margin: 0 }}>🔌 Switch Port Management</h3>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {switches.length > 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontWeight: 500 }}>Switch:</label>
                    <select 
                      value={selectedSwitchId} 
                      onChange={(e) => setSelectedSwitchId(e.target.value)}
                      style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                    >
                      {switches.map(sw => (
                        <option key={sw._id} value={sw._id}>{sw.name} ({sw.portCount || 24} ports)</option>
                      ))}
                    </select>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => exportPortsToCSV()}
                      title="Export to CSV/Excel"
                    >
                      📊 CSV
                    </button>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => exportPortsToPDF()}
                      title="Export to PDF"
                    >
                      📄 PDF
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {switches.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              <p>No switches in this project.</p>
              <p>Add a switch device to manage port assignments.</p>
            </div>
          ) : selectedSwitch ? (
            <div>
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f3f4f6', borderRadius: '6px' }}>
                <strong>{selectedSwitch.name}</strong> • {selectedSwitch.manufacturer} {selectedSwitch.model}
                {selectedSwitch.ipAddress && <span> • IP: {selectedSwitch.ipAddress}</span>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                {Array.from({ length: selectedSwitch.portCount || 24 }, (_, i) => i + 1).map(portNum => {
                  const assignedDevice = getDeviceOnPort(portNum)
                  
                  return (
                    <div 
                      key={portNum}
                      style={{
                        padding: '0.75rem',
                        border: '1px solid',
                        borderColor: assignedDevice ? '#10b981' : '#e5e7eb',
                        borderRadius: '6px',
                        background: assignedDevice ? '#ecfdf5' : 'white',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <strong style={{ color: assignedDevice ? '#059669' : '#6b7280' }}>
                          Port {portNum}
                        </strong>
                        {assignedDevice && (
                          <span style={{ fontSize: '0.75rem', color: '#059669' }}>● In Use</span>
                        )}
                      </div>
                      
                      <select
                        value={assignedDevice?._id || ''}
                        onChange={(e) => handlePortAssignment(portNum, e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          borderRadius: '4px',
                          border: '1px solid #d1d5db',
                          fontSize: '0.9rem',
                        }}
                      >
                        <option value="">-- Unassigned --</option>
                        {assignableDevices.map(device => (
                          <option key={device._id} value={device._id}>
                            {device.name} ({device.ipAddress || 'No IP'})
                          </option>
                        ))}
                      </select>
                      
                      {assignedDevice && (
                        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.5rem' }}>
                          {assignedDevice.manufacturer} {assignedDevice.model}
                          {assignedDevice.ipAddress && ` • ${assignedDevice.ipAddress}`}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
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
