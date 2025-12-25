"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";
import { ArrowLeft, Server, Wifi, WifiOff, RotateCcw } from "lucide-react";

export default function SuperadminControllerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const controllerId = params.id as string;

  const [controller, setController] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadController();
  }, [controllerId]);

  const loadController = async () => {
    try {
      setError("");
      setLoading(true);
      const data = await apiClient.getSuperadminController(controllerId);
      setController(data);
    } catch (err: any) {
      setError(err.message || "Ошибка при загрузке контроллера");
      if (err.status === 401 || err.status === 403) {
        router.push("/superadmin/login");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirm(`Сбросить контроллер ${controllerId}? Он будет отвязан от кабинета.`)) {
      return;
    }

    try {
      await apiClient.resetSuperadminController(controllerId);
      await loadController();
    } catch (err: any) {
      alert(err.message || "Ошибка при сбросе контроллера");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-900 dark:border-neutral-100 mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Загрузка...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Детали контроллера</h1>
            <p className="text-muted-foreground font-mono text-sm">{controllerId}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/superadmin/controllers">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Назад
              </Link>
            </Button>
            <Button variant="destructive" onClick={handleReset}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Сбросить контроллер
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {controller && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{controller.name}</CardTitle>
                  <CardDescription className="font-mono">{controller.macAddress}</CardDescription>
                </div>
                <Badge variant={controller.isActive ? "default" : "secondary"}>
                  {controller.isActive ? (
                    <>
                      <Wifi className="w-3 h-3 mr-1" />
                      Онлайн
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3 h-3 mr-1" />
                      Оффлайн
                    </>
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p><strong>ID:</strong> <span className="font-mono text-sm">{controller.id}</span></p>
                {controller.firmwareVersion && (
                  <p><strong>Версия прошивки:</strong> {controller.firmwareVersion}</p>
                )}
                {controller.cabinetId && (
                  <p>
                    <strong>Кабинет:</strong>{" "}
                    <Link href={`/superadmin/cabinets/${controller.cabinetId}`} className="text-primary hover:underline font-mono text-sm">
                      {controller.cabinetId}
                    </Link>
                  </p>
                )}
                <p><strong>Создан:</strong> {new Date(controller.createdAt).toLocaleString('ru-RU')}</p>
                <p><strong>Обновлен:</strong> {new Date(controller.updatedAt).toLocaleString('ru-RU')}</p>
                {controller.lastSeenAt && (
                  <p><strong>Последний раз онлайн:</strong> {new Date(controller.lastSeenAt).toLocaleString('ru-RU')}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

