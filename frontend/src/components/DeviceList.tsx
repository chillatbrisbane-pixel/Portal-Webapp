import { useState, useEffect } from 'react'
import { Device, DeviceCategory } from '../types'
import { devicesAPI } from '../services/apiService'
import { DeviceModal } from './DeviceModal'

interface DeviceListProps {
  projectId: string
}

const CATEGORY_INFO: Record<DeviceCategory, { icon: string; label: string; color: string }> = {
  network: { icon: '🔗', label: 'Networking', color: '#3b82f6' },
  camera: { icon: '📹', label: 'Cameras', color: '#ef4444' },
  security: { icon: '🔒', label: 'Security', color: '#f59e0b' },
  'control-system': { icon: '🎛️', label: 'Control System', color: '#8b5cf6' },
  lighting: { icon: '💡', label: 'Lighting', color: '#eab308' },
  av: { icon: '📺', label: 'AV Equipment', color: '#10b981' },
  other: { icon: '📦', label: 'Other Devices', color: '#6b7280' },
}

export const DeviceList: React.FC<DeviceListProps> = ({ projectId }) => {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grouped' | 'table'>('grouped')

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
    const existingIndex = devices.findIndex(d => d._id === newDevice._id)
    if (existingIndex >= 0) {
      setDevices(prev => prev.map(d => d._id === newDevice._id ? newDevice : d))
    } else {
      setDevices([newDevice, ...devices])
    }
    setShowModal(false)
    setSelectedDevice(null)
  }

  const handleDeviceDeleted = (deviceId: string) => {
    setDevices(devices.filter(d => d._id !== deviceId))
    setSelectedDevice(null)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  // Group devices by category
  const devicesByCategory = devices.reduce((acc, device) => {
    const cat = device.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(device)
    return acc
  }, {} as Record<string, Device[]>)

  // Filter devices
  const filteredDevices = filterCategory === 'all' 
    ? devices 
    : devices.filter(d => d.category === filterCategory)

  // Category counts
  const categoryCounts = Object.entries(devicesByCategory).map(([cat, devs]) => ({
    category: cat,
    count: devs.length,
    ...CATEGORY_INFO[cat as DeviceCategory]
  }))

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'not-installed': '#9ca3af',
      'installed': '#3b82f6',
      'configured': '#8b5cf6',
      'tested': '#f59e0b',
      'commissioned': '#10b981',
    }
    return colors[status] || '#9ca3af'
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h3 style={{ margin: 0 }}>🎛️ Devices ({devices.length})</h3>
          
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
          >
            <option value="all">All Categories</option>
            {Object.entries(CATEGORY_INFO).map(([key, info]) => (
              <option key={key} value={key}>{info.icon} {info.label}</option>
            ))}
          </select>

          <div style={{ display: 'flex', gap: '0.25rem', background: '#f3f4f6', borderRadius: '6px', padding: '0.25rem' }}>
            <button
              onClick={() => setViewMode('grouped')}
              style={{
                padding: '0.25rem 0.75rem',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                background: viewMode === 'grouped' ? 'white' : 'transparent',
                boxShadow: viewMode === 'grouped' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              📦 Grouped
            </button>
            <button
              onClick={() => setViewMode('table')}
              style={{
                padding: '0.25rem 0.75rem',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                background: viewMode === 'table' ? 'white' : 'transparent',
                boxShadow: viewMode === 'table' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              📋 Table
            </button>
          </div>
        </div>

        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          ➕ Add Device
        </button>
      </div>

      {/* Category Summary */}
      {filterCategory === 'all' && devices.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {categoryCounts.map(cat => (
            <button
              key={cat.category}
              onClick={() => setFilterCategory(cat.category)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '9999px',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              <span style={{
                background: cat.color,
                color: 'white',
                padding: '0.125rem 0.5rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}>
                {cat.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <p>Loading devices...</p>
      ) : devices.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</p>
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>No devices added yet.</p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            ➕ Add First Device
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Name</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Type</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Manufacturer</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>IP Address</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>VLAN</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDevices.map(device => {
                const catInfo = CATEGORY_INFO[device.category as DeviceCategory] || CATEGORY_INFO.other
                return (
                  <tr key={device._id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>{catInfo.icon}</span>
                        <strong>{device.name}</strong>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem', color: '#6b7280' }}>{device.deviceType || device.category}</td>
                    <td style={{ padding: '0.75rem' }}>{device.manufacturer || '-'}</td>
                    <td style={{ padding: '0.75rem' }}>
                      {device.ipAddress ? (
                        <code style={{ background: '#f3f4f6', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}>
                          {device.ipAddress}
                        </code>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '0.75rem' }}>{device.vlan || '-'}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: getStatusColor(device.status),
                        marginRight: '0.5rem',
                      }} />
                      {device.status}
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
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* GROUPED VIEW */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {Object.entries(devicesByCategory)
            .filter(([cat]) => filterCategory === 'all' || cat === filterCategory)
            .map(([category, catDevices]) => {
              const catInfo = CATEGORY_INFO[category as DeviceCategory] || CATEGORY_INFO.other
              return (
                <div key={category} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{
                    padding: '1rem 1.5rem',
                    background: `linear-gradient(135deg, ${catInfo.color}15, ${catInfo.color}05)`,
                    borderBottom: `2px solid ${catInfo.color}30`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                  }}>
                    <span style={{ fontSize: '1.5rem' }}>{catInfo.icon}</span>
                    <h4 style={{ margin: 0, color: '#333' }}>{catInfo.label}</h4>
                    <span style={{
                      background: catInfo.color,
                      color: 'white',
                      padding: '0.125rem 0.5rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}>
                      {catDevices.length}
                    </span>
                  </div>

                  <div style={{ padding: '1rem 1.5rem' }}>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      {catDevices.map(device => (
                        <div
                          key={device._id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '1rem',
                            background: '#f9fafb',
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                              <strong style={{ fontSize: '1.1rem' }}>{device.name}</strong>
                              <span style={{
                                display: 'inline-block',
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: getStatusColor(device.status),
                              }} />
                            </div>
                            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', color: '#6b7280', flexWrap: 'wrap' }}>
                              {device.manufacturer && (
                                <span>{device.manufacturer} {device.model}</span>
                              )}
                              {device.ipAddress && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <code style={{ background: '#e5e7eb', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>
                                    {device.ipAddress}
                                  </code>
                                  <button
                                    onClick={() => copyToClipboard(device.ipAddress)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.125rem' }}
                                    title="Copy IP"
                                  >
                                    📋
                                  </button>
                                </span>
                              )}
                              {device.vlan && <span>VLAN {device.vlan}</span>}
                              {device.location && <span>📍 {device.location}</span>}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {device.password && !device.hideCredentials && (
                              <button
                                onClick={() => copyToClipboard(device.password)}
                                style={{
                                  padding: '0.5rem',
                                  background: '#f3f4f6',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                }}
                                title="Copy Password"
                              >
                                🔑
                              </button>
                            )}
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setSelectedDevice(device)
                                setShowModal(true)
                              }}
                            >
                              ✏️ Edit
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      )}

      {showModal && (
        <DeviceModal
          projectId={projectId}
          device={selectedDevice}
          existingDevices={devices}
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

export default DeviceList
