// API Service - Connects to backend
import { Device, Project, User, ActivityLog } from '../types';

const API_BASE_URL = '/api';

// Store token in localStorage
const getToken = () => localStorage.getItem('token');
const setToken = (token: string) => localStorage.setItem('token', token);
const removeToken = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('loginTime');
};

// Fetch with timeout (default 15 seconds)
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 15000): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Request timeout - server not responding');
    }
    throw err;
  }
};

// Headers with auth token
const getHeaders = () => ({
  'Content-Type': 'application/json',
  ...(getToken() && { 'Authorization': `Bearer ${getToken()}` }),
});

// Handle expired/invalid token - force logout
const handleAuthError = (response: Response) => {
  if (response.status === 401 || response.status === 403) {
    removeToken();
    // Reload the page to show login screen
    window.location.reload();
  }
};

// ============ AUTHENTICATION ============

export const authAPI = {
  login: async (email: string, password: string, twoFactorCode?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, twoFactorCode }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }
    const data = await response.json();
    if (data.token) {
      setToken(data.token);
      localStorage.setItem('loginTime', Date.now().toString());
    }
    return data;
  },

  logout: () => {
    removeToken();
  },

  getCurrentUser: async () => {
    const token = getToken();
    if (!token) {
      throw new Error('No token');
    }
    const response = await fetchWithTimeout(`${API_BASE_URL}/auth/me`, {
      headers: getHeaders(),
    }, 10000); // 10 second timeout for auth check
    if (!response.ok) {
      handleAuthError(response);
      throw new Error('Failed to get user');
    }
    return response.json();
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to change password');
    }
    return response.json();
  },

  forceChangePassword: async (newPassword: string, newEmail: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/force-change-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ newPassword, newEmail }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update account');
    }
    const data = await response.json();
    if (data.token) {
      setToken(data.token);
    }
    return data;
  },

  // 2FA methods
  setup2FA: async () => {
    const response = await fetch(`${API_BASE_URL}/auth/2fa/setup`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to setup 2FA');
    }
    return response.json();
  },

  verify2FA: async (code: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/2fa/verify`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ code }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to verify 2FA');
    }
    return response.json();
  },

  disable2FA: async (password: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/2fa/disable`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ password }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to disable 2FA');
    }
    return response.json();
  },

  get2FAStatus: async () => {
    const response = await fetch(`${API_BASE_URL}/auth/2fa/status`, {
      headers: getHeaders(),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get 2FA status');
    }
    return response.json();
  },

  // Invite system
  verifyInvite: async (token: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/invite/${token}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Invalid invite link');
    }
    return response.json();
  },

  acceptInvite: async (token: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/accept-invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to accept invite');
    }
    const data = await response.json();
    if (data.token) {
      setToken(data.token);
    }
    return data;
  },

  // Password reset
  forgotPassword: async (email: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to process request');
    }
    return response.json();
  },

  verifyResetToken: async (token: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/auth/reset-password/${token}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Invalid or expired token');
    }
    return response.json();
  },

  resetPassword: async (token: string, password: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/auth/reset-password/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to reset password');
    }
    return response.json();
  },
};

// ============ CALENDAR ============

export const calendarAPI = {
  getToken: async () => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/calendar/token`, {
      headers: getHeaders(),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get calendar token');
    }
    return response.json();
  },

  regenerateToken: async () => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/calendar/regenerate`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to regenerate token');
    }
    return response.json();
  },
};

// ============ PROJECTS ============

