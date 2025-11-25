import { useState, useEffect } from 'react'
import { Device } from '../types'
import { devicesAPI } from '../services/apiService'
import { DeviceModal } from './DeviceModal'

interface DeviceListProps {
  projectId: string
}

export const DeviceList: React.FC<DeviceListProps> = ({ projectId }) => {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)

  useEffect(() => {
    loadDevices()
  }, [projectId])

  const loadDevices = async () => {
    try {
      setLoading(true)
      const data = await devicesAPI.getByProject(projectId)
      setDevices(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeviceCreated = (newDevice: Device) => {
    setDevices([newDevice, ...devices])
    setShowModal(false)
  }

  const handleDeviceDeleted = (deviceId: string) => {
    setDevices(devices.filter(d => d._id !== deviceId))
    setSelectedDevice(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3>🎛️ Devices</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
          ➕ Add Device
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <p>Loading devices...</p>
      ) : devices.length === 0 ? (
        <p className="text-muted">No devices added yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--gray-200)' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Name</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Category</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Manufacturer</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>IP Address</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.map(device => (
                <tr key={device._id} style={{ borderBottom: '1px solid var(--gray-200)' }}>
                  <td style={{ padding: '0.75rem' }}>{device.name}</td>
                  <td style={{ padding: '0.75rem' }}>{device.category}</td>
                  <td style={{ padding: '0.75rem' }}>{device.manufacturer || 'N/A'}</td>
                  <td style={{ padding: '0.75rem' }}>{device.ipAddress || 'N/A'}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', borderRadius: '3px', background: 'var(--gray-200)' }}>
                      {device.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setSelectedDevice(device)
                        setShowModal(true)
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <DeviceModal
          projectId={projectId}
          device={selectedDevice}
          onClose={() => {
            setShowModal(false)
            setSelectedDevice(null)
          }}
          onDeviceCreated={handleDeviceCreated}
          onDeviceDeleted={handleDeviceDeleted}
        />
      )}
    </div>
  )
}