import React, { useState } from 'react'

interface WiFiNetwork {
  name: string
  subnet: string
  gateway: string
}

interface WiFiDisplayProps {
  networks: {
    vlan1?: WiFiNetwork
    vlan20?: WiFiNetwork
    vlan30?: WiFiNetwork
  }
  onEdit?: () => void
}

export const WiFiDisplay: React.FC<WiFiDisplayProps> = ({ networks, onEdit }) => {
  const [copied, setCopied] = useState<string | null>(null)

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  const allNetworks = Object.entries(networks).map(([key, network]) => ({
    key,
    ...network,
  }))

  return (
    <div style={{ background: 'white', borderRadius: '8px', padding: '1.5rem', marginBottom: '2rem', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ color: '#333333', margin: 0 }}>🌐 Network Configuration</h3>
        {onEdit && (
          <button
            onClick={onEdit}
            style={{
              background: '#0066cc',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            ✏️ Edit
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        {allNetworks.map(network => (
          <div
            key={network.key}
            style={{
              padding: '1rem',
              background: '#f9fafb',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
            }}
          >
            <h4 style={{ color: '#333333', margin: '0 0 0.75rem 0' }}>
              {network.name}
            </h4>

            <div style={{ marginBottom: '0.75rem' }}>
              <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem', color: '#6b7280' }}>
                <strong>Subnet</strong>
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <code style={{
                  background: 'white',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  fontFamily: 'monospace',
                  flex: 1,
                }}>
                  {network.subnet}
                </code>
                <button
                  onClick={() => copyToClipboard(network.subnet, `subnet-${network.key}`)}
                  style={{
                    background: copied === `subnet-${network.key}` ? '#10b981' : '#e5e7eb',
                    color: copied === `subnet-${network.key}` ? 'white' : '#333333',
                    border: 'none',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    transition: 'all 0.3s',
                  }}
                  title="Copy subnet"
                >
                  {copied === `subnet-${network.key}` ? '✓' : '📋'}
                </button>
              </div>
            </div>

            <div>
              <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem', color: '#6b7280' }}>
                <strong>Gateway</strong>
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <code style={{
                  background: 'white',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  fontFamily: 'monospace',
                  flex: 1,
                }}>
                  {network.gateway}
                </code>
                <button
                  onClick={() => copyToClipboard(network.gateway, `gateway-${network.key}`)}
                  style={{
                    background: copied === `gateway-${network.key}` ? '#10b981' : '#e5e7eb',
                    color: copied === `gateway-${network.key}` ? 'white' : '#333333',
                    border: 'none',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    transition: 'all 0.3s',
                  }}
                  title="Copy gateway"
                >
                  {copied === `gateway-${network.key}` ? '✓' : '📋'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default WiFiDisplay
