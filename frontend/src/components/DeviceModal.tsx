import { useState } from 'react'
import { Device } from '../types'
import { devicesAPI } from '../services/apiService'

interface DeviceModalProps {
  projectId: string
  device: Device | null
  onClose: () => void
  onDeviceCreated: (device: Device) => void
  onDeviceDeleted: (deviceId: string) => void
}

export const DeviceModal: React.FC<DeviceModalProps> = ({
  projectId,
  device,
  onClose,
  onDeviceCreated,
  onDeviceDeleted,
}) => {
  const [formData, setFormData] = useState(
    device || {
      projectId,
      name: '',
      category: 'network',
      manufacturer: '',
      model: '',
      ipAddress: '',
      username: '',
      password: '',
      status: 'not-installed',
    }
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (device) {
        await devicesAPI.update(device._id, formData)
      } else {
        const newDevice = await devicesAPI.create(formData)
        onDeviceCreated(newDevice)
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{device ? 'Edit Device' : 'Add Device'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-group">
              <label>Device Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="network">Network</option>
                <option value="security">Security</option>
                <option value="camera">Camera</option>
                <option value="av">AV</option>
                <option value="lighting">Lighting</option>
                <option value="control-system">Control System</option>
              </select>
            </div>

            <div className="form-group">
              <label>Manufacturer</label>
              <input
                type="text"
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Model</label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>IP Address</label>
              <input
                type="text"
                value={formData.ipAddress}
                onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                placeholder="192.168.1.100"
              />
            </div>

            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              >
                <option value="not-installed">Not Installed</option>
                <option value="installed">Installed</option>
                <option value="configured">Configured</option>
                <option value="tested">Tested</option>
                <option value="commissioned">Commissioned</option>
              </select>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            {device && (
              <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={loading}>
                Delete
              </button>
            )}
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Device'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}