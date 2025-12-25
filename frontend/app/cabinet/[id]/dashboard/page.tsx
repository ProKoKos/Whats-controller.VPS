"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ControllerCard } from "@/components/dashboard/ControllerCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";
import { 
  Users, 
  Wifi, 
  WifiOff, 
  Settings, 
  Download, 
  Upload, 
  Copy,
  CheckCircle2,
  ArrowLeft,
  Smartphone
} from "lucide-react";

interface Controller {
  id: string;
  macAddress: string;
  firmwareVersion?: string;
  name: string;
  isActive: boolean;
  lastSeenAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface AuthorizedDevice {
  id: string;
  deviceFingerprint: string;
  publicKey: string;
  lastUsedAt?: string;
  createdAt: string;
}

export default function CabinetDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const cabinetId = params.id as string;

  const [controllers, setControllers] = useState<Controller[]>([]);
  const [authorizedDevices, setAuthorizedDevices] = useState<AuthorizedDevice[]>([]);
  const [cabinetSecret, setCabinetSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [secretCopied, setSecretCopied] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    // Загрузка cabinet_secret из localStorage
    if (typeof window !== 'undefined') {
      const savedSecret = localStorage.getItem(`cabinet_secret_${cabinetId}`);
      if (savedSecret) {
        setCabinetSecret(savedSecret);
      }
    }
    loadData();
  }, [cabinetId]);

  const loadData = async () => {
    try {
      setError("");
      setLoading(true);

      // Проверка наличия токена доступа
      const accessToken = typeof window !== 'undefined' 
        ? localStorage.getItem('cabinet_access_token')
        : null;

      if (!accessToken) {
        router.push(`/cabinet/${cabinetId}`);
        return;
      }

      // Загрузка контроллеров кабинета
      // Используем общий метод getControllers, который вернет только контроллеры текущего кабинета
      // (благодаря middleware authenticateCabinet)
      const controllersData = await apiClient.getControllers();
      setControllers(controllersData.controllers);

      // Загрузка авторизованных устройств
      // TODO: Добавить метод getAuthorizedDevices в API клиент
      // Пока оставляем пустым
      setAuthorizedDevices([]);
    } catch (err: any) {
      setError(err.message || "Ошибка при загрузке данных");
      if (err.status === 401 || err.status === 403) {
        // Токен истек или невалиден, перенаправляем на страницу доступа
        router.push(`/cabinet/${cabinetId}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.deleteController(id);
      await loadData();
    } catch (err: any) {
      alert(err.message || "Ошибка при удалении контроллера");
    }
  };

  const handleExportSecret = () => {
    if (!cabinetSecret) return;
    
    const data = {
      cabinet_id: cabinetId,
      cabinet_secret: cabinetSecret,
      export_date: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cabinet_secret_${cabinetId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportSecret = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (data.cabinet_id === cabinetId && data.cabinet_secret) {
            localStorage.setItem(`cabinet_secret_${cabinetId}`, data.cabinet_secret);
            setCabinetSecret(data.cabinet_secret);
            alert('Секрет кабинета успешно импортирован');
          } else {
            alert('Неверный формат файла');
          }
        } catch (err) {
          alert('Ошибка при чтении файла');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleCopySecret = () => {
    if (!cabinetSecret) return;
    navigator.clipboard.writeText(cabinetSecret).then(() => {
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-neutral-900 to-neutral-700 dark:from-neutral-100 dark:to-neutral-300 bg-clip-text text-transparent">
              Кабинет
            </h1>
            <p className="text-muted-foreground">
              Cabinet ID: {cabinetId}
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href={`/cabinet/${cabinetId}`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад
            </Link>
          </Button>
        </div>

        {/* Error */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Всего контроллеров
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{controllers.length}</div>
              <p className="text-xs text-muted-foreground">
                Зарегистрировано
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Активных
              </CardTitle>
              <Wifi className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {controllers.filter((c) => c.isActive).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Онлайн сейчас
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Авторизованных устройств
              </CardTitle>
              <Smartphone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {authorizedDevices.length}
              </div>
              <p className="text-xs text-muted-foreground">
                Устройств с доступом
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Cabinet Secret Management */}
        {cabinetSecret && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Секрет кабинета</CardTitle>
              <CardDescription>
                Сохраните этот секрет в безопасном месте. Он нужен для доступа к кабинету.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex-1 font-mono text-sm bg-neutral-100 dark:bg-neutral-800 p-3 rounded break-all">
                  {showSecret ? cabinetSecret : '•'.repeat(cabinetSecret.length)}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? '👁️' : '👁️‍🗨️'}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopySecret}
                >
                  {secretCopied ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleExportSecret} className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  Экспорт
                </Button>
                <Button variant="outline" onClick={handleImportSecret} className="flex-1">
                  <Upload className="w-4 h-4 mr-2" />
                  Импорт
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Controllers Section */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Контроллеры</CardTitle>
                <CardDescription>
                  Управление контроллерами кабинета
                </CardDescription>
              </div>
              <Button asChild>
                <Link href="/activate">
                  Добавить контроллер
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-900 dark:border-neutral-100 mx-auto"></div>
                <p className="mt-4 text-muted-foreground">Загрузка контроллеров...</p>
              </div>
            ) : controllers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">Нет контроллеров</p>
                <Button asChild>
                  <Link href="/activate">Добавить первый контроллер</Link>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {controllers.map((controller) => (
                  <ControllerCard
                    key={controller.id}
                    controller={controller}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Authorized Devices Section */}
        <Card>
          <CardHeader>
            <CardTitle>Авторизованные устройства</CardTitle>
            <CardDescription>
              Устройства с доступом к этому кабинету
            </CardDescription>
          </CardHeader>
          <CardContent>
            {authorizedDevices.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  Нет авторизованных устройств
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {authorizedDevices.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <p className="font-mono text-sm">{device.deviceFingerprint}</p>
                      <p className="text-xs text-muted-foreground">
                        Последнее использование: {device.lastUsedAt 
                          ? new Date(device.lastUsedAt).toLocaleString('ru-RU')
                          : 'Никогда'}
                      </p>
                    </div>
                    <Badge variant="outline">
                      Авторизовано
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

