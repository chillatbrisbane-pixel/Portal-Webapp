import React, { useState, useEffect, useCallback } from 'react';
import { 
  User, 
  ScheduleEntry, 
  TechnicianGroup, 
  PublicHoliday,
  Contractor,
  TimeSlot,
  EntryType,
  LeaveType,
  ENTRY_TYPES,
  LEAVE_TYPES,
  TIME_SLOTS,
  Project
} from '../types';
import { scheduleAPI, projectsAPI } from '../services/apiService';

interface ScheduleProps {
  user: User;
}

// Helper functions
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const formatDateDisplay = (date: Date): string => {
  return date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
};

const getWeekDates = (referenceDate: Date): Date[] => {
  const dates: Date[] = [];
  const start = new Date(referenceDate);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  start.setDate(diff);
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d);
  }
  return dates;
};

const isToday = (date: Date): boolean => {
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

const isWeekend = (date: Date): boolean => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

export const Schedule: React.FC<ScheduleProps> = ({ user }) => {
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [showWeekends, setShowWeekends] = useState(false);
  
  // Data
  const [groups, setGroups] = useState<TechnicianGroup[]>([]);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  
  // Modals
  const [editModal, setEditModal] = useState<{
    techId: string;
    techName: string;
    techType: 'user' | 'contractor';
    date: Date;
  } | null>(null);
  const [addTechModal, setAddTechModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    techId: string;
    techName: string;
    groupId: string;
    memberType: 'user' | 'contractor';
  } | null>(null);
  
  // Edit modal state
  const [slotData, setSlotData] = useState<Record<TimeSlot, {
    entryType: EntryType;
    project: string;
    leaveType: LeaveType | '';
    description: string;
    notes: string;
    entryId?: string;
  }>>({
    AM1: { entryType: 'project', project: '', leaveType: '', description: '', notes: '' },
    AM2: { entryType: 'project', project: '', leaveType: '', description: '', notes: '' },
    PM1: { entryType: 'project', project: '', leaveType: '', description: '', notes: '' },
    PM2: { entryType: 'project', project: '', leaveType: '', description: '', notes: '' },
  });
  const [activeSlot, setActiveSlot] = useState<TimeSlot>('AM1');
  const [saving, setSaving] = useState(false);

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const weekDates = getWeekDates(currentDate);
      const startDate = weekDates[0];
      const endDate = viewMode === 'week' 
        ? weekDates[6] 
        : new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      const [groupsData, scheduleData, projectsData] = await Promise.all([
        scheduleAPI.getGroups(),
        scheduleAPI.getSchedule(startDate, endDate),
        projectsAPI.getAll()
      ]);
      
      setGroups(groupsData);
      setEntries(scheduleData.entries);
      setHolidays(scheduleData.holidays);
      setProjects(projectsData.filter((p: Project) => p.status !== 'completed'));
    } catch (err: any) {
      setError(err.message || 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }, [currentDate, viewMode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Get entries for a specific tech and date
  const getEntriesForCell = (techId: string, date: Date): ScheduleEntry[] => {
    const dateStr = formatDate(date);
    return entries.filter(e => {
      const entryDate = new Date(e.date).toISOString().split('T')[0];
      const techMatch = e.technician?._id === techId || e.contractor?._id === techId;
      return entryDate === dateStr && techMatch;
    });
  };

  // Check if date is a holiday
  const getHoliday = (date: Date): PublicHoliday | undefined => {
    const dateStr = formatDate(date);
    return holidays.find(h => new Date(h.date).toISOString().split('T')[0] === dateStr);
  };

  // Open edit modal
  const openEditModal = (techId: string, techName: string, techType: 'user' | 'contractor', date: Date) => {
    const cellEntries = getEntriesForCell(techId, date);
    
    // Initialize slot data from existing entries
    const newSlotData: typeof slotData = {
      AM1: { entryType: 'project', project: '', leaveType: '', description: '', notes: '' },
      AM2: { entryType: 'project', project: '', leaveType: '', description: '', notes: '' },
      PM1: { entryType: 'project', project: '', leaveType: '', description: '', notes: '' },
      PM2: { entryType: 'project', project: '', leaveType: '', description: '', notes: '' },
    };
    
    cellEntries.forEach(entry => {
      const slot = entry.timeSlot as TimeSlot;
      newSlotData[slot] = {
        entryType: entry.entryType,
        project: entry.project?._id || '',
        leaveType: entry.leaveType || '',
        description: entry.description || '',
        notes: entry.notes || '',
        entryId: entry._id,
      };
    });
    
    setSlotData(newSlotData);
    setActiveSlot('AM1');
    setEditModal({ techId, techName, techType, date });
  };

  // Save schedule entries
  const handleSave = async () => {
    if (!editModal) return;
    
    try {
      setSaving(true);
      
      const entriesToSave: any[] = [];
      const entriesToDelete: string[] = [];
      
      TIME_SLOTS.forEach(slot => {
        const data = slotData[slot];
        const hasContent = data.entryType !== 'project' || data.project;
        
        if (hasContent) {
          entriesToSave.push({
            date: formatDate(editModal.date),
            timeSlot: slot,
            [editModal.techType === 'user' ? 'technician' : 'contractor']: editModal.techId,
            entryType: data.entryType,
            project: data.entryType === 'project' && data.project ? data.project : undefined,
            leaveType: data.entryType === 'leave' ? data.leaveType : undefined,
            description: data.description,
            notes: data.notes,
          });
        } else if (data.entryId) {
          entriesToDelete.push(data.entryId);
        }
      });
      
      // Bulk upsert entries
      if (entriesToSave.length > 0) {
        await scheduleAPI.bulkUpdate(entriesToSave, 'upsert');
      }
      
      // Delete removed entries
      for (const id of entriesToDelete) {
        await scheduleAPI.deleteEntry(id);
      }
      
      setEditModal(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Fill all empty slots with current slot data
  const handleFillDay = () => {
    const current = slotData[activeSlot];
    const newSlotData = { ...slotData };
    TIME_SLOTS.forEach(slot => {
      if (!newSlotData[slot].project && newSlotData[slot].entryType === 'project') {
        newSlotData[slot] = { ...current, entryId: newSlotData[slot].entryId };
      }
    });
    setSlotData(newSlotData);
  };

  // Clear all slots
  const handleClearAll = () => {
    setSlotData({
      AM1: { entryType: 'project', project: '', leaveType: '', description: '', notes: '', entryId: slotData.AM1.entryId },
      AM2: { entryType: 'project', project: '', leaveType: '', description: '', notes: '', entryId: slotData.AM2.entryId },
      PM1: { entryType: 'project', project: '', leaveType: '', description: '', notes: '', entryId: slotData.PM1.entryId },
      PM2: { entryType: 'project', project: '', leaveType: '', description: '', notes: '', entryId: slotData.PM2.entryId },
    });
  };

  // Navigation
  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction * 7));
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Render cell content
  const renderCellContent = (techId: string, date: Date) => {
    const cellEntries = getEntriesForCell(techId, date);
    const holiday = getHoliday(date);
    
    if (holiday) {
      return (
        <div style={{
          background: '#d1d5db',
          color: '#4b5563',
          padding: '0.25rem 0.5rem',
          borderRadius: '4px',
          fontSize: '0.75rem',
          textAlign: 'center',
        }}>
          🎉 {holiday.name}
        </div>
      );
    }
    
    if (cellEntries.length === 0) {
      return <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>—</div>;
    }
    
    // Check if all slots have same entry
    const allSame = cellEntries.length === 4 && 
      cellEntries.every(e => 
        e.entryType === cellEntries[0].entryType && 
        e.project?._id === cellEntries[0].project?._id
      );
    
    if (allSame || cellEntries.length === 1) {
      const entry = cellEntries[0];
      const config = ENTRY_TYPES[entry.entryType];
      const label = entry.entryType === 'project' 
        ? entry.projectName || entry.project?.clientName || 'Project'
        : entry.entryType === 'leave' && entry.leaveType
          ? LEAVE_TYPES[entry.leaveType]?.short || 'Leave'
          : config.label;
      
      return (
        <div style={{
          background: entry.entryType === 'leave' && entry.leaveType 
            ? LEAVE_TYPES[entry.leaveType]?.bg 
            : config.bg,
          color: config.text,
          padding: '0.25rem 0.5rem',
          borderRadius: '4px',
          fontSize: '0.75rem',
          textAlign: 'center',
          position: 'relative',
        }}>
          {label.substring(0, 12)}{label.length > 12 ? '…' : ''}
          {cellEntries.some(e => e.notes) && (
            <span style={{ position: 'absolute', top: '-4px', right: '-4px', fontSize: '0.6rem' }}>💬</span>
          )}
        </div>
      );
    }
    
    // Mixed slots - show mini grid
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '2px',
        fontSize: '0.6rem',
      }}>
        {TIME_SLOTS.map(slot => {
          const entry = cellEntries.find(e => e.timeSlot === slot);
          if (!entry) {
            return <div key={slot} style={{ background: '#f3f4f6', borderRadius: '2px', padding: '2px' }}>—</div>;
          }
          const config = ENTRY_TYPES[entry.entryType];
          return (
            <div key={slot} style={{
              background: entry.entryType === 'leave' && entry.leaveType 
                ? LEAVE_TYPES[entry.leaveType]?.bg 
                : config.bg,
              color: config.text,
              borderRadius: '2px',
              padding: '2px',
              textAlign: 'center',
            }}>
              {entry.entryType === 'project' 
                ? (entry.projectName?.substring(0, 4) || 'PRJ')
                : config.icon}
            </div>
          );
        })}
      </div>
    );
  };

  // Get week dates filtered by weekend setting
  const weekDates = getWeekDates(currentDate).filter(d => showWeekends || !isWeekend(d));

  // Can user edit schedule?
  const canEdit = ['admin', 'project-manager', 'project-coordinator'].includes(user.role);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <p>Loading schedule...</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: '1.5rem' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <div>
          <h2 style={{ margin: 0, color: '#1f2937' }}>📅 Schedule</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
            Technician allocation and resource planning
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={() => navigateWeek(-1)}
            style={{
              padding: '0.5rem 0.75rem',
              background: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            ← Prev
          </button>
          
          <button
            onClick={goToToday}
            style={{
              padding: '0.5rem 1rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Today
          </button>
          
          <button
            onClick={() => navigateWeek(1)}
            style={{
              padding: '0.5rem 0.75rem',
              background: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Next →
          </button>
          
          <div style={{ marginLeft: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label style={{ fontSize: '0.85rem', color: '#6b7280' }}>
              <input
                type="checkbox"
                checked={showWeekends}
                onChange={(e) => setShowWeekends(e.target.checked)}
                style={{ marginRight: '0.35rem' }}
              />
              Weekends
            </label>
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#dc2626',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1rem',
        }}>
          {error}
        </div>
      )}

      {/* Schedule Grid */}
      <div style={{
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'auto',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={{
                padding: '0.75rem 1rem',
                textAlign: 'left',
                fontWeight: 600,
                color: '#374151',
                borderBottom: '2px solid #e5e7eb',
                minWidth: '180px',
                position: 'sticky',
                left: 0,
                background: '#f9fafb',
                zIndex: 10,
              }}>
                Technician
                {canEdit && (
                  <button
                    onClick={() => setAddTechModal(true)}
                    style={{
                      marginLeft: '0.5rem',
                      padding: '0.2rem 0.5rem',
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                    }}
                  >
                    + Add
                  </button>
                )}
              </th>
              {weekDates.map(date => (
                <th
                  key={date.toISOString()}
                  style={{
                    padding: '0.75rem 0.5rem',
                    textAlign: 'center',
                    fontWeight: 600,
                    color: isToday(date) ? '#3b82f6' : '#374151',
                    borderBottom: '2px solid #e5e7eb',
                    minWidth: '100px',
                    background: isToday(date) ? '#eff6ff' : isWeekend(date) ? '#f3f4f6' : '#f9fafb',
                  }}
                >
                  {formatDateDisplay(date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(group => (
              <React.Fragment key={group._id}>
                {/* Group header */}
                <tr>
                  <td
                    colSpan={weekDates.length + 1}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#e5e7eb',
                      fontWeight: 600,
                      color: '#374151',
                      fontSize: '0.85rem',
                    }}
                  >
                    {group.name} ({group.members.length})
                  </td>
                </tr>
                
                {/* Group members */}
                {group.members.map(member => {
                  const techId = member.memberType === 'user' 
                    ? member.user?._id 
                    : member.contractor?._id;
                  const techName = member.memberType === 'user'
                    ? member.user?.name
                    : member.contractor?.name;
                  
                  if (!techId || !techName) return null;
                  
                  return (
                    <tr key={techId}>
                      <td style={{
                        padding: '0.5rem 1rem',
                        borderBottom: '1px solid #e5e7eb',
                        background: 'white',
                        position: 'sticky',
                        left: 0,
                        zIndex: 5,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <span style={{ fontWeight: 500, color: '#1f2937' }}>{techName}</span>
                            {member.role && (
                              <span style={{
                                marginLeft: '0.5rem',
                                fontSize: '0.7rem',
                                padding: '0.1rem 0.35rem',
                                background: '#dbeafe',
                                color: '#1e40af',
                                borderRadius: '3px',
                              }}>
                                {member.role}
                              </span>
                            )}
                          </div>
                          {canEdit && (
                            <button
                              onClick={() => setDeleteConfirm({
                                techId,
                                techName,
                                groupId: group._id,
                                memberType: member.memberType,
                              })}
                              style={{
                                padding: '0.2rem',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#9ca3af',
                                fontSize: '0.8rem',
                              }}
                              title="Remove from schedule"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                      
                      {weekDates.map(date => {
                        const holiday = getHoliday(date);
                        
                        return (
                          <td
                            key={date.toISOString()}
                            onClick={() => canEdit && !holiday && openEditModal(techId, techName, member.memberType, date)}
                            style={{
                              padding: '0.5rem',
                              borderBottom: '1px solid #e5e7eb',
                              borderLeft: '1px solid #f3f4f6',
                              background: isToday(date) ? '#eff6ff' : isWeekend(date) ? '#f9fafb' : 'white',
                              cursor: canEdit && !holiday ? 'pointer' : 'default',
                              verticalAlign: 'top',
                            }}
                          >
                            {renderCellContent(techId, date)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
            
            {groups.length === 0 && (
              <tr>
                <td colSpan={weekDates.length + 1} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                  No technician groups configured. 
                  {canEdit && ' Click "Add" to add technicians to the schedule.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{
        marginTop: '1.5rem',
        padding: '1rem',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}>
        <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#374151' }}>Legend</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          {Object.entries(ENTRY_TYPES).map(([key, config]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <div style={{
                width: '16px',
                height: '16px',
                background: config.bg,
                borderRadius: '3px',
              }} />
              <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{config.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Modal */}
      {editModal && (
        <div 
          className="modal-overlay" 
          onClick={() => setEditModal(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
        >
          <div 
            className="modal" 
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '500px',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{
              padding: '1.25rem',
              borderBottom: '1px solid #e5e7eb',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              borderRadius: '12px 12px 0 0',
            }}>
              <h3 style={{ margin: 0, color: 'white' }}>
                📅 {editModal.techName}
              </h3>
              <p style={{ margin: '0.25rem 0 0', color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem' }}>
                {editModal.date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>

            <div style={{ padding: '1.25rem' }}>
              {/* Slot tabs */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                {TIME_SLOTS.map(slot => {
                  const hasData = slotData[slot].project || slotData[slot].entryType !== 'project';
                  const hasNotes = !!slotData[slot].notes;
                  
                  return (
                    <button
                      key={slot}
                      onClick={() => setActiveSlot(slot)}
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        background: activeSlot === slot ? '#3b82f6' : hasData ? '#dbeafe' : '#f3f4f6',
                        color: activeSlot === slot ? 'white' : hasData ? '#1e40af' : '#6b7280',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 500,
                        position: 'relative',
                      }}
                    >
                      {slot}
                      {hasNotes && (
                        <span style={{
                          position: 'absolute',
                          top: '-4px',
                          right: '-4px',
                          width: '8px',
                          height: '8px',
                          background: '#f59e0b',
                          borderRadius: '50%',
                        }} />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Quick actions */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <button
                  onClick={handleFillDay}
                  style={{
                    padding: '0.4rem 0.75rem',
                    background: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                  }}
                >
                  📋 Fill Empty Slots
                </button>
                <button
                  onClick={handleClearAll}
                  style={{
                    padding: '0.4rem 0.75rem',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    color: '#dc2626',
                  }}
                >
                  🗑️ Clear All
                </button>
              </div>

              {/* Entry type */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500, fontSize: '0.9rem' }}>
                  Entry Type
                </label>
                <select
                  value={slotData[activeSlot].entryType}
                  onChange={(e) => setSlotData({
                    ...slotData,
                    [activeSlot]: { ...slotData[activeSlot], entryType: e.target.value as EntryType }
                  })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                  }}
                >
                  {Object.entries(ENTRY_TYPES).map(([key, config]) => (
                    <option key={key} value={key}>{config.icon} {config.label}</option>
                  ))}
                </select>
              </div>

              {/* Project selector (when type is project) */}
              {slotData[activeSlot].entryType === 'project' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500, fontSize: '0.9rem' }}>
                    Project
                  </label>
                  <select
                    value={slotData[activeSlot].project}
                    onChange={(e) => setSlotData({
                      ...slotData,
                      [activeSlot]: { ...slotData[activeSlot], project: e.target.value }
                    })}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '0.9rem',
                    }}
                  >
                    <option value="">-- Select Project --</option>
                    {projects.map(p => (
                      <option key={p._id} value={p._id}>
                        {p.name} {p.clientName ? `(${p.clientName})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Leave type (when type is leave) */}
              {slotData[activeSlot].entryType === 'leave' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500, fontSize: '0.9rem' }}>
                    Leave Type
                  </label>
                  <select
                    value={slotData[activeSlot].leaveType}
                    onChange={(e) => setSlotData({
                      ...slotData,
                      [activeSlot]: { ...slotData[activeSlot], leaveType: e.target.value as LeaveType }
                    })}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '0.9rem',
                    }}
                  >
                    <option value="">-- Select Leave Type --</option>
                    {Object.entries(LEAVE_TYPES).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notes */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500, fontSize: '0.9rem' }}>
                  Notes (optional)
                </label>
                <textarea
                  value={slotData[activeSlot].notes}
                  onChange={(e) => setSlotData({
                    ...slotData,
                    [activeSlot]: { ...slotData[activeSlot], notes: e.target.value }
                  })}
                  placeholder="Add notes for this time slot..."
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    minHeight: '60px',
                    resize: 'vertical',
                  }}
                />
              </div>
            </div>

            <div style={{
              padding: '1rem 1.25rem',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
            }}>
              <button
                onClick={() => setEditModal(null)}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '0.5rem 1.5rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: saving ? 'wait' : 'pointer',
                  fontWeight: 500,
                }}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div 
          className="modal-overlay"
          onClick={() => setDeleteConfirm(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '400px',
              padding: '1.5rem',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            <h3 style={{ margin: '0 0 1rem', color: '#dc2626' }}>
              ⚠️ Remove {deleteConfirm.techName}?
            </h3>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
              This will remove them from the schedule group. Their existing schedule entries will remain.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    await scheduleAPI.removeGroupMember(
                      deleteConfirm.groupId,
                      deleteConfirm.techId,
                      deleteConfirm.memberType
                    );
                    setDeleteConfirm(null);
                    loadData();
                  } catch (err: any) {
                    alert(err.message || 'Failed to remove');
                  }
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Tech Modal */}
      {addTechModal && (
        <AddTechModal
          groups={groups}
          onClose={() => setAddTechModal(false)}
          onAdded={() => {
            setAddTechModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
};

// Add Tech Modal Component
interface AddTechModalProps {
  groups: TechnicianGroup[];
  onClose: () => void;
  onAdded: () => void;
}

const AddTechModal: React.FC<AddTechModalProps> = ({ groups, onClose, onAdded }) => {
  const [availableTechs, setAvailableTechs] = useState<{ _id: string; name: string; email: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTech, setSelectedTech] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(groups[0]?._id || '');
  const [role, setRole] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadTechs = async () => {
      try {
        const techs = await scheduleAPI.getAvailableTechs();
        
        // Filter out techs already in groups
        const existingIds = new Set<string>();
        groups.forEach(g => {
          g.members.forEach(m => {
            if (m.user?._id) existingIds.add(m.user._id);
          });
        });
        
        setAvailableTechs(techs.filter((t: any) => !existingIds.has(t._id)));
      } catch (err) {
        console.error('Failed to load techs:', err);
      } finally {
        setLoading(false);
      }
    };
    loadTechs();
  }, [groups]);

  const handleAdd = async () => {
    if (!selectedTech || !selectedGroup) return;
    
    try {
      setSaving(true);
      await scheduleAPI.addGroupMember(selectedGroup, {
        memberType: 'user',
        userId: selectedTech,
        role: role || undefined,
      });
      onAdded();
    } catch (err: any) {
      alert(err.message || 'Failed to add technician');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div 
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}
    >
      <div 
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '12px',
          width: '90%',
          maxWidth: '400px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{
          padding: '1.25rem',
          borderBottom: '1px solid #e5e7eb',
          background: 'linear-gradient(135deg, #10b981, #059669)',
          borderRadius: '12px 12px 0 0',
        }}>
          <h3 style={{ margin: 0, color: 'white' }}>👤 Add Technician</h3>
        </div>

        <div style={{ padding: '1.25rem' }}>
          {loading ? (
            <p>Loading...</p>
          ) : availableTechs.length === 0 ? (
            <p style={{ color: '#6b7280' }}>All technicians are already in groups.</p>
          ) : (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500, fontSize: '0.9rem' }}>
                  Technician
                </label>
                <select
                  value={selectedTech}
                  onChange={(e) => setSelectedTech(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                  }}
                >
                  <option value="">-- Select Technician --</option>
                  {availableTechs.map(t => (
                    <option key={t._id} value={t._id}>{t.name} ({t.role})</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500, fontSize: '0.9rem' }}>
                  Group
                </label>
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                  }}
                >
                  {groups.map(g => (
                    <option key={g._id} value={g._id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500, fontSize: '0.9rem' }}>
                  Role Label (optional)
                </label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g., SUP, LEAD"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                  }}
                />
              </div>
            </>
          )}
        </div>

        <div style={{
          padding: '1rem 1.25rem',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={saving || !selectedTech || !selectedGroup}
            style={{
              padding: '0.5rem 1.5rem',
              background: saving || !selectedTech ? '#9ca3af' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: saving || !selectedTech ? 'not-allowed' : 'pointer',
              fontWeight: 500,
            }}
          >
            {saving ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Schedule;
