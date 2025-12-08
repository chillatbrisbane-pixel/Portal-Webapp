import { useState, useEffect } from 'react'
import { tasksAPI, usersAPI } from '../services/apiService'

interface Task {
  _id: string
  title: string
  description?: string
  assignee?: { _id: string; name: string; email: string }
  status: 'todo' | 'in-progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  dueDate?: string
  createdBy?: { _id: string; name: string }
  createdAt: string
  completedAt?: string
}

interface User {
  _id: string
  name: string
  email: string
}

interface TaskListProps {
  projectId: string
}

export default function TaskList({ projectId }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [filter, setFilter] = useState<'all' | 'todo' | 'in-progress' | 'done'>('all')
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignee: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    dueDate: '',
  })

  useEffect(() => {
    loadTasks()
    loadUsers()
  }, [projectId])

  const loadTasks = async () => {
    try {
      const data = await tasksAPI.getByProject(projectId)
      setTasks(data)
    } catch (error) {
      console.error('Failed to load tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      const data = await usersAPI.getAll()
      setUsers(data)
    } catch (error) {
      console.error('Failed to load users:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingTask) {
        await tasksAPI.update(editingTask._id, formData)
      } else {
        await tasksAPI.create({ ...formData, project: projectId })
      }
      await loadTasks()
      resetForm()
    } catch (error) {
      console.error('Failed to save task:', error)
      alert('Failed to save task')
    }
  }

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await tasksAPI.updateStatus(taskId, newStatus)
      await loadTasks()
    } catch (error) {
      console.error('Failed to update status:', error)
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
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
    })
    setShowAddForm(true)
  }

  const resetForm = () => {
    setFormData({ title: '', description: '', assignee: '', priority: 'medium', dueDate: '' })
    setEditingTask(null)
    setShowAddForm(false)
  }

  const filteredTasks = filter === 'all' ? tasks : tasks.filter(t => t.status === filter)

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return { bg: '#fee2e2', color: '#991b1b', label: '🔴 High' }
      case 'medium': return { bg: '#fef3c7', color: '#92400e', label: '🟡 Medium' }
      case 'low': return { bg: '#dcfce7', color: '#166534', label: '🟢 Low' }
      default: return { bg: '#f3f4f6', color: '#374151', label: priority }
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'todo': return { bg: '#e5e7eb', color: '#374151', label: 'To Do' }
      case 'in-progress': return { bg: '#dbeafe', color: '#1e40af', label: 'In Progress' }
      case 'done': return { bg: '#dcfce7', color: '#166534', label: 'Done' }
      default: return { bg: '#f3f4f6', color: '#374151', label: status }
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  }

  const isOverdue = (dueDate: string, status: string) => {
    if (status === 'done') return false
    return new Date(dueDate) < new Date()
  }

  // Task counts
  const todoCount = tasks.filter(t => t.status === 'todo').length
  const inProgressCount = tasks.filter(t => t.status === 'in-progress').length
  const doneCount = tasks.filter(t => t.status === 'done').length

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading tasks...</div>
  }

  return (
    <div style={{ padding: '1rem' }}>
      {/* Header with counts and add button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>📋 Tasks</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span style={{ padding: '0.25rem 0.5rem', background: '#e5e7eb', borderRadius: '4px', fontSize: '0.8rem' }}>
              {todoCount} To Do
            </span>
            <span style={{ padding: '0.25rem 0.5rem', background: '#dbeafe', borderRadius: '4px', fontSize: '0.8rem' }}>
              {inProgressCount} In Progress
            </span>
            <span style={{ padding: '0.25rem 0.5rem', background: '#dcfce7', borderRadius: '4px', fontSize: '0.8rem' }}>
              {doneCount} Done
            </span>
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setShowAddForm(true) }}
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
          ➕ Add Task
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {(['all', 'todo', 'in-progress', 'done'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '0.5rem 1rem',
              background: filter === f ? '#3b82f6' : '#f3f4f6',
              color: filter === f ? 'white' : '#374151',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            {f === 'all' ? 'All' : f === 'todo' ? 'To Do' : f === 'in-progress' ? 'In Progress' : 'Done'}
          </button>
        ))}
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div style={{
          background: '#f8fafc',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1rem',
          border: '1px solid #e2e8f0',
        }}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <input
                type="text"
                placeholder="Task title *"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
              />
              <textarea
                placeholder="Description (optional)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', resize: 'vertical' }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <select
                  value={formData.assignee}
                  onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                  style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                >
                  <option value="">Unassigned</option>
                  {users.map((user) => (
                    <option key={user._id} value={user._id}>{user.name}</option>
                  ))}
                </select>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                  style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                >
                  <option value="low">🟢 Low Priority</option>
                  <option value="medium">🟡 Medium Priority</option>
                  <option value="high">🔴 High Priority</option>
                </select>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button
                type="submit"
                style={{
                  padding: '0.5rem 1rem',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                {editingTask ? '💾 Update Task' : '➕ Add Task'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
          {filter === 'all' ? 'No tasks yet. Add your first task!' : `No ${filter.replace('-', ' ')} tasks.`}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filteredTasks.map((task) => {
            const priority = getPriorityColor(task.priority)
            const status = getStatusColor(task.status)
            const overdue = task.dueDate && isOverdue(task.dueDate, task.status)
            
            return (
              <div
                key={task._id}
                style={{
                  padding: '1rem',
                  background: task.status === 'done' ? '#f9fafb' : 'white',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  opacity: task.status === 'done' ? 0.7 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  {/* Status checkbox */}
                  <input
                    type="checkbox"
                    checked={task.status === 'done'}
                    onChange={() => handleStatusChange(task._id, task.status === 'done' ? 'todo' : 'done')}
                    style={{ marginTop: '0.25rem', width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  
                  {/* Main content */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{
                        fontWeight: 500,
                        textDecoration: task.status === 'done' ? 'line-through' : 'none',
                        color: task.status === 'done' ? '#9ca3af' : '#111827',
                      }}>
                        {task.title}
                      </span>
                      <span style={{
                        padding: '0.15rem 0.4rem',
                        background: priority.bg,
                        color: priority.color,
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 500,
                      }}>
                        {priority.label}
                      </span>
                      <span style={{
                        padding: '0.15rem 0.4rem',
                        background: status.bg,
                        color: status.color,
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 500,
                      }}>
                        {status.label}
                      </span>
                    </div>
                    
                    {task.description && (
                      <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#6b7280' }}>
                        {task.description}
                      </p>
                    )}
                    
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>
                      {task.assignee && (
                        <span>👤 {task.assignee.name}</span>
                      )}
                      {task.dueDate && (
                        <span style={{ color: overdue ? '#dc2626' : '#6b7280' }}>
                          📅 {formatDate(task.dueDate)} {overdue && '(Overdue!)'}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {task.status !== 'done' && (
                      <select
                        value={task.status}
                        onChange={(e) => handleStatusChange(task._id, e.target.value)}
                        style={{
                          padding: '0.25rem',
                          fontSize: '0.75rem',
                          borderRadius: '4px',
                          border: '1px solid #d1d5db',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="todo">To Do</option>
                        <option value="in-progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                    )}
                    <button
                      onClick={() => startEdit(task)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        background: '#dbeafe',
                        color: '#1e40af',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                      }}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(task._id, task.title)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        background: '#fee2e2',
                        color: '#991b1b',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
