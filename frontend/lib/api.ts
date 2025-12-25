// В браузере всегда используем относительный путь для rewrites
// Next.js rewrites будут проксировать /api/* на backend
// В SSR (server-side) можно использовать полный URL, но для клиента нужен относительный путь
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // В браузере всегда используем относительный путь
    return '/api';
  }
  // На сервере (SSR) используем полный URL если указан
  return process.env.NEXT_PUBLIC_API_URL || '/api';
};

const API_BASE_URL = getApiBaseUrl();

export interface ApiError {
  message: string;
  status?: number;
}

export class ApiClient {
  private baseURL: string;

  constructor() {
    // В dev режиме используем полный URL напрямую (CORS настроен)
    // В production используем относительный путь через Caddy
    if (typeof window !== 'undefined') {
      // В браузере: переменные NEXT_PUBLIC_* доступны через process.env
      // В Next.js они встраиваются в клиентский код на этапе сборки
      // Для dev режима используем хардкод, если переменная не доступна
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (apiUrl && apiUrl.startsWith('http')) {
        // Используем полный URL для dev режима
        this.baseURL = apiUrl;
      } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Dev режим: используем хардкод для localhost
        this.baseURL = 'http://localhost:3000/api';
      } else {
        // Production: используем относительный путь через Caddy
        this.baseURL = '/api';
      }
    } else {
      // На сервере (SSR) используем полный URL если указан
      this.baseURL = API_BASE_URL;
    }
    
    // Отладочная информация
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log('[API] Base URL:', this.baseURL);
      console.log('[API] NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);
    }
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

    const url = `${this.baseURL}${endpoint}`;
    
    // Отладочная информация (только в dev режиме)
    if (process.env.NODE_ENV === 'development') {
      console.log('[API] Request:', url, options.method || 'GET');
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Проверяем Content-Type перед парсингом JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('[API] Non-JSON response:', response.status, text.substring(0, 200));
      const error: ApiError = {
        message: `Сервер вернул не JSON ответ. Возможно, backend не запущен или URL неправильный. Статус: ${response.status}. URL: ${url}`,
        status: response.status,
      };
      throw error;
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      const error: ApiError = {
        message: 'Ошибка парсинга ответа сервера. Возможно, backend не запущен.',
        status: response.status,
      };
      throw error;
    }

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

  // Activation endpoints
  async initiateActivation(
    activationCode: string,
    macAddress: string,
    action: 'create_cabinet' | 'add_to_cabinet',
    cabinetSecret?: string
  ) {
    return this.request<{
      device_authorization_code: string;
      expires_at: string;
      cabinet_secret?: string;
      cabinet_id?: string;
      message: string;
    }>('/activation/initiate', {
      method: 'POST',
      body: JSON.stringify({
        activation_code: activationCode,
        mac_address: macAddress,
        action: action,
        cabinet_secret: cabinetSecret,
      }),
    });
  }

  // Cabinet endpoints
  async requestCabinetAccess(cabinetId: string) {
    return this.request<{
      access_request_code: string;
      expires_at: string;
      message: string;
    }>('/cabinets/request-access', {
      method: 'POST',
      body: JSON.stringify({
        cabinet_id: cabinetId,
      }),
    });
  }

  async authorizeDevice(
    sessionToken: string,
    deviceFingerprint: string,
    publicKey: string,
    userAgent?: string,
    screenResolution?: string,
    timezone?: string
  ) {
    return this.request<{
      device_id: string;
      cabinet_id: string;
      message: string;
    }>('/cabinets/authorize-device', {
      method: 'POST',
      body: JSON.stringify({
        session_token: sessionToken,
        device_fingerprint: deviceFingerprint,
        public_key: publicKey,
        user_agent: userAgent,
        screen_resolution: screenResolution,
        timezone: timezone,
      }),
    });
  }

  async accessCabinet(
    cabinetSecret: string,
    signature: string,
    message: string,
    deviceFingerprint: string
  ) {
    return this.request<{
      accessToken: string;
      cabinet_id: string;
      device_id: string;
      expires_in: string;
      message: string;
    }>('/cabinets/access', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cabinetSecret}`,
      },
      body: JSON.stringify({
        signature: signature,
        message: message,
        device_fingerprint: deviceFingerprint,
      }),
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

