import React, { useState, useEffect } from 'react';
import { clientAccessAPI } from '../services/apiService';

interface WiFiNetwork {
  name: string;
  password: string;
  vlan?: number;
  band?: string;
}

interface Device {
  _id: string;
  name: string;
  category: string;
  deviceType: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  macAddress?: string;
  ipAddress?: string;
  vlan?: number;
  location?: string;
  username?: string;
  password?: string;
  ssids?: { name: string; password: string }[];
  configNotes?: string;
}

interface ProjectData {
  name: string;
  clientName?: string;
  address?: string;
  state?: string;
  postcode?: string;
  wifiNetworks?: WiFiNetwork[];
  projectManager?: { name?: string; phone?: string };
  status?: string;
}

const CATEGORY_INFO: Record<string, { icon: string; label: string; color: string }> = {
  'network': { icon: '🔗', label: 'Networking', color: '#3b82f6' },
  'security': { icon: '🔒', label: 'Security', color: '#f59e0b' },
  'camera': { icon: '📹', label: 'Cameras', color: '#ef4444' },
  'control-system': { icon: '🎛️', label: 'Control System', color: '#8b5cf6' },
  'user-interface': { icon: '📱', label: 'User Interfaces', color: '#a855f7' },
  'intercom': { icon: '🔔', label: 'Intercom', color: '#ec4899' },
  'lighting': { icon: '💡', label: 'Lighting', color: '#eab308' },
  'power': { icon: '🔌', label: 'Power', color: '#dc2626' },
  'hvac': { icon: '❄️', label: 'HVAC', color: '#06b6d4' },
  'av': { icon: '📺', label: 'AV Equipment', color: '#10b981' },
  'other': { icon: '📦', label: 'Other', color: '#6b7280' },
};

// Extract token from URL path /client/{token}
const getTokenFromUrl = () => {
  const path = window.location.pathname;
  const match = path.match(/^\/client\/([a-f0-9]+)$/i);
  return match ? match[1] : null;
};

