import { useState, useEffect } from 'react'
import { Device, DeviceCategory } from '../types'
import { devicesAPI } from '../services/apiService'
import { DeviceModal } from './DeviceModal'

interface DeviceListProps {
  projectId: string
  onDevicesChanged?: () => void
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

// Helper to parse IP address for sorting
const parseIP = (ip: string): number => {
  if (!ip) return Infinity
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(isNaN)) return Infinity
  return parts[0] * 16777216 + parts[1] * 65536 + parts[2] * 256 + parts[3]
}

// Sort devices by IP address
const sortByIP = (devices: Device[]): Device[] => {
  return [...devices].sort((a, b) => parseIP(a.ipAddress || '') - parseIP(b.ipAddress || ''))
}

export const DeviceList: React.FC<DeviceListProps> = ({ projectId, onDevicesChanged }) => {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [searchFilter, setSearchFilter] = useState('')
  const [viewMode, setViewMode] = useState<'grouped' | 'table'>('grouped')
  const [viewOnlyMode, setViewOnlyMode] = useState(false)

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

  const handleDeviceCreated = (newDevice: Device | Device[]) => {
    // Handle both single device and array of devices (from bulk add)
    const devicesToAdd = Array.isArray(newDevice) ? newDevice : [newDevice]
    
    setDevices(prev => {
      const updated = [...prev]
      for (const dev of devicesToAdd) {
        const existingIndex = updated.findIndex(d => d._id === dev._id)
        if (existingIndex >= 0) {
          updated[existingIndex] = dev
        } else {
          updated.unshift(dev)
        }
      }
      return updated
    })
    setShowModal(false)
    setSelectedDevice(null)
    setViewOnlyMode(false)
    // Notify parent that devices changed (for port tab sync)
    if (onDevicesChanged) onDevicesChanged()
  }

  const handleDeviceDeleted = (deviceId: string) => {
    setDevices(devices.filter(d => d._id !== deviceId))
    setSelectedDevice(null)
    // Notify parent that devices changed
    if (onDevicesChanged) onDevicesChanged()
  }

  const copyToClipboard = async (text: string | undefined, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    if (text) {
      try {
        await navigator.clipboard.writeText(text)
        // Visual feedback - briefly change button text
        const btn = e?.currentTarget as HTMLButtonElement
        if (btn) {
          const original = btn.textContent
          btn.textContent = '✓'
          setTimeout(() => { btn.textContent = original }, 1000)
        }
      } catch (err) {
        // Fallback for older browsers
        const textarea = document.createElement('textarea')
        textarea.value = text
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
    }
  }

  // Group devices by category and sort by IP within each group
  const devicesByCategory = devices.reduce((acc, device) => {
    const cat = device.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(device)
    return acc
  }, {} as Record<string, Device[]>)
  
  // Sort each category by IP
  Object.keys(devicesByCategory).forEach(cat => {
    devicesByCategory[cat] = sortByIP(devicesByCategory[cat])
  })

  // Filter devices by category and search, then sort by IP
  const filteredDevices = sortByIP(
    devices.filter(d => {
      const matchesCategory = filterCategory === 'all' || d.category === filterCategory
      const searchLower = searchFilter.toLowerCase()
      const matchesSearch = !searchFilter || 
        d.name.toLowerCase().includes(searchLower) ||
        d.ipAddress?.toLowerCase().includes(searchLower) ||
        d.manufacturer?.toLowerCase().includes(searchLower) ||
        d.model?.toLowerCase().includes(searchLower) ||
        d.location?.toLowerCase().includes(searchLower)
      return matchesCategory && matchesSearch
    })
  )

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0 }}>🎛️ Devices ({filteredDevices.length}{searchFilter || filterCategory !== 'all' ? `/${devices.length}` : ''})</h3>
          
          {/* Search filter */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="🔍 Filter by name, IP, brand..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              style={{ 
                padding: '0.5rem 0.5rem 0.5rem 2rem', 
                borderRadius: '4px', 
                border: '1px solid #d1d5db',
                width: '220px',
              }}
            />
            {searchFilter && (
              <button
                onClick={() => setSearchFilter('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#9ca3af',
                }}
              >
                ✕
              </button>
            )}
          </div>
          
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
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>IP / MAC</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Credentials</th>
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
                        <div>
                          <strong>{device.name}</strong>
                          {device.manufacturer && (
                            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                              {device.manufacturer} {device.model}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem', color: '#6b7280' }}>{device.deviceType || device.category}</td>
                    <td style={{ padding: '0.75rem' }}>
                      {device.ipAddress ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <a 
                            href={`http://${device.ipAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ textDecoration: 'none', color: 'inherit' }}
                          >
                            <code style={{ background: '#f3f4f6', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem', cursor: 'pointer' }}>
                              {device.ipAddress}
                            </code>
                          </a>
                          <button onClick={(e) => copyToClipboard(device.ipAddress, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem' }}>📋</button>
                        </div>
                      ) : '-'}
                      {device.macAddress && (
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                          {device.macAddress}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {!device.hideCredentials && (device.username || device.password) ? (
                        <div style={{ fontSize: '0.85rem' }}>
                          {device.username && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <code style={{ background: '#fef3c7', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>{device.username}</code>
                              <button onClick={(e) => copyToClipboard(device.username, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem' }}>📋</button>
                            </div>
                          )}
                          {device.password && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.125rem' }}>
                              <code style={{ background: '#fef3c7', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>{device.password}</code>
                              <button onClick={(e) => copyToClipboard(device.password, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem' }}>📋</button>
                            </div>
                          )}
                        </div>
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
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setSelectedDevice(device)
                            setViewOnlyMode(true)
                            setShowModal(true)
                          }}
                          title="View"
                        >
                          👁️
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setSelectedDevice(device)
                            setViewOnlyMode(false)
                            setShowModal(true)
                          }}
                        >
                          ✏️
                        </button>
                      </div>
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
                            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', color: '#6b7280', flexWrap: 'wrap', alignItems: 'center' }}>
                              {device.manufacturer && (
                                <span>{device.manufacturer} {device.model}</span>
                              )}
                              {device.ipAddress && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <a 
                                    href={`http://${device.ipAddress}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ textDecoration: 'none', color: 'inherit' }}
                                  >
                                    <code style={{ background: '#e5e7eb', padding: '0.125rem 0.375rem', borderRadius: '4px', cursor: 'pointer' }}>
                                      {device.ipAddress}
                                    </code>
                                  </a>
                                  <button
                                    onClick={(e) => copyToClipboard(device.ipAddress, e)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.125rem' }}
                                    title="Copy IP"
                                  >
                                    📋
                                  </button>
                                </span>
                              )}
                              {device.macAddress && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <span style={{ color: '#9ca3af' }}>MAC:</span>
                                  <code style={{ background: '#f3f4f6', padding: '0.125rem 0.375rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                                    {device.macAddress}
                                  </code>
                                </span>
                              )}
                              {device.vlan && <span>VLAN {device.vlan}</span>}
                              {/* Show credentials inline for routers and cameras */}
                              {(device.deviceType === 'router' || device.deviceType === 'camera') && !device.hideCredentials && device.username && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <span style={{ color: '#9ca3af' }}>User:</span>
                                  <code style={{ background: '#fef3c7', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>
                                    {device.username}
                                  </code>
                                  <button
                                    onClick={(e) => copyToClipboard(device.username, e)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.125rem', fontSize: '0.75rem' }}
                                    title="Copy Username"
                                  >
                                    📋
                                  </button>
                                </span>
                              )}
                              {(device.deviceType === 'router' || device.deviceType === 'camera') && !device.hideCredentials && device.password && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <span style={{ color: '#9ca3af' }}>Pass:</span>
                                  <code style={{ background: '#fef3c7', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>
                                    {device.password}
                                  </code>
                                  <button
                                    onClick={(e) => copyToClipboard(device.password, e)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.125rem', fontSize: '0.75rem' }}
                                    title="Copy Password"
                                  >
                                    📋
                                  </button>
                                </span>
                              )}
                              {device.location && <span>📍 {device.location}</span>}
                            </div>
                            {/* Credentials row for other devices */}
                            {device.deviceType !== 'router' && device.deviceType !== 'camera' && (device.username || device.password) && !device.hideCredentials && (
                              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: '#6b7280', marginTop: '0.5rem', alignItems: 'center' }}>
                                {device.username && (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <span style={{ color: '#9ca3af' }}>User:</span>
                                    <code style={{ background: '#fef3c7', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>
                                      {device.username}
                                    </code>
                                    <button
                                      onClick={(e) => copyToClipboard(device.username, e)}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.125rem', fontSize: '0.75rem' }}
                                      title="Copy Username"
                                    >
                                      📋
                                    </button>
                                  </span>
                                )}
                                {device.password && (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <span style={{ color: '#9ca3af' }}>Pass:</span>
                                    <code style={{ background: '#fef3c7', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>
                                      {device.password}
                                    </code>
                                    <button
                                      onClick={(e) => copyToClipboard(device.password, e)}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.125rem', fontSize: '0.75rem' }}
                                      title="Copy Password"
                                    >
                                      📋
                                    </button>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setSelectedDevice(device)
                                setViewOnlyMode(true)
                                setShowModal(true)
                              }}
                              title="View Details"
                            >
                              👁️
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setSelectedDevice(device)
                                setViewOnlyMode(false)
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
          viewOnly={viewOnlyMode}
          onClose={() => {
            setShowModal(false)
            setSelectedDevice(null)
            setViewOnlyMode(false)
          }}
          onDeviceCreated={handleDeviceCreated}
          onDeviceDeleted={handleDeviceDeleted}
        />
      )}
    </div>
  )
}

export default DeviceList
