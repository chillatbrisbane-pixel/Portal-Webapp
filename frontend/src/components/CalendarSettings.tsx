import React, { useState, useEffect } from 'react';
import { calendarAPI } from '../services/apiService';

interface CalendarSettingsProps {
  onClose?: () => void;
}

export const CalendarSettings: React.FC<CalendarSettingsProps> = ({ onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedUrl, setFeedUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    loadCalendarToken();
  }, []);

  const loadCalendarToken = async () => {
    try {
      setLoading(true);
      const data = await calendarAPI.getToken();
      setFeedUrl(data.feedUrl);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = feedUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRegenerate = async () => {
    if (!window.confirm('Regenerate calendar feed URL? Your old URL will stop working and you\'ll need to update your calendar subscription.')) {
      return;
    }

    setRegenerating(true);
    try {
      const data = await calendarAPI.regenerateToken();
      setFeedUrl(data.feedUrl);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
        <p>Loading calendar settings...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <h3 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        📅 Calendar Integration
      </h3>

      <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
        Subscribe to your tasks in Outlook, Google Calendar, or any calendar app that supports ICS feeds.
        Tasks with due dates will appear as all-day events.
      </p>

      {error && (
        <div className="error-message" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
          Your Calendar Feed URL
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={feedUrl}
            readOnly
            style={{
              flex: 1,
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              background: '#f9fafb',
              fontSize: '0.85rem',
            }}
          />
          <button
            onClick={handleCopy}
            className="btn"
            style={{
              background: copied ? '#10b981' : '#3b82f6',
              color: 'white',
              whiteSpace: 'nowrap',
            }}
          >
            {copied ? '✓ Copied!' : '📋 Copy'}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div style={{
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '1.5rem',
      }}>
        <h4 style={{ margin: '0 0 0.75rem', color: '#1e40af' }}>How to Subscribe</h4>
        
        <div style={{ marginBottom: '1rem' }}>
          <strong style={{ color: '#374151' }}>Microsoft Outlook:</strong>
          <ol style={{ margin: '0.5rem 0 0 1.25rem', padding: 0, color: '#6b7280' }}>
            <li>Open Outlook Calendar</li>
            <li>Click "Add calendar" → "Subscribe from web"</li>
            <li>Paste the feed URL above</li>
            <li>Name it "Portal Tasks" and click Import</li>
          </ol>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <strong style={{ color: '#374151' }}>Google Calendar:</strong>
          <ol style={{ margin: '0.5rem 0 0 1.25rem', padding: 0, color: '#6b7280' }}>
            <li>Go to Google Calendar Settings</li>
            <li>Click "Add calendar" → "From URL"</li>
            <li>Paste the feed URL above</li>
            <li>Click "Add calendar"</li>
          </ol>
        </div>

        <div>
          <strong style={{ color: '#374151' }}>Apple Calendar:</strong>
          <ol style={{ margin: '0.5rem 0 0 1.25rem', padding: 0, color: '#6b7280' }}>
            <li>Go to File → New Calendar Subscription</li>
            <li>Paste the feed URL above</li>
            <li>Click Subscribe</li>
          </ol>
        </div>
      </div>

      {/* Notes */}
      <div style={{
        background: '#fefce8',
        border: '1px solid #fde047',
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '1.5rem',
      }}>
        <h4 style={{ margin: '0 0 0.5rem', color: '#854d0e' }}>📝 Notes</h4>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#713f12' }}>
          <li>Only tasks with due dates appear in the calendar</li>
          <li>High priority tasks include a reminder 1 day before</li>
          <li>Calendar apps typically refresh every 15-30 minutes</li>
          <li>Completed tasks are automatically removed</li>
        </ul>
      </div>

      {/* Regenerate Button */}
      <div style={{ 
        borderTop: '1px solid #e5e7eb', 
        paddingTop: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <button
            onClick={handleRegenerate}
            className="btn"
            style={{ background: '#fee2e2', color: '#991b1b' }}
            disabled={regenerating}
          >
            {regenerating ? 'Regenerating...' : '🔄 Regenerate URL'}
          </button>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#9ca3af' }}>
            Use if you need to revoke access to the old URL
          </p>
        </div>

        {onClose && (
          <button onClick={onClose} className="btn btn-primary">
            Done
          </button>
        )}
      </div>
    </div>
  );
};

export default CalendarSettings;
