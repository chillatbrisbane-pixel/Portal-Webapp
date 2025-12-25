import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { scheduleAPI, projectsAPI, contractorsAPI } from '../services/apiService';

interface ScheduleProps {
  user: User;
}

// Helper functions
const formatDate = (date: Date): string => {
  // Timezone-safe: use local date components instead of toISOString() which converts to UTC
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

const getMonthDates = (year: number, month: number): { date: Date; isCurrentMonth: boolean }[] => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const dates: { date: Date; isCurrentMonth: boolean }[] = [];
  
  const startDay = firstDay.getDay() || 7;
  for (let i = startDay - 1; i > 0; i--) {
    dates.push({ date: new Date(year, month, 1 - i), isCurrentMonth: false });
  }
  
  for (let i = 1; i <= lastDay.getDate(); i++) {
    dates.push({ date: new Date(year, month, i), isCurrentMonth: true });
  }
  
  const remaining = 42 - dates.length;
  for (let i = 1; i <= remaining; i++) {
    dates.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [showWeekends, setShowWeekends] = useState(false);
  
  const [groups, setGroups] = useState<TechnicianGroup[]>([]);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  
  const [editModal, setEditModal] = useState<{
    techId: string;
    techName: string;
    techType: 'user' | 'contractor';
    date: Date;
  } | null>(null);
  const [addTechModal, setAddTechModal] = useState(false);
  const [contractorsModal, setContractorsModal] = useState(false);
  const [editingContractor, setEditingContractor] = useState<Contractor | null>(null);
  const [editingTechNotes, setEditingTechNotes] = useState<{
    userId: string;
    userName: string;
    notes: string;
  } | null>(null);
  const [editingMemberRole, setEditingMemberRole] = useState<{
    groupId: string;
    memberId: string;
    memberName: string;
    memberType: 'user' | 'contractor';
    role: string;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    techId: string;
    techName: string;
    groupId: string;
    memberType: 'user' | 'contractor';
  } | null>(null);
  
  const [slotData, setSlotData] = useState<Record<TimeSlot, {
    entryType: EntryType;
    project: string;
    projectName: string;
    leaveType: LeaveType | '';
    description: string;
    notes: string;
    entryId?: string;
  }>>({
    AM1: { entryType: 'project', project: '', projectName: '', leaveType: '', description: '', notes: '' },
    AM2: { entryType: 'project', project: '', projectName: '', leaveType: '', description: '', notes: '' },
    PM1: { entryType: 'project', project: '', projectName: '', leaveType: '', description: '', notes: '' },
    PM2: { entryType: 'project', project: '', projectName: '', leaveType: '', description: '', notes: '' },
  });
  const [activeSlot, setActiveSlot] = useState<TimeSlot>('AM1');
  const [saving, setSaving] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      let startDate: Date;
      let endDate: Date;
      
      if (viewMode === 'week') {
        const weekDates = getWeekDates(currentDate);
        startDate = weekDates[0];
        endDate = weekDates[6];
      } else {
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      }
      
      const [groupsData, scheduleData, projectsData, contractorsData] = await Promise.all([
        scheduleAPI.getGroups(),
        scheduleAPI.getSchedule(startDate, endDate),
        projectsAPI.getAll(),
        contractorsAPI.getAll()
      ]);
      
      setGroups(groupsData);
      setEntries(scheduleData.entries || []);
      setHolidays(scheduleData.holidays || []);
      setProjects(projectsData.filter((p: Project) => p.status !== 'completed'));
      setContractors(contractorsData || []);
    } catch (err: any) {
      console.error('Load error:', err);
      setError(err.message || 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }, [currentDate, viewMode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Helper to extract date string from various formats (ISO string, Date object, etc.)
  const extractDateStr = (dateValue: string | Date): string => {
    if (typeof dateValue === 'string') {
      // If it's already a string, just take the YYYY-MM-DD part
      return dateValue.split('T')[0];
    }
    // If it's a Date object, use timezone-safe formatting
    return formatDate(dateValue);
  };

  const getEntriesForCell = (techId: string, date: Date): ScheduleEntry[] => {
    const dateStr = formatDate(date);
    return entries.filter(e => {
      const entryDate = extractDateStr(e.date);
      const techMatch = e.technician?._id === techId || e.contractor?._id === techId;
      return entryDate === dateStr && techMatch;
    });
  };

  const getHoliday = (date: Date): PublicHoliday | undefined => {
    const dateStr = formatDate(date);
    return holidays.find(h => extractDateStr(h.date) === dateStr);
  };

  const getContractor = (contractorId: string): Contractor | undefined => {
    return contractors.find(c => c._id === contractorId);
  };

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const openEditModal = (techId: string, techName: string, techType: 'user' | 'contractor', date: Date) => {
    const cellEntries = getEntriesForCell(techId, date);
    
    const newSlotData: typeof slotData = {
      AM1: { entryType: 'project', project: '', projectName: '', leaveType: '', description: '', notes: '' },
      AM2: { entryType: 'project', project: '', projectName: '', leaveType: '', description: '', notes: '' },
      PM1: { entryType: 'project', project: '', projectName: '', leaveType: '', description: '', notes: '' },
      PM2: { entryType: 'project', project: '', projectName: '', leaveType: '', description: '', notes: '' },
    };
    
    cellEntries.forEach(entry => {
      const slot = entry.timeSlot as TimeSlot;
      newSlotData[slot] = {
        entryType: entry.entryType as EntryType,
        project: entry.project?._id || '',
        projectName: entry.projectName || entry.project?.name || '',
        leaveType: (entry.leaveType as LeaveType) || '',
        description: entry.description || '',
        notes: entry.notes || '',
        entryId: entry._id,
      };
    });
    
    setSlotData(newSlotData);
    setActiveSlot('AM1');
    setProjectSearch('');
    setEditModal({ techId, techName, techType, date });
  };

  const handleSave = async () => {
    if (!editModal) return;
    
    try {
      setSaving(true);
      
      const operations: any[] = [];
      const deleteIds: string[] = [];
      
      for (const slot of TIME_SLOTS) {
        const data = slotData[slot];
        const hasContent = data.entryType !== 'project' || data.project;
        
        if (hasContent) {
          const entry: any = {
            date: formatDate(editModal.date),
            timeSlot: slot,
            entryType: data.entryType,
            description: data.description || '',
            notes: data.notes || '',
          };
          
          if (editModal.techType === 'user') {
            entry.technician = editModal.techId;
          } else {
            entry.contractor = editModal.techId;
          }
          
          if (data.entryType === 'project' && data.project) {
            entry.project = data.project;
          } else if (data.entryType === 'leave' && data.leaveType) {
            entry.leaveType = data.leaveType;
          }
          
          operations.push(entry);
        } else if (data.entryId) {
          // Track entries to delete
          deleteIds.push(data.entryId);
        }
      }
      
      // Delete cleared entries first
      for (const id of deleteIds) {
        try {
          await scheduleAPI.deleteEntry(id);
        } catch (err) {
          console.error('Failed to delete entry:', err);
        }
      }
      
      // Then upsert new/updated entries
      if (operations.length > 0) {
        console.log('Saving entries:', operations);
        const result = await scheduleAPI.bulkUpdate(operations, 'upsert');
        console.log('Save result:', result);
      }
      
      setEditModal(null);
      await loadData();
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.message || 'Failed to save schedule entries');
    } finally {
      setSaving(false);
    }
  };

  const copyToRestOfWeek = async () => {
    if (!editModal) return;
    
    const weekDates = getWeekDates(editModal.date);
    const currentDayIndex = weekDates.findIndex(d => formatDate(d) === formatDate(editModal.date));
    const remainingDays = weekDates.slice(currentDayIndex + 1).filter(d => showWeekends || !isWeekend(d));
    
    if (remainingDays.length === 0) {
      alert('No remaining days in the week to copy to');
      return;
    }
    
    if (!confirm(`Copy this day's schedule to ${remainingDays.length} remaining day(s) this week?`)) {
      return;
    }
    
    try {
      setSaving(true);
      const operations: any[] = [];
      
      for (const targetDate of remainingDays) {
        for (const slot of TIME_SLOTS) {
          const data = slotData[slot];
          const hasContent = data.entryType !== 'project' || data.project;
          
          if (hasContent) {
            const entry: any = {
              date: formatDate(targetDate),
              timeSlot: slot,
              entryType: data.entryType,
              description: data.description || '',
              notes: data.notes || '',
            };
            
            if (editModal.techType === 'user') {
              entry.technician = editModal.techId;
            } else {
              entry.contractor = editModal.techId;
            }
            
            if (data.entryType === 'project' && data.project) {
              entry.project = data.project;
            } else if (data.entryType === 'leave' && data.leaveType) {
              entry.leaveType = data.leaveType;
            }
            
            operations.push(entry);
          }
        }
      }
      
      if (operations.length > 0) {
        await scheduleAPI.bulkUpdate(operations, 'upsert');
      }
      
      await loadData();
      alert(`Copied to ${remainingDays.length} day(s)`);
    } catch (err: any) {
      console.error('Copy error:', err);
      setError(err.message || 'Failed to copy to week');
    } finally {
      setSaving(false);
    }
  };

  const updateCurrentSlot = (updates: Partial<typeof slotData['AM1']>) => {
    setSlotData(prev => ({
      ...prev,
      [activeSlot]: { ...prev[activeSlot], ...updates }
    }));
  };

  const fillAllSlots = () => {
    const current = slotData[activeSlot];
    const newSlotData = { ...slotData };
    TIME_SLOTS.forEach(slot => {
      newSlotData[slot] = { ...current, entryId: newSlotData[slot].entryId };
    });
    setSlotData(newSlotData);
  };

  const fillEmptySlots = () => {
    const current = slotData[activeSlot];
    const newSlotData = { ...slotData };
    TIME_SLOTS.forEach(slot => {
      const isEmpty = newSlotData[slot].entryType === 'project' && !newSlotData[slot].project;
      if (isEmpty) {
        newSlotData[slot] = { ...current, entryId: newSlotData[slot].entryId };
      }
    });
    setSlotData(newSlotData);
  };

  const clearAllSlots = () => {
    setSlotData({
      AM1: { entryType: 'project', project: '', projectName: '', leaveType: '', description: '', notes: '', entryId: slotData.AM1.entryId },
      AM2: { entryType: 'project', project: '', projectName: '', leaveType: '', description: '', notes: '', entryId: slotData.AM2.entryId },
      PM1: { entryType: 'project', project: '', projectName: '', leaveType: '', description: '', notes: '', entryId: slotData.PM1.entryId },
      PM2: { entryType: 'project', project: '', projectName: '', leaveType: '', description: '', notes: '', entryId: slotData.PM2.entryId },
    });
  };

  const clearSlot = (slot: TimeSlot) => {
    setSlotData(prev => ({
      ...prev,
      [slot]: { entryType: 'project', project: '', projectName: '', leaveType: '', description: '', notes: '', entryId: prev[slot].entryId }
    }));
  };

  const navigate = (direction: number) => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction * 7));
    } else {
      newDate.setMonth(newDate.getMonth() + direction);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => setCurrentDate(new Date());

  const filteredProjects = useMemo(() => {
    if (!projectSearch) return projects;
    const search = projectSearch.toLowerCase();
    return projects.filter(p => 
      p.name.toLowerCase().includes(search) ||
      p.clientName?.toLowerCase().includes(search)
    );
  }, [projects, projectSearch]);

  const renderCellContent = (techId: string, date: Date, compact = false) => {
    const cellEntries = getEntriesForCell(techId, date);
    const holiday = getHoliday(date);
    
    if (holiday) {
      return (
        <div style={{ background: '#d1d5db', color: '#4b5563', padding: compact ? '2px 4px' : '0.25rem 0.5rem', borderRadius: '4px', fontSize: compact ? '0.65rem' : '0.75rem', textAlign: 'center' }}>
          🎉 {compact ? 'HOL' : holiday.name}
        </div>
      );
    }
    
    if (cellEntries.length === 0) {
      return <div style={{ color: '#9ca3af', fontSize: '0.75rem', textAlign: 'center' }}>—</div>;
    }
    
    const allSame = cellEntries.length === 4 && 
      cellEntries.every(e => e.entryType === cellEntries[0].entryType && e.project?._id === cellEntries[0].project?._id);
    
    if (allSame || cellEntries.length === 1) {
      const entry = cellEntries[0];
      const config = ENTRY_TYPES[entry.entryType as EntryType];
      const label = entry.entryType === 'project' 
        ? entry.projectName || entry.project?.name || 'Project'
        : entry.entryType === 'leave' && entry.leaveType
          ? LEAVE_TYPES[entry.leaveType as LeaveType]?.short || 'Leave'
          : config?.label || entry.entryType;
      
      return (
        <div style={{
          background: entry.entryType === 'leave' && entry.leaveType ? LEAVE_TYPES[entry.leaveType as LeaveType]?.bg : config?.bg || '#94a3b8',
          color: config?.text || '#ffffff',
          padding: compact ? '2px 4px' : '0.25rem 0.5rem',
          borderRadius: '4px',
          fontSize: compact ? '0.65rem' : '0.75rem',
          textAlign: 'center',
          position: 'relative',
        }}>
          {compact ? label.substring(0, 6) : label.substring(0, 12)}{label.length > (compact ? 6 : 12) ? '…' : ''}
          {cellEntries.some(e => e.notes) && (
            <span style={{ position: 'absolute', top: '-4px', right: '-4px', fontSize: '0.6rem' }}>💬</span>
          )}
        </div>
      );
    }
    
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', fontSize: '0.6rem' }}>
        {TIME_SLOTS.map(slot => {
          const entry = cellEntries.find(e => e.timeSlot === slot);
          if (!entry) {
            return <div key={slot} style={{ background: '#f3f4f6', borderRadius: '2px', padding: '2px', textAlign: 'center' }}>—</div>;
          }
          const config = ENTRY_TYPES[entry.entryType as EntryType];
          return (
            <div key={slot} style={{
              background: entry.entryType === 'leave' && entry.leaveType ? LEAVE_TYPES[entry.leaveType as LeaveType]?.bg : config?.bg || '#94a3b8',
              color: config?.text || '#ffffff',
              borderRadius: '2px',
              padding: '2px',
              textAlign: 'center',
            }}>
              {entry.entryType === 'project' ? (entry.projectName?.substring(0, 4) || 'PRJ') : config?.icon || '?'}
            </div>
          );
        })}
      </div>
    );
  };

  const weekDates = getWeekDates(currentDate).filter(d => showWeekends || !isWeekend(d));
  const monthDates = useMemo(() => getMonthDates(currentDate.getFullYear(), currentDate.getMonth()), [currentDate]);
  const canEdit = ['admin', 'project-manager', 'project-coordinator'].includes(user.role);

  const headerText = viewMode === 'week'
    ? `Week of ${getWeekDates(currentDate)[0].toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} - ${getWeekDates(currentDate)[6].toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : currentDate.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}><p>Loading schedule...</p></div>;
  }

  return (
    <div className="container" style={{ paddingTop: '1rem' }}>
      {/* Header */}
      <div style={{ background: 'white', borderRadius: '8px', padding: '1rem', marginBottom: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h2 style={{ margin: 0, color: '#1f2937', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>📅 Schedule</h2>
            <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '8px', padding: '0.25rem' }}>
              <button onClick={() => setViewMode('week')} style={{ padding: '0.4rem 0.75rem', background: viewMode === 'week' ? 'white' : 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: viewMode === 'week' ? 600 : 400, fontSize: '0.85rem', boxShadow: viewMode === 'week' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>Week</button>
              <button onClick={() => setViewMode('month')} style={{ padding: '0.4rem 0.75rem', background: viewMode === 'month' ? 'white' : 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: viewMode === 'month' ? 600 : 400, fontSize: '0.85rem', boxShadow: viewMode === 'month' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>Month</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '0.85rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <input type="checkbox" checked={showWeekends} onChange={(e) => setShowWeekends(e.target.checked)} />
              Show Weekends
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: '#f3f4f6', borderRadius: '8px', padding: '0.25rem' }}>
              <button onClick={() => navigate(-1)} style={{ padding: '0.4rem 0.6rem', background: 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>←</button>
              <span style={{ padding: '0 0.75rem', fontWeight: 500, minWidth: '200px', textAlign: 'center', fontSize: '0.9rem' }}>{headerText}</span>
              <button onClick={() => navigate(1)} style={{ padding: '0.4rem 0.6rem', background: 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>→</button>
            </div>
            <button onClick={goToToday} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500, fontSize: '0.85rem' }}>Today</button>
            {canEdit && <button onClick={() => setContractorsModal(true)} style={{ padding: '0.5rem 1rem', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500, fontSize: '0.85rem' }}>🔧 Contractors</button>}
          </div>
        </div>
      </div>

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>{error}</div>}

      {/* Week View */}
      {viewMode === 'week' && (
        <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', minWidth: '180px', position: 'sticky', left: 0, background: '#f9fafb', zIndex: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>👥 Technician</span>
                    {canEdit && <button onClick={() => setAddTechModal(true)} style={{ padding: '0.2rem 0.5rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>+ Add</button>}
                  </div>
                </th>
                {weekDates.map(date => (
                  <th key={date.toISOString()} style={{ padding: '0.75rem 0.5rem', textAlign: 'center', fontWeight: 600, color: isToday(date) ? '#3b82f6' : '#374151', borderBottom: '2px solid #e5e7eb', minWidth: '100px', background: isToday(date) ? '#eff6ff' : isWeekend(date) ? '#f3f4f6' : '#f9fafb' }}>
                    <div>{date.toLocaleDateString('en-AU', { weekday: 'short' }).toUpperCase()}</div>
                    <div style={{ fontSize: '1.1rem' }}>{date.getDate()}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map(group => (
                <React.Fragment key={group._id}>
                  <tr>
                    <td colSpan={weekDates.length + 1} onClick={() => toggleGroup(group._id)} style={{ padding: '0.5rem 1rem', background: '#e5e7eb', fontWeight: 600, color: '#374151', fontSize: '0.85rem', cursor: 'pointer' }}>
                      {collapsedGroups.has(group._id) ? '▶' : '▼'} {group.name} ({group.members?.length || 0})
                    </td>
                  </tr>
                  {!collapsedGroups.has(group._id) && group.members?.map(member => {
                    const techId = member.memberType === 'user' ? member.user?._id : member.contractor?._id;
                    const techName = member.memberType === 'user' ? member.user?.name : member.contractor?.name;
                    const contractorData = member.memberType === 'contractor' ? getContractor(techId) : null;
                    const userNotes = member.memberType === 'user' ? (member.user as any)?.scheduleNotes : null;
                    if (!techId || !techName) return null;
                    
                    return (
                      <tr key={techId}>
                        <td style={{ padding: '0.5rem 1rem', borderBottom: '1px solid #e5e7eb', background: 'white', position: 'sticky', left: 0, zIndex: 5 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ position: 'relative' }} className="tech-name-cell">
                              <span style={{ fontWeight: 500, color: '#1f2937', cursor: contractorData ? 'help' : 'default' }} title={contractorData ? `${contractorData.phone || 'No phone'} | ${contractorData.email || 'No email'}` : undefined}>
                                {techName}
                                {member.memberType === 'contractor' && <span style={{ marginLeft: '0.35rem', fontSize: '0.65rem', color: '#9ca3af' }}>🔧</span>}
                              </span>
                              {member.role ? (
                                <span 
                                  onClick={() => canEdit && setEditingMemberRole({ groupId: group._id, memberId: techId, memberName: techName, memberType: member.memberType, role: member.role || '' })}
                                  style={{ marginLeft: '0.5rem', fontSize: '0.7rem', padding: '0.1rem 0.35rem', background: '#dbeafe', color: '#1e40af', borderRadius: '3px', cursor: canEdit ? 'pointer' : 'default' }}
                                  title={canEdit ? 'Click to edit role' : undefined}
                                >{member.role}</span>
                              ) : canEdit && (
                                <button 
                                  onClick={() => setEditingMemberRole({ groupId: group._id, memberId: techId, memberName: techName, memberType: member.memberType, role: '' })}
                                  style={{ marginLeft: '0.5rem', fontSize: '0.65rem', padding: '0.1rem 0.3rem', background: '#f3f4f6', color: '#6b7280', border: '1px dashed #d1d5db', borderRadius: '3px', cursor: 'pointer' }}
                                  title="Add role"
                                >+ role</button>
                              )}
                              {contractorData && (contractorData.phone || contractorData.email) && (
                                <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '2px' }}>
                                  {contractorData.phone && <span style={{ marginRight: '0.5rem' }}>📱 {contractorData.phone}</span>}
                                  {contractorData.email && <span>✉️ {contractorData.email}</span>}
                                </div>
                              )}
                              {userNotes && (
                                <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '2px' }}>📝 {userNotes}</div>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              {canEdit && member.memberType === 'user' && (
                                <button onClick={() => setEditingTechNotes({ userId: techId, userName: techName, notes: userNotes || '' })} style={{ padding: '0.2rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '0.8rem' }} title="Edit notes">📝</button>
                              )}
                              {canEdit && contractorData && (
                                <button onClick={() => setEditingContractor(contractorData)} style={{ padding: '0.2rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '0.8rem' }} title="Edit contractor">✏️</button>
                              )}
                              {canEdit && <button onClick={() => setDeleteConfirm({ techId, techName, groupId: group._id, memberType: member.memberType })} style={{ padding: '0.2rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '0.8rem' }} title="Remove from group">🗑️</button>}
                            </div>
                          </div>
                        </td>
                        {weekDates.map(date => {
                          const holiday = getHoliday(date);
                          return (
                            <td key={date.toISOString()} onClick={() => canEdit && !holiday && openEditModal(techId, techName, member.memberType, date)} style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb', borderLeft: '1px solid #f3f4f6', background: isToday(date) ? '#eff6ff' : isWeekend(date) ? '#f9fafb' : 'white', cursor: canEdit && !holiday ? 'pointer' : 'default', verticalAlign: 'top' }}>
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
                <tr><td colSpan={weekDates.length + 1} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>No technician groups configured. {canEdit && 'Click "Add" to add technicians.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Month View */}
      {viewMode === 'month' && (
        <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'auto' }}>
          {groups.map(group => (
            <div key={group._id} style={{ marginBottom: '1.5rem' }}>
              <div onClick={() => toggleGroup(group._id)} style={{ padding: '0.75rem 1rem', background: '#e5e7eb', fontWeight: 600, color: '#374151', fontSize: '0.9rem', cursor: 'pointer', borderRadius: '8px 8px 0 0' }}>
                {collapsedGroups.has(group._id) ? '▶' : '▼'} {group.name} ({group.members?.length || 0})
              </div>
              {!collapsedGroups.has(group._id) && group.members?.map(member => {
                const techId = member.memberType === 'user' ? member.user?._id : member.contractor?._id;
                const techName = member.memberType === 'user' ? member.user?.name : member.contractor?.name;
                const contractorData = member.memberType === 'contractor' ? getContractor(techId) : null;
                const userNotes = member.memberType === 'user' ? (member.user as any)?.scheduleNotes : null;
                if (!techId || !techName) return null;
                const displayDates = showWeekends ? monthDates : monthDates.filter(d => !isWeekend(d.date));
                
                return (
                  <div key={techId} style={{ borderBottom: '1px solid #e5e7eb', padding: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 500 }}>{techName}</span>
                        {member.memberType === 'contractor' && <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>🔧</span>}
                        {member.role ? (
                          <span 
                            onClick={() => canEdit && setEditingMemberRole({ groupId: group._id, memberId: techId, memberName: techName, memberType: member.memberType, role: member.role || '' })}
                            style={{ fontSize: '0.7rem', padding: '0.1rem 0.35rem', background: '#dbeafe', color: '#1e40af', borderRadius: '3px', cursor: canEdit ? 'pointer' : 'default' }}
                            title={canEdit ? 'Click to edit role' : undefined}
                          >{member.role}</span>
                        ) : canEdit && (
                          <button 
                            onClick={() => setEditingMemberRole({ groupId: group._id, memberId: techId, memberName: techName, memberType: member.memberType, role: '' })}
                            style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', background: '#f3f4f6', color: '#6b7280', border: '1px dashed #d1d5db', borderRadius: '3px', cursor: 'pointer' }}
                            title="Add role"
                          >+ role</button>
                        )}
                        {contractorData && (contractorData.phone || contractorData.email) && (
                          <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                            {contractorData.phone && <span style={{ marginRight: '0.5rem' }}>📱 {contractorData.phone}</span>}
                            {contractorData.email && <span>✉️ {contractorData.email}</span>}
                          </span>
                        )}
                        {userNotes && <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>📝 {userNotes}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        {canEdit && member.memberType === 'user' && (
                          <button onClick={() => setEditingTechNotes({ userId: techId, userName: techName, notes: userNotes || '' })} style={{ padding: '0.2rem 0.4rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}>📝</button>
                        )}
                        {canEdit && contractorData && (
                          <button onClick={() => setEditingContractor(contractorData)} style={{ padding: '0.2rem 0.4rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}>Edit</button>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${showWeekends ? 7 : 5}, 1fr)`, gap: '2px' }}>
                      {(showWeekends ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']).map(day => (
                        <div key={day} style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', padding: '0.25rem' }}>{day}</div>
                      ))}
                      {displayDates.map(({ date, isCurrentMonth }) => {
                        const holiday = getHoliday(date);
                        return (
                          <div key={date.toISOString()} onClick={() => canEdit && !holiday && isCurrentMonth && openEditModal(techId, techName, member.memberType, date)} style={{ padding: '0.25rem', minHeight: '50px', background: !isCurrentMonth ? '#f9fafb' : isToday(date) ? '#eff6ff' : 'white', border: `1px solid ${isToday(date) ? '#3b82f6' : '#e5e7eb'}`, borderRadius: '4px', cursor: canEdit && !holiday && isCurrentMonth ? 'pointer' : 'default', opacity: isCurrentMonth ? 1 : 0.4 }}>
                            <div style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '2px' }}>{date.getDate()}</div>
                            {isCurrentMonth && renderCellContent(techId, date, true)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#374151' }}>Legend</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          {Object.entries(ENTRY_TYPES).map(([key, config]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <div style={{ width: '16px', height: '16px', background: config.bg, borderRadius: '3px' }} />
              <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{config.label}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: '1rem' }}>
            <span style={{ fontSize: '0.8rem' }}>💬</span>
            <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Has notes</span>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editModal && (
        <div onClick={() => setEditModal(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '12px', width: '90%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(135deg, #1f2937, #374151)', borderRadius: '12px 12px 0 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <h3 style={{ margin: 0, color: 'white' }}>{editModal.techName}</h3>
                  <p style={{ margin: '0.25rem 0 0', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>{editModal.date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
                <button onClick={() => setEditModal(null)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer' }}>✕</button>
              </div>
            </div>

            <div style={{ padding: '1.25rem' }}>
              {/* Slot tabs */}
              <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', background: '#f3f4f6', padding: '0.25rem', borderRadius: '8px' }}>
                {TIME_SLOTS.map(slot => {
                  const data = slotData[slot];
                  const hasData = data.entryType !== 'project' || data.project;
                  const config = hasData ? ENTRY_TYPES[data.entryType] : null;
                  return (
                    <button key={slot} onClick={() => setActiveSlot(slot)} style={{ flex: 1, padding: '0.5rem', background: activeSlot === slot ? 'white' : 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: activeSlot === slot ? 600 : 400, boxShadow: activeSlot === slot ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>{slot}{data.notes && <span style={{ fontSize: '0.6rem' }}>💬</span>}</div>
                      {hasData && <div style={{ position: 'absolute', bottom: '4px', left: '50%', transform: 'translateX(-50%)', width: '8px', height: '8px', background: data.entryType === 'leave' && data.leaveType ? LEAVE_TYPES[data.leaveType]?.bg : config?.bg, borderRadius: '50%' }} />}
                    </button>
                  );
                })}
              </div>

              {/* Current slot info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', fontSize: '0.85rem' }}>
                <span style={{ color: '#6b7280' }}>Editing: <strong>{activeSlot}</strong>{slotData[activeSlot].entryType !== 'project' && <span style={{ marginLeft: '0.5rem', color: '#9ca3af' }}>({ENTRY_TYPES[slotData[activeSlot].entryType]?.label})</span>}</span>
                {(slotData[activeSlot].entryType !== 'project' || slotData[activeSlot].project) && <button onClick={() => clearSlot(activeSlot)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem' }}>Clear this slot</button>}
              </div>

              {/* Entry Type Grid */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>Entry Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
                  {Object.entries(ENTRY_TYPES).map(([key, config]) => (
                    <button key={key} onClick={() => updateCurrentSlot({ entryType: key as EntryType })} style={{ padding: '0.5rem', background: slotData[activeSlot].entryType === key ? `${config.bg}20` : 'white', border: slotData[activeSlot].entryType === key ? `2px solid ${config.bg}` : '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.25rem' }}>{config.icon}</div>
                      <div style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>{config.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Project Search */}
              {slotData[activeSlot].entryType === 'project' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>Project</label>
                  <input type="text" value={projectSearch} onChange={(e) => setProjectSearch(e.target.value)} placeholder="🔍 Search projects..." style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', marginBottom: '0.5rem' }} />
                  <div style={{ maxHeight: '150px', overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                    {filteredProjects.map(p => (
                      <button key={p._id} onClick={() => { updateCurrentSlot({ project: p._id, projectName: p.name }); setProjectSearch(''); }} style={{ width: '100%', padding: '0.5rem 0.75rem', background: slotData[activeSlot].project === p._id ? '#dbeafe' : 'white', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 500 }}>{p.name}</span>
                        {p.clientName && <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>({p.clientName})</span>}
                      </button>
                    ))}
                  </div>
                  {slotData[activeSlot].project && <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#dbeafe', borderRadius: '6px', fontSize: '0.85rem' }}>Selected: <strong>{slotData[activeSlot].projectName || projects.find(p => p._id === slotData[activeSlot].project)?.name}</strong></div>}
                </div>
              )}

              {/* Leave Type */}
              {slotData[activeSlot].entryType === 'leave' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>Leave Type</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                    {Object.entries(LEAVE_TYPES).map(([key, config]) => (
                      <button key={key} onClick={() => updateCurrentSlot({ leaveType: key as LeaveType })} style={{ padding: '0.5rem', background: slotData[activeSlot].leaveType === key ? `${config.bg}20` : 'white', border: slotData[activeSlot].leaveType === key ? `2px solid ${config.bg}` : '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer', textAlign: 'left' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{config.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {!['project', 'leave'].includes(slotData[activeSlot].entryType) && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>Description</label>
                  <input type="text" value={slotData[activeSlot].description} onChange={(e) => updateCurrentSlot({ description: e.target.value })} placeholder="Enter details..." style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem' }} />
                </div>
              )}

              {/* Notes */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>📝 Notes for {activeSlot}</label>
                <textarea value={slotData[activeSlot].notes} onChange={(e) => updateCurrentSlot({ notes: e.target.value })} placeholder="Add notes..." style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', minHeight: '60px', resize: 'vertical' }} />
              </div>

              {/* Quick Actions */}
              <div style={{ marginBottom: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>Quick Actions</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <button onClick={fillAllSlots} style={{ padding: '0.4rem 0.75rem', background: '#dbeafe', color: '#1e40af', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>📋 Fill entire day</button>
                  <button onClick={fillEmptySlots} style={{ padding: '0.4rem 0.75rem', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>📝 Fill empty slots</button>
                  <button onClick={copyToRestOfWeek} disabled={saving} style={{ padding: '0.4rem 0.75rem', background: '#d1fae5', color: '#065f46', border: 'none', borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.85rem', opacity: saving ? 0.6 : 1 }}>📅 Copy to rest of week</button>
                  <button onClick={clearAllSlots} style={{ padding: '0.4rem 0.75rem', background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>🗑️ Clear entire day</button>
                </div>
              </div>

              {/* Day Preview */}
              <div style={{ paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>Day Preview</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                  {TIME_SLOTS.map(slot => {
                    const data = slotData[slot];
                    const hasData = data.entryType !== 'project' || data.project;
                    const config = hasData ? ENTRY_TYPES[data.entryType] : null;
                    const bgColor = hasData ? (data.entryType === 'leave' && data.leaveType ? LEAVE_TYPES[data.leaveType]?.bg : config?.bg) : '#f1f5f9';
                    const textColor = hasData ? (config?.text || '#ffffff') : '#94a3b8';
                    let label = '—';
                    if (hasData) {
                      if (data.entryType === 'project') label = data.projectName?.substring(0, 6) || 'PRJ';
                      else if (data.entryType === 'leave' && data.leaveType) label = LEAVE_TYPES[data.leaveType]?.short || 'LV';
                      else label = config?.icon || '?';
                    }
                    return (
                      <div key={slot} onClick={() => setActiveSlot(slot)} style={{ padding: '0.5rem', background: bgColor, color: textColor, borderRadius: '8px', textAlign: 'center', cursor: 'pointer', border: activeSlot === slot ? '2px solid #3b82f6' : '2px solid transparent', position: 'relative' }}>
                        <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>{slot}</div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{label}</div>
                        {data.notes && <span style={{ position: 'absolute', top: '-4px', right: '-4px', width: '12px', height: '12px', background: '#f59e0b', borderRadius: '50%', fontSize: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>💬</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', justifyContent: 'space-between', borderRadius: '0 0 12px 12px' }}>
              <button onClick={() => setEditModal(null)} style={{ padding: '0.5rem 1rem', background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '0.5rem 1.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: saving ? 'wait' : 'pointer', fontWeight: 500 }}>{saving ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div onClick={() => setDeleteConfirm(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '12px', width: '90%', maxWidth: '400px', padding: '1.5rem', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 1rem', color: '#dc2626' }}>⚠️ Remove {deleteConfirm.techName}?</h3>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>This will remove them from the schedule group.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={async () => { try { await scheduleAPI.removeGroupMember(deleteConfirm.groupId, deleteConfirm.techId, deleteConfirm.memberType); setDeleteConfirm(null); loadData(); } catch (err: any) { alert(err.message); } }} style={{ padding: '0.5rem 1rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}>Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Tech Modal */}
      {addTechModal && <AddTechModal groups={groups} onClose={() => setAddTechModal(false)} onAdded={() => { setAddTechModal(false); loadData(); }} />}
      
      {/* Contractors Management Modal */}
      {contractorsModal && <ContractorsModal contractors={contractors} onClose={() => setContractorsModal(false)} onEdit={(c) => { setContractorsModal(false); setEditingContractor(c); }} onRefresh={loadData} />}
      
      {/* Edit Contractor Modal */}
      {editingContractor && <EditContractorModal contractor={editingContractor} onClose={() => setEditingContractor(null)} onSaved={() => { setEditingContractor(null); loadData(); }} />}

      {/* Edit Tech Notes Modal */}
      {editingTechNotes && <EditTechNotesModal userId={editingTechNotes.userId} userName={editingTechNotes.userName} notes={editingTechNotes.notes} onClose={() => setEditingTechNotes(null)} onSaved={() => { setEditingTechNotes(null); loadData(); }} />}

      {/* Edit Member Role Modal */}
      {editingMemberRole && <EditMemberRoleModal groupId={editingMemberRole.groupId} memberId={editingMemberRole.memberId} memberName={editingMemberRole.memberName} memberType={editingMemberRole.memberType} role={editingMemberRole.role} onClose={() => setEditingMemberRole(null)} onSaved={() => { setEditingMemberRole(null); loadData(); }} />}
    </div>
  );
};

// Add Tech Modal Component
interface AddTechModalProps { groups: TechnicianGroup[]; onClose: () => void; onAdded: () => void; }

const AddTechModal: React.FC<AddTechModalProps> = ({ groups, onClose, onAdded }) => {
  const [availableTechs, setAvailableTechs] = useState<{ _id: string; name: string; email: string; role: string }[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTech, setSelectedTech] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(groups[0]?._id || '');
  const [role, setRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'user' | 'contractor' | 'new-contractor'>('user');
  const [showNewGroup, setShowNewGroup] = useState(groups.length === 0);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newContractor, setNewContractor] = useState({ name: '', company: '', phone: '', category: 'contractor' as 'contractor' | 'subcontractor' });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [techs, contractorList] = await Promise.all([scheduleAPI.getAvailableTechs(), contractorsAPI.getAll()]);
        const existingUserIds = new Set<string>();
        const existingContractorIds = new Set<string>();
        groups.forEach(g => { g.members?.forEach(m => { if (m.user?._id) existingUserIds.add(m.user._id); if (m.contractor?._id) existingContractorIds.add(m.contractor._id); }); });
        setAvailableTechs(techs.filter((t: any) => !existingUserIds.has(t._id)));
        setContractors(contractorList.filter((c: Contractor) => c.isActive && !existingContractorIds.has(c._id)));
      } catch (err) { console.error('Failed to load:', err); } finally { setLoading(false); }
    };
    loadData();
  }, [groups]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try { setCreatingGroup(true); const g = await scheduleAPI.createGroup({ name: newGroupName.trim() }); setSelectedGroup(g._id); setShowNewGroup(false); setNewGroupName(''); onAdded(); }
    catch (err: any) { alert(err.message); } finally { setCreatingGroup(false); }
  };

  const handleCreateContractor = async () => {
    if (!newContractor.name.trim() || !selectedGroup) return;
    try { setSaving(true); const c = await contractorsAPI.create(newContractor); await scheduleAPI.addGroupMember(selectedGroup, { memberType: 'contractor', contractorId: c._id, role: role || undefined }); onAdded(); }
    catch (err: any) { alert(err.message); } finally { setSaving(false); }
  };

  const handleAdd = async () => {
    if (!selectedGroup || !selectedTech) return;
    try { setSaving(true); await scheduleAPI.addGroupMember(selectedGroup, { memberType: activeTab === 'user' ? 'user' : 'contractor', [activeTab === 'user' ? 'userId' : 'contractorId']: selectedTech, role: role || undefined }); onAdded(); }
    catch (err: any) { alert(err.message); } finally { setSaving(false); }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '12px', width: '90%', maxWidth: '450px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '1.25rem', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(135deg, #10b981, #059669)', borderRadius: '12px 12px 0 0' }}>
          <h3 style={{ margin: 0, color: 'white' }}>{showNewGroup ? '📁 Create Group' : '👤 Add to Schedule'}</h3>
        </div>
        <div style={{ padding: '1.25rem' }}>
          {showNewGroup ? (
            <>
              <p style={{ color: '#6b7280', marginBottom: '1rem', fontSize: '0.9rem' }}>{groups.length === 0 ? 'Create a group first.' : 'Create a new group.'}</p>
              <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="e.g., Install Technicians" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', marginBottom: '1rem' }} />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={handleCreateGroup} disabled={creatingGroup || !newGroupName.trim()} style={{ flex: 1, padding: '0.5rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>{creatingGroup ? 'Creating...' : 'Create'}</button>
                {groups.length > 0 && <button onClick={() => setShowNewGroup(false)} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>}
              </div>
            </>
          ) : loading ? <p>Loading...</p> : (
            <>
              <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', background: '#f3f4f6', padding: '0.25rem', borderRadius: '8px' }}>
                {['user', 'contractor', 'new-contractor'].map(tab => (
                  <button key={tab} onClick={() => { setActiveTab(tab as any); setSelectedTech(''); }} style={{ flex: 1, padding: '0.5rem', background: activeTab === tab ? 'white' : 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: activeTab === tab ? 600 : 400, fontSize: '0.8rem' }}>
                    {tab === 'user' ? '👤 Staff' : tab === 'contractor' ? '🔧 Contractor' : '➕ New'}
                  </button>
                ))}
              </div>
              {activeTab === 'user' && <select value={selectedTech} onChange={(e) => setSelectedTech(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', marginBottom: '1rem' }}><option value="">-- Select Staff --</option>{availableTechs.map(t => <option key={t._id} value={t._id}>{t.name} ({t.role})</option>)}</select>}
              {activeTab === 'contractor' && <select value={selectedTech} onChange={(e) => setSelectedTech(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', marginBottom: '1rem' }}><option value="">-- Select Contractor --</option>{contractors.map(c => <option key={c._id} value={c._id}>{c.name} {c.company ? `(${c.company})` : ''}</option>)}</select>}
              {activeTab === 'new-contractor' && (
                <div style={{ marginBottom: '1rem' }}>
                  <input type="text" value={newContractor.name} onChange={(e) => setNewContractor({ ...newContractor, name: e.target.value })} placeholder="Name *" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', marginBottom: '0.5rem' }} />
                  <input type="text" value={newContractor.company} onChange={(e) => setNewContractor({ ...newContractor, company: e.target.value })} placeholder="Company" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', marginBottom: '0.5rem' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input type="tel" value={newContractor.phone} onChange={(e) => setNewContractor({ ...newContractor, phone: e.target.value })} placeholder="Phone" style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }} />
                    <input type="email" value={newContractor.email || ''} onChange={(e) => setNewContractor({ ...newContractor, email: e.target.value })} placeholder="Email" style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }} />
                  </div>
                  <select value={newContractor.category} onChange={(e) => setNewContractor({ ...newContractor, category: e.target.value as any })} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}><option value="contractor">Contractor</option><option value="subcontractor">Subcontractor</option></select>
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <select value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)} style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}><option value="">-- Select Group --</option>{groups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}</select>
                <button onClick={() => setShowNewGroup(true)} style={{ padding: '0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>+ New</button>
              </div>
              <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role label (optional)" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }} />
            </>
          )}
        </div>
        {!showNewGroup && (
          <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button onClick={onClose} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
            <button onClick={activeTab === 'new-contractor' ? handleCreateContractor : handleAdd} disabled={saving || !selectedGroup || (activeTab !== 'new-contractor' && !selectedTech) || (activeTab === 'new-contractor' && !newContractor.name.trim())} style={{ padding: '0.5rem 1.5rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}>{saving ? 'Saving...' : activeTab === 'new-contractor' ? 'Create & Add' : 'Add'}</button>
          </div>
        )}
      </div>
    </div>
  );
};

// Contractors Management Modal
const ContractorsModal: React.FC<{
  contractors: Contractor[];
  onClose: () => void;
  onEdit: (contractor: Contractor) => void;
  onRefresh: () => void;
}> = ({ contractors, onClose, onEdit, onRefresh }) => {
  const [filter, setFilter] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const filteredContractors = contractors.filter(c => 
    c.name.toLowerCase().includes(filter.toLowerCase()) ||
    c.company?.toLowerCase().includes(filter.toLowerCase()) ||
    c.email?.toLowerCase().includes(filter.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contractor? This will also remove them from any groups.')) return;
    try {
      setDeleting(id);
      await contractorsAPI.delete(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete contractor');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '12px', width: '90%', maxWidth: '600px', maxHeight: '90vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1.25rem', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(135deg, #f59e0b, #d97706)', borderRadius: '12px 12px 0 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, color: 'white' }}>🔧 Manage Contractors</h3>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '0.4rem 0.6rem', borderRadius: '6px', cursor: 'pointer' }}>✕</button>
          </div>
        </div>
        
        <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb' }}>
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="🔍 Search contractors..."
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem' }}
          />
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '0.5rem' }}>
          {filteredContractors.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>
              {filter ? 'No contractors match your search' : 'No contractors yet'}
            </p>
          ) : (
            filteredContractors.map(c => (
              <div key={c._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: '#f9fafb', borderRadius: '8px', marginBottom: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600, color: '#1f2937' }}>{c.name}</span>
                    {c.company && <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>({c.company})</span>}
                    <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', background: c.category === 'subcontractor' ? '#fef3c7' : '#dbeafe', color: c.category === 'subcontractor' ? '#92400e' : '#1e40af', borderRadius: '4px' }}>
                      {c.category === 'subcontractor' ? 'SUB' : 'CON'}
                    </span>
                    {!c.isActive && <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', background: '#fee2e2', color: '#dc2626', borderRadius: '4px' }}>Inactive</span>}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    {c.phone && <span style={{ marginRight: '1rem' }}>📱 {c.phone}</span>}
                    {c.email && <span>✉️ {c.email}</span>}
                    {!c.phone && !c.email && <span style={{ fontStyle: 'italic' }}>No contact info</span>}
                  </div>
                  {c.notes && <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>📝 {c.notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => onEdit(c)} style={{ padding: '0.4rem 0.6rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>Edit</button>
                  <button onClick={() => handleDelete(c._id)} disabled={deleting === c._id} style={{ padding: '0.4rem 0.6rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', opacity: deleting === c._id ? 0.5 : 1 }}>
                    {deleting === c._id ? '...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ padding: '1rem', borderTop: '1px solid #e5e7eb', background: '#f9fafb', textAlign: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>{contractors.length} contractor{contractors.length !== 1 ? 's' : ''} total</span>
        </div>
      </div>
    </div>
  );
};

// Contractor Edit Modal
const EditContractorModal: React.FC<{
  contractor: Contractor;
  onClose: () => void;
  onSaved: () => void;
}> = ({ contractor, onClose, onSaved }) => {
  const [formData, setFormData] = useState({
    name: contractor.name,
    company: contractor.company || '',
    phone: contractor.phone || '',
    email: contractor.email || '',
    category: contractor.category || 'contractor',
    notes: contractor.notes || '',
    isActive: contractor.isActive !== false
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Name is required');
      return;
    }
    try {
      setSaving(true);
      await contractorsAPI.update(contractor._id, formData);
      onSaved();
    } catch (err: any) {
      alert(err.message || 'Failed to update contractor');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1001 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '12px', width: '90%', maxWidth: '450px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '1.25rem', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', borderRadius: '12px 12px 0 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, color: 'white' }}>✏️ Edit Contractor</h3>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '0.4rem 0.6rem', borderRadius: '6px', cursor: 'pointer' }}>✕</button>
          </div>
        </div>

        <div style={{ padding: '1.25rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500, fontSize: '0.9rem' }}>Name *</label>
            <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }} />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500, fontSize: '0.9rem' }}>Company</label>
            <input type="text" value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500, fontSize: '0.9rem' }}>Phone</label>
              <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500, fontSize: '0.9rem' }}>Email</label>
              <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500, fontSize: '0.9rem' }}>Category</label>
              <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value as any })} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}>
                <option value="contractor">Contractor</option>
                <option value="subcontractor">Subcontractor</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500, fontSize: '0.9rem' }}>Status</label>
              <select value={formData.isActive ? 'active' : 'inactive'} onChange={e => setFormData({ ...formData, isActive: e.target.value === 'active' })} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500, fontSize: '0.9rem' }}>Notes</label>
            <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Any notes about this contractor..." style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', minHeight: '60px', resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !formData.name.trim()} style={{ padding: '0.5rem 1.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Edit Tech Notes Modal Component
const EditTechNotesModal: React.FC<{
  userId: string;
  userName: string;
  notes: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ userId, userName, notes, onClose, onSaved }) => {
  const [notesValue, setNotesValue] = useState(notes);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      await usersAPI.updateScheduleNotes(userId, notesValue);
      onSaved();
    } catch (err: any) {
      alert(err.message || 'Failed to update notes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1001 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '12px', width: '90%', maxWidth: '400px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '1.25rem', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(135deg, #10b981, #059669)', borderRadius: '12px 12px 0 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, color: 'white' }}>📝 Notes for {userName}</h3>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '0.4rem 0.6rem', borderRadius: '6px', cursor: 'pointer' }}>✕</button>
          </div>
        </div>

        <div style={{ padding: '1.25rem' }}>
          <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Add notes that will appear on the schedule next to this technician's name.
          </p>
          <textarea
            value={notesValue}
            onChange={e => setNotesValue(e.target.value)}
            placeholder="e.g., On leave Mon-Wed, Working from site B, etc."
            style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', minHeight: '100px', resize: 'vertical', fontSize: '0.9rem' }}
            autoFocus
          />
        </div>

        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '0.5rem 1.5rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving...' : 'Save Notes'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Edit Member Role Modal Component
const EditMemberRoleModal: React.FC<{
  groupId: string;
  memberId: string;
  memberName: string;
  memberType: 'user' | 'contractor';
  role: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ groupId, memberId, memberName, memberType, role, onClose, onSaved }) => {
  const [roleValue, setRoleValue] = useState(role);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      await scheduleAPI.updateMemberRole(groupId, memberId, memberType, roleValue.trim());
      onSaved();
    } catch (err: any) {
      alert(err.message || 'Failed to update role');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1001 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '12px', width: '90%', maxWidth: '350px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '1.25rem', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', borderRadius: '12px 12px 0 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, color: 'white' }}>🏷️ Edit Role</h3>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '0.4rem 0.6rem', borderRadius: '6px', cursor: 'pointer' }}>✕</button>
          </div>
        </div>

        <div style={{ padding: '1.25rem' }}>
          <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Set a role/label for <strong>{memberName}</strong> that appears next to their name on the schedule.
          </p>
          <input
            type="text"
            value={roleValue}
            onChange={e => setRoleValue(e.target.value)}
            placeholder="e.g., SUP, Rack Builder, Lead Tech..."
            style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem' }}
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
          <p style={{ color: '#9ca3af', fontSize: '0.75rem', marginTop: '0.5rem' }}>
            Leave empty to remove the role badge.
          </p>
        </div>

        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '0.5rem 1.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving...' : 'Save Role'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Schedule;
