import { useState } from 'react'
import { reportsAPI } from '../services/apiService'

interface LegacyImportModalProps {
  onClose: () => void
  onSuccess: () => void
}

interface ParsedData {
  projectName: string
  wifiNetworks: { ssid: string; password: string }[]
  devices: any[]
}

export function LegacyImportModal({ onClose, onSuccess }: LegacyImportModalProps) {
  const [input, setInput] = useState('')
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'paste' | 'preview'>('paste')

  const cleanValue = (val: string | undefined): string => {
    if (!val) return ''
    // Remove tabs and everything after them (often contains notes/defaults)
    return val.split('\t')[0].trim()
  }

  const parseContent = () => {
    if (!input.trim()) {
      setError('Please paste some content first')
      return
    }

    setError('')
    
    const data: ParsedData = {
      projectName: '',
      wifiNetworks: [],
      devices: []
    }

    const lines = input.split('\n')
    let currentSection: string | null = null
    let currentDevice: any = null
    let currentSwitchPorts: { port: number; device: string }[] = []
    let currentPduPorts: { port: number; device: string }[] = []

    // Extract project name from header
    const headerMatch = input.match(/^(.+?)\s*Account Details/m)
    if (headerMatch) {
      data.projectName = headerMatch[1].trim()
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()

      // Skip empty lines and dividers
      if (!trimmed || /^=+$/.test(trimmed)) continue

      // Detect section headers [SectionName]
      const sectionMatch = trimmed.match(/^\[([^\]]+)\]/)
      if (sectionMatch) {
        // Save previous device if exists
        if (currentDevice && (currentDevice.name || currentDevice._type === 'wifi')) {
          if (currentDevice._type === 'switch' && currentSwitchPorts.length > 0) {
            currentDevice.managedPorts = currentSwitchPorts.map(p => ({
              portNumber: p.port,
              description: p.device
            }))
            currentSwitchPorts = []
          }
          if (currentDevice._type === 'pdu' && currentPduPorts.length > 0) {
            currentDevice.pduPortNames = currentPduPorts.map(p => p.device).join('\n')
            currentPduPorts = []
          }
          if (currentDevice._type !== 'wifi') {
            data.devices.push(currentDevice)
          }
        }

        currentSection = sectionMatch[1].trim()
        currentDevice = null
        currentSwitchPorts = []
        currentPduPorts = []

        const sectionLower = currentSection.toLowerCase()

        if (sectionLower.includes('wireless') || sectionLower === 'wireless') {
          currentDevice = { _type: 'wifi' }
        } else if (sectionLower.includes('control4')) {
          currentDevice = { _type: 'control4' }
        } else if (sectionLower.match(/^wap\d+$/i)) {
          currentDevice = { _type: 'access-point', name: currentSection }
        } else if (sectionLower.match(/^switch\d+$/i)) {
          currentDevice = { _type: 'switch', name: currentSection }
        } else if (sectionLower.match(/^camera\d+$/i)) {
          currentDevice = { _type: 'camera', name: currentSection }
        } else if (sectionLower.match(/^pdu\d+$/i)) {
          currentDevice = { _type: 'pdu', name: currentSection }
        } else if (sectionLower === 'nvr') {
          currentDevice = { _type: 'nvr', name: 'NVR' }
        } else if (sectionLower === 'cloudkey') {
          currentDevice = { _type: 'cloudkey', name: 'Cloud Key' }
        } else if (sectionLower.match(/^ac\d+$/i) || sectionLower.includes('coolmaster')) {
          currentDevice = { _type: 'hvac-controller', name: currentSection }
        } else if (sectionLower.includes('router')) {
          currentDevice = { _type: 'router', name: 'Router' }
        } else if (sectionLower.includes('modem')) {
          currentDevice = { _type: 'modem', name: 'Modem' }
        } else if (sectionLower.includes('amp') || sectionLower.includes('sonance')) {
          currentDevice = { _type: 'amplifier', name: currentSection }
        } else if (sectionLower.includes('intercom') || sectionLower.includes('ds2')) {
          currentDevice = { _type: 'door-station', name: 'Intercom' }
        } else if (sectionLower.includes('samsung')) {
          currentDevice = { _type: 'tv', name: 'Samsung TV' }
        }

        continue
      }

      // Parse switch port assignments: SWITCH01 PoE Port01: WAP01
      const switchPortMatch = trimmed.match(/^(?:SWITCH\d+)?\s*(?:PoE)?\s*Port(\d+):\s*(.+)$/i)
      if (switchPortMatch && currentDevice && currentDevice._type === 'switch') {
        const portNum = parseInt(switchPortMatch[1])
        const deviceName = switchPortMatch[2].trim()
        if (portNum && deviceName) {
          currentSwitchPorts.push({ port: portNum, device: deviceName })
        }
        continue
      }

      // Parse PDU port assignments: PDU01 Power Port01: CLIENT MODEM
      const pduPortMatch = trimmed.match(/^(?:PDU\d+)?\s*Power\s*Port(\d+):\s*(.+)$/i)
      if (pduPortMatch && currentDevice && currentDevice._type === 'pdu') {
        const portNum = parseInt(pduPortMatch[1])
        const deviceName = pduPortMatch[2].trim()
        if (portNum && deviceName) {
          currentPduPorts.push({ port: portNum, device: deviceName })
        }
        continue
      }

      // Parse key:value pairs - handle tabs as separators too
      const kvMatch = trimmed.match(/^([^:\t]+)[:\t]\s*(.*)$/)
      if (kvMatch && currentDevice) {
        const key = kvMatch[1].trim().toLowerCase()
        const value = kvMatch[2].trim()

        if (!value) continue

        // WiFi networks
        if (currentDevice._type === 'wifi') {
          if (key.includes('ssid')) {
            currentDevice.ssid = value
          } else if (key.includes('password')) {
            currentDevice.password = value
            // Complete wifi entry
            if (currentDevice.ssid) {
              data.wifiNetworks.push({
                ssid: currentDevice.ssid,
                password: currentDevice.password
              })
              currentDevice = { _type: 'wifi' }
            }
          }
          continue
        }

        // Skip control4 for now
        if (currentDevice._type === 'control4') continue

        // Device fields
        if (key.includes('location')) {
          currentDevice.location = value
        } else if (key.includes('brand') || key.includes('manufacturer')) {
          currentDevice.manufacturer = value
        } else if (key.includes('model')) {
          currentDevice.model = value
        } else if (key.includes('serial')) {
          currentDevice.serialNumber = value
        } else if (key.includes('ip address') || key === 'ip') {
          currentDevice.ipAddress = value
        } else if (key.includes('mac address') || key === 'mac') {
          currentDevice.macAddress = value
        } else if (key.includes('login') || (key.includes('user') && !key.includes('account'))) {
          currentDevice.username = value
        } else if (key.includes('password') || key.includes('pass')) {
          currentDevice.password = value
        } else if (key.includes('firmware')) {
          currentDevice.firmwareVersion = value
        } else if (key.includes('name') && !currentDevice.name) {
          currentDevice.name = value
        }
      }

      // Check for Inception alarm info
      if (trimmed.includes('ALARM Serial Number:')) {
        const serialMatch = trimmed.match(/ALARM Serial Number:\s*(\S+)/i)
        if (serialMatch) {
          let alarmDevice = data.devices.find(d => d._type === 'alarm-panel')
          if (!alarmDevice) {
            alarmDevice = { _type: 'alarm-panel', name: 'Inception Alarm', panelType: 'inception' }
            data.devices.push(alarmDevice)
          }
          alarmDevice.serialNumber = serialMatch[1]
        }
      }
    }

    // Save last device
    if (currentDevice && currentDevice.name) {
      if (currentDevice._type === 'switch' && currentSwitchPorts.length > 0) {
        currentDevice.managedPorts = currentSwitchPorts.map(p => ({
          portNumber: p.port,
          description: p.device
        }))
      }
      if (currentDevice._type === 'pdu' && currentPduPorts.length > 0) {
        currentDevice.pduPortNames = currentPduPorts.map(p => p.device).join('\n')
      }
      if (currentDevice._type !== 'wifi') {
        data.devices.push(currentDevice)
      }
    }

    // Remove duplicates from wifi
    const seenSSIDs = new Set<string>()
    data.wifiNetworks = data.wifiNetworks.filter(w => {
      if (!w.ssid || seenSSIDs.has(w.ssid)) return false
      seenSSIDs.add(w.ssid)
      return true
    })

    setParsedData(data)
    setStep('preview')
  }

  const handleImport = async () => {
    if (!parsedData) return

    setImporting(true)
    setError('')

    try {
      const projectId = 'temp-' + Date.now()

      // Create project object
      const project = {
        _id: projectId,
        name: parsedData.projectName || 'Imported Project',
        status: 'in-progress',
        wifiNetworks: parsedData.wifiNetworks.map(w => ({
          ssid: w.ssid,
          password: w.password,
          band: 'Dual',
          vlan: 1
        }))
      }

      // Map device types to Portal categories
      const deviceTypeMap: Record<string, { category: string; deviceType: string }> = {
        'access-point': { category: 'network', deviceType: 'access-point' },
        'switch': { category: 'network', deviceType: 'switch' },
        'router': { category: 'network', deviceType: 'router' },
        'cloudkey': { category: 'network', deviceType: 'cloudkey' },
        'modem': { category: 'network', deviceType: 'router' },
        'camera': { category: 'camera', deviceType: 'camera' },
        'nvr': { category: 'camera', deviceType: 'nvr' },
        'pdu': { category: 'power', deviceType: 'pdu' },
        'amplifier': { category: 'av', deviceType: 'amplifier' },
        'tv': { category: 'av', deviceType: 'tv' },
        'hvac-controller': { category: 'hvac', deviceType: 'hvac-controller' },
        'door-station': { category: 'intercom', deviceType: 'door-station' },
        'alarm-panel': { category: 'security', deviceType: 'alarm-panel' }
      }

      // Convert devices
      const devices = parsedData.devices.map((d, idx) => {
        const mapping = deviceTypeMap[d._type] || { category: 'other', deviceType: 'generic' }

        const device: any = {
          _id: 'dev-' + Date.now() + '-' + idx,
          projectId: projectId,
          name: d.name || 'Device ' + (idx + 1),
          category: mapping.category,
          deviceType: mapping.deviceType,
          manufacturer: d.manufacturer || '',
          model: d.model || '',
          serialNumber: d.serialNumber || '',
          ipAddress: cleanValue(d.ipAddress),
          macAddress: cleanValue(d.macAddress),
          username: cleanValue(d.username),
          password: cleanValue(d.password),
          location: cleanValue(d.location),
          firmwareVersion: d.firmwareVersion || '',
          status: 'installed'
        }

        // Add alarm-specific fields
        if (d._type === 'alarm-panel' && d.panelType) {
          device.panelType = d.panelType
        }

        // Add switch ports
        if (d._type === 'switch' && d.managedPorts) {
          device.managedPorts = d.managedPorts
          device.portCount = Math.max(...d.managedPorts.map((p: any) => p.portNumber), 24)
        }

        // Add PDU port names
        if (d._type === 'pdu' && d.pduPortNames) {
          device.pduPortNames = d.pduPortNames
        }

        return device
      })

      const importData = { project, devices }
      
      await reportsAPI.importJSON(importData)
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to import')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}
      >
        <div className="modal-header">
          <h2>📄 Import Legacy Text File</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          {step === 'paste' && (
            <>
              <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
                Paste the contents of your old project text file below. The importer will extract WiFi networks, devices, and their details.
              </p>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste your legacy text file content here..."
                style={{
                  width: '100%',
                  height: '400px',
                  fontFamily: 'Monaco, Consolas, monospace',
                  fontSize: '0.85rem',
                  padding: '1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  resize: 'vertical'
                }}
              />
            </>
          )}

          {step === 'preview' && parsedData && (
            <>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <div style={{ background: '#eff6ff', padding: '0.5rem 1rem', borderRadius: '6px' }}>
                  <strong style={{ color: '#1d4ed8' }}>{parsedData.wifiNetworks.length}</strong> WiFi Networks
                </div>
                <div style={{ background: '#f0fdf4', padding: '0.5rem 1rem', borderRadius: '6px' }}>
                  <strong style={{ color: '#15803d' }}>{parsedData.devices.length}</strong> Devices
                </div>
              </div>

              {parsedData.projectName && (
                <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                  📋 Project Name: <strong>{parsedData.projectName}</strong>
                </div>
              )}

              {/* WiFi Networks */}
              {parsedData.wifiNetworks.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <h4 style={{ marginBottom: '0.5rem' }}>📶 WiFi Networks</h4>
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {parsedData.wifiNetworks.map((w, i) => (
                      <div key={i} style={{ background: '#f9fafb', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.9rem' }}>
                        <strong>{w.ssid}</strong> — <code>{w.password}</code>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Devices */}
              <div>
                <h4 style={{ marginBottom: '0.5rem' }}>🔧 Devices</h4>
                <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                        <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Name</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Type</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>IP</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.devices.map((d, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '0.5rem' }}>{d.name}</td>
                          <td style={{ padding: '0.5rem' }}><span style={{ background: '#e5e7eb', padding: '0.125rem 0.375rem', borderRadius: '4px', fontSize: '0.75rem' }}>{d._type}</span></td>
                          <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>{cleanValue(d.ipAddress) || '—'}</td>
                          <td style={{ padding: '0.5rem' }}>{cleanValue(d.location) || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          {step === 'paste' && (
            <>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={parseContent}>
                🔍 Parse Content
              </button>
            </>
          )}
          {step === 'preview' && (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setStep('paste')}>
                ← Back
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleImport}
                disabled={importing}
              >
                {importing ? '⏳ Importing...' : '📥 Import to Portal'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
