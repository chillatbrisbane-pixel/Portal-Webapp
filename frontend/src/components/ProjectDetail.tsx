import { useState, useEffect } from 'react'
import { Project, Device, ProjectVersion, NoteEntry, User } from '../types'
import { projectsAPI, reportsAPI, devicesAPI, clientAccessAPI, usersAPI } from '../services/apiService'
import { DeviceList } from './DeviceList'
import TaskList from './TaskList'

interface ProjectDetailProps {
  project: Project
  initialTab?: 'devices' | 'tasks' | null
  onBack: () => void
  onProjectUpdated: (project: Project) => void
  onProjectDeleted: (projectId: string) => void
  onProjectCloned?: (project: Project) => void
  currentUser?: { _id: string; name: string; role: string }
}

interface StaffMember {
  _id: string
  name: string
  phone?: string
  role: string
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
  initialTab,
  onBack,
  onProjectUpdated,
  onProjectDeleted,
  onProjectCloned,
  currentUser,
}) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState(project)
  const [activeTab, setActiveTab] = useState<'devices' | 'wifi' | 'ports' | 'notes' | 'history' | 'tasks'>(initialTab || 'devices')
  
  // Version history
  const [versions, setVersions] = useState<ProjectVersion[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [rollingBack, setRollingBack] = useState(false)
  
  // Note entries
  const [noteEntries, setNoteEntries] = useState<NoteEntry[]>([])
  const [newNoteText, setNewNoteText] = useState('')
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [addingNote, setAddingNote] = useState(false)
  
  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  
  // Clone modal
  const [showCloneModal, setShowCloneModal] = useState(false)
  const [cloneName, setCloneName] = useState('')
  const [cloneDevices, setCloneDevices] = useState(true)
  
  // Staff list for dropdowns
  const [allStaff, setAllStaff] = useState<StaffMember[]>([])
  const [projectManagers, setProjectManagers] = useState<StaffMember[]>([])
  
  // Collapsible sections
  const [sectionsExpanded, setSectionsExpanded] = useState({
    projectDetails: true,
    teamContacts: true,
    links: true,
  })
  
  // WiFi networks - sync with project
  const [wifiNetworks, setWifiNetworks] = useState<WiFiNetwork[]>(project.wifiNetworks || [])
  const [showAddWifi, setShowAddWifi] = useState(false)
  const [newWifi, setNewWifi] = useState<WiFiNetwork>({ name: '', password: '', vlan: 1, band: '5GHz' })
  const [showNewWifiPassword, setShowNewWifiPassword] = useState(false)
  const [showViewWifiPasswords, setShowViewWifiPasswords] = useState(false)
  const [editingWifiIndex, setEditingWifiIndex] = useState<number | null>(null)
  const [editingWifi, setEditingWifi] = useState<WiFiNetwork | null>(null)
  const [showEditWifiPassword, setShowEditWifiPassword] = useState(false)
  const [wifiPasswordWarning, setWifiPasswordWarning] = useState(false)
  const [qrWifi, setQrWifi] = useState<WiFiNetwork | null>(null)
  const [showSharePointQR, setShowSharePointQR] = useState(false)
  const [showSkytunnelQR, setShowSkytunnelQR] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
  const [quickLinksExpanded, setQuickLinksExpanded] = useState(true)
  
  // Client Access
  const [clientAccess, setClientAccess] = useState<{
    enabled: boolean;
    token: string | null;
    pin: string | null;
    lastAccessed: string | null;
    createdAt: string | null;
  }>({ enabled: false, token: null, pin: null, lastAccessed: null, createdAt: null })
  const [clientAccessLoading, setClientAccessLoading] = useState(false)
  const [showClientAccessWarning, setShowClientAccessWarning] = useState(false)
  const [clientAccessPin, setClientAccessPin] = useState('')
  
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
    loadClientAccess()
  }, [project._id])

  // Load staff list when editing starts
  useEffect(() => {
    if (editing) {
      loadStaff()
    }
  }, [editing])

  const loadStaff = async () => {
    try {
      const users = await usersAPI.getAll()
      // Filter active users
      const activeUsers = users.filter((u: StaffMember) => !u.suspended)
      setAllStaff(activeUsers)
      // Project managers are only project-manager role (not admin)
      setProjectManagers(activeUsers.filter((u: StaffMember) => u.role === 'project-manager'))
    } catch (err) {
      console.error('Failed to load staff:', err)
    }
  }

  const loadDevices = async () => {
    try {
      const data = await devicesAPI.getByProject(project._id)
      setDevices(data)
      
      // Include both switches and routers for port management
      const portDevices = data.filter((d: Device) => d.deviceType === 'switch' || d.deviceType === 'router')
      if (portDevices.length > 0 && !selectedSwitchId) {
        setSelectedSwitchId(portDevices[0]._id)
      }
    } catch (err) {
      console.error('Failed to load devices:', err)
    }
  }

  const loadClientAccess = async () => {
    try {
      const data = await clientAccessAPI.getStatus(project._id)
      setClientAccess(data)
      setClientAccessPin(data.pin || '')
    } catch (err) {
      console.error('Failed to load client access:', err)
    }
  }

  const toggleClientAccess = async (enable: boolean) => {
    // If disabling, just do it
    // If enabling after being disabled (token exists but disabled), show warning
    if (enable && clientAccess.token && !clientAccess.enabled) {
      setShowClientAccessWarning(true)
      return
    }
    
    await updateClientAccess(enable)
  }

  const updateClientAccess = async (enable: boolean) => {
    setClientAccessLoading(true)
    try {
      const data = await clientAccessAPI.update(project._id, { 
        enabled: enable,
        pin: clientAccessPin || undefined,
      })
      setClientAccess(data)
      setShowClientAccessWarning(false)
    } catch (err) {
      console.error('Failed to update client access:', err)
    } finally {
      setClientAccessLoading(false)
    }
  }

  const saveClientAccessPin = async () => {
    setClientAccessLoading(true)
    try {
      const data = await clientAccessAPI.update(project._id, { 
        enabled: clientAccess.enabled,
        pin: clientAccessPin || '',
      })
      setClientAccess(data)
    } catch (err) {
      console.error('Failed to save PIN:', err)
    } finally {
      setClientAccessLoading(false)
    }
  }

  const regenerateClientToken = async () => {
    setClientAccessLoading(true)
    try {
      const data = await clientAccessAPI.regenerateToken(project._id)
      setClientAccess(prev => ({ ...prev, ...data }))
    } catch (err) {
      console.error('Failed to regenerate token:', err)
    } finally {
      setClientAccessLoading(false)
    }
  }

  const getClientAccessUrl = () => {
    const baseUrl = window.location.origin
    return `${baseUrl}/client/${clientAccess.token}`
  }

  const loadVersions = async () => {
    setLoadingVersions(true)
    try {
      const data = await projectsAPI.getVersions(project._id)
      setVersions(data)
    } catch (err) {
      console.error('Failed to load versions:', err)
    } finally {
      setLoadingVersions(false)
    }
  }

  const handleRollback = async (versionId: string, versionNumber: number) => {
    if (!window.confirm(`Are you sure you want to rollback to version ${versionNumber}? This will restore the project and all devices to that point in time.`)) {
      return
    }

    setRollingBack(true)
    try {
      const result = await projectsAPI.rollback(project._id, versionId)
      onProjectUpdated(result.project)
      alert(`Successfully rolled back to version ${versionNumber}`)
      loadVersions()
      loadDevices()
    } catch (err: any) {
      alert(`Rollback failed: ${err.message}`)
    } finally {
      setRollingBack(false)
    }
  }

  // Load versions when history tab is selected
  useEffect(() => {
    if (activeTab === 'history') {
      loadVersions()
    }
  }, [activeTab, project._id])

  // Load notes when notes tab is selected
  const loadNotes = async () => {
    setLoadingNotes(true)
    try {
      const notes = await projectsAPI.getNotes(project._id)
      setNoteEntries(notes)
    } catch (err) {
      console.error('Failed to load notes:', err)
    } finally {
      setLoadingNotes(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'notes') {
      loadNotes()
    }
  }, [activeTab, project._id])

  const handleAddNote = async () => {
    if (!newNoteText.trim()) return
    
    setAddingNote(true)
    try {
      const updatedNotes = await projectsAPI.addNote(project._id, newNoteText.trim())
      setNoteEntries(updatedNotes)
      setNewNoteText('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAddingNote(false)
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm('Delete this note?')) return
    
    try {
      await projectsAPI.deleteNote(project._id, noteId)
      setNoteEntries(prev => prev.filter(n => n._id !== noteId))
    } catch (err: any) {
      setError(err.message)
    }
  }

  // Get switches and routers for port management (sorted by name)
  const switches = devices
    .filter(d => d.deviceType === 'switch' || d.deviceType === 'router')
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  const selectedSwitch = switches.find(s => s._id === selectedSwitchId)
  
  // Get non-switch/router devices for port assignment, sorted by IP
  // Devices assignable to switch ports - exclude current switch/router but allow other switches
  const assignableDevices = devices
    .filter(d => (d.deviceType !== 'switch' && d.deviceType !== 'router') || d._id !== selectedSwitchId)
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
        state: formData.state,
        postcode: formData.postcode,
        projectManager: formData.projectManager,
        siteLead: formData.siteLead,
        sharePointLink: formData.sharePointLink,
        skytunnelLink: formData.skytunnelLink,
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

  // Handle project updates from device saves (e.g., skytunnel link from Inception)
  const handleProjectUpdate = (updates: { skytunnelLink?: string }) => {
    if (updates.skytunnelLink) {
      const updatedProject = { ...project, skytunnelLink: updates.skytunnelLink }
      setFormData(prev => ({ ...prev, skytunnelLink: updates.skytunnelLink }))
      onProjectUpdated(updatedProject)
    }
  }

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
      'completed': { bg: '#d1fae5', text: '#065f46' },
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
                <label>Description</label>
                <input
                  type="text"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief project description or notes"
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
                  <option value="completed">Completed</option>
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

              <div className="form-group" style={{ margin: 0 }}>
                <label>State</label>
                <select
                  value={formData.state || ''}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                >
                  <option value="">Select State</option>
                  <option value="NSW">NSW</option>
                  <option value="VIC">VIC</option>
                  <option value="QLD">QLD</option>
                  <option value="WA">WA</option>
                  <option value="SA">SA</option>
                  <option value="TAS">TAS</option>
                  <option value="ACT">ACT</option>
                  <option value="NT">NT</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Postcode</label>
                <input
                  type="text"
                  value={formData.postcode || ''}
                  onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                  maxLength={4}
                  placeholder="e.g. 2000"
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>👔 Project Manager</label>
                <select
                  value={formData.projectManager?.userId || ''}
                  onChange={(e) => {
                    const selectedUser = projectManagers.find(u => u._id === e.target.value)
                    setFormData({
                      ...formData,
                      projectManager: selectedUser 
                        ? { userId: selectedUser._id, name: selectedUser.name, phone: selectedUser.phone || '' }
                        : { userId: undefined, name: '', phone: '' }
                    })
                  }}
                >
                  <option value="">-- Select Project Manager --</option>
                  {projectManagers.map(pm => (
                    <option key={pm._id} value={pm._id}>{pm.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>👔 PM Phone</label>
                <input
                  type="tel"
                  value={formData.projectManager?.phone || ''}
                  onChange={(e) => setFormData({ ...formData, projectManager: { ...formData.projectManager, phone: e.target.value } })}
                  placeholder="Auto-filled or manual entry"
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>🦺 Site Lead</label>
                <select
                  value={formData.siteLead?.userId || ''}
                  onChange={(e) => {
                    const selectedUser = allStaff.find(u => u._id === e.target.value)
                    setFormData({
                      ...formData,
                      siteLead: selectedUser 
                        ? { userId: selectedUser._id, name: selectedUser.name, phone: selectedUser.phone || '' }
                        : { userId: undefined, name: '', phone: '' }
                    })
                  }}
                >
                  <option value="">-- Select Site Lead --</option>
                  {allStaff
                    .filter(staff => ['tech', 'project-manager', 'admin'].includes(staff.role))
                    .map(staff => (
                      <option key={staff._id} value={staff._id}>{staff.name}</option>
                    ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>🦺 Site Lead Phone</label>
                <input
                  type="tel"
                  value={formData.siteLead?.phone || ''}
                  onChange={(e) => setFormData({ ...formData, siteLead: { ...formData.siteLead, phone: e.target.value } })}
                  placeholder="Auto-filled or manual entry"
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>📁 SharePoint/OneDrive Link</label>
                <input
                  type="url"
                  value={formData.sharePointLink || ''}
                  onChange={(e) => setFormData({ ...formData, sharePointLink: e.target.value })}
                  placeholder="https://company.sharepoint.com/..."
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>🔗 Skytunnel Link</label>
                <input
                  type="url"
                  value={formData.skytunnelLink || ''}
                  onChange={(e) => setFormData({ ...formData, skytunnelLink: e.target.value })}
                  placeholder="https://skytunnel.com/..."
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
            {/* Project Details Section - Collapsible */}
            <div style={{ marginBottom: '1rem' }}>
              <div 
                onClick={() => setSectionsExpanded(prev => ({ ...prev, projectDetails: !prev.projectDetails }))}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  padding: '0.5rem 0',
                  borderBottom: '1px solid #e5e7eb',
                  marginBottom: sectionsExpanded.projectDetails ? '1rem' : 0,
                }}
              >
                <h4 style={{ margin: 0, color: '#374151', fontSize: '0.95rem' }}>📋 Project Details</h4>
                <span style={{ color: '#6b7280', fontSize: '1.2rem' }}>{sectionsExpanded.projectDetails ? '▼' : '▶'}</span>
              </div>
              
              {sectionsExpanded.projectDetails && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem' }}>
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
                    <p style={{ fontWeight: 600, margin: 0 }}>
                      {project.address || 'N/A'}
                      {(project.state || project.postcode) && (
                        <span style={{ fontWeight: 400, color: '#6b7280' }}>
                          {project.state ? `, ${project.state}` : ''}{project.postcode ? ` ${project.postcode}` : ''}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Team Contacts Section - Collapsible */}
            {(project.projectManager?.name || project.siteLead?.name) && (
              <div style={{ marginBottom: '1rem' }}>
                <div 
                  onClick={() => setSectionsExpanded(prev => ({ ...prev, teamContacts: !prev.teamContacts }))}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    padding: '0.5rem 0',
                    borderBottom: '1px solid #e5e7eb',
                    marginBottom: sectionsExpanded.teamContacts ? '1rem' : 0,
                  }}
                >
                  <h4 style={{ margin: 0, color: '#374151', fontSize: '0.95rem' }}>👥 Team Contacts</h4>
                  <span style={{ color: '#6b7280', fontSize: '1.2rem' }}>{sectionsExpanded.teamContacts ? '▼' : '▶'}</span>
                </div>
                
                {sectionsExpanded.teamContacts && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem', padding: '1rem', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                    {project.projectManager?.name && (
                      <div>
                        <p style={{ color: '#166534', fontSize: '0.85rem', marginBottom: '0.25rem' }}>👔 Project Manager</p>
                        <p style={{ fontWeight: 600, margin: 0, color: '#166534' }}>{project.projectManager.name}</p>
                        {project.projectManager.phone && (
                          <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
                            <a href={`tel:${project.projectManager.phone}`} style={{ color: '#15803d' }}>{project.projectManager.phone}</a>
                          </p>
                        )}
                      </div>
                    )}
                    {project.siteLead?.name && (
                      <div>
                        <p style={{ color: '#166534', fontSize: '0.85rem', marginBottom: '0.25rem' }}>🦺 Site Lead</p>
                        <p style={{ fontWeight: 600, margin: 0, color: '#166534' }}>{project.siteLead.name}</p>
                        {project.siteLead.phone && (
                          <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
                            <a href={`tel:${project.siteLead.phone}`} style={{ color: '#15803d' }}>{project.siteLead.phone}</a>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Quick Links Section */}
            {(project.sharePointLink || project.skytunnelLink || currentUser?.role === 'admin') && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div 
                  onClick={() => setQuickLinksExpanded(!quickLinksExpanded)}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem', 
                    cursor: 'pointer',
                    marginBottom: quickLinksExpanded ? '1rem' : 0,
                    padding: '0.5rem 0',
                  }}
                >
                  <span style={{ color: '#6b7280' }}>{quickLinksExpanded ? '▼' : '▶'}</span>
                  <h3 style={{ margin: 0, fontSize: '1rem', color: '#374151' }}>🔗 Quick Links</h3>
                </div>
                
                {quickLinksExpanded && (
                  <>
                    {/* SharePoint/OneDrive Link */}
                    {project.sharePointLink && (
                      <div 
                        className="sharepoint-bar"
                        style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem',
                  marginBottom: '1.5rem',
                  padding: '0.75rem 1rem',
                  background: '#eff6ff',
                  borderRadius: '8px',
                  border: '1px solid #bfdbfe',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>📁</span>
                <a 
                  href={project.sharePointLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ 
                    flex: 1,
                    minWidth: '150px',
                    color: '#1e40af', 
                    fontWeight: 600,
                    fontSize: '1rem',
                    textDecoration: 'none',
                  }}
                >
                  {project.name} OneDrive Link
                </a>
                <div className="sharepoint-buttons" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={async (e) => {
                      e.preventDefault()
                      try {
                        await navigator.clipboard.writeText(project.sharePointLink)
                        setCopyFeedback('link')
                        setTimeout(() => setCopyFeedback(null), 2000)
                      } catch (err) {
                        // Fallback
                        const textarea = document.createElement('textarea')
                        textarea.value = project.sharePointLink
                        document.body.appendChild(textarea)
                        textarea.select()
                        document.execCommand('copy')
                        document.body.removeChild(textarea)
                        setCopyFeedback('link')
                        setTimeout(() => setCopyFeedback(null), 2000)
                      }
                    }}
                    style={{
                      padding: '0.5rem 0.75rem',
                      background: copyFeedback === 'link' ? '#10b981' : '#e5e7eb',
                      color: copyFeedback === 'link' ? 'white' : '#374151',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.25rem',
                      transition: 'all 0.2s',
                      flex: 1,
                      minWidth: '70px',
                    }}
                    title="Copy link"
                  >
                    {copyFeedback === 'link' ? '✓ Copied!' : '📋 Copy'}
                  </button>
                  <button
                    onClick={() => setShowSharePointQR(true)}
                    style={{
                      padding: '0.5rem 0.75rem',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.25rem',
                      flex: 1,
                      minWidth: '60px',
                    }}
                    title="Show QR code"
                  >
                    📱 QR
                  </button>
                  <a
                    href={project.sharePointLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '0.5rem 0.75rem',
                      background: '#0078d4',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.25rem',
                      flex: 1,
                      minWidth: '60px',
                    }}
                    title="Open in new tab"
                  >
                    🔗 Open
                  </a>
                </div>
              </div>
            )}

            {/* Skytunnel Link */}
            {project.skytunnelLink && (
              <div 
                className="skytunnel-bar"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem',
                  marginBottom: '1.5rem',
                  padding: '0.75rem 1rem',
                  background: '#f5f3ff',
                  borderRadius: '8px',
                  border: '1px solid #c4b5fd',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>🔗</span>
                <a 
                  href={project.skytunnelLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ 
                    flex: 1,
                    minWidth: '150px',
                    color: '#6d28d9', 
                    fontWeight: 600,
                    fontSize: '1rem',
                    textDecoration: 'none',
                  }}
                >
                  {project.name} - Skytunnel Link
                </a>
                <div className="skytunnel-buttons" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={async (e) => {
                      e.preventDefault()
                      try {
                        await navigator.clipboard.writeText(project.skytunnelLink)
                        setCopyFeedback('skytunnel')
                        setTimeout(() => setCopyFeedback(null), 2000)
                      } catch (err) {
                        const textarea = document.createElement('textarea')
                        textarea.value = project.skytunnelLink
                        document.body.appendChild(textarea)
                        textarea.select()
                        document.execCommand('copy')
                        document.body.removeChild(textarea)
                        setCopyFeedback('skytunnel')
                        setTimeout(() => setCopyFeedback(null), 2000)
                      }
                    }}
                    style={{
                      padding: '0.5rem 0.75rem',
                      background: copyFeedback === 'skytunnel' ? '#10b981' : '#e5e7eb',
                      color: copyFeedback === 'skytunnel' ? 'white' : '#374151',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.25rem',
                      transition: 'all 0.2s',
                      flex: 1,
                      minWidth: '70px',
                    }}
                    title="Copy link"
                  >
                    {copyFeedback === 'skytunnel' ? '✓ Copied!' : '📋 Copy'}
                  </button>
                  <button
                    onClick={() => setShowSkytunnelQR(true)}
                    style={{
                      padding: '0.5rem 0.75rem',
                      background: '#7c3aed',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.25rem',
                      flex: 1,
                      minWidth: '60px',
                    }}
                    title="Show QR code"
                  >
                    📱 QR
                  </button>
                  <a
                    href={project.skytunnelLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '0.5rem 0.75rem',
                      background: '#6d28d9',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.25rem',
                      flex: 1,
                      minWidth: '60px',
                    }}
                    title="Open in new tab"
                  >
                    🔗 Open
                  </a>
                </div>
              </div>
            )}

                    {/* Client Access Link */}
                    {currentUser?.role === 'admin' && (
                      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0 }}>🔗 Client Access Link</p>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={clientAccess.enabled}
                      onChange={(e) => toggleClientAccess(e.target.checked)}
                      disabled={clientAccessLoading}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.85rem', color: clientAccess.enabled ? '#059669' : '#6b7280' }}>
                      {clientAccess.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                </div>
                
                {clientAccess.enabled && clientAccess.token && (
                  <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: '1rem', border: '1px solid #bbf7d0' }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem', 
                      marginBottom: '0.75rem',
                      padding: '0.5rem',
                      background: 'white',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontFamily: 'monospace',
                      wordBreak: 'break-all',
                    }}>
                      {getClientAccessUrl()}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(getClientAccessUrl())
                            setCopyFeedback('clientLink')
                            setTimeout(() => setCopyFeedback(null), 2000)
                          } catch {
                            const textarea = document.createElement('textarea')
                            textarea.value = getClientAccessUrl()
                            document.body.appendChild(textarea)
                            textarea.select()
                            document.execCommand('copy')
                            document.body.removeChild(textarea)
                            setCopyFeedback('clientLink')
                            setTimeout(() => setCopyFeedback(null), 2000)
                          }
                        }}
                        style={{
                          padding: '0.5rem 0.75rem',
                          background: copyFeedback === 'clientLink' ? '#10b981' : '#059669',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                        }}
                      >
                        {copyFeedback === 'clientLink' ? '✓ Copied!' : '📋 Copy Link'}
                      </button>
                      <button
                        onClick={regenerateClientToken}
                        disabled={clientAccessLoading}
                        style={{
                          padding: '0.5rem 0.75rem',
                          background: '#f59e0b',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                        }}
                        title="Generate a new link (invalidates old link)"
                      >
                        🔄 New Link
                      </button>
                      <a
                        href={getClientAccessUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: '0.5rem 0.75rem',
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          textDecoration: 'none',
                        }}
                      >
                        🔗 Preview
                      </a>
                    </div>
                    
                    {/* PIN Setting */}
                    <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #bbf7d0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', color: '#166534' }}>🔐 PIN Protection:</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={clientAccessPin}
                          onChange={(e) => setClientAccessPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="Optional 4-6 digit PIN"
                          maxLength={6}
                          style={{
                            padding: '0.375rem 0.5rem',
                            border: '1px solid #86efac',
                            borderRadius: '4px',
                            width: '140px',
                            fontSize: '0.85rem',
                          }}
                        />
                        <button
                          onClick={saveClientAccessPin}
                          disabled={clientAccessLoading}
                          style={{
                            padding: '0.375rem 0.75rem',
                            background: '#166534',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                          }}
                        >
                          Save
                        </button>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: '#166534', margin: '0.5rem 0 0', opacity: 0.8 }}>
                        {clientAccess.pin ? `Current PIN: ${clientAccess.pin}` : 'No PIN set - anyone with the link can access'}
                      </p>
                    </div>
                    
                    {clientAccess.lastAccessed && (
                      <p style={{ fontSize: '0.75rem', color: '#166534', margin: '0.75rem 0 0', opacity: 0.7 }}>
                        Last accessed: {new Date(clientAccess.lastAccessed).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
                
                {!clientAccess.enabled && (
                  <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: 0 }}>
                    Enable to generate a shareable link for clients to view their system profile
                  </p>
                )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* WiFi Networks in Header */}
            {allWifiNetworks.length > 0 && (
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0 }}>📶 WiFi Networks</p>
                  <button
                    onClick={() => setShowViewWifiPasswords(!showViewWifiPasswords)}
                    style={{ padding: '0.2rem 0.5rem', background: 'transparent', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', color: '#6b7280' }}
                    title={showViewWifiPasswords ? 'Hide passwords' : 'Show passwords'}
                  >
                    {showViewWifiPasswords ? '🙈 Hide' : '👁️ Show'}
                  </button>
                </div>
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
                      <code style={{ background: '#e0f2fe', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                        {wifi.password ? (showViewWifiPasswords ? wifi.password : '••••••••') : '(open)'}
                      </code>
                      {wifi.password && (
                        <>
                          <button
                            onClick={(e) => copyToClipboard(wifi.password, e)}
                            style={{ padding: '0.15rem 0.35rem', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}
                            title="Copy password"
                          >
                            📋
                          </button>
                          <button
                            onClick={() => setQrWifi(wifi)}
                            style={{ padding: '0.15rem 0.35rem', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}
                            title="Show QR code"
                          >
                            📱
                          </button>
                        </>
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
      <div className="tabs-container" style={{ borderBottom: '2px solid #e5e7eb', marginBottom: '1.5rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div className="tabs" style={{ display: 'flex', gap: '0', minWidth: 'max-content' }}>
          {[
            { id: 'devices', label: '🎛️ Devices' },
            { id: 'tasks', label: '📋 Tasks' },
            { id: 'wifi', label: '📶 WiFi' },
            { id: 'ports', label: '🔌 Ports' },
            { id: 'notes', label: '📝 Notes' },
            { id: 'history', label: '📜 History' },
          ].map(tab => (
            <button
              key={tab.id}
              className="tab-btn"
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
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'devices' && (
        <DeviceList 
          projectId={project._id} 
          onDevicesChanged={loadDevices} 
          onProjectUpdate={handleProjectUpdate}
        />
      )}

      {activeTab === 'tasks' && (
        <div className="card">
          <TaskList projectId={project._id} />
        </div>
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
                <button className="btn btn-primary btn-sm" onClick={handleAddWifi}>💾 Save</button>
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
                            <>
                              <button onClick={(e) => copyToClipboard(wifi.password, e)}
                                style={{ marginLeft: '0.5rem', padding: '0.1rem 0.3rem', background: 'transparent', border: 'none', cursor: 'pointer' }}
                                title="Copy password">
                                📋
                              </button>
                              <button onClick={() => setQrWifi(wifi)}
                                style={{ padding: '0.1rem 0.3rem', background: 'transparent', border: 'none', cursor: 'pointer' }}
                                title="Show QR code">
                                📱
                              </button>
                            </>
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
                        <option key={sw._id} value={sw._id}>
                          {sw.name} ({sw.deviceType === 'router' ? (sw.lanPorts || 4) : (sw.portCount || 24)} ports)
                        </option>
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
              <p>No switches or routers in this project.</p>
              <p>Add a switch or router to manage port assignments.</p>
            </div>
          ) : selectedSwitch ? (
            <div>
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f3f4f6', borderRadius: '6px' }}>
                <strong>{selectedSwitch.name}</strong> • {selectedSwitch.manufacturer} {selectedSwitch.model}
                {selectedSwitch.ipAddress && <span> • IP: {selectedSwitch.ipAddress}</span>}
                <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: '#6b7280' }}>
                  ({selectedSwitch.deviceType === 'router' ? (selectedSwitch.lanPorts || 4) : (selectedSwitch.portCount || 24)} ports)
                </span>
              </div>

              {/* VLAN Legend */}
              {(() => {
                const usedVlans = new Set<number>()
                const portCount = selectedSwitch.deviceType === 'router' ? (selectedSwitch.lanPorts || 4) : (selectedSwitch.portCount || 24)
                Array.from({ length: portCount }, (_, i) => i + 1).forEach(portNum => {
                  const device = getDeviceOnPort(portNum)
                  if (device?.vlan) usedVlans.add(device.vlan)
                })
                if (usedVlans.size > 0) {
                  const vlanColors: Record<number, { bg: string; border: string; text: string }> = {
                    1: { bg: '#ecfdf5', border: '#10b981', text: '#059669' },   // Green - Default/Management
                    10: { bg: '#eff6ff', border: '#3b82f6', text: '#2563eb' },  // Blue
                    20: { bg: '#fef2f2', border: '#ef4444', text: '#dc2626' },  // Red - Cameras
                    30: { bg: '#fefce8', border: '#eab308', text: '#ca8a04' },  // Yellow
                    40: { bg: '#f5f3ff', border: '#8b5cf6', text: '#7c3aed' },  // Purple
                    50: { bg: '#fdf4ff', border: '#d946ef', text: '#c026d3' },  // Pink
                    60: { bg: '#fff7ed', border: '#f97316', text: '#ea580c' },  // Orange
                    100: { bg: '#f0fdfa', border: '#14b8a6', text: '#0d9488' }, // Teal
                  }
                  const getVlanColor = (vlan: number) => {
                    if (vlanColors[vlan]) return vlanColors[vlan]
                    // Generate color based on vlan number for unlisted VLANs
                    const hue = (vlan * 137) % 360
                    return { bg: `hsl(${hue}, 70%, 95%)`, border: `hsl(${hue}, 70%, 50%)`, text: `hsl(${hue}, 70%, 35%)` }
                  }
                  return (
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>VLANs:</span>
                      {Array.from(usedVlans).sort((a, b) => a - b).map(vlan => {
                        const colors = getVlanColor(vlan)
                        return (
                          <span key={vlan} style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: colors.bg,
                            border: `1px solid ${colors.border}`,
                            color: colors.text,
                          }}>
                            VLAN {vlan}
                          </span>
                        )
                      })}
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        background: '#f3f4f6',
                        border: '1px solid #e5e7eb',
                        color: '#6b7280',
                      }}>
                        Unassigned
                      </span>
                    </div>
                  )
                }
                return null
              })()}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                {Array.from({ length: selectedSwitch.deviceType === 'router' ? (selectedSwitch.lanPorts || 4) : (selectedSwitch.portCount || 24) }, (_, i) => i + 1).map(portNum => {
                  const assignedDevice = getDeviceOnPort(portNum)
                  
                  // VLAN color scheme
                  const vlanColors: Record<number, { bg: string; border: string; text: string }> = {
                    1: { bg: '#ecfdf5', border: '#10b981', text: '#059669' },   // Green - Default/Management
                    10: { bg: '#eff6ff', border: '#3b82f6', text: '#2563eb' },  // Blue
                    20: { bg: '#fef2f2', border: '#ef4444', text: '#dc2626' },  // Red - Cameras
                    30: { bg: '#fefce8', border: '#eab308', text: '#ca8a04' },  // Yellow
                    40: { bg: '#f5f3ff', border: '#8b5cf6', text: '#7c3aed' },  // Purple
                    50: { bg: '#fdf4ff', border: '#d946ef', text: '#c026d3' },  // Pink
                    60: { bg: '#fff7ed', border: '#f97316', text: '#ea580c' },  // Orange
                    100: { bg: '#f0fdfa', border: '#14b8a6', text: '#0d9488' }, // Teal
                  }
                  const getVlanColor = (vlan: number) => {
                    if (vlanColors[vlan]) return vlanColors[vlan]
                    const hue = (vlan * 137) % 360
                    return { bg: `hsl(${hue}, 70%, 95%)`, border: `hsl(${hue}, 70%, 50%)`, text: `hsl(${hue}, 70%, 35%)` }
                  }
                  
                  const colors = assignedDevice?.vlan 
                    ? getVlanColor(assignedDevice.vlan)
                    : { bg: 'white', border: '#e5e7eb', text: '#6b7280' }
                  
                  return (
                    <div 
                      key={portNum}
                      style={{
                        padding: '0.75rem',
                        border: '2px solid',
                        borderColor: colors.border,
                        borderRadius: '6px',
                        background: colors.bg,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <strong style={{ color: colors.text }}>
                          Port {portNum}
                        </strong>
                        {assignedDevice && (
                          <span style={{ 
                            fontSize: '0.7rem', 
                            color: colors.text,
                            background: `${colors.border}20`,
                            padding: '0.125rem 0.375rem',
                            borderRadius: '3px',
                            fontWeight: 600,
                          }}>
                            VLAN {assignedDevice.vlan || 1}
                          </span>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>📝 Project Notes</h3>
            <button className="btn btn-secondary btn-sm" onClick={loadNotes} disabled={loadingNotes}>
              {loadingNotes ? '🔄 Loading...' : '🔄 Refresh'}
            </button>
          </div>

          {/* Add new note */}
          <div style={{ 
            padding: '1rem', 
            background: '#f0f9ff', 
            borderRadius: '8px', 
            marginBottom: '1.5rem',
            border: '1px solid #bae6fd',
          }}>
            <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
              ➕ Add a Note
            </label>
            <textarea
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              rows={3}
              placeholder="Type your note here... (will be timestamped automatically)"
              style={{ width: '100%', fontFamily: 'inherit', marginBottom: '0.5rem' }}
              disabled={addingNote}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-primary"
                onClick={handleAddNote}
                disabled={addingNote || !newNoteText.trim()}
              >
                {addingNote ? '⏳ Adding...' : '📝 Add Note'}
              </button>
            </div>
          </div>

          {/* Notes timeline */}
          {loadingNotes ? (
            <p>Loading notes...</p>
          ) : noteEntries.length === 0 ? (
            <p style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>
              No notes yet. Add the first note above!
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {noteEntries
                .slice()
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((note) => (
                  <div
                    key={note._id}
                    style={{
                      padding: '1rem',
                      background: '#f9fafb',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      position: 'relative',
                    }}
                  >
                    {/* Header with user and timestamp */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'flex-start',
                      marginBottom: '0.5rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ 
                          background: '#3b82f6', 
                          color: 'white', 
                          padding: '0.25rem 0.5rem', 
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                        }}>
                          👤 {note.createdBy?.name || 'Unknown'}
                        </span>
                        <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                          {new Date(note.createdAt).toLocaleDateString('en-AU', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })} at {new Date(note.createdAt).toLocaleTimeString('en-AU', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      
                      {/* Delete button - only show for note creator or admin */}
                      {(currentUser?.role === 'admin' || currentUser?._id === note.createdBy?._id) && (
                        <button
                          onClick={() => handleDeleteNote(note._id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#9ca3af',
                            padding: '0.25rem',
                            fontSize: '0.9rem',
                          }}
                          title="Delete note"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                    
                    {/* Note text */}
                    <div style={{ 
                      whiteSpace: 'pre-wrap', 
                      color: '#374151',
                      lineHeight: 1.6,
                    }}>
                      {note.text}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Legacy notes section - only show if there are legacy notes */}
          {formData.notes && (
            <div style={{ 
              marginTop: '2rem', 
              padding: '1rem', 
              background: '#fefce8', 
              borderRadius: '8px',
              border: '1px solid #fde047',
            }}>
              <h4 style={{ margin: '0 0 0.5rem', color: '#854d0e' }}>📋 Legacy Notes</h4>
              <p style={{ fontSize: '0.85rem', color: '#a16207', marginBottom: '0.5rem' }}>
                These notes were saved before the timestamped notes feature. They are preserved here for reference.
              </p>
              <div style={{ 
                whiteSpace: 'pre-wrap', 
                background: 'white', 
                padding: '0.75rem', 
                borderRadius: '4px',
                color: '#374151',
              }}>
                {formData.notes}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>📜 Version History</h3>
            <button className="btn btn-secondary btn-sm" onClick={loadVersions} disabled={loadingVersions}>
              {loadingVersions ? '🔄 Loading...' : '🔄 Refresh'}
            </button>
          </div>

          <p style={{ color: '#666', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Showing the last 5 versions. Each project save creates a new version that can be restored.
          </p>

          {loadingVersions ? (
            <p>Loading version history...</p>
          ) : versions.length === 0 ? (
            <p style={{ color: '#666' }}>No version history yet. Versions are created when the project is updated.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {versions.map((version, index) => (
                <div
                  key={version._id}
                  style={{
                    padding: '1rem',
                    background: index === 0 ? '#f0fdf4' : '#f9fafb',
                    border: `1px solid ${index === 0 ? '#bbf7d0' : '#e5e7eb'}`,
                    borderRadius: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          background: index === 0 ? '#10b981' : '#6b7280',
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}>
                          v{version.versionNumber}
                        </span>
                        {index === 0 && (
                          <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 500 }}>
                            Most Recent
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '0 0 0.25rem', fontWeight: 500 }}>
                        {version.changeDescription}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>
                        {new Date(version.createdAt).toLocaleString()} by {version.createdBy?.name || 'Unknown'}
                      </p>
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
                        <span>📋 {version.snapshot.devices?.length || 0} devices</span>
                        <span style={{ marginLeft: '1rem' }}>📶 {version.snapshot.wifiNetworks?.length || 0} WiFi networks</span>
                        <span style={{ marginLeft: '1rem' }}>Status: {version.snapshot.status}</span>
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleRollback(version._id, version.versionNumber)}
                      disabled={rollingBack}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {rollingBack ? '⏳ Restoring...' : '⏪ Restore'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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

      {/* WiFi QR Code Modal */}
      {qrWifi && (
        <div className="modal-overlay" onClick={() => setQrWifi(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>📱 WiFi QR Code</h3>
              <button className="close-btn" onClick={() => setQrWifi(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '2rem' }}>
              <p style={{ marginBottom: '1rem', fontWeight: 600 }}>{qrWifi.name}</p>
              
              {/* QR Code using Google Charts API */}
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`WIFI:T:WPA;S:${qrWifi.name};P:${qrWifi.password};;`)}`}
                alt="WiFi QR Code"
                style={{ 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '8px',
                  padding: '1rem',
                  background: 'white',
                }}
              />
              
              <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#6b7280' }}>
                Scan with your phone camera to connect
              </p>
              
              <div style={{ 
                marginTop: '1rem', 
                padding: '0.75rem', 
                background: '#f3f4f6', 
                borderRadius: '6px',
                fontSize: '0.85rem',
              }}>
                <strong>Network:</strong> {qrWifi.name}<br />
                <strong>Password:</strong> {qrWifi.password}<br />
                <strong>Security:</strong> WPA/WPA2
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setQrWifi(null)}>Close</button>
              <button 
                className="btn btn-primary"
                onClick={(e) => {
                  copyToClipboard(qrWifi.password, e)
                }}
              >
                📋 Copy Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SharePoint QR Code Modal */}
      {showSharePointQR && project.sharePointLink && (
        <div className="modal-overlay" onClick={() => setShowSharePointQR(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header" style={{ background: '#eff6ff' }}>
              <h3>📁 SharePoint / OneDrive</h3>
              <button className="close-btn" onClick={() => setShowSharePointQR(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '2rem' }}>
              <p style={{ marginBottom: '1rem', fontWeight: 600, color: '#1e40af' }}>
                {project.name} - Project Files
              </p>
              
              {/* QR Code */}
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(project.sharePointLink)}`}
                alt="SharePoint QR Code"
                style={{ 
                  border: '2px solid #bfdbfe', 
                  borderRadius: '12px',
                  padding: '1rem',
                  background: 'white',
                }}
              />
              
              <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#6b7280' }}>
                Scan to open project files on your device
              </p>
              
              <div style={{ 
                marginTop: '1rem', 
                padding: '0.75rem', 
                background: '#f0f9ff', 
                borderRadius: '6px',
                fontSize: '0.8rem',
                wordBreak: 'break-all',
                color: '#1e40af',
                border: '1px solid #bfdbfe',
              }}>
                {project.sharePointLink}
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setShowSharePointQR(false)}>Close</button>
              <button 
                className="btn btn-primary"
                style={{ 
                  background: copyFeedback === 'modal' ? '#10b981' : '#3b82f6',
                  transition: 'background 0.2s',
                }}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(project.sharePointLink)
                    setCopyFeedback('modal')
                    setTimeout(() => setCopyFeedback(null), 2000)
                  } catch (err) {
                    const textarea = document.createElement('textarea')
                    textarea.value = project.sharePointLink
                    document.body.appendChild(textarea)
                    textarea.select()
                    document.execCommand('copy')
                    document.body.removeChild(textarea)
                    setCopyFeedback('modal')
                    setTimeout(() => setCopyFeedback(null), 2000)
                  }
                }}
              >
                {copyFeedback === 'modal' ? '✓ Copied!' : '📋 Copy Link'}
              </button>
              <a
                href={project.sharePointLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ 
                  background: '#0078d4',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                🔗 Open
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Skytunnel QR Code Modal */}
      {showSkytunnelQR && project.skytunnelLink && (
        <div className="modal-overlay" onClick={() => setShowSkytunnelQR(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header" style={{ background: '#f5f3ff' }}>
              <h3>🔗 Skytunnel</h3>
              <button className="close-btn" onClick={() => setShowSkytunnelQR(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '2rem' }}>
              <p style={{ marginBottom: '1rem', fontWeight: 600, color: '#6d28d9' }}>
                {project.name} - Skytunnel Access
              </p>
              
              {/* QR Code */}
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(project.skytunnelLink)}`}
                alt="Skytunnel QR Code"
                style={{ 
                  border: '2px solid #c4b5fd', 
                  borderRadius: '12px',
                  padding: '1rem',
                  background: 'white',
                }}
              />
              
              <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#6b7280' }}>
                Scan to access Skytunnel on your device
              </p>
              
              <div style={{ 
                marginTop: '1rem', 
                padding: '0.75rem', 
                background: '#f5f3ff', 
                borderRadius: '6px',
                fontSize: '0.8rem',
                wordBreak: 'break-all',
                color: '#6d28d9',
                border: '1px solid #c4b5fd',
              }}>
                {project.skytunnelLink}
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setShowSkytunnelQR(false)}>Close</button>
              <button 
                className="btn btn-primary"
                style={{ 
                  background: copyFeedback === 'skytunnelModal' ? '#10b981' : '#7c3aed',
                  transition: 'background 0.2s',
                }}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(project.skytunnelLink)
                    setCopyFeedback('skytunnelModal')
                    setTimeout(() => setCopyFeedback(null), 2000)
                  } catch (err) {
                    const textarea = document.createElement('textarea')
                    textarea.value = project.skytunnelLink
                    document.body.appendChild(textarea)
                    textarea.select()
                    document.execCommand('copy')
                    document.body.removeChild(textarea)
                    setCopyFeedback('skytunnelModal')
                    setTimeout(() => setCopyFeedback(null), 2000)
                  }
                }}
              >
                {copyFeedback === 'skytunnelModal' ? '✓ Copied!' : '📋 Copy Link'}
              </button>
              <a
                href={project.skytunnelLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ 
                  background: '#6d28d9',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                🔗 Open
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Client Access Re-enable Warning Modal */}
      {showClientAccessWarning && (
        <div className="modal-overlay" onClick={() => setShowClientAccessWarning(false)}>
          <div 
            className="modal" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '450px' }}
          >
            <div className="modal-header">
              <h2>⚠️ Re-enable Client Access?</h2>
              <button className="close-btn" onClick={() => setShowClientAccessWarning(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '1rem' }}>
                Client access was previously disabled. Re-enabling will generate a <strong>new link</strong>.
              </p>
              <p style={{ color: '#dc2626', marginBottom: '1.5rem' }}>
                The old link will no longer work. Make sure to share the new link with your client.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => setShowClientAccessWarning(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => updateClientAccess(true)}
                  className="btn btn-primary"
                  disabled={clientAccessLoading}
                  style={{ flex: 1, background: '#059669' }}
                >
                  {clientAccessLoading ? 'Enabling...' : '✓ Enable & Generate New Link'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProjectDetail
