"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { apiClient } from "@/lib/api";
import {
  generateKeyPair,
  generateDeviceFingerprint,
  signMessage,
  savePrivateKey,
  savePublicKey,
  loadPrivateKey,
  loadPublicKey,
} from "@/lib/crypto";

type Step = "check" | "request" | "authorize" | "access" | "dashboard";

export default function CabinetPage() {
  const params = useParams();
  const router = useRouter();
  const cabinetId = params.id as string;

  const [step, setStep] = useState<Step>("check");
  const [cabinetSecret, setCabinetSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessRequestCode, setAccessRequestCode] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Проверка наличия cabinet_secret
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSecret = localStorage.getItem(`cabinet_secret_${cabinetId}`);
      if (savedSecret) {
        setCabinetSecret(savedSecret);
        // Проверяем, авторизовано ли устройство
        checkDeviceAuthorization(savedSecret);
      } else {
        setStep("request");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cabinetId]);

  const checkDeviceAuthorization = async (secret: string) => {
    try {
      // Проверяем наличие ключей устройства
      const deviceFingerprint = await generateDeviceFingerprint();
      const privateKey = loadPrivateKey(deviceFingerprint);
      const publicKey = loadPublicKey(deviceFingerprint);

      if (privateKey && publicKey) {
        // Устройство уже авторизовано, пробуем войти
        await handleAccess(secret, deviceFingerprint, privateKey);
      } else {
        // Нужна авторизация устройства
        setStep("authorize");
      }
    } catch (err: any) {
      setError(err.message || "Ошибка при проверке авторизации");
      setStep("request");
    }
  };

  const handleRequestAccess = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.requestCabinetAccess(cabinetId);
      setAccessRequestCode(response.access_request_code);
      setStep("authorize");
    } catch (err: any) {
      setError(err.message || "Ошибка при запросе доступа");
    } finally {
      setLoading(false);
    }
  };

  const handleAuthorizeDevice = async () => {
    setLoading(true);
    setError(null);

    try {
      // Генерация пары ключей
      const deviceFingerprint = await generateDeviceFingerprint();
      let privateKey = loadPrivateKey(deviceFingerprint);
      let publicKey = loadPublicKey(deviceFingerprint);

      if (!privateKey || !publicKey) {
        const keyPair = await generateKeyPair();
        privateKey = keyPair.privateKey;
        publicKey = keyPair.publicKey;
        savePrivateKey(privateKey, deviceFingerprint);
        savePublicKey(publicKey, deviceFingerprint);
      }

      // Если есть sessionToken, авторизуем устройство
      if (sessionToken) {
        const response = await apiClient.authorizeDevice(
          sessionToken,
          deviceFingerprint,
          publicKey,
          navigator.userAgent,
          `${window.screen.width}x${window.screen.height}`,
          Intl.DateTimeFormat().resolvedOptions().timeZone
        );

        setDeviceId(response.device_id);
      }

      // Если есть cabinet_secret, сразу входим
      if (cabinetSecret) {
        await handleAccess(cabinetSecret, deviceFingerprint, privateKey);
      } else {
        // Запрашиваем sessionToken через confirm-access (это должно быть сделано на контроллере)
        // Пока просто показываем сообщение
        setError("Подтвердите доступ на контроллере, затем обновите страницу");
        setStep("authorize");
      }
    } catch (err: any) {
      setError(err.message || "Ошибка при авторизации устройства");
    } finally {
      setLoading(false);
    }
  };

  const handleAccess = async (
    secret: string,
    deviceFingerprint: string,
    privateKey: string
  ) => {
    setLoading(true);
    setError(null);

    try {
      // Создание сообщения для подписи
      const message = `cabinet_access_${cabinetId}_${Date.now()}`;
      const signature = await signMessage(message, privateKey);

      // Вход в кабинет
      const response = await apiClient.accessCabinet(
        secret,
        signature,
        message,
        deviceFingerprint
      );

      setAccessToken(response.accessToken);
      
      // Сохранение токена
      if (typeof window !== 'undefined') {
        localStorage.setItem('cabinet_access_token', response.accessToken);
        localStorage.setItem('cabinet_id', response.cabinet_id);
      }

      // Переход на дашборд
      router.push(`/cabinet/${cabinetId}/dashboard`);
    } catch (err: any) {
      setError(err.message || "Ошибка при входе в кабинет");
      setLoading(false);
    }
  };

  const handleManualSecret = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const secret = formData.get('secret') as string;

    if (!secret) {
      setError("Введите секрет кабинета");
      return;
    }

    setCabinetSecret(secret);
    localStorage.setItem(`cabinet_secret_${cabinetId}`, secret);
    await checkDeviceAuthorization(secret);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-neutral-900 to-neutral-700 dark:from-neutral-100 dark:to-neutral-300 bg-clip-text text-transparent">
              Доступ к кабинету
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400">
              Cabinet ID: {cabinetId}
            </p>
          </div>

          {error && (
            <Alert className="mb-6 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200">
              {error}
            </Alert>
          )}

          {step === "request" && (
            <Card>
              <CardHeader>
                <CardTitle>Запрос доступа к кабинету</CardTitle>
                <CardDescription>
                  Для доступа к кабинету необходимо подтверждение на одном из ваших контроллеров
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-neutral-700 dark:text-neutral-300">
                    Если у вас есть секрет кабинета, вы можете ввести его вручную:
                  </p>
                </div>

                <form onSubmit={handleManualSecret} className="space-y-4">
                  <div>
                    <Label htmlFor="secret">Секрет кабинета</Label>
                    <Input
                      id="secret"
                      name="secret"
                      type="text"
                      placeholder="Введите секрет кабинета"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Проверка..." : "Войти с секретом"}
                  </Button>
                </form>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      или
                    </span>
                  </div>
                </div>

                <Button
                  onClick={handleRequestAccess}
                  variant="outline"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? "Запрос..." : "Запросить доступ через контроллер"}
                </Button>

                <div className="pt-4">
                  <Link href="/" className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">
                    ← Вернуться на главную
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {step === "authorize" && accessRequestCode && (
            <Card>
              <CardHeader>
                <CardTitle>Подтверждение доступа</CardTitle>
                <CardDescription>
                  Введите код подтверждения на одном из ваших контроллеров
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="text-center">
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                      Код для ввода на контроллере:
                    </p>
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 font-mono tracking-wider">
                      {accessRequestCode}
                    </p>
                  </div>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                    📋 Инструкции:
                  </p>
                  <ol className="text-sm text-neutral-700 dark:text-neutral-300 space-y-2 list-decimal list-inside">
                    <li>Откройте веб-интерфейс одного из ваших контроллеров</li>
                    <li>Перейдите в раздел "Подтверждение доступа"</li>
                    <li>Введите код: <strong className="font-mono">{accessRequestCode}</strong></li>
                    <li>После подтверждения нажмите кнопку ниже</li>
                  </ol>
                </div>

                <Button
                  onClick={handleAuthorizeDevice}
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? "Авторизация..." : "Устройство подтверждено, авторизовать"}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setStep("request")}
                  className="w-full"
                >
                  Назад
                </Button>
              </CardContent>
            </Card>
          )}

          {step === "access" && cabinetSecret && (
            <Card>
              <CardHeader>
                <CardTitle>Вход в кабинет</CardTitle>
                <CardDescription>
                  Устройство авторизовано. Выполняется вход...
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <p className="text-neutral-600 dark:text-neutral-400">
                    Пожалуйста, подождите...
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {loading && (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <p className="text-neutral-600 dark:text-neutral-400">
                    Обработка...
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

