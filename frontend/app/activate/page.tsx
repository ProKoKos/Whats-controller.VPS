"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

type ActionType = "create_cabinet" | "add_to_cabinet" | null;

export default function ActivatePage() {
  const router = useRouter();
  const [action, setAction] = useState<ActionType>(null);
  const [activationCode, setActivationCode] = useState("");
  const [macAddress, setMacAddress] = useState("");
  const [cabinetSecret, setCabinetSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"select" | "form" | "result">("select");
  const [result, setResult] = useState<{
    deviceAuthorizationCode: string;
    expiresAt: string;
    cabinetSecret?: string;
    cabinetId?: string;
  } | null>(null);

  const handleActionSelect = (selectedAction: "create_cabinet" | "add_to_cabinet") => {
    setAction(selectedAction);
    setStep("form");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/activation/initiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          activation_code: activationCode,
          mac_address: macAddress,
          action: action,
          cabinet_secret: action === "add_to_cabinet" ? cabinetSecret : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || data.message || "Ошибка при инициации активации");
      }

      setResult({
        deviceAuthorizationCode: data.device_authorization_code,
        expiresAt: data.expires_at,
        cabinetSecret: data.cabinet_secret,
        cabinetId: data.cabinet_id,
      });

      // Сохранение cabinet_secret в localStorage, если создан новый кабинет
      if (data.cabinet_secret && data.cabinet_id) {
        localStorage.setItem(`cabinet_secret_${data.cabinet_id}`, data.cabinet_secret);
      }

      setStep("result");
    } catch (err: any) {
      setError(err.message || "Произошла ошибка");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep("select");
    setAction(null);
    setError(null);
    setResult(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-neutral-900 to-neutral-700 dark:from-neutral-100 dark:to-neutral-300 bg-clip-text text-transparent">
              Активация контроллера
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400">
              Подключите ваш контроллер к системе
            </p>
          </div>

          {step === "select" && (
            <Card>
              <CardHeader>
                <CardTitle>Выберите действие</CardTitle>
                <CardDescription>
                  Создайте новый кабинет или добавьте контроллер в существующий
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={() => handleActionSelect("create_cabinet")}
                  className="w-full"
                  size="lg"
                >
                  Создать новый кабинет
                </Button>
                <Button
                  onClick={() => handleActionSelect("add_to_cabinet")}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  Добавить в существующий кабинет
                </Button>
                <div className="pt-4">
                  <Link href="/" className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">
                    ← Вернуться на главную
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {step === "form" && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {action === "create_cabinet" ? "Создание нового кабинета" : "Добавление в кабинет"}
                </CardTitle>
                <CardDescription>
                  Введите данные для активации контроллера
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <Alert className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200">
                      {error}
                    </Alert>
                  )}

                  <div>
                    <Label htmlFor="activationCode">Код активации с контроллера</Label>
                    <Input
                      id="activationCode"
                      type="text"
                      placeholder="Введите 12-символьный код"
                      value={activationCode}
                      onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                      maxLength={12}
                      required
                      pattern="[A-Za-z0-9]{12}"
                    />
                    <p className="text-xs text-neutral-500 mt-1">
                      Код из 12 символов (буквы и цифры)
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="macAddress">MAC адрес контроллера</Label>
                    <Input
                      id="macAddress"
                      type="text"
                      placeholder="AA:BB:CC:DD:EE:FF"
                      value={macAddress}
                      onChange={(e) => setMacAddress(e.target.value.toUpperCase())}
                      required
                      pattern="^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$"
                    />
                    <p className="text-xs text-neutral-500 mt-1">
                      Формат: AA:BB:CC:DD:EE:FF или AA-BB-CC-DD-EE-FF
                    </p>
                  </div>

                  {action === "add_to_cabinet" && (
                    <div>
                      <Label htmlFor="cabinetSecret">Секрет кабинета</Label>
                      <Input
                        id="cabinetSecret"
                        type="text"
                        placeholder="Введите секрет вашего кабинета"
                        value={cabinetSecret}
                        onChange={(e) => setCabinetSecret(e.target.value)}
                        required
                      />
                      <p className="text-xs text-neutral-500 mt-1">
                        Секрет кабинета, который вы получили при создании
                      </p>
                    </div>
                  )}

                  <div className="flex gap-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleBack}
                      disabled={loading}
                    >
                      Назад
                    </Button>
                    <Button type="submit" disabled={loading} className="flex-1">
                      {loading ? "Обработка..." : "Продолжить"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {step === "result" && result && (
            <Card>
              <CardHeader>
                <CardTitle>Активация инициирована</CardTitle>
                <CardDescription>
                  Введите код подтверждения на контроллере
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="text-center">
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                      Код для ввода на контроллере:
                    </p>
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 font-mono tracking-wider">
                      {result.deviceAuthorizationCode}
                    </p>
                    <p className="text-xs text-neutral-500 mt-2">
                      Действителен до: {new Date(result.expiresAt).toLocaleString("ru-RU")}
                    </p>
                  </div>
                </div>

                {result.cabinetSecret && result.cabinetId && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <p className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2">
                      ✓ Новый кабинет создан
                    </p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-2">
                      Секрет кабинета (сохранен автоматически):
                    </p>
                    <p className="text-xs font-mono bg-white dark:bg-neutral-800 p-2 rounded break-all">
                      {result.cabinetSecret}
                    </p>
                    <p className="text-xs text-neutral-500 mt-2">
                      ID кабинета: {result.cabinetId}
                    </p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-3">
                      Ссылка на кабинет будет доступна после подтверждения активации на контроллере.
                    </p>
                  </div>
                )}

                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                    📋 Инструкции:
                  </p>
                  <ol className="text-sm text-neutral-700 dark:text-neutral-300 space-y-2 list-decimal list-inside">
                    <li>На контроллере откройте веб-интерфейс</li>
                    <li>Перейдите в раздел активации</li>
                    <li>Введите код: <strong className="font-mono">{result.deviceAuthorizationCode}</strong></li>
                    <li>Подождите подтверждения активации</li>
                    <li>После активации вы получите доступ к контроллеру</li>
                  </ol>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    className="flex-1"
                  >
                    Активировать еще один контроллер
                  </Button>
                  <Button
                    asChild
                    className="flex-1"
                  >
                    <Link href="/">На главную</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

