import { useState, useEffect } from 'react'
import { Device, DeviceCategory, DeviceType, DEVICE_TYPE_OPTIONS, BRAND_OPTIONS } from '../types'
import { devicesAPI } from '../services/apiService'

interface DeviceModalProps {
  projectId: string
  device: Device | null
  onClose: () => void
  onDeviceCreated: (device: Device) => void
  onDeviceDeleted: (deviceId: string) => void
  existingDevices?: Device[]
  viewOnly?: boolean
}

interface SwitchInfo {
  _id: string
  name: string
  portCount: number
  managedPorts: { portNumber: number; assignedDevice?: string; description?: string }[]
}

const INITIAL_FORM_DATA: Partial<Device> = {
  name: '',
  category: 'network',
  deviceType: 'switch',
  manufacturer: '',
  model: '',
  serialNumber: '',
  macAddress: '',
  ipAddress: '',
  vlan: 1,
  username: '',
  password: '',
  hideCredentials: false,
  location: '',
  room: '',
  status: 'not-installed',
  configNotes: '',
  portCount: 24,
  poeType: 'at',
  wanProtocol: 'dhcp',
  panelType: '',
  zoneCount: 0,
  controlBrand: '',
  lightingBrand: '',
  controlMethod: 'ip',
}

// Default device names by type
const getDefaultDeviceName = (deviceType: string, existingCount: number) => {
  const names: Record<string, string> = {
    'router': 'Router',
    'switch': 'Switch',
    'access-point': 'WAP',
    'camera': 'Camera',
    'nvr': 'NVR',
    'dvr': 'DVR',
    'alarm-panel': 'Alarm Panel',
    'keypad': 'Keypad',
    'door-controller': 'Door Controller',
    'control-processor': 'Processor',
    'touch-panel': 'Touch Panel',
    'secondary-processor': 'Secondary Processor',
    'door-station': 'Door Station',
    'remote': 'Remote',
    'lighting-gateway': 'Lighting Gateway',
    'dimmer': 'Dimmer',
    'relay-pack': 'Relay Pack',
    'receiver': 'AV Receiver',
    'tv': 'TV',
    'projector': 'Projector',
    'audio-matrix': 'Audio Matrix',
    'amplifier': 'Amplifier',
    'soundbar': 'Soundbar',
    'media-player': 'Media Player',
    'fan': 'Fan',
    'irrigation': 'Irrigation',
    'hvac': 'HVAC',
    'relay': 'Relay',
    'fireplace': 'Fireplace',
    'shade': 'Shade',
    'pool': 'Pool Controller',
    'generic': 'Device',
  }
  const baseName = names[deviceType] || 'Device'
  return `${baseName}${existingCount + 1}`
}

