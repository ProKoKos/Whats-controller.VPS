"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";
import { ArrowLeft, Server, Wifi, WifiOff, RotateCcw } from "lucide-react";

export default function SuperadminControllersPage() {
  const router = useRouter();
  const [controllers, setControllers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadControllers();
  }, []);

  const loadControllers = async () => {
    try {
      setError("");
      setLoading(true);
      const data = await apiClient.getSuperadminControllers();
      setControllers(data.controllers);
    } catch (err: any) {
      setError(err.message || "Ошибка при загрузке контроллеров");
      if (err.status === 401 || err.status === 403) {
        router.push("/superadmin/login");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (controllerId: string) => {
    if (!confirm(`Сбросить контроллер ${controllerId}? Он будет отвязан от кабинета.`)) {
      return;
    }

    try {
      await apiClient.resetSuperadminController(controllerId);
      await loadControllers();
    } catch (err: any) {
      alert(err.message || "Ошибка при сбросе контроллера");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Контроллеры</h1>
            <p className="text-muted-foreground">Управление всеми контроллерами</p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/superadmin/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад
            </Link>
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-900 dark:border-neutral-100 mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Загрузка контроллеров...</p>
          </div>
        ) : controllers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Нет контроллеров</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {controllers.map((controller) => (
              <Card key={controller.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{controller.name}</CardTitle>
                      <CardDescription className="font-mono text-xs mt-1">
                        {controller.macAddress}
                      </CardDescription>
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
                  {controller.firmwareVersion && (
                    <p className="text-sm text-muted-foreground">
                      Версия: {controller.firmwareVersion}
                    </p>
                  )}
                  {controller.cabinetId && (
                    <p className="text-xs text-muted-foreground font-mono">
                      Кабинет: {controller.cabinetId.substring(0, 8)}...
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button asChild variant="default" className="flex-1">
                      <Link href={`/superadmin/controllers/${controller.id}`}>
                        Детали
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleReset(controller.id)}
                      title="Сбросить контроллер"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

