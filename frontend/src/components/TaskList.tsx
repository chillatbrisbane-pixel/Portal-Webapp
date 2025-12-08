import { useState, useEffect } from 'react'
import { tasksAPI, usersAPI, projectsAPI } from '../services/apiService'

interface Task {
  _id: string
  title: string
  description?: string
  assignee?: { _id: string; name: string; email: string }
  stage: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  dueDate?: string
  createdBy?: { _id: string; name: string }
  completedBy?: { _id: string; name: string }
  createdAt: string
  completedAt?: string
}

interface User {
  _id: string
  name: string
  email: string
}

interface Stage {
  id: string
  label: string
  color: string
  order: number
}

interface TaskListProps {
  projectId: string
}

// Default stages for new projects
const DEFAULT_STAGES: Stage[] = [
  { id: 'planning', label: '📋 Planning', color: '#e5e7eb', order: 0 },
  { id: 'rough-in', label: '🔧 Rough-in', color: '#fef3c7', order: 1 },
  { id: 'fit-off', label: '🔨 Fit-off', color: '#dbeafe', order: 2 },
  { id: 'configure', label: '⚙️ Configure', color: '#e0e7ff', order: 3 },
  { id: 'test', label: '🧪 Test', color: '#fce7f3', order: 4 },
  { id: 'commission', label: '✅ Commission', color: '#dcfce7', order: 5 },
]

const STAGE_COLORS = [
  { value: '#e5e7eb', name: 'Grey' },
  { value: '#fee2e2', name: 'Red' },
  { value: '#fef3c7', name: 'Yellow' },
  { value: '#d1fae5', name: 'Green' },
  { value: '#dbeafe', name: 'Blue' },
  { value: '#e0e7ff', name: 'Indigo' },
  { value: '#fce7f3', name: 'Pink' },
  { value: '#f3e8ff', name: 'Purple' },
]

