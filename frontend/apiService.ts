// API Service - Connects to backend at http://localhost:5000

const API_BASE_URL = 'http://192.168.2.199:5000/api';

// Store token in localStorage
const getToken = () => localStorage.getItem('token');
const setToken = (token: string) => localStorage.setItem('token', token);
const removeToken = () => localStorage.removeItem('token');

// Headers with auth token
const getHeaders = () => ({
  'Content-Type': 'application/json',
  ...(getToken() && { 'Authorization': `Bearer ${getToken()}` }),
});

// ============ AUTHENTICATION ============

export const authAPI = {
  login: async (username: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }
    const data = await response.json();
    setToken(data.token);
    return data;
  },

  logout: () => {
    removeToken();
  },

  getCurrentUser: async () => {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: getHeaders(),
    });
    if (!response.ok) {
      removeToken();
      throw new Error('Failed to get user');
    }
    return response.json();
  },
};

// ============ PROJECTS ============

export const projectsAPI = {
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/projects`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch projects');
    return response.json();
  },

  getById: async (projectId: string) => {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch project');
    return response.json();
  },

  create: async (projectData: any) => {
    const response = await fetch(`${API_BASE_URL}/projects`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(projectData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create project');
    }
    return response.json();
  },

  update: async (projectId: string, projectData: any) => {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(projectData),
    });
    if (!response.ok) throw new Error('Failed to update project');
    return response.json();
  },

  delete: async (projectId: string) => {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete project');
    return response.json();
  },

  addTeamMember: async (projectId: string, userId: string, role: string) => {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/team`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ userId, role }),
    });
    if (!response.ok) throw new Error('Failed to add team member');
    return response.json();
  },

  removeTeamMember: async (projectId: string, userId: string) => {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/team/${userId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to remove team member');
    return response.json();
  },
};

// ============ DEVICES ============

export const devicesAPI = {
  getByProject: async (projectId: string) => {
    const response = await fetch(`${API_BASE_URL}/devices/project/${projectId}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch devices');
    return response.json();
  },

  getById: async (deviceId: string) => {
    const response = await fetch(`${API_BASE_URL}/devices/${deviceId}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch device');
    return response.json();
  },

  create: async (deviceData: any) => {
    const response = await fetch(`${API_BASE_URL}/devices`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(deviceData),
    });
    if (!response.ok) throw new Error('Failed to create device');
    return response.json();
  },

  update: async (deviceId: string, deviceData: any) => {
    const response = await fetch(`${API_BASE_URL}/devices/${deviceId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(deviceData),
    });
    if (!response.ok) throw new Error('Failed to update device');
    return response.json();
  },

  delete: async (deviceId: string) => {
    const response = await fetch(`${API_BASE_URL}/devices/${deviceId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete device');
    return response.json();
  },
};

// ============ USERS ============

export const usersAPI = {
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/users`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch users');
    return response.json();
  },

  getById: async (userId: string) => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch user');
    return response.json();
  },

  update: async (userId: string, userData: any) => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(userData),
    });
    if (!response.ok) throw new Error('Failed to update user');
    return response.json();
  },

  delete: async (userId: string) => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete user');
    return response.json();
  },

  changePassword: async (userId: string, currentPassword: string, newPassword: string) => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/change-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!response.ok) throw new Error('Failed to change password');
    return response.json();
  },

  resetPassword: async (userId: string, newPassword: string) => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/reset-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ newPassword }),
    });
    if (!response.ok) throw new Error('Failed to reset password');
    return response.json();
  },
};

// ============ MANUFACTURERS & TEMPLATES ============

export const manufacturersAPI = {
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/manufacturers`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch manufacturers');
    return response.json();
  },
};

export const deviceTemplatesAPI = {
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/device-templates`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch device templates');
    return response.json();
  },

  getByCategory: async (category: string) => {
    const response = await fetch(`${API_BASE_URL}/device-templates?category=${category}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch templates');
    return response.json();
  },
};

// ============ HEALTH CHECK ============

export const healthCheck = async () => {
  try {
    const response = await fetch(`${API_BASE_URL.replace('/api', '')}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
};

// ============ TASKS ============

export const tasksAPI = {
  getByProject: async (projectId: string) => {
    const response = await fetch(`${API_BASE_URL}/tasks/project/${projectId}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch tasks');
    return response.json();
  },

  getById: async (id: string) => {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch task');
    return response.json();
  },

  create: async (taskData: any) => {
    const response = await fetch(`${API_BASE_URL}/tasks`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(taskData),
    });
    if (!response.ok) throw new Error('Failed to create task');
    return response.json();
  },

  update: async (id: string, taskData: any) => {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(taskData),
    });
    if (!response.ok) throw new Error('Failed to update task');
    return response.json();
  },

  updateStatus: async (id: string, status: string) => {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    });
    if (!response.ok) throw new Error('Failed to update task status');
    return response.json();
  },

  addComment: async (id: string, text: string) => {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}/comments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ text }),
    });
    if (!response.ok) throw new Error('Failed to add comment');
    return response.json();
  },

  delete: async (id: string) => {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete task');
    return response.json();
  },
};

export default {
  authAPI,
  projectsAPI,
  devicesAPI,
  usersAPI,
  manufacturersAPI,
  deviceTemplatesAPI,
  tasksAPI,
  healthCheck,
  getToken,
  setToken,
  removeToken,
};
