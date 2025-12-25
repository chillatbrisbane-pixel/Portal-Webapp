import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, Project } from '../types';
import { tasksAPI, usersAPI, projectsAPI } from '../services/apiService';
import TaskList from './TaskList';

interface Subtask {
  _id: string;
  title: string;
  completed: boolean;
  completedAt?: string;
  completedBy?: { _id: string; name: string };
}

interface Task {
  _id: string;
  title: string;
  description?: string;
  project?: { _id: string; name: string; clientName?: string; status?: string };
  assignee?: { _id: string; name: string; email: string };
  assignees?: { _id: string; name: string; email: string }[];
  subtasks?: Subtask[];
  stage: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  createdBy?: { _id: string; name: string };
  completedBy?: { _id: string; name: string };
  createdAt: string;
  completedAt?: string;
}

interface TasksProps {
  user: User;
}

interface Stage {
  id: string;
  label: string;
  color: string;
}

const DEFAULT_STAGES: Stage[] = [
  { id: 'planning', label: '📋 Planning', color: '#e5e7eb' },
  { id: 'rough-in', label: '🔧 Rough-in', color: '#fef3c7' },
  { id: 'fit-off', label: '🔨 Fit-off', color: '#dbeafe' },
  { id: 'configure', label: '⚙️ Configure', color: '#e0e7ff' },
  { id: 'test', label: '🧪 Test', color: '#fce7f3' },
  { id: 'commission', label: '✅ Commission', color: '#dcfce7' },
];

const PRIORITY_CONFIG = {
  high: { label: 'High', color: '#ef4444', bg: '#fef2f2' },
  medium: { label: 'Medium', color: '#f59e0b', bg: '#fffbeb' },
  low: { label: 'Low', color: '#6b7280', bg: '#f3f4f6' },
};

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isOverdue = (dueDate: string): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dueDate) < today;
};

const isDueToday = (dueDate: string): boolean => {
  const today = formatDate(new Date());
  return dueDate.split('T')[0] === today;
};