export default function TaskList({ projectId }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [stages, setStages] = useState<Stage[]>(DEFAULT_STAGES)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'board'>('board')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showStageManager, setShowStageManager] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [expandedTask, setExpandedTask] = useState<string | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignee: '',
    stage: 'planning',
    priority: 'medium' as 'low' | 'medium' | 'high',
    dueDate: '',
  })

  // Stage manager state
  const [editingStages, setEditingStages] = useState<Stage[]>([])
  const [newStageName, setNewStageName] = useState('')

  useEffect(() => {
    loadData()
  }, [projectId])

  const loadData = async () => {
    try {
      const [tasksData, usersData, projectData] = await Promise.all([
        tasksAPI.getByProject(projectId),
        usersAPI.getAll(),
        projectsAPI.getById(projectId),
      ])
      setTasks(tasksData)
      setUsers(usersData)
      
      console.log('Project taskStages from DB:', projectData.taskStages)
      
      // Load stages from project or use defaults
      let loadedStages: Stage[]
      if (projectData.taskStages && projectData.taskStages.length > 0) {
        loadedStages = projectData.taskStages.sort((a: Stage, b: Stage) => a.order - b.order)
      } else {
        loadedStages = [...DEFAULT_STAGES]
      }
      
      // Check for orphaned tasks (tasks in stages that don't exist)
      const stageIds = new Set(loadedStages.map(s => s.id))
      const orphanedStageIds = new Set<string>()
      tasksData.forEach((task: Task) => {
        if (!stageIds.has(task.stage)) {
          orphanedStageIds.add(task.stage)
        }
      })
      
      // Add orphaned stages so tasks are visible
      if (orphanedStageIds.size > 0) {
        console.log('Found orphaned stages:', Array.from(orphanedStageIds))
        orphanedStageIds.forEach(stageId => {
          loadedStages.push({
            id: stageId,
            label: `❓ ${stageId}`,
            color: '#f3f4f6',
            order: loadedStages.length,
          })
        })
      }
      
      setStages(loadedStages)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTasks = async () => {
    try {
      const data = await tasksAPI.getByProject(projectId)
      setTasks(data)
    } catch (error) {
      console.error('Failed to load tasks:', error)
    }
  }

  const saveStages = async (newStages: Stage[]) => {
    try {
      console.log('Saving stages to project:', newStages)
      const result = await projectsAPI.update(projectId, { taskStages: newStages })
      console.log('Save result:', result)
      setStages(newStages)
    } catch (error) {
      console.error('Failed to save stages:', error)
      alert('Failed to save stages')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const taskData = { ...formData, project: projectId }
      console.log('Submitting task:', taskData)
      if (editingTask) {
        await tasksAPI.update(editingTask._id, formData)
      } else {
        await tasksAPI.create(taskData)
      }
      await loadTasks()
      resetForm()
    } catch (error: any) {
      console.error('Failed to save task:', error)
      alert(error.message || 'Failed to save task')
    }
  }

  const handleToggleComplete = async (taskId: string) => {
    try {
      await tasksAPI.toggleComplete(taskId)
      await loadTasks()
    } catch (error) {
      console.error('Failed to toggle task:', error)
    }
  }

  const handleMoveStage = async (taskId: string, newStage: string) => {
    try {
      await tasksAPI.moveStage(taskId, newStage)
      await loadTasks()
    } catch (error) {
      console.error('Failed to move task:', error)
    }
  }

  const handleDelete = async (taskId: string, title: string) => {
    if (!window.confirm(`Delete task "${title}"?`)) return
    try {
      await tasksAPI.delete(taskId)
      await loadTasks()
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }

  const startEdit = (task: Task) => {
    setEditingTask(task)
    setFormData({
      title: task.title,
      description: task.description || '',
      assignee: task.assignee?._id || '',
      stage: task.stage,
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
    })
    setShowAddForm(true)
  }

  const startAddToStage = (stageId: string) => {
    resetForm()
    setFormData(prev => ({ ...prev, stage: stageId }))
    setShowAddForm(true)
  }

  const resetForm = () => {
    setFormData({ title: '', description: '', assignee: '', stage: stages[0]?.id || 'planning', priority: 'medium', dueDate: '' })
    setEditingTask(null)
    setShowAddForm(false)
  }

  // Stage manager functions
  const openStageManager = () => {
    setEditingStages([...stages])
    setNewStageName('')
    setShowStageManager(true)
  }

  const addStage = () => {
    if (!newStageName.trim()) return
    const newId = newStageName.toLowerCase().replace(/[^a-z0-9]/g, '-')
    const newStage: Stage = {
      id: newId + '-' + Date.now(),
      label: newStageName.trim(),
      color: STAGE_COLORS[editingStages.length % STAGE_COLORS.length].value,
      order: editingStages.length,
    }
    setEditingStages([...editingStages, newStage])
    setNewStageName('')
  }

  const updateStageLabel = (index: number, label: string) => {
    const updated = [...editingStages]
    updated[index] = { ...updated[index], label }
    setEditingStages(updated)
  }

  const updateStageColor = (index: number, color: string) => {
    const updated = [...editingStages]
    updated[index] = { ...updated[index], color }
    setEditingStages(updated)
  }

  const deleteStage = (index: number) => {
    const stage = editingStages[index]
    const tasksInStage = tasks.filter(t => t.stage === stage.id).length
    if (tasksInStage > 0) {
      alert(`Cannot delete "${stage.label}" - it has ${tasksInStage} task(s). Move or delete them first.`)
      return
    }
    const updated = editingStages.filter((_, i) => i !== index)
    setEditingStages(updated.map((s, i) => ({ ...s, order: i })))
  }

  const moveStageUp = (index: number) => {
    if (index === 0) return
    const updated = [...editingStages]
    ;[updated[index - 1], updated[index]] = [updated[index], updated[index - 1]]
    setEditingStages(updated.map((s, i) => ({ ...s, order: i })))
  }

  const moveStageDown = (index: number) => {
    if (index === editingStages.length - 1) return
    const updated = [...editingStages]
    ;[updated[index], updated[index + 1]] = [updated[index + 1], updated[index]]
    setEditingStages(updated.map((s, i) => ({ ...s, order: i })))
  }

  const saveStageChanges = async () => {
    await saveStages(editingStages)
    setShowStageManager(false)
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return { bg: '#fee2e2', color: '#991b1b', label: '!' }
      case 'medium': return { bg: '#fef3c7', color: '#92400e', label: '•' }
      case 'low': return { bg: '#dcfce7', color: '#166534', label: '○' }
      default: return { bg: '#f3f4f6', color: '#374151', label: '•' }
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  }

  const isOverdue = (dueDate: string, completed: boolean) => {
    if (completed) return false
    return new Date(dueDate) < new Date()
  }

  // Stats
  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.completed).length
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading tasks...</div>
  }

  // Task card component
  const TaskCard = ({ task, compact = false }: { task: Task; compact?: boolean }) => {
    const priority = getPriorityBadge(task.priority)
    const overdue = task.dueDate && isOverdue(task.dueDate, task.completed)
    const isExpanded = expandedTask === task._id
    
    return (
      <div
        style={{
          padding: compact ? '0.5rem' : '0.75rem',
          background: task.completed ? '#f9fafb' : 'white',
          borderRadius: '6px',
          border: '1px solid #e5e7eb',
          opacity: task.completed ? 0.7 : 1,
          cursor: 'pointer',
        }}
        onClick={() => setExpandedTask(isExpanded ? null : task._id)}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={task.completed}
            onChange={(e) => {
              e.stopPropagation()
              handleToggleComplete(task._id)
            }}
            style={{ marginTop: '0.2rem', width: '16px', height: '16px', cursor: 'pointer', accentColor: '#10b981' }}
          />
          
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{
                fontWeight: 500,
                fontSize: compact ? '0.85rem' : '0.9rem',
                textDecoration: task.completed ? 'line-through' : 'none',
                color: task.completed ? '#9ca3af' : '#111827',
                wordBreak: 'break-word',
              }}>
                {task.title}
              </span>
              {task.priority === 'high' && (
                <span style={{
                  padding: '0.1rem 0.3rem',
                  background: priority.bg,
                  color: priority.color,
                  borderRadius: '3px',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                }}>
                  HIGH
                </span>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', fontSize: '0.75rem', color: '#6b7280', flexWrap: 'wrap' }}>
              {task.assignee && <span>👤 {task.assignee.name.split(' ')[0]}</span>}
              {task.dueDate && (
                <span style={{ color: overdue ? '#dc2626' : '#6b7280' }}>
                  📅 {formatDate(task.dueDate)}{overdue && ' ⚠️'}
                </span>
              )}
            </div>

            {isExpanded && (
              <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
                {task.description && (
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: '#4b5563' }}>{task.description}</p>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <select
                    value={task.stage}
                    onChange={(e) => { e.stopPropagation(); handleMoveStage(task._id, e.target.value) }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                  >
                    {stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                  <button onClick={(e) => { e.stopPropagation(); startEdit(task) }} style={{ padding: '0.25rem 0.5rem', background: '#dbeafe', color: '#1e40af', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>✏️ Edit</button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(task._id, task.title) }} style={{ padding: '0.25rem 0.5rem', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>🗑️</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h3 style={{ margin: 0 }}>📋 Tasks</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#6b7280' }}>
            <div style={{ width: '100px', height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${progressPercent}%`, height: '100%', background: '#10b981', transition: 'width 0.3s' }} />
            </div>
            <span>{completedTasks}/{totalTasks} done</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={openStageManager} style={{ padding: '0.4rem 0.75rem', background: '#f3f4f6', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }} title="Manage Stages">⚙️ Stages</button>
          <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '6px', padding: '2px' }}>
            <button onClick={() => setView('board')} style={{ padding: '0.4rem 0.75rem', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', background: view === 'board' ? 'white' : 'transparent', color: view === 'board' ? '#111827' : '#6b7280', boxShadow: view === 'board' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }}>▦ Board</button>
            <button onClick={() => setView('list')} style={{ padding: '0.4rem 0.75rem', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', background: view === 'list' ? 'white' : 'transparent', color: view === 'list' ? '#111827' : '#6b7280', boxShadow: view === 'list' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }}>☰ List</button>
          </div>
          <button onClick={() => startAddToStage(stages[0]?.id || 'planning')} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500, fontSize: '0.85rem' }}>➕ Add Task</button>
        </div>
      </div>

      {/* Stage Manager Modal */}
      {showStageManager && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowStageManager(false)}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', width: '100%', maxWidth: '500px', margin: '1rem', maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem' }}>⚙️ Manage Stages</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {editingStages.map((stage, idx) => (
                <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: stage.color, borderRadius: '6px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <button onClick={() => moveStageUp(idx)} disabled={idx === 0} style={{ padding: '0', width: '20px', height: '14px', border: 'none', background: 'rgba(255,255,255,0.7)', borderRadius: '2px', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 1, fontSize: '0.6rem' }}>▲</button>
                    <button onClick={() => moveStageDown(idx)} disabled={idx === editingStages.length - 1} style={{ padding: '0', width: '20px', height: '14px', border: 'none', background: 'rgba(255,255,255,0.7)', borderRadius: '2px', cursor: idx === editingStages.length - 1 ? 'default' : 'pointer', opacity: idx === editingStages.length - 1 ? 0.3 : 1, fontSize: '0.6rem' }}>▼</button>
                  </div>
                  <input type="text" value={stage.label} onChange={(e) => updateStageLabel(idx, e.target.value)} style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
                  <select value={stage.color} onChange={(e) => updateStageColor(idx, e.target.value)} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', background: stage.color, minWidth: '100px' }}>
                    {STAGE_COLORS.map(c => <option key={c.value} value={c.value} style={{ background: c.value }}>⬤ {c.name}</option>)}
                  </select>
                  <button onClick={() => deleteStage(idx)} style={{ padding: '0.5rem', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>🗑️</button>
                </div>
              ))}
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input type="text" placeholder="New stage name..." value={newStageName} onChange={(e) => setNewStageName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addStage()} style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
              <button onClick={addStage} style={{ padding: '0.5rem 1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>➕ Add</button>
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowStageManager(false)} style={{ padding: '0.75rem 1.5rem', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveStageChanges} style={{ padding: '0.75rem 1.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}>💾 Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Task Modal */}
      {showAddForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => resetForm()}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', width: '100%', maxWidth: '500px', margin: '1rem' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem' }}>{editingTask ? '✏️ Edit Task' : '➕ New Task'}</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <input type="text" placeholder="Task title *" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required autoFocus style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '1rem' }} />
                <textarea placeholder="Description (optional)" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid #d1d5db', resize: 'vertical' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <select value={formData.stage} onChange={(e) => setFormData({ ...formData, stage: e.target.value })} style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                    {stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                  <select value={formData.assignee} onChange={(e) => setFormData({ ...formData, assignee: e.target.value })} style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                    <option value="">Unassigned</option>
                    {users.map((user) => <option key={user._id} value={user._id}>{user.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })} style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                    <option value="low">🟢 Low Priority</option>
                    <option value="medium">🟡 Medium Priority</option>
                    <option value="high">🔴 High Priority</option>
                  </select>
                  <input type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={resetForm} style={{ padding: '0.75rem 1.5rem', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '0.75rem 1.5rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}>{editingTask ? '💾 Save Changes' : '➕ Add Task'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Board View */}
      {view === 'board' && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stages.length}, minmax(200px, 1fr))`, gap: '0.75rem', overflowX: 'auto', paddingBottom: '1rem' }}>
          {stages.map((stage) => {
            const stageTasks = tasks.filter(t => t.stage === stage.id)
            const stageCompleted = stageTasks.filter(t => t.completed).length
            return (
              <div key={stage.id} style={{ background: stage.color, borderRadius: '8px', padding: '0.75rem', minHeight: '200px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '2px solid rgba(0,0,0,0.1)' }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{stage.label}</span>
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>{stageCompleted}/{stageTasks.length}</span>
                  </div>
                  <button onClick={() => startAddToStage(stage.id)} style={{ width: '24px', height: '24px', background: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }} title={`Add task to ${stage.label}`}>+</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {stageTasks.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.8rem', fontStyle: 'italic' }}>No tasks</div>
                  ) : (
                    stageTasks.map((task) => <TaskCard key={task._id} task={task} compact />)
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {stages.map((stage) => {
            const stageTasks = tasks.filter(t => t.stage === stage.id)
            if (stageTasks.length === 0) return null
            const stageCompleted = stageTasks.filter(t => t.completed).length
            return (
              <div key={stage.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '2px solid', borderColor: stage.color, marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.95rem', padding: '0.25rem 0.75rem', background: stage.color, borderRadius: '4px' }}>{stage.label}</span>
                  <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{stageCompleted}/{stageTasks.length} complete</span>
                  <button onClick={() => startAddToStage(stage.id)} style={{ marginLeft: 'auto', padding: '0.25rem 0.5rem', background: stage.color, border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>+ Add</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {stageTasks.map((task) => <TaskCard key={task._id} task={task} />)}
                </div>
              </div>
            )
          })}
          {tasks.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
              <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No tasks yet</p>
              <p style={{ fontSize: '0.9rem' }}>Click "Add Task" to get started</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