export const ClientPortal: React.FC = () => {
  const token = getTokenFromUrl();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requiresPin, setRequiresPin] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [project, setProject] = useState<ProjectData | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showPasswords, setShowPasswords] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (token) {
      loadProject();
    }
  }, [token]);

  const loadProject = async (pinCode?: string) => {
    try {
      setLoading(true);
      setError('');
      const data = await clientAccessAPI.getProjectByToken(token!, pinCode);
      setProject(data.project);
      setDevices(data.devices);
      setRequiresPin(false);
      
      // Expand all categories by default
      const categories = new Set(data.devices.map((d: Device) => d.category));
      setExpandedCategories(categories);
    } catch (err: any) {
      if (err.requiresPin) {
        setRequiresPin(true);
      } else {
        setError(err.error || 'Failed to load project');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    
    if (pin.length < 4) {
      setPinError('PIN must be at least 4 digits');
      return;
    }
    
    try {
      await clientAccessAPI.verifyPin(token!, pin);
      loadProject(pin);
    } catch (err: any) {
      setPinError(err.error || 'Incorrect PIN');
    }
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const togglePassword = (id: string) => {
    setShowPasswords(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const groupDevicesByCategory = () => {
    const grouped: Record<string, Device[]> = {};
    devices.forEach(device => {
      if (!grouped[device.category]) {
        grouped[device.category] = [];
      }
      grouped[device.category].push(device);
    });
    return grouped;
  };

  // PIN entry screen
  if (requiresPin) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(135deg, #0066cc 0%, #004999 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '3rem',
          maxWidth: '400px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔐</div>
          <h2 style={{ color: '#333', marginBottom: '0.5rem' }}>PIN Required</h2>
          <p style={{ color: '#666', marginBottom: '2rem' }}>
            Enter the PIN provided by your system integrator
          </p>
          
          <form onSubmit={handlePinSubmit}>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter PIN"
              maxLength={6}
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '1.5rem',
                textAlign: 'center',
                letterSpacing: '0.5rem',
                border: `2px solid ${pinError ? '#ef4444' : '#e5e7eb'}`,
                borderRadius: '8px',
                marginBottom: '1rem',
              }}
              autoFocus
            />
            {pinError && (
              <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{pinError}</p>
            )}
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '1rem',
                background: '#0066cc',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Access System Profile
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f3f4f6',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
          <p>Loading your system profile...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f3f4f6',
      }}>
        <div style={{ 
          textAlign: 'center', 
          background: 'white', 
          padding: '3rem', 
          borderRadius: '16px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
          <h2 style={{ color: '#dc2626', marginBottom: '0.5rem' }}>Access Denied</h2>
          <p style={{ color: '#666' }}>{error}</p>
        </div>
      </div>
    );
  }

  const devicesByCategory = groupDevicesByCategory();

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      {/* Header */}
      <div style={{ 
        background: 'linear-gradient(135deg, #0066cc 0%, #004999 100%)',
        color: 'white',
        padding: '2rem',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{ margin: 0, fontSize: '1.75rem' }}>{project?.name}</h1>
          {project?.clientName && (
            <p style={{ margin: '0.5rem 0 0', opacity: 0.9 }}>{project.clientName}</p>
          )}
          {project?.address && (
            <p style={{ margin: '0.25rem 0 0', opacity: 0.7, fontSize: '0.9rem' }}>
              {project.address}{project.state && `, ${project.state}`} {project.postcode}
            </p>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        {/* WiFi Networks */}
        {project?.wifiNetworks && project.wifiNetworks.length > 0 && (
          <div style={{ 
            background: 'white', 
            borderRadius: '12px', 
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}>
            <h2 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📶 WiFi Networks
            </h2>
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {project.wifiNetworks.map((wifi, i) => (
                <div 
                  key={i}
                  style={{
                    padding: '1rem',
                    background: '#f0f9ff',
                    borderRadius: '8px',
                    border: '1px solid #bae6fd',
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#0369a1', marginBottom: '0.5rem' }}>
                    {wifi.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: '#666', fontSize: '0.9rem' }}>Password:</span>
                    <code style={{ 
                      background: '#e0f2fe', 
                      padding: '0.25rem 0.5rem', 
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                    }}>
                      {showPasswords.has(`wifi-${i}`) ? wifi.password : '••••••••'}
                    </code>
                    <button
                      onClick={() => togglePassword(`wifi-${i}`)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '1rem',
                      }}
                    >
                      {showPasswords.has(`wifi-${i}`) ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Devices by Category */}
        {Object.entries(devicesByCategory).map(([category, catDevices]) => {
          const catInfo = CATEGORY_INFO[category] || CATEGORY_INFO.other;
          const isExpanded = expandedCategories.has(category);
          
          return (
            <div 
              key={category}
              style={{ 
                background: 'white', 
                borderRadius: '12px', 
                marginBottom: '1rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                overflow: 'hidden',
              }}
            >
              {/* Category Header */}
              <div 
                onClick={() => toggleCategory(category)}
                style={{
                  padding: '1rem 1.5rem',
                  background: catInfo.color,
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>{catInfo.icon}</span>
                  <span style={{ fontWeight: 600 }}>{catInfo.label}</span>
                  <span style={{ 
                    background: 'rgba(255,255,255,0.2)', 
                    padding: '0.25rem 0.75rem', 
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                  }}>
                    {catDevices.length}
                  </span>
                </div>
                <span style={{ fontSize: '1.25rem' }}>{isExpanded ? '▼' : '▶'}</span>
              </div>

              {/* Devices List */}
              {isExpanded && (
                <div style={{ padding: '1rem' }}>
                  {catDevices.map(device => (
                    <div 
                      key={device._id}
                      style={{
                        padding: '1rem',
                        borderBottom: '1px solid #e5e7eb',
                        ':last-child': { borderBottom: 'none' },
                      }}
                    >
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'flex-start',
                        marginBottom: '0.75rem',
                      }}>
                        <div>
                          <div style={{ fontWeight: 600, color: '#1f2937' }}>{device.name}</div>
                          {(device.manufacturer || device.model) && (
                            <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                              {[device.manufacturer, device.model].filter(Boolean).join(' ')}
                            </div>
                          )}
                        </div>
                        {device.location && (
                          <div style={{ 
                            background: '#f3f4f6', 
                            padding: '0.25rem 0.75rem', 
                            borderRadius: '4px',
                            fontSize: '0.85rem',
                            color: '#4b5563',
                          }}>
                            📍 {device.location}
                          </div>
                        )}
                      </div>

                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                        gap: '0.5rem',
                        fontSize: '0.9rem',
                      }}>
                        {device.ipAddress && (
                          <div>
                            <span style={{ color: '#6b7280' }}>IP:</span>{' '}
                            <code style={{ background: '#f3f4f6', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>
                              {device.ipAddress}
                            </code>
                          </div>
                        )}
                        {device.macAddress && (
                          <div>
                            <span style={{ color: '#6b7280' }}>MAC:</span>{' '}
                            <code style={{ background: '#f3f4f6', padding: '0.125rem 0.375rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                              {device.macAddress}
                            </code>
                          </div>
                        )}
                        {device.serialNumber && (
                          <div>
                            <span style={{ color: '#6b7280' }}>Serial:</span>{' '}
                            <span>{device.serialNumber}</span>
                          </div>
                        )}
                        {device.vlan && (
                          <div>
                            <span style={{ color: '#6b7280' }}>VLAN:</span>{' '}
                            <span>{device.vlan}</span>
                          </div>
                        )}
                        {device.username && (
                          <div>
                            <span style={{ color: '#6b7280' }}>User:</span>{' '}
                            <span>{device.username}</span>
                          </div>
                        )}
                        {device.password && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span style={{ color: '#6b7280' }}>Pass:</span>{' '}
                            <code style={{ background: '#f3f4f6', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>
                              {showPasswords.has(device._id) ? device.password : '••••••'}
                            </code>
                            <button
                              onClick={() => togglePassword(device._id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}
                            >
                              {showPasswords.has(device._id) ? '🙈' : '👁️'}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Device SSIDs */}
                      {device.ssids && device.ssids.length > 0 && (
                        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
                          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.5rem' }}>WiFi Networks:</div>
                          {device.ssids.map((ssid, i) => (
                            <div key={i} style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem' }}>
                              <span>📶 {ssid.name}</span>
                              <span style={{ color: '#6b7280' }}>
                                Pass: {showPasswords.has(`${device._id}-ssid-${i}`) ? ssid.password : '••••••'}
                                <button
                                  onClick={() => togglePassword(`${device._id}-ssid-${i}`)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: '0.25rem' }}
                                >
                                  {showPasswords.has(`${device._id}-ssid-${i}`) ? '🙈' : '👁️'}
                                </button>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {device.configNotes && (
                        <div style={{ 
                          marginTop: '0.75rem', 
                          padding: '0.5rem', 
                          background: '#fefce8', 
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                          color: '#854d0e',
                        }}>
                          📝 {device.configNotes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Support Footer */}
        <div style={{ 
          background: 'white', 
          borderRadius: '12px', 
          padding: '1.5rem',
          marginTop: '2rem',
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}>
          <h3 style={{ margin: '0 0 0.5rem', color: '#1f2937' }}>Need Help?</h3>
          <p style={{ margin: 0, color: '#6b7280' }}>
            Contact your system integrator for technical support
          </p>
          {project?.projectManager?.name && (
            <p style={{ margin: '0.5rem 0 0', color: '#0066cc' }}>
              {project.projectManager.name}
              {project.projectManager.phone && ` • ${project.projectManager.phone}`}
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '2rem', color: '#9ca3af', fontSize: '0.85rem' }}>
          Powered by Electronic Living Portal
        </div>
      </div>
    </div>
  );
};

export default ClientPortal;
