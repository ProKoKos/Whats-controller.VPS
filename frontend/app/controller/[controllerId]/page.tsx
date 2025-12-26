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
import { ArrowLeft, Server, Wifi, WifiOff, Shield, CheckCircle, XCircle } from "lucide-react";

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
      const pinResult = await apiClient.verifyControllerPin(controllerId, pin!);
      
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
      // Генерируем пару Ed25519 ключей
      const { privateKey, publicKey } = await generateKeyPair();

      // Генерируем имя устройства
      const deviceName = `Device ${new Date().toLocaleDateString('ru-RU')} ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;

      // Формируем сообщение для подписи: метод + путь + тело запроса
      const requestBody = JSON.stringify({ device_name: deviceName, public_key: publicKey });
      const message = `POST/api/controllers/${controllerId}/authorize-device${requestBody}`;
      
      // Подписываем запрос
      const signature = await signMessage(message, privateKey);

      // Отправляем запрос на привязку устройства
      const result = await apiClient.authorizeDevice(
        controllerId,
        deviceName,
        publicKey,
        signature
      );

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
      setAuthorized(true);
      
      // Загружаем информацию о контроллере
      await loadControllerInfo(publicKey, signature);
    } catch (err: any) {
      console.error('Device binding error:', err);
      setError(err.message || "Ошибка при привязке устройства");
      setLoading(false);
    }
  };

  const authorizeWithEd25519 = async (privateKey: string) => {
    try {
      // Получаем публичный ключ из приватного
      const publicKey = getPublicKeyFromPrivate(privateKey);
      
      // Получаем имя устройства
      const storedDeviceName = typeof window !== 'undefined'
        ? localStorage.getItem(`device_name_${controllerId}`)
        : null;
      if (storedDeviceName) {
        setDeviceName(storedDeviceName);
      }

      // Формируем сообщение для подписи
      const message = `GET/api/controllers/${controllerId}`;
      const signature = await signMessage(message, privateKey);

      // Загружаем информацию о контроллере с Ed25519 авторизацией
      await loadControllerInfo(publicKey, signature);
    } catch (err: any) {
      console.error('Ed25519 authorization error:', err);
      setError(err.message || "Ошибка авторизации");
      setLoading(false);
    }
  };

  const loadControllerInfo = async (publicKey: string, signature: string) => {
    try {
      const controllerData = await apiClient.getControllerWithAuth(controllerId, signature, publicKey);
      setController(controllerData);
      setAuthorized(true);
      setLoading(false);
    } catch (err: any) {
      console.error('Load controller info error:', err);
      if (err.status === 403) {
        setError("Доступ запрещен. Устройство не авторизовано.");
      } else {
        setError(err.message || "Ошибка при загрузке информации о контроллере");
      }
      setLoading(false);
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

          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Интерфейс контроллера будет доступен здесь после реализации WebSocket туннеля.
              Пока отображается базовая информация о контроллере.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}

