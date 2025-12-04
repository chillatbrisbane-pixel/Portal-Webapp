import React, { useState, useEffect } from 'react'
import { Device, DeviceCategory, DeviceType, DEVICE_TYPE_OPTIONS, BRAND_OPTIONS, getDeviceConnectionConfig } from '../types'
import { devicesAPI } from '../services/apiService'

interface DeviceModalProps {
  projectId: string
  device: Device | null
  onClose: () => void
  onDeviceCreated: (device: Device | Device[]) => void
  onDeviceDeleted: (deviceId: string) => void
  existingDevices?: Device[]
  viewOnly?: boolean
}

interface SwitchInfo {
  _id: string
  name: string
  portCount: number
  managedPorts: { portNumber: number; assignedDevice?: string; description?: string }[]
  deviceType?: string
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
  firmwareVersion: '',
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
  connectionType: 'wired',
  // Alarm system fields
  slamCount: 0,
  inputExpanderCount: 0,
  outputExpanderCount: 0,
  readerCount: 0,
  partitionCount: 1,
  userCodeCount: 0,
  sirenCount: 0,
  // Users arrays
  nvrUsers: [],
  alarmUsers: [],
  // Control4 temp login
  control4TempUser: '',
  control4TempPass: '',
  // Araknis / OvrC fields
  ovrcUsername: '',
  ovrcPassword: '',
  localAdminUser: '',
  localAdminPass: '',
  // Audio matrix / multiroom amp
  audioInputCount: 0,
  audioOutputCount: 0,
  isAmplified: false,
  audioInputNames: '',
  audioOutputNames: '',
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
    'dali-gateway': 'DALI Gateway',
    'receiver': 'AV Receiver',
    'tv': 'TV',
    'projector': 'Projector',
    'audio-matrix': 'Audio Matrix',
    'video-matrix': 'Video Matrix',
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
    'ekey-reader': 'Ekey Reader',
    'cloudkey': 'Cloudkey',
    'pdu': 'PDU',
    'ups': 'UPS',
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
  
  // Barcode scanner
  const [showScanner, setShowScanner] = useState(false)
  const [scanTarget, setScanTarget] = useState<'serialNumber' | 'model'>('serialNumber')
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const streamRef = React.useRef<MediaStream | null>(null)

  // Get device types for selected category
  const deviceTypes = DEVICE_TYPE_OPTIONS[formData.category as DeviceCategory] || []

  // Load switches and routers for port binding
  useEffect(() => {
    const loadSwitches = async () => {
      // Include both switches and routers, but exclude the current device
      const bindableDevices = existingDevices.filter(d => 
        (d.deviceType === 'switch' || d.deviceType === 'router') &&
        d._id !== device?._id // Can't bind to self
      )
      setSwitches(bindableDevices.map(s => ({
        _id: s._id,
        name: s.name,
        // Use lanPorts for routers, portCount for switches
        portCount: s.deviceType === 'router' ? (s.lanPorts || 4) : (s.portCount || 24),
        managedPorts: s.managedPorts || [],
        deviceType: s.deviceType
      })))
    }
    loadSwitches()
  }, [existingDevices, device])

  // Track previous category to detect actual changes
  const [prevCategory, setPrevCategory] = useState(formData.category)
  
  // Update device type and name when category changes
  useEffect(() => {
    if (!device && formData.category !== prevCategory) {
      setPrevCategory(formData.category)
      const types = DEVICE_TYPE_OPTIONS[formData.category as DeviceCategory]
      if (types && types.length > 0) {
        const newType = types[0].value
        const existingCount = existingDevices.filter(d => d.deviceType === newType).length
        const connectionConfig = getDeviceConnectionConfig(newType)
        setFormData(prev => ({ 
          ...prev, 
          deviceType: newType,
          name: getDefaultDeviceName(newType, existingCount),
          connectionType: connectionConfig.default,
        }))
        // Clear switch binding if connection type doesn't require it
        if (!connectionConfig.requiresSwitch || connectionConfig.default === 'wifi' || connectionConfig.default === 'none') {
          setSelectedSwitch('')
          setSelectedPort('')
        }
      }
    }
  }, [formData.category, device, existingDevices, prevCategory])

  // Track previous device type to detect actual changes
  const [prevDeviceType, setPrevDeviceType] = useState(formData.deviceType)
  
  // Update name and connection type when device type changes
  useEffect(() => {
    if (!device && formData.deviceType && formData.deviceType !== prevDeviceType) {
      setPrevDeviceType(formData.deviceType)
      const existingCount = existingDevices.filter(d => d.deviceType === formData.deviceType).length
      const connectionConfig = getDeviceConnectionConfig(formData.deviceType as string)
      setFormData(prev => ({ 
        ...prev, 
        name: getDefaultDeviceName(formData.deviceType as string, existingCount),
        connectionType: connectionConfig.default,
      }))
      // Clear switch binding if connection type doesn't require it
      if (!connectionConfig.requiresSwitch || connectionConfig.default === 'wifi' || connectionConfig.default === 'none') {
        setSelectedSwitch('')
        setSelectedPort('')
      }
    }
  }, [formData.deviceType, device, existingDevices, prevDeviceType])

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

  // Barcode Scanner Functions
  const [scannerError, setScannerError] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string>('')
  const scanIntervalRef = React.useRef<number | null>(null)