export const projectsAPI = {
  getAll: async (): Promise<Project[]> => {
    const response = await fetch(`${API_BASE_URL}/projects`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch projects');
    return response.json();
  },

  getById: async (projectId: string): Promise<Project> => {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch project');
    return response.json();
  },

  create: async (projectData: Partial<Project>): Promise<Project> => {
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

  update: async (projectId: string, projectData: Partial<Project>): Promise<Project> => {
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

  clone: async (projectId: string, name: string, cloneDevices: boolean = true): Promise<Project> => {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/clone`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, cloneDevices }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to clone project');
    }
    return response.json();
  },

  getVersions: async (projectId: string) => {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/versions`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch versions');
    return response.json();
  },

  rollback: async (projectId: string, versionId: string) => {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/rollback/${versionId}`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to rollback');
    }
    return response.json();
  },

  // Note entries
  getNotes: async (projectId: string) => {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/notes`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch notes');
    return response.json();
  },

  addNote: async (projectId: string, text: string) => {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/notes`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add note');
    }
    return response.json();
  },

  deleteNote: async (projectId: string, noteId: string) => {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/notes/${noteId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete note');
    }
    return response.json();
  },
};

// ============ DEVICES ============

export const devicesAPI = {
  getByProject: async (projectId: string): Promise<Device[]> => {
    const response = await fetch(`${API_BASE_URL}/devices/project/${projectId}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch devices');
    return response.json();
  },

  getByCategory: async (projectId: string, category: string): Promise<Device[]> => {
    const response = await fetch(`${API_BASE_URL}/devices/project/${projectId}/category/${category}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch devices');
    return response.json();
  },

  getById: async (deviceId: string): Promise<Device> => {
    const response = await fetch(`${API_BASE_URL}/devices/${deviceId}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch device');
    return response.json();
  },

  create: async (deviceData: Partial<Device> & { autoAssignIP?: boolean }): Promise<Device> => {
    const response = await fetch(`${API_BASE_URL}/devices`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(deviceData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create device');
    }
    return response.json();
  },

  update: async (deviceId: string, deviceData: Partial<Device>): Promise<Device> => {
    const response = await fetch(`${API_BASE_URL}/devices/${deviceId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(deviceData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update device');
    }
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

  bulkCreate: async (projectId: string, devices: Partial<Device>[]) => {
    const response = await fetch(`${API_BASE_URL}/devices/bulk`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ projectId, devices }),
    });
    if (!response.ok) throw new Error('Failed to bulk create devices');
    return response.json();
  },

  // Utility endpoints
  generatePassword: async (): Promise<{ password: string }> => {
    const response = await fetch(`${API_BASE_URL}/devices/generate-password`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to generate password');
    return response.json();
  },

  getNextIP: async (projectId: string, deviceType: string, category?: string): Promise<{ ip: string; vlan: number; warning?: string }> => {
    const params = category ? `?category=${category}` : '';
    const response = await fetch(`${API_BASE_URL}/devices/next-ip/${projectId}/${deviceType}${params}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to get next IP');
    return response.json();
  },

  checkIPConflict: async (projectId: string, ipAddress: string, excludeDeviceId?: string): Promise<{ hasConflict: boolean; conflictingDevice?: { id: string; name: string; category: string } }> => {
    const response = await fetch(`${API_BASE_URL}/devices/check-ip-conflict`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ projectId, ipAddress, excludeDeviceId }),
    });
    if (!response.ok) throw new Error('Failed to check IP conflict');
    return response.json();
  },

  getIPConfig: async () => {
    const response = await fetch(`${API_BASE_URL}/devices/ip-config`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to get IP config');
    return response.json();
  },

  getAvailableSwitchPorts: async (projectId: string) => {
    const response = await fetch(`${API_BASE_URL}/devices/available-switch-ports/${projectId}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to get switch ports');
    return response.json();
  },
};

// ============ REPORTS ============

export const reportsAPI = {
  downloadPDF: (projectId: string) => {
    const token = getToken();
    window.open(`${API_BASE_URL}/reports/project/${projectId}?token=${token}`, '_blank');
  },

  downloadJSON: (projectId: string) => {
    const token = getToken();
    window.open(`${API_BASE_URL}/reports/project/${projectId}/json?token=${token}`, '_blank');
  },

  downloadCSV: (projectId: string) => {
    const token = getToken();
    window.open(`${API_BASE_URL}/reports/project/${projectId}/csv?token=${token}`, '_blank');
  },

  importJSON: async (backupData: any): Promise<{ success: boolean; message: string; projectId: string; projectName: string }> => {
    const response = await fetch(`${API_BASE_URL}/reports/import`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(backupData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to import project');
    }
    return response.json();
  },
};

// ============ USERS ============

export const usersAPI = {
  getAll: async (): Promise<User[]> => {
    const response = await fetch(`${API_BASE_URL}/users`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch users');
    return response.json();
  },

  getById: async (userId: string): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch user');
    return response.json();
  },

  invite: async (userData: { email: string; name: string; role?: string }) => {
    const response = await fetch(`${API_BASE_URL}/auth/invite`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(userData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to invite user');
    }
    return response.json();
  },

  resendInvite: async (userId: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/resend-invite/${userId}`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to resend invite');
    }
    return response.json();
  },

  update: async (userId: string, userData: Partial<User>): Promise<User> => {
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

  suspend: async (userId: string, reason?: string) => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/suspend`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to suspend user');
    }
    return response.json();
  },

  unsuspend: async (userId: string) => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/unsuspend`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to unsuspend user');
    }
    return response.json();
  },

  changePassword: async (userId: string, currentPassword: string, newPassword: string) => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/change-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to change password');
    }
    return response.json();
  },

  resetPassword: async (userId: string, newPassword: string) => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/reset-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ newPassword }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to reset password');
    }
    return response.json();
  },

  getLoginHistory: async (userId: string): Promise<ActivityLog[]> => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/login-history`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch login history');
    return response.json();
  },

  getActivityLogs: async (params?: { userId?: string; action?: string; limit?: number; page?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.userId) queryParams.append('userId', params.userId);
    if (params?.action) queryParams.append('action', params.action);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.page) queryParams.append('page', params.page.toString());

    const response = await fetch(`${API_BASE_URL}/users/activity-logs?${queryParams}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch activity logs');
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

  getMyTasks: async () => {
    const response = await fetch(`${API_BASE_URL}/tasks/my-tasks`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch my tasks');
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
    console.log('Creating task with data:', taskData);
    const response = await fetch(`${API_BASE_URL}/tasks`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(taskData),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      console.error('Task creation failed:', response.status, errorData);
      throw new Error(errorData.message || `Failed to create task (${response.status})`);
    }
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

  toggleComplete: async (id: string) => {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}/toggle`, {
      method: 'PATCH',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to toggle task');
    return response.json();
  },

  moveStage: async (id: string, stage: string) => {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}/stage`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ stage }),
    });
    if (!response.ok) throw new Error('Failed to move task');
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

