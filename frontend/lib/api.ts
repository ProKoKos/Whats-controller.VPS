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
    // Проверяем наличие токена (приоритет: superadmin > cabinet > user)
    const superadminToken = typeof window !== 'undefined' 
      ? localStorage.getItem('superadmin_access_token') 
      : null;
    const cabinetToken = typeof window !== 'undefined' 
      ? localStorage.getItem('cabinet_access_token') 
      : null;
    const userToken = typeof window !== 'undefined' 
      ? localStorage.getItem('accessToken') 
      : null;
    const token = superadminToken || cabinetToken || userToken;

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
      // Пытаемся извлечь детальное сообщение об ошибке
      let errorMessage = 'Request failed';
      if (data) {
        if (typeof data.error === 'string') {
          errorMessage = data.error;
        } else if (typeof data.error === 'object' && data.error?.message) {
          errorMessage = data.error.message;
        } else if (data.message) {
          errorMessage = data.message;
        } else if (data.error) {
          errorMessage = String(data.error);
        }
      }
      
      const error: ApiError = {
        message: errorMessage,
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

  // Legacy method - deprecated, use initiateActivation instead
  // @deprecated Use initiateActivation for new activation flow
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

  // ============================================
  // Cabinet endpoints
  // ============================================

  /**
   * Запрос доступа к кабинету
   * Генерирует access_request_code для подтверждения на контроллере
   * @param cabinetId ID кабинета
   * @returns access_request_code для ввода на контроллере
   */
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

  /**
   * Авторизация устройства для доступа к кабинету
   * @param sessionToken Токен сессии, полученный после подтверждения на контроллере
   * @param deviceFingerprint Fingerprint устройства
   * @param publicKey Публичный ключ Ed25519 устройства
   * @param userAgent User-Agent браузера
   * @param screenResolution Разрешение экрана
   * @param timezone Часовой пояс
   * @returns device_id и cabinet_id
   */
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

  /**
   * Вход в кабинет с использованием cabinet_secret и Ed25519 подписи
   * @param cabinetSecret Секрет кабинета
   * @param signature Ed25519 подпись сообщения
   * @param message Сообщение для подписи
   * @param deviceFingerprint Fingerprint устройства
   * @returns JWT access token для доступа к API кабинета
   */
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

  // ============================================
  // Cabinet-specific endpoints
  // ============================================

  /**
   * Получение списка контроллеров кабинета
   * Использует cabinet_access_token для авторизации
   * @param cabinetId ID кабинета (используется для фильтрации, если API поддерживает)
   * @returns Список контроллеров кабинета
   */
  async getCabinetControllers(cabinetId: string) {
    // API автоматически фильтрует по cabinet_id на основе токена
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

  async getAuthorizedDevices(cabinetId: string) {
    // TODO: Добавить эндпоинт GET /api/cabinets/:id/devices для получения авторизованных устройств
    // Пока возвращаем пустой массив, так как эндпоинт еще не реализован
    return Promise.resolve({
      devices: []
    });
  }

  // Cabinet info endpoint (if needed)
  async getCabinetInfo(cabinetId: string) {
    // TODO: Добавить эндпоинт GET /api/cabinets/:id для получения информации о кабинете
    // Пока не реализовано
    throw new Error('Cabinet info endpoint not implemented yet');
  }

  // ============================================
  // Superadmin endpoints
  // ============================================

  /**
   * Вход суперадмина
   * @param username Имя пользователя суперадмина
   * @param password Пароль суперадмина
   * @returns JWT токен для доступа к API суперадмина
   */
  async superadminLogin(username: string, password: string) {
    return this.request<{
      accessToken: string;
      superadmin: {
        id: string;
        username: string;
      };
      expires_in: string;
    }>('/superadmin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  /**
   * Получение профиля суперадмина
   * @returns Информация о суперадмине
   */
  async getSuperadminProfile() {
    return this.request<{
      id: string;
      username: string;
      isActive: boolean;
      lastLoginAt?: string;
      createdAt: string;
      updatedAt: string;
    }>('/superadmin/profile', {
      method: 'GET',
    });
  }

  /**
   * Смена логина/пароля суперадмина
   * @param username Новое имя пользователя (опционально)
   * @param password Новый пароль (опционально)
   * @param currentPassword Текущий пароль (обязательно)
   */
  async changeSuperadminCredentials(
    currentPassword: string,
    username?: string,
    password?: string
  ) {
    return this.request<{
      message: string;
    }>('/superadmin/change-credentials', {
      method: 'PUT',
      body: JSON.stringify({
        username,
        password,
        currentPassword,
      }),
    });
  }

  /**
   * Получение списка всех кабинетов
   * @returns Список кабинетов с количеством контроллеров
   */
  async getSuperadminCabinets() {
    return this.request<{
      cabinets: Array<{
        id: string;
        createdAt: string;
        lastActivity?: string;
        controllerCount: number;
      }>;
    }>('/superadmin/cabinets', {
      method: 'GET',
    });
  }

  /**
   * Получение деталей кабинета
   * @param cabinetId ID кабинета
   * @returns Детальная информация о кабинете и его контроллерах
   */
  async getSuperadminCabinet(cabinetId: string) {
    return this.request<{
      id: string;
      createdAt: string;
      lastActivity?: string;
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
    }>(`/superadmin/cabinets/${cabinetId}`, {
      method: 'GET',
    });
  }

  /**
   * Удаление кабинета
   * @param cabinetId ID кабинета
   */
  async deleteSuperadminCabinet(cabinetId: string) {
    return this.request<{
      message: string;
      cabinetId: string;
      deletedControllers: number;
    }>(`/superadmin/cabinets/${cabinetId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Получение списка всех контроллеров
   * @returns Список всех контроллеров в системе
   */
  async getSuperadminControllers() {
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
        cabinetId?: string;
      }>;
    }>('/superadmin/controllers', {
      method: 'GET',
    });
  }

  /**
   * Получение деталей контроллера
   * @param controllerId ID контроллера
   * @returns Детальная информация о контроллере
   */
  async getSuperadminController(controllerId: string) {
    return this.request<{
      id: string;
      macAddress: string;
      firmwareVersion?: string;
      name: string;
      isActive: boolean;
      lastSeenAt?: string;
      createdAt: string;
      updatedAt: string;
      cabinetId?: string;
    }>(`/superadmin/controllers/${controllerId}`, {
      method: 'GET',
    });
  }

  /**
   * Сброс контроллера (отвязка от кабинета)
   * @param controllerId ID контроллера
   */
  /**
   * Удаление контроллера суперадмином
   * @param controllerId ID контроллера
   */
  async deleteSuperadminController(controllerId: string) {
    return this.request<{
      message: string;
      controller_id: string;
    }>(`/superadmin/controllers/${controllerId}`, {
      method: 'DELETE',
    });
  }

  async resetSuperadminController(controllerId: string) {
    return this.request<{
      message: string;
      controllerId: string;
    }>(`/superadmin/controllers/${controllerId}/reset`, {
      method: 'POST',
    });
  }

  // Logout
  logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('cabinet_access_token');
      localStorage.removeItem('cabinet_id');
      localStorage.removeItem('superadmin_access_token');
      localStorage.removeItem('superadmin_id');
      localStorage.removeItem('superadmin_username');
    }
  }

  /**
   * Проверка PIN кода для доступа к контроллеру
   * @param controllerId ID контроллера
   * @param pin PIN код (8 цифр)
   * @returns Результат проверки PIN
   */
  async verifyControllerPin(controllerId: string, pin: string) {
    return this.request<{
      valid: boolean;
      expires_at?: string;
      error?: string;
    }>(`/controllers/${controllerId}/verify-pin?pin=${encodeURIComponent(pin)}`, {
      method: 'GET',
    });
  }

  /**
   * Привязка устройства к контроллеру через Ed25519
   * @param controllerId ID контроллера
   * @param deviceName Имя устройства
   * @param publicKey Публичный ключ Ed25519 (base64)
   * @param signature Подпись запроса (base64)
   * @returns ID привязанного устройства
   */
  async authorizeControllerDevice(
    controllerId: string,
    deviceName: string,
    publicKey: string,
    signature: string
  ) {
    return this.request<{
      device_id: string;
      message: string;
    }>(`/controllers/${controllerId}/authorize-device`, {
      method: 'POST',
      headers: {
        'X-Device-Signature': signature,
        'X-Device-Public-Key': publicKey,
      },
      body: JSON.stringify({
        device_name: deviceName,
        public_key: publicKey,
      }),
    });
  }

  /**
   * Получение информации о контроллере (с Ed25519 авторизацией)
   * @param controllerId ID контроллера
   * @param signature Подпись запроса (base64)
   * @param publicKey Публичный ключ (base64)
   * @returns Информация о контроллере
   */
  async getControllerWithAuth(controllerId: string, signature: string, publicKey: string) {
    return this.request<{
      controller_id: string;
      mac_address: string;
      firmware_version?: string;
      is_active: boolean;
      last_seen_at?: string;
    }>(`/controllers/${controllerId}`, {
      method: 'GET',
      headers: {
        'X-Device-Signature': signature,
        'X-Device-Public-Key': publicKey,
      },
    });
  }

  /**
   * Деактивация контроллера (удаление из базы)
   * @param controllerId ID контроллера
   * @param signature Подпись запроса (base64)
   * @param publicKey Публичный ключ (base64)
   */
  async deactivateController(controllerId: string, signature: string, publicKey: string) {
    return this.request<{
      message: string;
      controller_id: string;
    }>(`/controllers/${controllerId}/deactivate`, {
      method: 'POST',
      headers: {
        'X-Device-Signature': signature,
        'X-Device-Public-Key': publicKey,
      },
    });
  }

  /**
   * Список авторизованных устройств для контроллера
   * @param controllerId ID контроллера
   * @param signature Подпись запроса (base64)
   * @param publicKey Публичный ключ (base64)
   * @returns Список устройств
   */
  async getControllerAuthorizedDevices(controllerId: string, signature: string, publicKey: string) {
    return this.request<{
      devices: Array<{
        device_id: string;
        device_name: string;
        created_at: string;
        last_used_at?: string;
      }>;
    }>(`/controllers/${controllerId}/authorized-devices`, {
      method: 'GET',
      headers: {
        'X-Device-Signature': signature,
        'X-Device-Public-Key': publicKey,
      },
    });
  }
}

export const apiClient = new ApiClient();

