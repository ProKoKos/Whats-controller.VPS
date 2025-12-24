const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export interface ApiError {
  message: string;
  status?: number;
}

export class ApiClient {
  private baseURL: string;

  constructor() {
    this.baseURL = API_BASE_URL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = typeof window !== 'undefined' 
      ? localStorage.getItem('accessToken') 
      : null;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      const error: ApiError = {
        message: data.message || 'Request failed',
        status: response.status,
      };
      throw error;
    }

    return data;
  }

  // Auth endpoints
  async register(email: string, password: string) {
    return this.request<{
      message: string;
      user: {
        id: string;
        email: string;
        createdAt: string;
      };
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async login(email: string, password: string) {
    return this.request<{
      accessToken: string;
      refreshToken: string;
      user: {
        id: string;
        email: string;
      };
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  // User profile
  async getProfile() {
    return this.request<{
      id: string;
      email: string;
      createdAt: string;
    }>('/auth/profile', {
      method: 'GET',
    });
  }

  // Controller endpoints
  async getControllers() {
    return this.request<{
      controllers: Array<{
        id: string;
        macAddress: string;
        firmwareVersion?: string;
        name: string;
        isActive: boolean;
        lastSeenAt?: string;
        createdAt: string;
        updatedAt: string;
      }>;
    }>('/controllers', {
      method: 'GET',
    });
  }

  async getController(id: string) {
    return this.request<{
      id: string;
      macAddress: string;
      firmwareVersion?: string;
      name: string;
      isActive: boolean;
      lastSeenAt?: string;
      createdAt: string;
      updatedAt: string;
    }>(`/controllers/${id}`, {
      method: 'GET',
    });
  }

  async activateController(mac: string, firmwareVersion?: string) {
    return this.request<{
      controllerId: string;
      activationToken: string;
      message: string;
    }>('/controllers/activate', {
      method: 'POST',
      body: JSON.stringify({ mac, firmwareVersion }),
    });
  }

  async updateController(id: string, name: string) {
    return this.request<{
      message: string;
    }>(`/controllers/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  }

  async deleteController(id: string) {
    return this.request<{
      message: string;
    }>(`/controllers/${id}`, {
      method: 'DELETE',
    });
  }

  // Logout
  logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  }
}

export const apiClient = new ApiClient();