  const startScanner = async (target: 'serialNumber' | 'model') => {
    setScanTarget(target)
    setScannerError(null)
    setDebugInfo('')
    setShowScanner(true)
    
    // Wait a tick for modal to render and video element to mount
    await new Promise(resolve => setTimeout(resolve, 100))
    
    try {
      // Check if we're on HTTPS (required for camera on mobile)
      const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost'
      if (!isSecure) {
        throw new Error(`SecurityError: Camera requires HTTPS. Current: ${window.location.protocol}//${window.location.hostname}`)
      }

      // Check if getUserMedia is supported
      if (!navigator.mediaDevices) {
        throw new Error('navigator.mediaDevices not available. Site must be served over HTTPS.')
      }
      
      if (!navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia not available. Try a different browser.')
      }

      setDebugInfo('Requesting camera permission...')

      // Request camera permission with simpler constraints for mobile
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment' // Use back camera on mobile
        }
      })
      
      setDebugInfo('Got stream, attaching to video...')
      streamRef.current = stream
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        
        // Wait for video to be ready
        await new Promise<void>((resolve, reject) => {
          if (!videoRef.current) return reject(new Error('Video element not found'))
          
          videoRef.current.onloadedmetadata = () => {
            setDebugInfo('Video metadata loaded, playing...')
            videoRef.current?.play()
              .then(() => {
                setDebugInfo('Video playing!')
                resolve()
              })
              .catch(reject)
          }
          
          videoRef.current.onerror = () => reject(new Error('Video element error'))
          
          // Timeout after 5 seconds
          setTimeout(() => reject(new Error('Video load timeout')), 5000)
        })
        
        // Start continuous barcode detection if supported
        if ('BarcodeDetector' in window) {
          startBarcodeDetection()
          setDebugInfo('BarcodeDetector active')
        } else {
          setDebugInfo('Camera ready (no auto-detect)')
        }
      } else {
        throw new Error('Video element not mounted')
      }
    } catch (err: any) {
      console.error('Camera access error:', err)
      
      // Build detailed error message
      let errorMsg = 'Unable to access camera.'
      const errorName = err.name || 'Unknown'
      const errorMessage = err.message || ''
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Camera permission denied. Please allow camera access in your browser settings and reload the page.'
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'No camera found on this device.'
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMsg = 'Camera is in use by another application.'
      } else if (err.name === 'OverconstrainedError') {
        // Try again with absolutely no constraints
        try {
          setDebugInfo('Trying fallback camera...')
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true })
          streamRef.current = fallbackStream
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream
            await videoRef.current.play()
            setDebugInfo('Fallback camera working')
            return
          }
        } catch (fallbackErr: any) {
          errorMsg = `Could not access any camera: ${fallbackErr.message || fallbackErr.name}`
        }
      } else if (err.name === 'AbortError') {
        errorMsg = 'Camera request was aborted. Please try again.'
      } else if (err.name === 'SecurityError') {
        errorMsg = 'Camera blocked due to security policy. Ensure site is served over HTTPS.'
      } else {
        errorMsg = `${errorName}: ${errorMessage}`
      }
      
      setDebugInfo(`Error: ${errorName} - ${errorMessage}`)
      setScannerError(errorMsg)
    }
  }

  // Use BarcodeDetector API for continuous scanning
  const startBarcodeDetection = () => {
    if (!('BarcodeDetector' in window)) return
    
    setIsScanning(true)
    const detector = new (window as any).BarcodeDetector({
      formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'codabar', 'itf']
    })
    
    const detectBarcode = async () => {
      if (!videoRef.current || videoRef.current.readyState !== 4) return
      
      try {
        const barcodes = await detector.detect(videoRef.current)
        if (barcodes.length > 0) {
          const value = barcodes[0].rawValue
          setFormData(prev => ({ ...prev, [scanTarget]: value }))
          stopScanner()
          return
        }
      } catch (err) {
        // Detection failed, continue scanning
      }
    }
    
    // Scan every 200ms
    scanIntervalRef.current = window.setInterval(detectBarcode, 200)
  }

  const stopScanner = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setShowScanner(false)
    setIsScanning(false)
    setScannerError(null)
    setDebugInfo('')
  }

  const captureAndProcess = async () => {
    if (!videoRef.current) return
    
    // Try BarcodeDetector first
    if ('BarcodeDetector' in window) {
      try {
        const detector = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'codabar', 'itf']
        })
        const barcodes = await detector.detect(videoRef.current)
        if (barcodes.length > 0) {
          setFormData(prev => ({ ...prev, [scanTarget]: barcodes[0].rawValue }))
          stopScanner()
          return
        }
      } catch (err) {
        console.log('BarcodeDetector failed, falling back to manual entry')
      }
    }
    
    // Fallback: prompt user to enter the scanned value
    const scannedValue = prompt('No barcode detected. Enter the value manually:')
    if (scannedValue) {
      setFormData(prev => ({ ...prev, [scanTarget]: scannedValue }))
    }
    stopScanner()
  }

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

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
        const devicesToCreate: Partial<Device>[] = []
        for (let i = 0; i < quantity; i++) {
          const existingCount = existingDevices.filter(d => d.deviceType === formData.deviceType).length + i
          // Exclude ipAddress so each device gets unique auto-assigned IP
          const { ipAddress, ...formDataWithoutIP } = formData
          devicesToCreate.push({
            ...formDataWithoutIP,
            name: getDefaultDeviceName(formData.deviceType as string, existingCount),
            autoAssignIP: true,
          } as any)
        }
        const result = await devicesAPI.bulkCreate(projectId, devicesToCreate)
        if (result.created && result.created.length > 0) {
          // Pass all created devices at once
          onDeviceCreated(result.created)
        }
        if (result.errors && result.errors.length > 0) {
          setError(`Created ${result.created?.length || 0} devices. ${result.errors.length} failed.`)
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
                  <option value="power">🔌 Power</option>
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
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    name="model"
                    type="text"
                    value={formData.model}
                    onChange={handleInputChange}
                    placeholder="e.g., USW-Pro-24-POE"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => startScanner('model')}
                    style={{ padding: '0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}
                    title="Scan barcode"
                  >
                    📷
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Serial Number</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    name="serialNumber"
                    type="text"
                    value={formData.serialNumber}
                    onChange={handleInputChange}
                    style={{ flex: 1 }}
                    disabled={bulkMode}
                    placeholder={bulkMode ? '(Set individually after creation)' : ''}
                  />
                  {!bulkMode && (
                    <button
                      type="button"
                      onClick={() => startScanner('serialNumber')}
                      style={{ padding: '0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}
                      title="Scan barcode"
                    >
                      📷
                    </button>
                  )}
                </div>
              </div>

              {/* Hide firmware for Sonos devices */}
              {formData.manufacturer !== 'Sonos' && (
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Firmware Version</label>
                  <input
                    name="firmwareVersion"
                    type="text"
                    value={formData.firmwareVersion || ''}
                    onChange={handleInputChange}
                    placeholder="e.g., 1.12.3"
                    disabled={bulkMode}
                  />
                </div>
              )}
            </div>

            {/* ============ SONOS SPECIFIC ============ */}
            {formData.manufacturer === 'Sonos' && (
              <>
                <h4 style={{ color: '#333', margin: '1.5rem 0 1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                  🔊 Sonos Configuration
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Network Path</label>
                    <select 
                      name="networkPath" 
                      value={formData.networkPath || ''} 
                      onChange={handleInputChange}
                    >
                      <option value="">Select...</option>
                      <option value="wired">🔌 Wired (Ethernet)</option>
                      <option value="wireless">📶 Wireless (WiFi)</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Sonos PIN</label>
                    <input
                      name="sonosPin"
                      type="text"
                      value={formData.sonosPin || ''}
                      onChange={handleInputChange}
                      placeholder="e.g., 1234"
                      maxLength={8}
                    />
                  </div>
                </div>
              </>
            )}

            {/* ============ CONTROL4 TEMP LOGIN ============ */}
            {formData.manufacturer === 'Control4' && (
              <>
                <h4 style={{ color: '#333', margin: '1.5rem 0 1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                  🎛️ Control4 Temporary Login
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Temp Username</label>
                    <input
                      name="control4TempUser"
                      type="text"
                      value={formData.control4TempUser || ''}
                      onChange={handleInputChange}
                      placeholder="Installer username"
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Temp Password</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        name="control4TempPass"
                        type="text"
                        value={formData.control4TempPass || ''}
                        onChange={handleInputChange}
                        placeholder="Temp password"
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={handleGeneratePassword}
                        style={{ padding: '0.5rem', background: '#e5e7eb', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        title="Generate Password"
                      >
                        🎲
                      </button>
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.5rem' }}>
                  Temporary installer credentials for project handover
                </p>
              </>
            )}

            {/* ============ AUDIO MATRIX / MULTIROOM AMP ============ */}
            {(formData.deviceType === 'audio-matrix' || formData.deviceType === 'amplifier') && (
              <>
                <h4 style={{ color: '#333', margin: '1.5rem 0 1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                  🎵 Audio Configuration
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Input Count</label>
                    <input
                      name="audioInputCount"
                      type="number"
                      min="0"
                      max="32"
                      value={formData.audioInputCount || ''}
                      onChange={handleInputChange}
                      placeholder="e.g., 8"
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Output Count</label>
                    <input
                      name="audioOutputCount"
                      type="number"
                      min="0"
                      max="32"
                      value={formData.audioOutputCount || ''}
                      onChange={handleInputChange}
                      placeholder="e.g., 8"
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Amplified?</label>
                    <select
                      name="isAmplified"
                      value={formData.isAmplified ? 'yes' : 'no'}
                      onChange={(e) => setFormData({ ...formData, isAmplified: e.target.value === 'yes' })}
                    >
                      <option value="no">No (Preamp Only)</option>
                      <option value="yes">Yes (With Amplifier)</option>
                    </select>
                  </div>
                </div>
                {(formData.audioInputCount > 0 || formData.audioOutputCount > 0) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    {formData.audioInputCount > 0 && (
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Input Names (one per line)</label>
                        <textarea
                          name="audioInputNames"
                          value={formData.audioInputNames || ''}
                          onChange={handleInputChange}
                          placeholder={`Input 1\nInput 2\nInput 3...`}
                          rows={Math.min(formData.audioInputCount || 4, 6)}
                          style={{ resize: 'vertical' }}
                        />
                      </div>
                    )}
                    {formData.audioOutputCount > 0 && (
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Output Names / Zones (one per line)</label>
                        <textarea
                          name="audioOutputNames"
                          value={formData.audioOutputNames || ''}
                          onChange={handleInputChange}
                          placeholder={`Living Room\nKitchen\nMaster Bedroom...`}
                          rows={Math.min(formData.audioOutputCount || 4, 6)}
                          style={{ resize: 'vertical' }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

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
            {(() => {
              // Check if Ubiquiti device - credentials managed via UniFi controller
              const manufacturer = formData.manufacturer?.toLowerCase() || ''
              const isUnifi = manufacturer.includes('ubiquiti') || manufacturer.includes('unifi')
              
              if (isUnifi) {
                return (
                  <div style={{ 
                    margin: '1.5rem 0', 
                    padding: '1rem', 
                    background: '#f0f9ff', 
                    borderRadius: '8px',
                    border: '1px solid #bae6fd',
                  }}>
                    <p style={{ margin: 0, color: '#0369a1', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>ℹ️</span>
                      <span>UniFi devices are managed via the UniFi Controller - credentials not required here.</span>
                    </p>
                  </div>
                )
              }
              
              // Dynamic credential labels based on device type
              const getCredentialLabels = () => {
                const deviceType = formData.deviceType as string
                
                // App-based devices
                if (deviceType === 'fan' && manufacturer?.includes('haiku')) {
                  return { title: '📱 Haiku App Login', username: 'Email', password: 'Password', placeholder: 'email@example.com' }
                }
                if (deviceType === 'fan') {
                  return { title: '📱 App Login', username: 'Email/Username', password: 'Password', placeholder: 'email@example.com' }
                }
                if (deviceType === 'irrigation') {
                  return { title: '📱 App Login', username: 'Email/Username', password: 'Password', placeholder: 'email@example.com' }
                }
                if (deviceType === 'hvac') {
                  return { title: '🔐 Controller Login', username: 'Username', password: 'Password', placeholder: 'admin' }
                }
                if (deviceType === 'pool') {
                  return { title: '📱 App Login', username: 'Email/Username', password: 'Password', placeholder: 'email@example.com' }
                }
                
                // Standard device credentials
                return { title: '🔐 Credentials', username: 'Username', password: 'Password', placeholder: 'admin' }
              }
              
              const credLabels = getCredentialLabels()
              
              return (
                <>
                  <h4 style={{ color: '#333', margin: '1.5rem 0 1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                    {credLabels.title}
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>{credLabels.username}</label>
                      <input
                        name="username"
                        type="text"
                        value={formData.username}
                        onChange={handleInputChange}
                        placeholder={credLabels.placeholder}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label>{credLabels.password}</label>
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
                            onClick={(e) => copyToClipboard(formData.password || '', e)}
                            style={{ padding: '0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}
                            title="Copy"
                          >
                            📋
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )
            })()}

            {/* NVR: Copy credentials to all cameras */}
            {formData.deviceType === 'nvr' && device && (formData.username || formData.password) && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', color: '#1e40af' }}>
                    📹 Copy these credentials to all cameras in this project?
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      const cameras = existingDevices.filter(d => d.deviceType === 'camera')
                      if (cameras.length === 0) {
                        alert('No cameras found in this project')
                        return
                      }
                      if (!window.confirm(`Update credentials for ${cameras.length} camera(s)?`)) {
                        return
                      }
                      try {
                        for (const cam of cameras) {
                          await devicesAPI.update(cam._id, {
                            username: formData.username,
                            password: formData.password,
                          })
                        }
                        alert(`✅ Credentials copied to ${cameras.length} camera(s)`)
                      } catch (err) {
                        alert('Failed to update some cameras')
                      }
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                    }}
                  >
                    📋 Copy to All Cameras
                  </button>
                </div>
              </div>
            )}

            {/* ============ NVR EXTRA USERS ============ */}
            {formData.deviceType === 'nvr' && !bulkMode && (
              <>
                <h4 style={{ color: '#333', margin: '1.5rem 0 1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                  👥 Additional Users
                </h4>
                <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  Add extra user accounts for operators/viewers beyond the main admin credentials above.
                </p>
                
                {/* Existing NVR users list */}
                {(formData.nvrUsers || []).length > 0 && (
                  <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {formData.nvrUsers?.map((user, idx) => (
                      <div key={idx} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.75rem',
                        padding: '0.75rem',
                        background: '#f9fafb',
                        borderRadius: '6px',
                        border: '1px solid #e5e7eb',
                      }}>
                        <span style={{ 
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: user.role === 'admin' ? '#fee2e2' : user.role === 'operator' ? '#fef3c7' : '#dcfce7',
                          color: user.role === 'admin' ? '#991b1b' : user.role === 'operator' ? '#92400e' : '#166534',
                        }}>
                          {user.role}
                        </span>
                        <strong style={{ flex: 1 }}>{user.username}</strong>
                        <code style={{ background: '#e5e7eb', padding: '0.2rem 0.5rem', borderRadius: '3px', fontSize: '0.85rem' }}>
                          {user.password}
                        </code>
                        {user.notes && <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>({user.notes})</span>}
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...(formData.nvrUsers || [])]
                            updated.splice(idx, 1)
                            setFormData({ ...formData, nvrUsers: updated })
                          }}
                          style={{
                            padding: '0.25rem 0.5rem',
                            background: '#fee2e2',
                            color: '#991b1b',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Add new NVR user form */}
                <div style={{ 
                  padding: '1rem',
                  background: '#f0f9ff',
                  borderRadius: '6px',
                  border: '1px dashed #bae6fd',
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <input
                      type="text"
                      placeholder="Username"
                      id="new-nvr-username"
                      style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                    />
                    <input
                      type="text"
                      placeholder="Password"
                      id="new-nvr-password"
                      style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                    />
                    <select id="new-nvr-role" style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}>
                      <option value="viewer">Viewer</option>
                      <option value="operator">Operator</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <input
                      type="text"
                      placeholder="Notes (optional)"
                      id="new-nvr-notes"
                      style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const username = (document.getElementById('new-nvr-username') as HTMLInputElement).value.trim()
                        const password = (document.getElementById('new-nvr-password') as HTMLInputElement).value.trim()
                        const role = (document.getElementById('new-nvr-role') as HTMLSelectElement).value as 'admin' | 'operator' | 'viewer'
                        const notes = (document.getElementById('new-nvr-notes') as HTMLInputElement).value.trim()
                        
                        if (!username || !password) {
                          alert('Username and password are required')
                          return
                        }
                        
                        const newUser = { username, password, role, notes }
                        setFormData({ ...formData, nvrUsers: [...(formData.nvrUsers || []), newUser] })
                        
                        // Clear form
                        ;(document.getElementById('new-nvr-username') as HTMLInputElement).value = ''
                        ;(document.getElementById('new-nvr-password') as HTMLInputElement).value = ''
                        ;(document.getElementById('new-nvr-role') as HTMLSelectElement).value = 'viewer'
                        ;(document.getElementById('new-nvr-notes') as HTMLInputElement).value = ''
                      }}
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      ➕ Add User
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ============ CONNECTION TYPE ============ */}
            {(() => {
              const connectionConfig = getDeviceConnectionConfig(formData.deviceType as string)
              // Only show if there's more than one option
              if (connectionConfig.options.length > 1) {
                return (
                  <>
                    <h4 style={{ color: '#333', margin: '1.5rem 0 1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                      📡 Connection Type
                    </h4>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>How does this device connect to the network?</label>
                      <select 
                        name="connectionType" 
                        value={formData.connectionType || connectionConfig.default} 
                        onChange={(e) => {
                          const newConnectionType = e.target.value as 'wired' | 'wifi' | 'both' | 'none'
                          setFormData(prev => ({ ...prev, connectionType: newConnectionType }))
                          // Clear switch binding if WiFi or none selected
                          if (newConnectionType === 'wifi' || newConnectionType === 'none') {
                            setSelectedSwitch('')
                            setSelectedPort('')
                          }
                        }}
                      >
                        {connectionConfig.options.map(opt => (
                          <option key={opt} value={opt}>
                            {opt === 'wired' ? '🔌 Wired (Ethernet)' : 
                             opt === 'wifi' ? '📶 WiFi' : 
                             opt === 'both' ? '🔌📶 Both (Wired + WiFi)' : 
                             '⚡ No Network (Power only)'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )
              }
              return null
            })()}

            {/* ============ SWITCH PORT BINDING ============ */}
            {/* Only show if device has wired or both connection type */}
            {(() => {
              const connectionConfig = getDeviceConnectionConfig(formData.deviceType as string)
              const currentConnectionType = formData.connectionType || connectionConfig.default
              const showSwitchBinding = currentConnectionType === 'wired' || currentConnectionType === 'both'
              
              // For switches, show uplink binding option but exclude self from list
              // For routers, they typically don't connect to other switches (they ARE the upstream)
              if (formData.deviceType === 'router') {
                return null
              }
              
              // For switches, show uplink port binding
              const isSwitch = formData.deviceType === 'switch'
              
              if (!showSwitchBinding && !isSwitch) {
                return null
              }

              // Disable in bulk mode
              if (bulkMode) {
                return (
                  <div style={{ marginTop: '1rem', padding: '1rem', background: '#f3f4f6', borderRadius: '8px', color: '#6b7280' }}>
                    🔌 Switch port binding will be set individually after devices are created
                  </div>
                )
              }

              // Check if camera is bound to NVR (disable switch binding)
              const boundToNVR = formData.deviceType === 'camera' && formData.boundToNVR
              
              // Filter out the current device from available switches for uplink
              const availableSwitches = switches.filter(sw => sw._id !== device?._id)
              
              return (
                <>
                  <h4 style={{ color: '#333', margin: '1.5rem 0 1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                    {isSwitch ? '🔗 Uplink Port Binding' : '🔌 Switch Port Binding'}
                  </h4>

                  {boundToNVR ? (
                    <div style={{ padding: '1rem', background: '#f3f4f6', borderRadius: '8px', color: '#6b7280' }}>
                      Camera is connected directly to NVR - switch port binding disabled
                    </div>
                  ) : (
                    <>
                      {isSwitch && (
                        <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1rem' }}>
                          Select which switch/router port this switch's uplink connects to.
                        </p>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label>{isSwitch ? 'Uplink to Switch/Router' : 'Connected to Switch/Router'}</label>
                          <select 
                            value={selectedSwitch} 
                            onChange={(e) => {
                              setSelectedSwitch(e.target.value)
                              setSelectedPort('')
                            }}
                          >
                            <option value="">-- Not bound --</option>
                            {availableSwitches.map(sw => (
                              <option key={sw._id} value={sw._id}>
                                {sw.name} ({sw.portCount} {sw.deviceType === 'router' ? 'LAN ports' : 'ports'})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                          <label>{isSwitch ? 'Uplink Port' : 'Switch Port'}</label>
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
                    </>
                  )}
                </>
              )
            })()}

            {/* ============ CAMERA NVR BINDING ============ */}
            {formData.category === 'camera' && formData.deviceType === 'camera' && (
              <>
                <h4 style={{ color: '#333', margin: '1.5rem 0 1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                  📹 NVR Connection
                </h4>
                {selectedSwitch ? (
                  <div style={{ padding: '1rem', background: '#f3f4f6', borderRadius: '8px', color: '#6b7280' }}>
                    Camera is bound to switch port - NVR binding disabled
                  </div>
                ) : (
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Connected to NVR</label>
                    <select 
                      name="boundToNVR"
                      value={typeof formData.boundToNVR === 'object' ? formData.boundToNVR._id : (formData.boundToNVR || '')}
                      onChange={handleInputChange}
                      disabled={bulkMode}
                    >
                      <option value="">-- Direct to switch (no NVR) --</option>
                      {existingDevices
                        .filter(d => d.deviceType === 'nvr')
                        .map(nvr => (
                          <option key={nvr._id} value={nvr._id}>
                            {nvr.name} {nvr.manufacturer ? `(${nvr.manufacturer})` : ''}
                          </option>
                        ))
                      }
                    </select>
                    <small style={{ color: '#6b7280', marginTop: '0.25rem', display: 'block' }}>
                      If camera connects directly to NVR rather than via switch
                    </small>
                  </div>
                )}
              </>
            )}

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

                {/* Araknis specific - OvrC and extra logins */}
                {formData.manufacturer === 'Araknis' && (
                  <>
                    <h5 style={{ color: '#1e40af', margin: '1.5rem 0 0.75rem', fontSize: '0.95rem' }}>
                      📡 Araknis / OvrC Configuration
                    </h5>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>OvrC Username</label>
                        <input
                          name="ovrcUsername"
                          type="text"
                          value={formData.ovrcUsername || ''}
                          onChange={handleInputChange}
                          placeholder="OvrC account email"
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>OvrC Password</label>
                        <input
                          name="ovrcPassword"
                          type="text"
                          value={formData.ovrcPassword || ''}
                          onChange={handleInputChange}
                          placeholder="OvrC password"
                        />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Local Admin Username</label>
                        <input
                          name="localAdminUser"
                          type="text"
                          value={formData.localAdminUser || ''}
                          onChange={handleInputChange}
                          placeholder="Local admin username"
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Local Admin Password</label>
                        <input
                          name="localAdminPass"
                          type="text"
                          value={formData.localAdminPass || ''}
                          onChange={handleInputChange}
                          placeholder="Local admin password"
                        />
                      </div>
                    </div>
                  </>
                )}
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

                {/* Common alarm fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Areas/Partitions</label>
                    <input name="partitionCount" type="number" value={formData.partitionCount || 1} onChange={handleInputChange} min={1} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>User Codes</label>
                    <input name="userCodeCount" type="number" value={formData.userCodeCount || 0} onChange={handleInputChange} min={0} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Sirens</label>
                    <input name="sirenCount" type="number" value={formData.sirenCount || 0} onChange={handleInputChange} min={0} />
                  </div>
                </div>

                {/* Inception specific fields */}
                {formData.panelType === 'inception' && (
                  <>
                    <h5 style={{ color: '#1e40af', margin: '1.5rem 0 0.75rem', fontSize: '0.95rem' }}>
                      🔷 Inception Hardware
                    </h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>SLAMs</label>
                        <input 
                          name="slamCount" 
                          type="number" 
                          value={formData.slamCount || 0} 
                          onChange={handleInputChange} 
                          min={0} 
                          title="Siren, Lighting, Automation Modules"
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Input Expanders</label>
                        <input 
                          name="inputExpanderCount" 
                          type="number" 
                          value={formData.inputExpanderCount || 0} 
                          onChange={handleInputChange} 
                          min={0}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Output Expanders</label>
                        <input 
                          name="outputExpanderCount" 
                          type="number" 
                          value={formData.outputExpanderCount || 0} 
                          onChange={handleInputChange} 
                          min={0}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Card Readers</label>
                        <input 
                          name="readerCount" 
                          type="number" 
                          value={formData.readerCount || 0} 
                          onChange={handleInputChange} 
                          min={0}
                        />
                      </div>
                    </div>

                    {formData.serialNumber && (
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
                            onClick={(e) => copyToClipboard(`https://skytunnel.com.au/inception/${formData.serialNumber}`, e)}
                            style={{ padding: '0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            📋
                          </button>
                          <a
                            href={`https://skytunnel.com.au/inception/${formData.serialNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ padding: '0.5rem', background: '#3b82f6', color: 'white', borderRadius: '4px', textDecoration: 'none', fontSize: '0.85rem' }}
                          >
                            🔗 Open
                          </a>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* ============ ALARM USER CODES ============ */}
                {!bulkMode && (
                  <>
                    <h4 style={{ color: '#333', margin: '1.5rem 0 1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                      🔑 User Codes
                    </h4>
                    <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1rem' }}>
                      Manage alarm user codes with access permissions.
                    </p>
                    
                    {/* Existing alarm users list */}
                    {(formData.alarmUsers || []).length > 0 && (
                      <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {formData.alarmUsers?.map((user, idx) => (
                          <div key={idx} style={{ 
                            padding: '0.75rem',
                            background: '#f9fafb',
                            borderRadius: '6px',
                            border: '1px solid #e5e7eb',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                              {user.isAdmin && (
                                <span style={{ 
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '4px',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  background: '#fee2e2',
                                  color: '#991b1b',
                                }}>
                                  ADMIN
                                </span>
                              )}
                              <strong style={{ flex: 1 }}>{user.name}</strong>
                              <button
                                type="button"
                                onClick={() => {
                                  const current = formData.alarmUsers || []
                                  const updated = current.map((u, i) => 
                                    i === idx ? { ...u, _showCode: !u._showCode } : u
                                  )
                                  setFormData({ ...formData, alarmUsers: updated as any })
                                }}
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  background: '#e5e7eb',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem',
                                }}
                              >
                                {(user as any)._showCode ? '🙈 Hide' : '👁️ Show'}
                              </button>
                              <code style={{ 
                                background: '#e5e7eb', 
                                padding: '0.2rem 0.5rem', 
                                borderRadius: '3px', 
                                fontSize: '0.85rem',
                                fontFamily: 'monospace',
                                letterSpacing: '0.1rem',
                              }}>
                                {(user as any)._showCode ? user.code : '••••'}
                              </code>
                              <button
                                type="button"
                                onClick={(e) => copyToClipboard(user.code, e)}
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem',
                                }}
                              >
                                📋
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...(formData.alarmUsers || [])]
                                  updated.splice(idx, 1)
                                  setFormData({ ...formData, alarmUsers: updated })
                                }}
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  background: '#fee2e2',
                                  color: '#991b1b',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem',
                                }}
                              >
                                ✕
                              </button>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: '#6b7280', flexWrap: 'wrap' }}>
                              <span>{user.canArm ? '✅ Arm' : '❌ Arm'}</span>
                              <span>{user.canDisarm ? '✅ Disarm' : '❌ Disarm'}</span>
                              {user.isRestApiUser && <span>🔌 API</span>}
                              {user.webUsername && <span>🌐 Web: {user.webUsername}</span>}
                              {user.userGroup && <span>👥 {user.userGroup}</span>}
                              {user.accessAreas?.length > 0 && (
                                <span>📍 Areas: {user.accessAreas.join(', ')}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Add new alarm user form */}
                    <div style={{ 
                      padding: '1rem',
                      background: '#fef3c7',
                      borderRadius: '6px',
                      border: '1px dashed #fbbf24',
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <input
                          type="text"
                          placeholder="User Name"
                          id="new-alarm-name"
                          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                        />
                        <input
                          type="text"
                          placeholder="Code (e.g. 1234)"
                          id="new-alarm-code"
                          maxLength={8}
                          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <input
                          type="text"
                          placeholder="Web Login Username"
                          id="new-alarm-webuser"
                          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input
                            type="text"
                            placeholder="Web Password"
                            id="new-alarm-webpass"
                            style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              const { password } = await devicesAPI.generatePassword()
                              ;(document.getElementById('new-alarm-webpass') as HTMLInputElement).value = password
                            }}
                            style={{
                              padding: '0.5rem',
                              background: '#e5e7eb',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                            title="Generate Password"
                          >
                            🎲
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <input
                          type="text"
                          placeholder="User Group (e.g. Operators)"
                          id="new-alarm-group"
                          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                        />
                        <input
                          type="text"
                          placeholder="Access Areas (comma-separated)"
                          id="new-alarm-areas"
                          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                          <input type="checkbox" id="new-alarm-arm" defaultChecked /> Can Arm
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                          <input type="checkbox" id="new-alarm-disarm" defaultChecked /> Can Disarm
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                          <input type="checkbox" id="new-alarm-admin" /> Admin
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                          <input type="checkbox" id="new-alarm-restapi" /> REST API User
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const name = (document.getElementById('new-alarm-name') as HTMLInputElement).value.trim()
                          const code = (document.getElementById('new-alarm-code') as HTMLInputElement).value.trim()
                          const canArm = (document.getElementById('new-alarm-arm') as HTMLInputElement).checked
                          const canDisarm = (document.getElementById('new-alarm-disarm') as HTMLInputElement).checked
                          const isAdmin = (document.getElementById('new-alarm-admin') as HTMLInputElement).checked
                          const areasStr = (document.getElementById('new-alarm-areas') as HTMLInputElement).value.trim()
                          const accessAreas = areasStr ? areasStr.split(',').map(a => a.trim()).filter(a => a) : []
                          const webUsername = (document.getElementById('new-alarm-webuser') as HTMLInputElement).value.trim()
                          const webPassword = (document.getElementById('new-alarm-webpass') as HTMLInputElement).value.trim()
                          const userGroup = (document.getElementById('new-alarm-group') as HTMLInputElement).value.trim()
                          const isRestApiUser = (document.getElementById('new-alarm-restapi') as HTMLInputElement).checked
                          
                          if (!name || !code) {
                            alert('Name and code are required')
                            return
                          }
                          
                          const newUser = { 
                            name, 
                            code, 
                            canArm, 
                            canDisarm, 
                            isAdmin, 
                            accessAreas,
                            webUsername,
                            webPassword,
                            userGroup,
                            isRestApiUser,
                          }
                          setFormData({ ...formData, alarmUsers: [...(formData.alarmUsers || []), newUser] })
                          
                          // Clear form
                          ;(document.getElementById('new-alarm-name') as HTMLInputElement).value = ''
                          ;(document.getElementById('new-alarm-code') as HTMLInputElement).value = ''
                          ;(document.getElementById('new-alarm-webuser') as HTMLInputElement).value = ''
                          ;(document.getElementById('new-alarm-webpass') as HTMLInputElement).value = ''
                          ;(document.getElementById('new-alarm-group') as HTMLInputElement).value = ''
                          ;(document.getElementById('new-alarm-arm') as HTMLInputElement).checked = true
                          ;(document.getElementById('new-alarm-disarm') as HTMLInputElement).checked = true
                          ;(document.getElementById('new-alarm-admin') as HTMLInputElement).checked = false
                          ;(document.getElementById('new-alarm-restapi') as HTMLInputElement).checked = false
                          ;(document.getElementById('new-alarm-areas') as HTMLInputElement).value = ''
                        }}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#f59e0b',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          ➕ Add User
                        </button>
                    </div>
                  </>
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

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.9)',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div style={{ 
            background: 'white', 
            borderRadius: '12px', 
            padding: '1.5rem', 
            maxWidth: '500px', 
            width: '100%',
            textAlign: 'center',
          }}>
            <h3 style={{ margin: '0 0 1rem', color: '#333' }}>
              📷 Scan {scanTarget === 'serialNumber' ? 'Serial Number' : 'Model'} Barcode
            </h3>
            
            {scannerError ? (
              // Error state
              <div style={{ 
                padding: '2rem',
                background: '#fef2f2',
                borderRadius: '8px',
                marginBottom: '1rem',
              }}>
                <p style={{ color: '#991b1b', margin: '0 0 1rem', fontWeight: 600 }}>
                  ⚠️ Camera Error
                </p>
                <p style={{ color: '#991b1b', margin: '0 0 1rem', fontSize: '0.9rem', wordBreak: 'break-word' }}>
                  {scannerError}
                </p>
                <div style={{ color: '#6b7280', margin: 0, fontSize: '0.85rem', textAlign: 'left' }}>
                  <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>Troubleshooting:</p>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                    <li>Site must be served over <strong>HTTPS</strong> (not HTTP)</li>
                    <li>On mobile: Settings → Chrome → Site Settings → Camera → Allow</li>
                    <li>On iOS: Settings → Safari → Camera → Allow</li>
                    <li>Try refreshing the page after granting permission</li>
                  </ul>
                  <p style={{ margin: '0.75rem 0 0', padding: '0.5rem', background: '#fee2e2', borderRadius: '4px', fontSize: '0.8rem' }}>
                    Current URL: {typeof window !== 'undefined' ? window.location.protocol + '//' + window.location.host : 'N/A'}
                  </p>
                </div>
              </div>
            ) : (
              // Camera view
              <div style={{ 
                position: 'relative', 
                width: '100%', 
                background: '#000', 
                borderRadius: '8px',
                overflow: 'hidden',
                marginBottom: '1rem',
              }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', display: 'block', minHeight: '250px' }}
                />
                {/* Scan overlay guide */}
                <div style={{
                  position: 'absolute',
                  inset: '20%',
                  border: '2px dashed #00ff00',
                  borderRadius: '8px',
                  pointerEvents: 'none',
                }} />
                {/* Scanning indicator */}
                {isScanning && (
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(16, 185, 129, 0.9)',
                    color: 'white',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}>
                    🔍 Scanning...
                  </div>
                )}
              </div>
            )}

            <p style={{ color: '#666', fontSize: '0.9rem', margin: '0 0 1rem' }}>
              {scannerError 
                ? 'Fix permissions and try again, or enter manually below.'
                : isScanning 
                  ? 'Point at barcode - it will scan automatically!'
                  : 'Position the barcode within the green guide, then tap capture.'
              }
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={stopScanner}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
              >
                ✕ Cancel
              </button>
              {!scannerError && (
                <button
                  type="button"
                  onClick={captureAndProcess}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                  }}
                >
                  📸 Capture
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const value = prompt(`Enter ${scanTarget === 'serialNumber' ? 'serial number' : 'model'} manually:`)
                  if (value) {
                    setFormData(prev => ({ ...prev, [scanTarget]: value }))
                  }
                  stopScanner()
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
              >
                ⌨️ Manual
              </button>
            </div>

            <p style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '1rem' }}>
              {'BarcodeDetector' in window 
                ? '✅ Auto-detection supported in this browser'
                : '⚠️ Auto-detection not supported - use Capture or Manual'
              }
            </p>
            
            {/* Debug info */}
            {debugInfo && (
              <p style={{ 
                color: '#6b7280', 
                fontSize: '0.75rem', 
                marginTop: '0.5rem',
                padding: '0.5rem',
                background: '#f3f4f6',
                borderRadius: '4px',
                fontFamily: 'monospace',
              }}>
                Status: {debugInfo}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default DeviceModal
