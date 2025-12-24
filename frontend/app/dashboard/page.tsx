"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { ControllerCard } from "@/components/dashboard/ControllerCard";
import { AddControllerDialog } from "@/components/dashboard/AddControllerDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiClient } from "@/lib/api";
import { logout } from "@/lib/auth";
import { LogOut, Users } from "lucide-react";

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

export default function DashboardPage() {
  const [controllers, setControllers] = useState<Controller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadControllers = async () => {
    try {
      setError("");
      const data = await apiClient.getControllers();
      setControllers(data.controllers);
    } catch (err: any) {
      setError(err.message || "Ошибка при загрузке контроллеров");
      if (err.status === 401) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadControllers();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await apiClient.deleteController(id);
      await loadControllers();
    } catch (err: any) {
      alert(err.message || "Ошибка при удалении контроллера");
    }
  };

  const handleControllerAdded = () => {
    loadControllers();
  };

  return (
    <RequireAuth>
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-neutral-900 to-neutral-700 dark:from-neutral-100 dark:to-neutral-300 bg-clip-text text-transparent">
                Личный кабинет
              </h1>
              <p className="text-muted-foreground">
                Управление вашими контроллерами
              </p>
            </div>
            <Button variant="outline" onClick={logout}>
              <LogOut className="w-4 h-4 mr-2" />
              Выйти
            </Button>
          </div>

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
                <Users className="h-4 w-4 text-green-500" />
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
                  Неактивных
                </CardTitle>
                <Users className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                  {controllers.filter((c) => !c.isActive).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Оффлайн
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="mb-6">
            <AddControllerDialog onControllerAdded={handleControllerAdded} />
          </div>

          {/* Error */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Controllers List */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-900 dark:border-neutral-100 mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Загрузка контроллеров...</p>
            </div>
          ) : controllers.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Нет контроллеров</CardTitle>
                <CardDescription>
                  Добавьте первый контроллер для начала работы
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AddControllerDialog onControllerAdded={handleControllerAdded} />
              </CardContent>
            </Card>
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
        </div>
      </div>
    </RequireAuth>
  );
}