const isDueThisWeek = (dueDate: string): boolean => {
  const today = new Date();
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const due = new Date(dueDate);
  return due >= today && due <= weekEnd;
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

export const Tasks: React.FC<TasksProps> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<{ _id: string; name: string; email: string }[]>([]);
  
  const [viewMode, setViewMode] = useState<'list' | 'board' | 'calendar'>('list');
  const [showCompleted, setShowCompleted] = useState(false);
  const [filterProject, setFilterProject] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('dueDate');
  
  const [calendarDate, setCalendarDate] = useState(new Date());
  
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const canEdit = ['admin', 'project-manager', 'project-coordinator'].includes(user.role);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const [tasksData, projectsData, usersData] = await Promise.all([
        tasksAPI.getAll({ completed: showCompleted ? undefined : 'false' }),
        projectsAPI.getAll(),
        usersAPI.getAll()
      ]);
      
      setTasks(tasksData);
      setProjects(projectsData);
      setUsers(usersData);
    } catch (err: any) {
      console.error('Load error:', err);
      setError(err.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [showCompleted]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredTasks = useMemo(() => {
    let result = [...tasks];
    
    if (filterProject) {
      result = result.filter(t => t.project?._id === filterProject);
    }
    if (filterAssignee) {
      result = result.filter(t => 
        t.assignee?._id === filterAssignee || 
        t.assignees?.some(a => a._id === filterAssignee)
      );
    }
    if (filterPriority) {
      result = result.filter(t => t.priority === filterPriority);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.project?.name.toLowerCase().includes(query)
      );
    }
    
    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'dueDate':
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        case 'priority':
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        case 'project':
          return (a.project?.name || '').localeCompare(b.project?.name || '');
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return 0;
      }
    });
    
    return result;
  }, [tasks, filterProject, filterAssignee, filterPriority, searchQuery, sortBy]);

  const tasksByStage = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    const stageIds = new Set(DEFAULT_STAGES.map(s => s.id));
    
    // Initialize with default stages
    DEFAULT_STAGES.forEach(s => { grouped[s.id] = []; });
    
    // Group tasks and track orphaned stages
    const orphanedStageIds = new Set<string>();
    filteredTasks.forEach(task => {
      if (!stageIds.has(task.stage)) {
        orphanedStageIds.add(task.stage);
        if (!grouped[task.stage]) grouped[task.stage] = [];
      }
      if (!grouped[task.stage]) grouped[task.stage] = [];
      grouped[task.stage].push(task);
    });
    
    return grouped;
  }, [filteredTasks]);

  const tasksByDate = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    filteredTasks.forEach(task => {
      if (task.dueDate) {
        const dateKey = task.dueDate.split('T')[0];
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(task);
      }
    });
    return grouped;
  }, [filteredTasks]);

  const handleToggleComplete = async (task: Task) => {
    try {
      await tasksAPI.toggle(task._id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update task');
    }
  };

  const handleStageChange = async (taskId: string, newStage: string) => {
    try {
      await tasksAPI.updateStage(taskId, newStage);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to move task');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Delete this task?')) return;
    try {
      await tasksAPI.delete(taskId);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete task');
    }
  };

  // Stats
  const stats = useMemo(() => {
    const overdue = tasks.filter(t => !t.completed && t.dueDate && isOverdue(t.dueDate)).length;
    const dueToday = tasks.filter(t => !t.completed && t.dueDate && isDueToday(t.dueDate)).length;
    const dueThisWeek = tasks.filter(t => !t.completed && t.dueDate && isDueThisWeek(t.dueDate)).length;
    const highPriority = tasks.filter(t => !t.completed && t.priority === 'high').length;
    const completedToday = tasks.filter(t => t.completed && t.completedAt && isDueToday(t.completedAt)).length;
    return { overdue, dueToday, dueThisWeek, highPriority, completedToday, total: tasks.length };
  }, [tasks]);

  // When a project is selected, show the full TaskList component for that project
  if (filterProject) {
    const selectedProject = projects.find(p => p._id === filterProject);
    return (
      <div className="container" style={{ paddingTop: '1rem' }}>
        {/* Back to All Tasks header */}
        <div style={{ background: 'white', borderRadius: '8px', padding: '1rem', marginBottom: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button onClick={() => setFilterProject('')} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ← Back to All Tasks
            </button>
            <h2 style={{ margin: 0, color: '#1f2937' }}>
              📁 {selectedProject?.name || 'Project'} {selectedProject?.clientName && <span style={{ color: '#6b7280', fontWeight: 400 }}>- {selectedProject.clientName}</span>}
            </h2>
          </div>
        </div>
        
        {/* Render the actual TaskList component */}
        <TaskList projectId={filterProject} />
      </div>
    );
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}><p>Loading tasks...</p></div>;
  }

  // Global tasks view (no project selected)
  return (
    <div className="container" style={{ paddingTop: '1rem' }}>
      {/* Header */}
      <div style={{ background: 'white', borderRadius: '8px', padding: '1rem', marginBottom: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h2 style={{ margin: 0, color: '#1f2937', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>✅ All Tasks</h2>
            <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '8px', padding: '0.25rem' }}>
              {(['list', 'board', 'calendar'] as const).map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)} style={{ padding: '0.4rem 0.75rem', background: viewMode === mode ? 'white' : 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: viewMode === mode ? 600 : 400, fontSize: '0.85rem', boxShadow: viewMode === mode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', textTransform: 'capitalize' }}>
                  {mode === 'list' ? '📋' : mode === 'board' ? '📊' : '📅'} {mode}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '0.85rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <input type="checkbox" checked={showCompleted} onChange={e => setShowCompleted(e.target.checked)} />
              Show Completed
            </label>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ background: '#fef2f2', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#dc2626' }}>{stats.overdue}</div>
          <div style={{ fontSize: '0.75rem', color: '#991b1b' }}>Overdue</div>
        </div>
        <div style={{ background: '#fffbeb', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#d97706' }}>{stats.dueToday}</div>
          <div style={{ fontSize: '0.75rem', color: '#92400e' }}>Due Today</div>
        </div>
        <div style={{ background: '#eff6ff', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2563eb' }}>{stats.dueThisWeek}</div>
          <div style={{ fontSize: '0.75rem', color: '#1e40af' }}>This Week</div>
        </div>
        <div style={{ background: '#fef3c7', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#b45309' }}>{stats.highPriority}</div>
          <div style={{ fontSize: '0.75rem', color: '#92400e' }}>High Priority</div>
        </div>
        <div style={{ background: '#dcfce7', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#16a34a' }}>{stats.completedToday}</div>
          <div style={{ fontSize: '0.75rem', color: '#166534' }}>Done Today</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: 'white', borderRadius: '8px', padding: '1rem', marginBottom: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="🔍 Search tasks..." style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', minWidth: '200px' }} />
          <select value={filterProject} onChange={e => setFilterProject(e.target.value)} style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem' }}>
            <option value="">All Projects</option>
            {projects.filter(p => p.status !== 'completed').map(p => (
              <option key={p._id} value={p._id}>{p.name}</option>
            ))}
          </select>
          <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem' }}>
            <option value="">All Assignees</option>
            <option value={user._id}>My Tasks</option>
            {users.map(u => (
              <option key={u._id} value={u._id}>{u.name}</option>
            ))}
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem' }}>
            <option value="">All Priorities</option>
            <option value="high">🔴 High</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">⚪ Low</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem' }}>
            <option value="dueDate">Sort: Due Date</option>
            <option value="priority">Sort: Priority</option>
            <option value="project">Sort: Project</option>
            <option value="created">Sort: Created</option>
          </select>
          {(filterProject || filterAssignee || filterPriority || searchQuery) && (
            <button onClick={() => { setFilterProject(''); setFilterAssignee(''); setFilterPriority(''); setSearchQuery(''); }} style={{ padding: '0.5rem 0.75rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>Clear Filters</button>
          )}
        </div>
      </div>

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>{error}</div>}

      {/* List View */}
      {viewMode === 'list' && (
        <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          {filteredTasks.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
              <p>No tasks found</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', width: '40px' }}></th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Task</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Project</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Assignee</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Priority</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Due Date</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Stage</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', width: '80px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map(task => {
                  const priorityConfig = PRIORITY_CONFIG[task.priority];
                  const overdue = task.dueDate && !task.completed && isOverdue(task.dueDate);
                  const dueToday = task.dueDate && isDueToday(task.dueDate);
                  
                  return (
                    <tr key={task._id} style={{ borderBottom: '1px solid #e5e7eb', background: task.completed ? '#f9fafb' : 'white' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <input type="checkbox" checked={task.completed} onChange={() => handleToggleComplete(task)} disabled={!canEdit} style={{ width: '18px', height: '18px', cursor: canEdit ? 'pointer' : 'default' }} />
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 500, color: task.completed ? '#9ca3af' : '#1f2937', textDecoration: task.completed ? 'line-through' : 'none' }}>{task.title}</div>
                        {task.description && <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem' }}>{task.description.substring(0, 100)}{task.description.length > 100 ? '...' : ''}</div>}
                        {task.subtasks && task.subtasks.length > 0 && (
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                            ☑️ {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} subtasks
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {task.project ? (
                          <span style={{ fontSize: '0.85rem', padding: '0.25rem 0.5rem', background: '#dbeafe', color: '#1e40af', borderRadius: '4px' }}>{task.project.name}</span>
                        ) : <span style={{ color: '#9ca3af' }}>—</span>}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {task.assignees && task.assignees.length > 0 ? (
                          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                            {task.assignees.slice(0, 2).map(a => (
                              <span key={a._id} style={{ fontSize: '0.8rem', padding: '0.15rem 0.4rem', background: '#f3f4f6', borderRadius: '4px' }}>{a.name.split(' ')[0]}</span>
                            ))}
                            {task.assignees.length > 2 && <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>+{task.assignees.length - 2}</span>}
                          </div>
                        ) : <span style={{ color: '#9ca3af' }}>Unassigned</span>}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: priorityConfig.bg, color: priorityConfig.color, borderRadius: '4px', fontWeight: 500 }}>{priorityConfig.label}</span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {task.dueDate ? (
                          <span style={{ fontSize: '0.85rem', color: overdue ? '#dc2626' : dueToday ? '#d97706' : '#374151', fontWeight: overdue || dueToday ? 600 : 400 }}>
                            {new Date(task.dueDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                            {overdue && ' ⚠️'}
                          </span>
                        ) : <span style={{ color: '#9ca3af' }}>—</span>}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <select value={task.stage} onChange={e => handleStageChange(task._id, e.target.value)} disabled={!canEdit} style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.8rem', background: DEFAULT_STAGES.find(s => s.id === task.stage)?.color || '#e5e7eb' }}>
                          {DEFAULT_STAGES.map(s => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                          {canEdit && (
                            <>
                              <button onClick={() => setEditingTask(task)} style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>✏️</button>
                              <button onClick={() => handleDeleteTask(task._id)} style={{ padding: '0.25rem 0.5rem', background: '#fef2f2', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>🗑️</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Board View */}
      {viewMode === 'board' && (
        <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem' }}>
          {DEFAULT_STAGES.map(stage => (
            <div key={stage.id} style={{ minWidth: '280px', maxWidth: '320px', flex: '1 0 280px' }}>
              <div style={{ background: stage.color, padding: '0.75rem 1rem', borderRadius: '8px 8px 0 0', fontWeight: 600, fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{stage.label}</span>
                <span style={{ background: 'rgba(0,0,0,0.1)', padding: '0.15rem 0.4rem', borderRadius: '10px', fontSize: '0.75rem' }}>{tasksByStage[stage.id]?.length || 0}</span>
              </div>
              <div style={{ background: '#f9fafb', padding: '0.5rem', borderRadius: '0 0 8px 8px', minHeight: '300px' }}>
                {tasksByStage[stage.id]?.map(task => {
                  const priorityConfig = PRIORITY_CONFIG[task.priority];
                  const overdue = task.dueDate && !task.completed && isOverdue(task.dueDate);
                  
                  return (
                    <div key={task._id} style={{ background: 'white', padding: '0.75rem', borderRadius: '6px', marginBottom: '0.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.1)', borderLeft: `3px solid ${priorityConfig.color}` }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <input type="checkbox" checked={task.completed} onChange={() => handleToggleComplete(task)} disabled={!canEdit} style={{ marginTop: '2px' }} />
                        <span style={{ fontWeight: 500, fontSize: '0.9rem', color: task.completed ? '#9ca3af' : '#1f2937', textDecoration: task.completed ? 'line-through' : 'none', flex: 1 }}>{task.title}</span>
                      </div>
                      {task.project && (
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>📁 {task.project.name}</div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          {task.assignees && task.assignees.length > 0 && (
                            <span style={{ color: '#6b7280' }}>👤 {task.assignees[0].name.split(' ')[0]}{task.assignees.length > 1 ? ` +${task.assignees.length - 1}` : ''}</span>
                          )}
                        </div>
                        {task.dueDate && (
                          <span style={{ color: overdue ? '#dc2626' : '#6b7280', fontWeight: overdue ? 600 : 400 }}>
                            📅 {new Date(task.dueDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                      {canEdit && (
                        <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #e5e7eb' }}>
                          <button onClick={() => setEditingTask(task)} style={{ flex: 1, padding: '0.25rem', background: '#f3f4f6', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}>Edit</button>
                          <button onClick={() => handleDeleteTask(task._id)} style={{ padding: '0.25rem 0.5rem', background: '#fef2f2', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}>🗑️</button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {(!tasksByStage[stage.id] || tasksByStage[stage.id].length === 0) && (
                  <div style={{ textAlign: 'center', color: '#9ca3af', padding: '2rem 0', fontSize: '0.85rem' }}>No tasks</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1))} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>← Prev</button>
            <h3 style={{ margin: 0 }}>{calendarDate.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}</h3>
            <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1))} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Next →</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: '#e5e7eb' }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} style={{ background: '#f9fafb', padding: '0.5rem', textAlign: 'center', fontWeight: 600, fontSize: '0.85rem' }}>{day}</div>
            ))}
            {getMonthDates(calendarDate.getFullYear(), calendarDate.getMonth()).map(({ date, isCurrentMonth }, i) => {
              const dateKey = formatDate(date);
              const dayTasks = tasksByDate[dateKey] || [];
              const isToday = formatDate(new Date()) === dateKey;
              
              return (
                <div key={i} style={{ background: isCurrentMonth ? 'white' : '#f9fafb', padding: '0.5rem', minHeight: '100px', opacity: isCurrentMonth ? 1 : 0.5, border: isToday ? '2px solid #3b82f6' : 'none' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: isToday ? 700 : 400, color: isToday ? '#3b82f6' : '#374151', marginBottom: '0.25rem' }}>{date.getDate()}</div>
                  {dayTasks.slice(0, 3).map(task => (
                    <div key={task._id} onClick={() => setEditingTask(task)} style={{ fontSize: '0.7rem', padding: '0.2rem 0.35rem', background: task.completed ? '#d1d5db' : PRIORITY_CONFIG[task.priority].bg, color: task.completed ? '#6b7280' : PRIORITY_CONFIG[task.priority].color, borderRadius: '3px', marginBottom: '0.15rem', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: task.completed ? 'line-through' : 'none' }}>
                      {task.title}
                    </div>
                  ))}
                  {dayTasks.length > 3 && (
                    <div style={{ fontSize: '0.65rem', color: '#6b7280' }}>+{dayTasks.length - 3} more</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add/Edit Task Modal */}
      {(showAddModal || editingTask) && (
        <TaskModal 
          task={editingTask}
          projects={projects}
          users={users}
          onClose={() => { setShowAddModal(false); setEditingTask(null); }}
          onSaved={() => { setShowAddModal(false); setEditingTask(null); loadData(); }}
        />
      )}
    </div>
  );
};

// Task Modal Component
interface TaskModalProps {
  task: Task | null;
  projects: Project[];
  users: { _id: string; name: string; email: string }[];
  onClose: () => void;
  onSaved: () => void;
}

const TaskModal: React.FC<TaskModalProps> = ({ task, projects, users, onClose, onSaved }) => {
  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    project: task?.project?._id || '',
    assignees: task?.assignees?.map(a => a._id) || [],
    stage: task?.stage || 'planning',
    priority: task?.priority || 'medium',
    dueDate: task?.dueDate ? task.dueDate.split('T')[0] : '',
  });
  const [subtasks, setSubtasks] = useState<{ title: string; completed: boolean }[]>(
    task?.subtasks?.map(s => ({ title: s.title, completed: s.completed })) || []
  );
  const [newSubtask, setNewSubtask] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.project) {
      alert('Title and Project are required');
      return;
    }
    
    try {
      setSaving(true);
      const data = {
        ...formData,
        subtasks,
        dueDate: formData.dueDate || null,
      };
      
      if (task) {
        await tasksAPI.update(task._id, data);
      } else {
        await tasksAPI.create(data);
      }
      onSaved();
    } catch (err: any) {
      alert(err.message || 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    setSubtasks([...subtasks, { title: newSubtask.trim(), completed: false }]);
    setNewSubtask('');
  };

  const toggleAssignee = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      assignees: prev.assignees.includes(userId)
        ? prev.assignees.filter(id => id !== userId)
        : [...prev.assignees, userId]
    }));
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '12px', width: '90%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '1.25rem', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(135deg, #10b981, #059669)', borderRadius: '12px 12px 0 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, color: 'white' }}>{task ? '✏️ Edit Task' : '➕ New Task'}</h3>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '0.4rem 0.6rem', borderRadius: '6px', cursor: 'pointer' }}>✕</button>
          </div>
        </div>

        <div style={{ padding: '1.25rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500, fontSize: '0.9rem' }}>Title *</label>
            <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="Task title" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }} />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500, fontSize: '0.9rem' }}>Project *</label>
            <select value={formData.project} onChange={e => setFormData({ ...formData, project: e.target.value })} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}>
              <option value="">Select project</option>
              {projects.filter(p => p.status !== 'completed').map(p => (
                <option key={p._id} value={p._id}>{p.name} {p.clientName ? `(${p.clientName})` : ''}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500, fontSize: '0.9rem' }}>Description</label>
            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Task description" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', minHeight: '80px', resize: 'vertical' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500, fontSize: '0.9rem' }}>Stage</label>
              <select value={formData.stage} onChange={e => setFormData({ ...formData, stage: e.target.value })} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}>
                {DEFAULT_STAGES.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500, fontSize: '0.9rem' }}>Priority</label>
              <select value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value as any })} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500, fontSize: '0.9rem' }}>Due Date</label>
              <input type="date" value={formData.dueDate} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }} />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500, fontSize: '0.9rem' }}>Assignees</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', maxHeight: '120px', overflow: 'auto' }}>
              {users.map(u => (
                <button key={u._id} onClick={() => toggleAssignee(u._id)} style={{ padding: '0.25rem 0.5rem', background: formData.assignees.includes(u._id) ? '#dbeafe' : '#f3f4f6', border: formData.assignees.includes(u._id) ? '1px solid #3b82f6' : '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>
                  {formData.assignees.includes(u._id) ? '✓ ' : ''}{u.name}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500, fontSize: '0.9rem' }}>Subtasks</label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input type="text" value={newSubtask} onChange={e => setNewSubtask(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSubtask()} placeholder="Add subtask" style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }} />
              <button onClick={addSubtask} style={{ padding: '0.5rem 1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Add</button>
            </div>
            {subtasks.map((st, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0', borderBottom: '1px solid #f3f4f6' }}>
                <input type="checkbox" checked={st.completed} onChange={() => setSubtasks(subtasks.map((s, j) => j === i ? { ...s, completed: !s.completed } : s))} />
                <span style={{ flex: 1, textDecoration: st.completed ? 'line-through' : 'none', color: st.completed ? '#9ca3af' : '#1f2937' }}>{st.title}</span>
                <button onClick={() => setSubtasks(subtasks.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}>✕</button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '0.5rem 1.5rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving...' : task ? 'Update Task' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Tasks;