export const DeviceModal: React.FC<DeviceModalProps> = ({
  projectId,
  device,
  onClose,
  onDeviceCreated,
  onDeviceDeleted,
  existingDevices = [],
  viewOnly = false,
}) => {
  const [formData, setFormData] = useState<Partial<Device>>(device || { ...INITIAL_FORM_DATA, projectId })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [ipConflict, setIpConflict] = useState<string | null>(null)
  const [autoAssignIP, setAutoAssignIP] = useState(!device)
  
  // Bulk add
  const [quantity, setQuantity] = useState(1)
  const [bulkMode, setBulkMode] = useState(false)
  
  // Switch port binding
  const [switches, setSwitches] = useState<SwitchInfo[]>([])
  const [selectedSwitch, setSelectedSwitch] = useState<string>('')
  const [selectedPort, setSelectedPort] = useState<number | ''>('')
  const [portWarning, setPortWarning] = useState<string | null>(null)

  // Get device types for selected category
  const deviceTypes = DEVICE_TYPE_OPTIONS[formData.category as DeviceCategory] || []

  // Load switches for port binding
  useEffect(() => {
    const loadSwitches = async () => {
      const switchDevices = existingDevices.filter(d => d.deviceType === 'switch')
      setSwitches(switchDevices.map(s => ({
        _id: s._id,
        name: s.name,
        portCount: s.portCount || 24,
        managedPorts: s.managedPorts || []
      })))
    }
    loadSwitches()
  }, [existingDevices])

  // Update device type and name when category changes
  useEffect(() => {
    if (!device) {
      const types = DEVICE_TYPE_OPTIONS[formData.category as DeviceCategory]
      if (types && types.length > 0) {
        const newType = types[0].value
        const existingCount = existingDevices.filter(d => d.deviceType === newType).length
        setFormData(prev => ({ 
          ...prev, 
          deviceType: newType,
          name: getDefaultDeviceName(newType, existingCount)
        }))
      }
    }
  }, [formData.category, device, existingDevices])

  // Update name when device type changes
  useEffect(() => {
    if (!device && formData.deviceType) {
      const existingCount = existingDevices.filter(d => d.deviceType === formData.deviceType).length
      setFormData(prev => ({ 
        ...prev, 
        name: getDefaultDeviceName(formData.deviceType as string, existingCount)
      }))
    }
  }, [formData.deviceType, device, existingDevices])

  // Auto-assign IP when device type changes
  useEffect(() => {
    if (autoAssignIP && !device && formData.deviceType) {
      fetchNextIP()
    }
  }, [formData.deviceType, autoAssignIP])

  // Check port binding when switch/port changes
  useEffect(() => {
    if (selectedSwitch && selectedPort) {
      // Check if any device is already bound to this switch+port
      const boundDevice = existingDevices.find(d => {
        if (d._id === device?._id) return false // Skip current device
        const switchId = typeof d.boundToSwitch === 'string' 
          ? d.boundToSwitch 
          : d.boundToSwitch?._id
        return switchId === selectedSwitch && d.switchPort === selectedPort
      })
      
      if (boundDevice) {
        setPortWarning(`⚠️ Port ${selectedPort} is already assigned to "${boundDevice.name}"`)
      } else {
        setPortWarning(null)
      }
    } else {
      setPortWarning(null)
    }
  }, [selectedSwitch, selectedPort, switches, existingDevices, device])

  // Initialize switch/port from device if editing
  useEffect(() => {
    if (device) {
      if (device.boundToSwitch) {
        const switchId = typeof device.boundToSwitch === 'string' ? device.boundToSwitch : device.boundToSwitch._id
        setSelectedSwitch(switchId)
      }
      if (device.switchPort) {
        setSelectedPort(device.switchPort)
      }
    }
  }, [device])

  const fetchNextIP = async () => {
    try {
      const result = await devicesAPI.getNextIP(projectId, formData.deviceType as string, formData.category)
      setFormData(prev => ({ ...prev, ipAddress: result.ip, vlan: result.vlan }))
    } catch (err) {
      console.error('Failed to get next IP:', err)
    }
  }

  const handleGeneratePassword = async () => {
    try {
      const { password } = await devicesAPI.generatePassword()
      setFormData(prev => ({ ...prev, password }))
    } catch (err) {
      console.error('Failed to generate password:', err)
    }
  }

  const checkIPConflict = async (ip: string) => {
    if (!ip) {
      setIpConflict(null)
      return
    }
    try {
      const result = await devicesAPI.checkIPConflict(projectId, ip, device?._id)
      if (result.hasConflict && result.conflictingDevice) {
        setIpConflict(`IP already used by "${result.conflictingDevice.name}"`)
      } else {
        setIpConflict(null)
      }
    } catch (err) {
      console.error('Failed to check IP:', err)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    const newValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    setFormData(prev => ({ ...prev, [name]: newValue }))

    if (name === 'ipAddress') {
      checkIPConflict(value)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (ipConflict && !bulkMode) {
      setError('Please resolve IP conflict before saving')
      return
    }

    setLoading(true)

    try {
      // Add switch binding info - use null to clear, not undefined
      const deviceData = {
        ...formData,
        boundToSwitch: selectedSwitch || null,
        switchPort: selectedPort || null,
      }

      if (device) {
        // Update existing
        const savedDevice = await devicesAPI.update(device._id, deviceData)
        onDeviceCreated(savedDevice)
      } else if (bulkMode && quantity > 1) {
        // Bulk create - don't include IP so backend auto-assigns unique IPs
        const devices: Partial<Device>[] = []
        for (let i = 0; i < quantity; i++) {
          const existingCount = existingDevices.filter(d => d.deviceType === formData.deviceType).length + i
          // Exclude ipAddress so each device gets unique auto-assigned IP
          const { ipAddress, ...formDataWithoutIP } = formData
          devices.push({
            ...formDataWithoutIP,
            name: getDefaultDeviceName(formData.deviceType as string, existingCount),
            autoAssignIP: true,
          } as any)
        }
        const result = await devicesAPI.bulkCreate(projectId, devices)
        if (result.created && result.created.length > 0) {
          result.created.forEach((d: Device) => onDeviceCreated(d))
        }
        if (result.errors && result.errors.length > 0) {
          setError(`Created ${result.created.length} devices. ${result.errors.length} failed.`)
          setLoading(false)
          return
        }
      } else {
        // Single create
        const savedDevice = await devicesAPI.create({ ...deviceData, projectId, autoAssignIP })
        onDeviceCreated(savedDevice)
      }
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!device || !window.confirm('Delete this device?')) return
    setLoading(true)

    try {
      await devicesAPI.delete(device._id)
      onDeviceDeleted(device._id)
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string | undefined) => {
    if (text) {
      navigator.clipboard.writeText(text)
    }
  }

  // Get brand options for current category/type
  const getBrandOptions = () => {
    const categoryBrands = BRAND_OPTIONS[formData.category as keyof typeof BRAND_OPTIONS]
    if (categoryBrands && formData.deviceType) {
      return categoryBrands[formData.deviceType as keyof typeof categoryBrands] || ['Custom']
    }
    return ['Custom']
  }

  // Get available ports for selected switch
  const getAvailablePorts = () => {
    if (!selectedSwitch) return []
    const sw = switches.find(s => s._id === selectedSwitch)
    if (!sw) return []
    
    const ports = []
    for (let i = 1; i <= sw.portCount; i++) {
      const binding = sw.managedPorts?.find(p => p.portNumber === i)
      const isBound = binding?.assignedDevice && binding.assignedDevice !== device?._id
      ports.push({ number: i, isBound, boundTo: binding?.assignedDevice })
    }
    return ports
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '90vh', overflow: 'auto' }}>
        <div className="modal-header">
          <h2>{viewOnly ? '👁️ View Device' : device ? '✏️ Edit Device' : '➕ Add Device'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            {/* ============ CATEGORY & TYPE FIRST ============ */}
            <h4 style={{ color: '#333', marginBottom: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
              📋 Device Type
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Category *</label>
                <select name="category" value={formData.category} onChange={handleInputChange}>
                  <option value="network">🔗 Network</option>
                  <option value="camera">📹 Cameras</option>
                  <option value="security">🔒 Security</option>
                  <option value="control-system">🎛️ Control System</option>
                  <option value="lighting">💡 Lighting</option>
                  <option value="av">📺 AV</option>
                  <option value="other">📦 Other</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Device Type *</label>
                <select name="deviceType" value={formData.deviceType} onChange={handleInputChange}>
                  {deviceTypes.map(dt => (
                    <option key={dt.value} value={dt.value}>{dt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ============ BASIC INFO ============ */}
            <h4 style={{ color: '#333', margin: '1.5rem 0 1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
              📝 Device Details
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Device Name *</label>
                <input
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g., Camera1"
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Manufacturer</label>
                <select name="manufacturer" value={formData.manufacturer} onChange={handleInputChange}>
                  <option value="">Select...</option>
                  {getBrandOptions().map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Model</label>
                <input
                  name="model"
                  type="text"
                  value={formData.model}
                  onChange={handleInputChange}
                  placeholder="e.g., USW-Pro-24-POE"
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Serial Number</label>
                <input
                  name="serialNumber"
                  type="text"
                  value={formData.serialNumber}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            {/* ============ BULK ADD (only for new devices) ============ */}
            {!device && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={bulkMode}
                    onChange={(e) => setBulkMode(e.target.checked)}
                  />
                  <strong>Bulk Add Multiple Devices</strong>
                </label>
                {bulkMode && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                    <label>Quantity:</label>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      min={1}
                      max={50}
                      style={{ width: '80px' }}
                    />
                    <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                      Will auto-assign IPs ({formData.name}1, {formData.name}2, etc.)
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ============ NETWORK INFO ============ */}
            <h4 style={{ color: '#333', margin: '1.5rem 0 1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
              🌐 Network Configuration
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  IP Address
                  {!device && (
                    <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <input
                        type="checkbox"
                        checked={autoAssignIP}
                        onChange={(e) => setAutoAssignIP(e.target.checked)}
                      />
                      Auto
                    </label>
                  )}
                </label>
                <input
                  name="ipAddress"
                  type="text"
                  value={formData.ipAddress}
                  onChange={handleInputChange}
                  placeholder="192.168.1.1"
                  style={ipConflict ? { borderColor: '#ef4444' } : {}}
                  disabled={bulkMode}
                />
                {ipConflict && <small style={{ color: '#ef4444' }}>⚠️ {ipConflict}</small>}
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>MAC Address</label>
                <input
                  name="macAddress"
                  type="text"
                  value={formData.macAddress}
                  onChange={handleInputChange}
                  placeholder="AA:BB:CC:DD:EE:FF"
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>VLAN</label>
                <input
                  name="vlan"
                  type="number"
                  value={formData.vlan}
                  onChange={handleInputChange}
                  min={1}
                  max={4094}
                />
              </div>
            </div>

            {/* ============ CREDENTIALS ============ */}
            <h4 style={{ color: '#333', margin: '1.5rem 0 1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
              🔐 Credentials
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Username</label>
                <input
                  name="username"
                  type="text"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="admin"
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Password</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleInputChange}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ padding: '0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}
                    title={showPassword ? 'Hide' : 'Show'}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    style={{ padding: '0.5rem', background: '#0066cc', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    title="Generate Password"
                  >
                    🎲
                  </button>
                  {formData.password && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(formData.password || '')}
                      style={{ padding: '0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}
                      title="Copy"
                    >
                      📋
                    </button>
                  )}
                </div>
              </div>
            </div>

            {formData.manufacturer === 'Ubiquiti' && (
              <div className="form-group" style={{ margin: '0.5rem 0 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    name="hideCredentials"
                    type="checkbox"
                    checked={formData.hideCredentials}
                    onChange={handleInputChange}
                  />
                  Hide credentials in reports (Unifi Cloud managed)
                </label>
              </div>
            )}

            {/* ============ SWITCH PORT BINDING ============ */}
            <h4 style={{ color: '#333', margin: '1.5rem 0 1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
              🔌 Switch Port Binding
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Connected to Switch</label>
                <select 
                  value={selectedSwitch} 
                  onChange={(e) => {
                    setSelectedSwitch(e.target.value)
                    setSelectedPort('')
                  }}
                >
                  <option value="">-- Not bound --</option>
                  {switches.map(sw => (
                    <option key={sw._id} value={sw._id}>{sw.name} ({sw.portCount} ports)</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Switch Port</label>
                <select 
                  value={selectedPort} 
                  onChange={(e) => setSelectedPort(e.target.value ? parseInt(e.target.value) : '')}
                  disabled={!selectedSwitch}
                >
                  <option value="">-- Select port --</option>
                  {getAvailablePorts().map(port => (
                    <option 
                      key={port.number} 
                      value={port.number}
                      style={port.isBound ? { color: '#ef4444' } : {}}
                    >
                      Port {port.number} {port.isBound ? '(in use)' : ''}
                    </option>
                  ))}
                </select>
                {portWarning && (
                  <small style={{ color: '#f59e0b', display: 'block', marginTop: '0.25rem' }}>{portWarning}</small>
                )}
              </div>
            </div>

            {/* ============ CATEGORY-SPECIFIC FIELDS ============ */}
            
            {/* NETWORK - SWITCH */}
            {formData.category === 'network' && formData.deviceType === 'switch' && (
              <>
                <h4 style={{ color: '#333', margin: '1.5rem 0 1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                  🔀 Switch Configuration
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Port Count</label>
                    <select name="portCount" value={formData.portCount} onChange={handleInputChange}>
                      <option value={8}>8 Ports</option>
                      <option value={16}>16 Ports</option>
                      <option value={24}>24 Ports</option>
                      <option value={48}>48 Ports</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>PoE Type</label>
                    <select name="poeType" value={formData.poeType} onChange={handleInputChange}>
                      <option value="none">No PoE</option>
                      <option value="af">802.3af (PoE)</option>
                      <option value="at">802.3at (PoE+)</option>
                      <option value="bt">802.3bt (PoE++)</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>SFP+ Ports</label>
                    <input
                      name="sfpPorts"
                      type="number"
                      value={formData.sfpPorts || 0}
                      onChange={handleInputChange}
                      min={0}
                    />
                  </div>
                </div>
              </>
            )}

            {/* NETWORK - ROUTER */}
            {formData.category === 'network' && formData.deviceType === 'router' && (
              <>
                <h4 style={{ color: '#333', margin: '1.5rem 0 1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                  🌐 Router Configuration
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>WAN Protocol</label>
                    <select name="wanProtocol" value={formData.wanProtocol} onChange={handleInputChange}>
                      <option value="dhcp">DHCP</option>
                      <option value="pppoe">PPPoE</option>
                      <option value="static">Static IP</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>LAN Ports</label>
                    <input name="lanPorts" type="number" value={formData.lanPorts || 4} onChange={handleInputChange} min={1} max={48} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>WAN Ports</label>
                    <input name="wanPorts" type="number" value={formData.wanPorts || 1} onChange={handleInputChange} min={1} max={4} />
                  </div>
                </div>
              </>
            )}

            {/* SECURITY - ALARM PANEL */}
            {formData.category === 'security' && formData.deviceType === 'alarm-panel' && (
              <>
                <h4 style={{ color: '#333', margin: '1.5rem 0 1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                  🚨 Security Panel Configuration
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Panel Type</label>
                    <select name="panelType" value={formData.panelType} onChange={handleInputChange}>
                      <option value="">Select...</option>
                      <option value="inception">Inner Range (Inception)</option>
                      <option value="paradox">Paradox</option>
                      <option value="bosch">Bosch</option>
                      <option value="honeywell">Honeywell</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Zones</label>
                    <input name="zoneCount" type="number" value={formData.zoneCount || 0} onChange={handleInputChange} min={0} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Outputs</label>
                    <input name="outputCount" type="number" value={formData.outputCount || 0} onChange={handleInputChange} min={0} />
                  </div>
                </div>
                {formData.panelType === 'inception' && formData.serialNumber && (
                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label>SkyTunnel Link</label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={`https://skytunnel.com.au/inception/${formData.serialNumber}`}
                        readOnly
                        style={{ flex: 1, background: '#f3f4f6' }}
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard(`https://skytunnel.com.au/inception/${formData.serialNumber}`)}
                        style={{ padding: '0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        📋
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* AV EQUIPMENT */}
            {formData.category === 'av' && (
              <>
                <h4 style={{ color: '#333', margin: '1.5rem 0 1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                  📺 AV Configuration
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Control Method</label>
                    <select name="controlMethod" value={formData.controlMethod} onChange={handleInputChange}>
                      <option value="ip">IP Control</option>
                      <option value="ir">IR</option>
                      <option value="serial">Serial/RS232</option>
                      <option value="cec">HDMI CEC</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Room</label>
                    <input name="room" type="text" value={formData.room} onChange={handleInputChange} placeholder="e.g., Living Room" />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Location</label>
                    <input name="location" type="text" value={formData.location} onChange={handleInputChange} placeholder="e.g., AV Rack" />
                  </div>
                </div>
              </>
            )}

            {/* ============ LOCATION & STATUS ============ */}
            <h4 style={{ color: '#333', margin: '1.5rem 0 1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
              📍 Location & Status
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Location</label>
                <input name="location" type="text" value={formData.location} onChange={handleInputChange} placeholder="e.g., Server Rack" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Status</label>
                <select name="status" value={formData.status} onChange={handleInputChange}>
                  <option value="not-installed">Not Installed</option>
                  <option value="installed">Installed</option>
                  <option value="configured">Configured</option>
                  <option value="tested">Tested</option>
                  <option value="commissioned">Commissioned</option>
                </select>
              </div>
            </div>

            {/* ============ NOTES ============ */}
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label>Configuration Notes</label>
              <textarea
                name="configNotes"
                value={formData.configNotes}
                onChange={handleInputChange}
                rows={3}
                placeholder="Any additional notes..."
                style={{ fontFamily: 'inherit' }}
                disabled={viewOnly}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {viewOnly ? 'Close' : 'Cancel'}
            </button>
            {!viewOnly && device && (
              <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={loading}>
                🗑️ Delete
              </button>
            )}
            {!viewOnly && (
              <button type="submit" className="btn btn-primary" disabled={loading || (!!ipConflict && !bulkMode)}>
                {loading ? '⏳ Saving...' : bulkMode && quantity > 1 ? `💾 Add ${quantity} Devices` : '💾 Save Device'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

export default DeviceModal
