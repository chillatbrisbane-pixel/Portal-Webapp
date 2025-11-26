import React, { useState } from 'react'
import { Project } from '../types'
import { projectsAPI } from '../services/apiService'

interface DeviceManagementModalProps {
  project: Project
  onClose: () => void
  onDevicesUpdated: (project: Project) => void
}

export const DeviceManagementModal: React.FC<DeviceManagementModalProps> = ({
  project,
  onClose,
  onDevicesUpdated,
}) => {
  const [devices, setDevices] = useState(project.devices || [])
  const [newDevice, setNewDevice] = useState({
    name: '',
    type: 'network-switch',
    ipAddress: '',
    description: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const deviceTypes = [
    { value: 'network-switch', label: '🌐 Network Switch' },
    { value: 'access-point', label: '📡 Access Point' },
    { value: 'camera', label: '📹 Camera' },
    { value: 'nvr', label: '🎬 NVR' },
    { value: 'display', label: '🖥️ Display' },
    { value: 'amplifier', label: '🔊 Amplifier' },
    { value: 'control-system', label: '🎛️ Control System' },
    { value: 'other', label: '📦 Other' },
  ]

  const addDevice = async () => {
    if (!newDevice.name.trim()) {
      setError('Device name is required')
      return
    }

    setError('')
    setLoading(true)

    try {
      const updatedProject = await projectsAPI.addDevice(project._id, newDevice as any)
      setDevices(updatedProject.devices || [])
      setNewDevice({ name: '', type: 'network-switch', ipAddress: '', description: '' })
      onDevicesUpdated(updatedProject)
    } catch (err: any) {
      setError(err.message || 'Failed to add device')
    } finally {
      setLoading(false)
    }
  }

  const removeDevice = async (deviceId: string) => {
    if (!window.confirm('Delete this device?')) return

    setLoading(true)
    try {
      const updatedProject = await projectsAPI.removeDevice(project._id, deviceId)
      setDevices(updatedProject.devices || [])
      onDevicesUpdated(updatedProject)
    } catch (err: any) {
      setError(err.message || 'Failed to remove device')
    } finally {
      setLoading(false)
    }
  }

  const getDeviceTypeLabel = (type: string) => {
    return deviceTypes.find(d => d.value === type)?.label || type
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        {/* Header */}
        <div className="modal-header">
          <h2>📦 Device Management</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          <h3 style={{ color: '#333333', marginBottom: '1rem' }}>Add New Device</h3>

          <div className="form-group">
            <label htmlFor="deviceName">Device Name *</label>
            <input
              id="deviceName"
              type="text"
              value={newDevice.name}
              onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
              placeholder="e.g., Main Switch"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="deviceType">Device Type *</label>
            <select
              id="deviceType"
              value={newDevice.type}
              onChange={(e) => setNewDevice({ ...newDevice, type: e.target.value })}
              disabled={loading}
            >
              {deviceTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="ipAddress">IP Address</label>
            <input
              id="ipAddress"
              type="text"
              value={newDevice.ipAddress}
              onChange={(e) => setNewDevice({ ...newDevice, ipAddress: e.target.value })}
              placeholder="e.g., 192.168.1.10"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={newDevice.description}
              onChange={(e) => setNewDevice({ ...newDevice, description: e.target.value })}
              placeholder="Device details and notes"
              rows={2}
              style={{ fontFamily: 'inherit', padding: '0.75rem' }}
              disabled={loading}
            />
          </div>

          <button
            onClick={addDevice}
            disabled={loading || !newDevice.name.trim()}
            style={{
              background: '#0066cc',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              width: '100%',
              marginBottom: '2rem',
            }}
          >
            {loading ? '⏳ Adding...' : '➕ Add Device'}
          </button>

          {/* Device List */}
          {devices.length > 0 && (
            <>
              <h3 style={{ color: '#333333', marginTop: '2rem', marginBottom: '1rem' }}>
                Devices ({devices.length})
              </h3>

              <div style={{ display: 'grid', gap: '1rem' }}>
                {devices.map(device => (
                  <div
                    key={device._id}
                    style={{
                      padding: '1rem',
                      background: '#f9fafb',
                      borderRadius: '6px',
                      border: '1px solid #e5e7eb',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                      <div>
                        <h4 style={{ margin: '0 0 0.25rem 0', color: '#333333' }}>
                          {device.name}
                        </h4>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#6b7280' }}>
                          {getDeviceTypeLabel(device.type)}
                        </p>
                      </div>
                      <button
                        onClick={() => removeDevice(device._id)}
                        disabled={loading}
                        style={{
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                        }}
                      >
                        Delete
                      </button>
                    </div>

                    {device.ipAddress && (
                      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
                        <strong>IP:</strong> {device.ipAddress}
                      </p>
                    )}

                    {device.description && (
                      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#6b7280' }}>
                        {device.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export default DeviceManagementModal
