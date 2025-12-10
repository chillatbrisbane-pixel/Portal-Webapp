import React, { useState, useEffect } from 'react';
import { clientAccessAPI } from '../services/apiService';

interface WiFiNetwork {
  name: string;
  password: string;
  vlan?: number;
  band?: string;
}

interface ManagedPort {
  portNumber: number;
  description?: string;
  assignedDevice?: { _id: string; name: string; ipAddress?: string } | null;
  vlan?: number;
  poeEnabled?: boolean;
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
  // Switch ports
  portCount?: number;
  managedPorts?: ManagedPort[];
  // Switch binding (for devices connected to switches)
  boundToSwitch?: string | { _id: string; name: string };
  switchPort?: number;
  // PDU ports
  pduPortCount?: number;
  pduPortNames?: string;
}

interface ProjectData {
  _id?: string;
  name: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  address?: string;
  state?: string;
  postcode?: string;
  wifiNetworks?: WiFiNetwork[];
  projectManager?: { name?: string; phone?: string };
  siteLead?: { name?: string; phone?: string };
  status?: string;
  description?: string;
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
  const [verifiedPin, setVerifiedPin] = useState('');
  const [project, setProject] = useState<ProjectData | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showPasswords, setShowPasswords] = useState<Set<string>>(new Set());
  const [qrWifi, setQrWifi] = useState<WiFiNetwork | null>(null);
  const [sectionsExpanded, setSectionsExpanded] = useState({
    projectDetails: true,
    wifiNetworks: true,
    switchPorts: true,
    pduPorts: true,
  });

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
      setVerifiedPin(pin);  // Store the verified pin for PDF downloads
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
  
  // Get switches and PDUs for port allocation sections
  const switches = devices.filter(d => d.deviceType === 'switch' && d.portCount);
  const pdus = devices.filter(d => d.deviceType === 'pdu');
  
  // Build port allocations for each switch from device bindings
  const getSwitchPortAllocations = (switchId: string) => {
    return devices
      .filter(d => {
        const boundId = typeof d.boundToSwitch === 'string' 
          ? d.boundToSwitch 
          : d.boundToSwitch?._id;
        return boundId === switchId && d.switchPort;
      })
      .map(d => ({
        portNumber: d.switchPort!,
        deviceName: d.name,
        ipAddress: d.ipAddress,
        vlan: d.vlan,
      }))
      .sort((a, b) => a.portNumber - b.portNumber);
  };

  const handleDownloadPDF = () => {
    if (token) {
      // Use the public client PDF endpoint with the client token
      const pinParam = verifiedPin ? `?pin=${encodeURIComponent(verifiedPin)}` : '';
      window.open(`/api/reports/client/${token}/pdf${pinParam}`, '_blank');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      {/* Header */}
      <div style={{ 
        background: 'linear-gradient(135deg, #0066cc 0%, #004999 100%)',
        color: 'white',
        padding: '2rem',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
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
          {project?._id && (
            <button
              onClick={handleDownloadPDF}
              style={{
                padding: '0.75rem 1.25rem',
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            >
              📄 Download PDF
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        {/* Project Details Section - Collapsible */}
        <div style={{ 
          background: 'white', 
          borderRadius: '12px', 
          marginBottom: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}>
          <div 
            onClick={() => setSectionsExpanded(prev => ({ ...prev, projectDetails: !prev.projectDetails }))}
            style={{
              padding: '1rem 1.5rem',
              background: '#f0fdf4',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: sectionsExpanded.projectDetails ? '1px solid #bbf7d0' : 'none',
            }}
          >
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#166534' }}>
              📋 Project Details
            </h2>
            <span style={{ fontSize: '1.2rem', color: '#166534' }}>{sectionsExpanded.projectDetails ? '▼' : '▶'}</span>
          </div>
          
          {sectionsExpanded.projectDetails && (
            <div style={{ padding: '1.5rem' }}>
              <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                {project?.clientName && (
                  <div>
                    <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '0.25rem' }}>👤 Client</p>
                    <p style={{ fontWeight: 600, margin: 0 }}>{project.clientName}</p>
                  </div>
                )}
                {project?.clientEmail && (
                  <div>
                    <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '0.25rem' }}>📧 Email</p>
                    <p style={{ fontWeight: 600, margin: 0 }}>
                      <a href={`mailto:${project.clientEmail}`} style={{ color: '#0066cc' }}>{project.clientEmail}</a>
                    </p>
                  </div>
                )}
                {project?.clientPhone && (
                  <div>
                    <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '0.25rem' }}>📱 Phone</p>
                    <p style={{ fontWeight: 600, margin: 0 }}>
                      <a href={`tel:${project.clientPhone}`} style={{ color: '#0066cc' }}>{project.clientPhone}</a>
                    </p>
                  </div>
                )}
                {project?.address && (
                  <div>
                    <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '0.25rem' }}>📍 Address</p>
                    <p style={{ fontWeight: 600, margin: 0 }}>
                      {project.address}
                      {(project.state || project.postcode) && (
                        <span style={{ fontWeight: 400, color: '#6b7280' }}>
                          {project.state ? `, ${project.state}` : ''} {project.postcode || ''}
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>
              
              {/* Team Contacts */}
              {(project?.projectManager?.name || project?.siteLead?.name) && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                    {project?.projectManager?.name && (
                      <div style={{ padding: '0.75rem', background: '#f0fdf4', borderRadius: '8px' }}>
                        <p style={{ color: '#166534', fontSize: '0.85rem', marginBottom: '0.25rem' }}>👔 Project Manager</p>
                        <p style={{ fontWeight: 600, margin: 0, color: '#166534' }}>{project.projectManager.name}</p>
                        {project.projectManager.phone && (
                          <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
                            <a href={`tel:${project.projectManager.phone}`} style={{ color: '#15803d' }}>{project.projectManager.phone}</a>
                          </p>
                        )}
                      </div>
                    )}
                    {project?.siteLead?.name && (
                      <div style={{ padding: '0.75rem', background: '#fef3c7', borderRadius: '8px' }}>
                        <p style={{ color: '#92400e', fontSize: '0.85rem', marginBottom: '0.25rem' }}>🦺 Site Lead</p>
                        <p style={{ fontWeight: 600, margin: 0, color: '#92400e' }}>{project.siteLead.name}</p>
                        {project.siteLead.phone && (
                          <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
                            <a href={`tel:${project.siteLead.phone}`} style={{ color: '#b45309' }}>{project.siteLead.phone}</a>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* WiFi Networks - Collapsible */}
        {project?.wifiNetworks && project.wifiNetworks.length > 0 && (
          <div style={{ 
            background: 'white', 
            borderRadius: '12px', 
            marginBottom: '1.5rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            overflow: 'hidden',
          }}>
            <div 
              onClick={() => setSectionsExpanded(prev => ({ ...prev, wifiNetworks: !prev.wifiNetworks }))}
              style={{
                padding: '1rem 1.5rem',
                background: '#eff6ff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: sectionsExpanded.wifiNetworks ? '1px solid #bfdbfe' : 'none',
              }}
            >
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e40af' }}>
                📶 WiFi Networks
              </h2>
              <span style={{ fontSize: '1.2rem', color: '#1e40af' }}>{sectionsExpanded.wifiNetworks ? '▼' : '▶'}</span>
            </div>
            
            {sectionsExpanded.wifiNetworks && (
              <div style={{ padding: '1.5rem' }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
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
                      <button
                        onClick={() => setQrWifi(wifi)}
                        style={{
                          padding: '0.4rem 0.75rem',
                          background: '#0066cc',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        📱 Show QR Code
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* WiFi QR Code Modal */}
        {qrWifi && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }} onClick={() => setQrWifi(null)}>
            <div 
              style={{
                background: 'white',
                borderRadius: '16px',
                padding: '2rem',
                maxWidth: '400px',
                width: '100%',
                textAlign: 'center',
              }}
              onClick={e => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 1rem', color: '#0066cc' }}>{qrWifi.name}</h3>
              <div style={{ 
                background: 'white', 
                padding: '1rem', 
                borderRadius: '8px',
                display: 'inline-block',
                marginBottom: '1rem',
              }}>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`WIFI:T:WPA;S:${qrWifi.name};P:${qrWifi.password};;`)}`}
                  alt="WiFi QR Code"
                  style={{ display: 'block' }}
                />
              </div>
              <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
                Scan this QR code with your phone camera to connect
              </p>
              <button
                onClick={() => setQrWifi(null)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#e5e7eb',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Switch Port Allocations */}
        {switches.length > 0 && (
          <div style={{ 
            background: 'white', 
            borderRadius: '12px', 
            marginBottom: '1.5rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            overflow: 'hidden',
          }}>
            <div 
              onClick={() => setSectionsExpanded(prev => ({ ...prev, switchPorts: !prev.switchPorts }))}
              style={{
                padding: '1rem 1.5rem',
                background: '#dbeafe',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: sectionsExpanded.switchPorts ? '1px solid #bfdbfe' : 'none',
              }}
            >
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e40af' }}>
                🔌 Switch Port Allocations
              </h2>
              <span style={{ fontSize: '1.2rem', color: '#1e40af' }}>{sectionsExpanded.switchPorts ? '▼' : '▶'}</span>
            </div>
            
            {sectionsExpanded.switchPorts && (
              <div style={{ padding: '1.5rem' }}>
                {switches.map(sw => {
                  const portAllocations = getSwitchPortAllocations(sw._id);
                  return (
                    <div key={sw._id} style={{ marginBottom: '1.5rem' }}>
                      <h3 style={{ margin: '0 0 1rem', color: '#374151', fontSize: '1.1rem' }}>
                        {sw.name} {sw.portCount && `(${sw.portCount} ports)`}
                      </h3>
                      <div style={{ overflowX: 'auto' }}>
                        {portAllocations.length > 0 ? (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                              <tr style={{ background: '#f3f4f6' }}>
                                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Port</th>
                                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Device</th>
                                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>IP Address</th>
                                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>VLAN</th>
                              </tr>
                            </thead>
                            <tbody>
                              {portAllocations.map(port => (
                                <tr key={port.portNumber} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                  <td style={{ padding: '0.5rem', fontWeight: 600 }}>{port.portNumber}</td>
                                  <td style={{ padding: '0.5rem' }}>{port.deviceName}</td>
                                  <td style={{ padding: '0.5rem', fontFamily: 'monospace', color: '#6b7280' }}>
                                    {port.ipAddress || '-'}
                                  </td>
                                  <td style={{ padding: '0.5rem' }}>{port.vlan || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p style={{ color: '#6b7280', fontStyle: 'italic', margin: 0 }}>No port allocations configured</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* PDU Port Allocations */}
        {pdus.length > 0 && (
          <div style={{ 
            background: 'white', 
            borderRadius: '12px', 
            marginBottom: '1.5rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            overflow: 'hidden',
          }}>
            <div 
              onClick={() => setSectionsExpanded(prev => ({ ...prev, pduPorts: !prev.pduPorts }))}
              style={{
                padding: '1rem 1.5rem',
                background: '#fee2e2',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: sectionsExpanded.pduPorts ? '1px solid #fecaca' : 'none',
              }}
            >
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#991b1b' }}>
                🔌 PDU Outlet Allocations
              </h2>
              <span style={{ fontSize: '1.2rem', color: '#991b1b' }}>{sectionsExpanded.pduPorts ? '▼' : '▶'}</span>
            </div>
            
            {sectionsExpanded.pduPorts && (
              <div style={{ padding: '1.5rem' }}>
                {pdus.map(pdu => {
                  const portNames = pdu.pduPortNames?.split('\n').filter(n => n.trim()) || [];
                  return (
                    <div key={pdu._id} style={{ marginBottom: '1.5rem' }}>
                      <h3 style={{ margin: '0 0 1rem', color: '#374151', fontSize: '1.1rem' }}>
                        {pdu.name} {pdu.location && `(${pdu.location})`}
                      </h3>
                      {portNames.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
                          {portNames.map((name, idx) => (
                            <div 
                              key={idx}
                              style={{
                                padding: '0.5rem 0.75rem',
                                background: '#fef2f2',
                                borderRadius: '6px',
                                border: '1px solid #fecaca',
                                display: 'flex',
                                gap: '0.5rem',
                                alignItems: 'center',
                              }}
                            >
                              <span style={{ 
                                background: '#dc2626', 
                                color: 'white', 
                                padding: '0.125rem 0.5rem', 
                                borderRadius: '4px',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                              }}>
                                {idx + 1}
                              </span>
                              <span style={{ color: '#374151' }}>{name}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ color: '#6b7280', fontStyle: 'italic', margin: 0 }}>No outlet allocations configured</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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

        {/* Footer */}
        <div style={{ 
          textAlign: 'center', 
          marginTop: '3rem', 
          padding: '2rem',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}>
          <p style={{ margin: 0, color: '#374151', fontWeight: 600, fontSize: '1rem' }}>
            Need assistance? Contact Electronic Living
          </p>
          <p style={{ margin: '0.5rem 0 0' }}>
            <a 
              href="tel:1300764554" 
              style={{ 
                color: '#0066cc', 
                fontSize: '1.5rem', 
                fontWeight: 700, 
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              📞 1300 764 554
            </a>
          </p>
          <p style={{ margin: '1rem 0 0', color: '#9ca3af', fontSize: '0.85rem' }}>
            Powered by Electronic Living Portal
          </p>
        </div>
      </div>
    </div>
  );
};

export default ClientPortal;
