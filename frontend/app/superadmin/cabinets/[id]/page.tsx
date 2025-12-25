"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";
import { ArrowLeft, Server, Wifi, WifiOff, Trash2 } from "lucide-react";

export default function SuperadminCabinetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const cabinetId = params.id as string;

  const [cabinet, setCabinet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadCabinet();
  }, [cabinetId]);

  const loadCabinet = async () => {
    try {
      setError("");
      setLoading(true);
      const data = await apiClient.getSuperadminCabinet(cabinetId);
      setCabinet(data);
    } catch (err: any) {
      setError(err.message || "Ошибка при загрузке кабинета");
      if (err.status === 401 || err.status === 403) {
        router.push("/superadmin/login");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Удалить кабинет ${cabinetId}? Это действие нельзя отменить.`)) {
      return;
    }

    try {
      await apiClient.deleteSuperadminCabinet(cabinetId);
      router.push("/superadmin/cabinets");
    } catch (err: any) {
      alert(err.message || "Ошибка при удалении кабинета");
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
            <h1 className="text-4xl font-bold mb-2">Детали кабинета</h1>
            <p className="text-muted-foreground font-mono text-sm">{cabinetId}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/superadmin/cabinets">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Назад
              </Link>
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Удалить кабинет
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {cabinet && (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Информация о кабинете</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p><strong>ID:</strong> <span className="font-mono text-sm">{cabinet.id}</span></p>
                <p><strong>Создан:</strong> {new Date(cabinet.createdAt).toLocaleString('ru-RU')}</p>
                {cabinet.lastActivity && (
                  <p><strong>Последняя активность:</strong> {new Date(cabinet.lastActivity).toLocaleString('ru-RU')}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Контроллеры кабинета ({cabinet.controllers.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {cabinet.controllers.length === 0 ? (
                  <p className="text-muted-foreground">Нет контроллеров</p>
                ) : (
                  <div className="space-y-4">
                    {cabinet.controllers.map((controller: any) => (
                      <div key={controller.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-semibold">{controller.name}</p>
                          <p className="text-sm text-muted-foreground font-mono">{controller.macAddress}</p>
                          {controller.firmwareVersion && (
                            <p className="text-xs text-muted-foreground">Версия: {controller.firmwareVersion}</p>
                          )}
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
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

