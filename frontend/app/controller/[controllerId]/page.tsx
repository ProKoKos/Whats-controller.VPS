"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";
import { generateKeyPair, signMessage, getPublicKeyFromPrivate } from "@/lib/ed25519";
import { ArrowLeft, Server, Wifi, WifiOff, Shield, CheckCircle, XCircle, PowerOff } from "lucide-react";

export default function ControllerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const controllerId = params.controllerId as string;
  const pin = searchParams.get('pin');

  const [controller, setController] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [connected, setConnected] = useState(false);
  const [controllerStatus, setControllerStatus] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [controllerStatus, setControllerStatus] = useState<any>(null);

  useEffect(() => {
    if (!pin) {
      setError("PIN код не указан в URL. Используйте ссылку с PIN из интерфейса контроллера.");
      setLoading(false);
      return;
    }

    initializeAccess();
  }, [controllerId, pin]);

  const initializeAccess = async () => {
    try {
      setError("");
      setLoading(true);

      // Проверяем PIN
      console.log('[Controller] Verifying PIN for controller:', controllerId);
      let pinResult;
      try {
        pinResult = await apiClient.verifyControllerPin(controllerId, pin!);
        console.log('[Controller] PIN verification result:', pinResult);
      } catch (err: any) {
        console.error('[Controller] PIN verification error:', err);
        setError(`Ошибка проверки PIN: ${err.message || 'Неизвестная ошибка'}`);
        setLoading(false);
        return;
      }
      
      if (!pinResult.valid) {
        setError(pinResult.error || "Неверный или истекший PIN код");
        setLoading(false);
        return;
      }

      // Проверяем, есть ли уже сохраненные ключи для этого контроллера
      const storageKey = `ed25519_private_key_${controllerId}`;
      const storedPrivateKey = typeof window !== 'undefined' 
        ? localStorage.getItem(storageKey) 
        : null;

      if (storedPrivateKey) {
        // Устройство уже привязано, используем Ed25519 авторизацию
        await authorizeWithEd25519(storedPrivateKey);
      } else {
        // Первый доступ - привязываем устройство через Ed25519
        await bindDeviceWithPin();
      }
    } catch (err: any) {
      console.error('Access initialization error:', err);
      setError(err.message || "Ошибка при инициализации доступа");
      setLoading(false);
    }
  };

  const bindDeviceWithPin = async () => {
    try {
      console.log('[Controller] Binding device with PIN...');
      // Генерируем пару Ed25519 ключей
      const { privateKey, publicKey } = await generateKeyPair();
      console.log('[Controller] Generated Ed25519 keys');

      // Генерируем имя устройства
      const deviceName = `Device ${new Date().toLocaleDateString('ru-RU')} ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;

      // Формируем сообщение для подписи: метод + путь (без /api) + тело запроса
      // Важно: сортируем ключи для консистентности с сервером
      const bodyObj = { device_name: deviceName, public_key: publicKey };
      const requestBody = JSON.stringify(bodyObj, Object.keys(bodyObj).sort());
      const message = `POST/controllers/${controllerId}/authorize-device${requestBody}`;
      console.log('[Controller] Signing message:', message);
      console.log('[Controller] Message length:', message.length);
      console.log('[Controller] Body object:', bodyObj);
      
      // Подписываем запрос
      const signature = await signMessage(message, privateKey);
      console.log('[Controller] Message signed');

      // Отправляем запрос на привязку устройства
      console.log('[Controller] Sending authorize device request...');
      const result = await apiClient.authorizeControllerDevice(
        controllerId,
        deviceName,
        publicKey,
        signature
      );
      console.log('[Controller] Device authorized:', result);

      // Сохраняем ключи в localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(`ed25519_private_key_${controllerId}`, privateKey);
        localStorage.setItem(`ed25519_public_key_${controllerId}`, publicKey);
        localStorage.setItem(`device_name_${controllerId}`, deviceName);
        
        // Сохраняем список авторизованных контроллеров
        const authorizedControllers = JSON.parse(
          localStorage.getItem('authorized_controllers') || '[]'
        );
        if (!authorizedControllers.includes(controllerId)) {
          authorizedControllers.push(controllerId);
          localStorage.setItem('authorized_controllers', JSON.stringify(authorizedControllers));
        }
      }

      setDeviceName(deviceName);
      
      // Небольшая задержка, чтобы устройство точно добавилось в базу
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Загружаем информацию о контроллере
      // Используем тот же публичный ключ и подписываем новое сообщение для GET запроса
      const getMessage = `GET/controllers/${controllerId}`;
      console.log('[Controller] Signing GET message:', getMessage);
      const getSignature = await signMessage(getMessage, privateKey);
      console.log('[Controller] GET message signed');
      
      await loadControllerInfo(publicKey, getSignature);
    } catch (err: any) {
      console.error('[Controller] Device binding error:', err);
      const errorMessage = err.message || err.error || "Ошибка при привязке устройства";
      setError(`Ошибка привязки устройства: ${errorMessage}`);
      setLoading(false);
    }
  };

  const authorizeWithEd25519 = async (privateKey: string) => {
    try {
      console.log('[Controller] Authorizing with Ed25519...');
      // Получаем публичный ключ из приватного
      const publicKey = getPublicKeyFromPrivate(privateKey);
      
      // Получаем имя устройства
      const storedDeviceName = typeof window !== 'undefined'
        ? localStorage.getItem(`device_name_${controllerId}`)
        : null;
      if (storedDeviceName) {
        setDeviceName(storedDeviceName);
      }

      // Формируем сообщение для подписи: метод + путь (без /api) + тело запроса
      const message = `GET/controllers/${controllerId}`;
      console.log('[Controller] Signing message:', message);
      const signature = await signMessage(message, privateKey);
      console.log('[Controller] Message signed');

      // Загружаем информацию о контроллере с Ed25519 авторизацией
      await loadControllerInfo(publicKey, signature);
    } catch (err: any) {
      console.error('[Controller] Ed25519 authorization error:', err);
      const errorMessage = err.message || err.error || "Ошибка авторизации";
      setError(`Ошибка авторизации: ${errorMessage}`);
      setLoading(false);
    }
  };

  const loadControllerInfo = async (publicKey: string, signature: string) => {
    try {
      console.log('[Controller] Loading controller info...');
      const controllerData = await apiClient.getControllerWithAuth(controllerId, signature, publicKey);
      console.log('[Controller] Controller info loaded:', controllerData);
      setController(controllerData);
      setAuthorized(true);
      
      // Проверяем статус подключения
      try {
        const connectionStatus = await apiClient.getControllerConnectionStatus(controllerId, signature, publicKey);
        console.log('[Controller] Connection status:', connectionStatus);
        setConnected(connectionStatus.connected);
        
        // Если контроллер подключен, загружаем его статус
        if (connectionStatus.connected) {
          await loadControllerStatus(publicKey, signature);
        }
      } catch (err: any) {
        console.warn('[Controller] Failed to check connection status:', err);
        setConnected(false);
      }
      
      setLoading(false);
    } catch (err: any) {
      console.error('[Controller] Load controller info error:', err);
      if (err.status === 403) {
        setError("Доступ запрещен. Устройство не авторизовано.");
      } else {
        const errorMessage = err.message || err.error || "Ошибка при загрузке информации о контроллере";
        setError(`Ошибка загрузки: ${errorMessage}`);
      }
      setLoading(false);
    }
  };

  const loadControllerStatus = async (publicKey: string, signature: string) => {
    try {
      console.log('[Controller] Loading controller status via tunnel...');
      const response = await apiClient.proxyControllerRequest(
        controllerId,
        'GET',
        '/api/status',
        signature,
        publicKey
      );
      
      if (response.status === 200) {
        const statusData = JSON.parse(response.body);
        console.log('[Controller] Controller status loaded:', statusData);
        setControllerStatus(statusData);
      } else {
        console.warn('[Controller] Failed to load status:', response.status, response.body);
      }
    } catch (err: any) {
      console.error('[Controller] Failed to load controller status:', err);
      if (err.message?.includes('not connected')) {
        setConnected(false);
      }
    }
  };

  const handleDeactivate = async () => {
    if (!confirm(`Деактивировать контроллер? Контроллер будет удален из базы данных. Это действие нельзя отменить.`)) {
      return;
    }

    try {
      const storageKey = `ed25519_private_key_${controllerId}`;
      const storedPrivateKey = typeof window !== 'undefined' 
        ? localStorage.getItem(storageKey) 
        : null;

      if (!storedPrivateKey) {
        alert('Ошибка: не найден приватный ключ для авторизации');
        return;
      }

      const publicKey = getPublicKeyFromPrivate(storedPrivateKey);
      const message = `POST/controllers/${controllerId}/deactivate`;
      const signature = await signMessage(message, storedPrivateKey);

      await apiClient.deactivateController(controllerId, signature, publicKey);
      
      // Очищаем данные из localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem(storageKey);
        localStorage.removeItem(`ed25519_public_key_${controllerId}`);
        localStorage.removeItem(`device_name_${controllerId}`);
        const authorizedControllers = JSON.parse(
          localStorage.getItem('authorized_controllers') || '[]'
        );
        const updated = authorizedControllers.filter((id: string) => id !== controllerId);
        localStorage.setItem('authorized_controllers', JSON.stringify(updated));
      }

      alert('Контроллер успешно деактивирован');
      router.push('/');
    } catch (err: any) {
      console.error('[Controller] Deactivation error:', err);
      alert(err.message || err.error || "Ошибка при деактивации контроллера");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900 dark:border-neutral-100 mx-auto mb-4"></div>
              <p className="text-neutral-600 dark:text-neutral-400">Проверка доступа...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Ошибка доступа
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="mt-4">
              <Button asChild variant="outline" className="w-full">
                <Link href="/">На главную</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!authorized || !controller) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900 dark:border-neutral-100 mx-auto mb-4"></div>
              <p className="text-neutral-600 dark:text-neutral-400">Инициализация доступа...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Button asChild variant="outline">
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                На главную
              </Link>
            </Button>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Контроллер {controllerId.substring(0, 8)}...
              </CardTitle>
              <CardDescription>
                Удаленное управление контроллером WMOC
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">MAC адрес:</span>
                  <Badge variant="outline" className="font-mono">
                    {controller.mac_address}
                  </Badge>
                </div>
                
                {controller.firmware_version && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600 dark:text-neutral-400">Версия прошивки:</span>
                    <Badge variant="outline">
                      {controller.firmware_version}
                    </Badge>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">Статус:</span>
                  <Badge variant={controller.is_active ? "default" : "secondary"}>
                    {controller.is_active ? "Активен" : "Неактивен"}
                  </Badge>
                </div>

                {deviceName && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600 dark:text-neutral-400">Устройство:</span>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">{deviceName}</span>
                    </div>
                  </div>
                )}

                {controller.last_seen_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600 dark:text-neutral-400">Последняя активность:</span>
                    <span className="text-sm">
                      {new Date(controller.last_seen_at).toLocaleString('ru-RU')}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Действия</CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                variant="destructive" 
                onClick={handleDeactivate}
                className="w-full"
              >
                <PowerOff className="h-4 w-4 mr-2" />
                Деактивировать контроллер
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                Удалит контроллер из базы данных. Все данные будут потеряны.
              </p>
            </CardContent>
          </Card>

          {connected ? (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wifi className="h-5 w-5 text-green-500" />
                  Статус контроллера
                </CardTitle>
                <CardDescription>
                  Данные получены через WebSocket туннель
                </CardDescription>
              </CardHeader>
              <CardContent>
                {controllerStatus ? (
                  <div className="space-y-4">
                    <pre className="bg-neutral-100 dark:bg-neutral-800 p-4 rounded-lg overflow-auto text-sm">
                      {JSON.stringify(controllerStatus, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-neutral-900 dark:border-neutral-100 mx-auto mb-2"></div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">Загрузка данных...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Alert>
              <WifiOff className="h-4 w-4" />
              <AlertDescription>
                Контроллер не подключен к серверу через WebSocket туннель.
                Убедитесь, что контроллер включен и подключен к интернету.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}

