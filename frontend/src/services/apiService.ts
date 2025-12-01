// API Service - Connects to backend
import { Device, Project, User, ActivityLog } from '../types';

const API_BASE_URL = '/api';

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
  login: async (email: string, password: string, twoFactorCode?: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
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
    }
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

  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
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

  create: async (userData: { email: string; password: string; name: string; role?: string }): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(userData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create user');
    }
    const data = await response.json();
    return data.user;
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

export default {
  authAPI,
  projectsAPI,
  devicesAPI,
  reportsAPI,
  usersAPI,
  manufacturersAPI,
  deviceTemplatesAPI,
  healthCheck,
  getToken,
  setToken,
  removeToken,
};