// Settings API
export const settingsAPI = {
  // Get branding settings
  getBranding: async () => {
    const response = await fetch(`${API_BASE_URL}/settings/branding`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!response.ok) throw new Error('Failed to fetch branding settings');
    return response.json();
  },

  // Get logo image data
  getLogo: async () => {
    const response = await fetch(`${API_BASE_URL}/settings/branding/logo`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!response.ok) throw new Error('Failed to fetch logo');
    return response.json();
  },

  // Get background image data
  getBackground: async () => {
    const response = await fetch(`${API_BASE_URL}/settings/branding/background`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!response.ok) throw new Error('Failed to fetch background');
    return response.json();
  },

  // Update branding settings
  updateBranding: async (data: {
    logo?: { data: string; mimeType: string; filename: string } | null;
    background?: { data: string; mimeType: string; filename: string; opacity?: number } | null;
    companyName?: string;
    companyWebsite?: string;
  }) => {
    const response = await fetch(`${API_BASE_URL}/settings/branding`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update branding');
    }
    return response.json();
  },

  // Delete logo
  deleteLogo: async () => {
    const response = await fetch(`${API_BASE_URL}/settings/branding/logo`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!response.ok) throw new Error('Failed to delete logo');
    return response.json();
  },

  // Delete background
  deleteBackground: async () => {
    const response = await fetch(`${API_BASE_URL}/settings/branding/background`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!response.ok) throw new Error('Failed to delete background');
    return response.json();
  },
};

// Client Access API
export const clientAccessAPI = {
  // Get client access status for a project
  getStatus: async (projectId: string) => {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/client-access`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!response.ok) throw new Error('Failed to fetch client access status');
    return response.json();
  },

  // Update client access (enable/disable, set PIN)
  update: async (projectId: string, data: { enabled: boolean; pin?: string }) => {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/client-access`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update client access');
    return response.json();
  },

  // Regenerate access token
  regenerateToken: async (projectId: string) => {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/client-access/regenerate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!response.ok) throw new Error('Failed to regenerate token');
    return response.json();
  },

  // Public: Get project data via client token (no auth required)
  getProjectByToken: async (token: string, pin?: string) => {
    const url = pin 
      ? `${API_BASE_URL}/client/${token}?pin=${pin}`
      : `${API_BASE_URL}/client/${token}`;
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json();
      throw error;
    }
    return response.json();
  },

  // Public: Verify PIN
  verifyPin: async (token: string, pin: string) => {
    const response = await fetch(`${API_BASE_URL}/client/${token}/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw error;
    }
    return response.json();
  },
};

// Active Users API
export const activeUsersAPI = {
  // Get list of currently active users (admin only)
  getActiveUsers: async () => {
    const response = await fetch(`${API_BASE_URL}/users/active/list`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!response.ok) throw new Error('Failed to fetch active users');
    return response.json();
  },
};

export default {
  authAPI,
  projectsAPI,
  devicesAPI,
  reportsAPI,
  usersAPI,
  manufacturersAPI,
  deviceTemplatesAPI,
  tasksAPI,
  settingsAPI,
  clientAccessAPI,
  activeUsersAPI,
  healthCheck,
  getToken,
  setToken,
  removeToken,
};
