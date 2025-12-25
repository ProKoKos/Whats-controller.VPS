"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiClient } from "@/lib/api";
import { 
  Users, 
  Server, 
  Activity,
  LogOut,
  Settings,
  Building2,
  Wifi
} from "lucide-react";

export default function SuperadminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState({
    totalCabinets: 0,
    totalControllers: 0,
    activeControllers: 0,
    loading: true
  });
  const [error, setError] = useState("");

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setError("");
      const [cabinetsData, controllersData] = await Promise.all([
        apiClient.getSuperadminCabinets(),
        apiClient.getSuperadminControllers()
      ]);

      setStats({
        totalCabinets: cabinetsData.cabinets.length,
        totalControllers: controllersData.controllers.length,
        activeControllers: controllersData.controllers.filter(c => c.isActive).length,
        loading: false
      });
    } catch (err: any) {
      setError(err.message || "Ошибка при загрузке статистики");
      if (err.status === 401 || err.status === 403) {
        router.push("/superadmin/login");
      }
      setStats(prev => ({ ...prev, loading: false }));
    }
  };

  const handleLogout = () => {
    apiClient.logout();
    router.push("/superadmin/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-neutral-900 to-neutral-700 dark:from-neutral-100 dark:to-neutral-300 bg-clip-text text-transparent">
              Панель суперадмина
            </h1>
            <p className="text-muted-foreground">
              Управление системой
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/superadmin/settings">
                <Settings className="w-4 h-4 mr-2" />
                Настройки
              </Link>
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Выйти
            </Button>
          </div>
        </div>

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
                Всего кабинетов
              </CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.loading ? "..." : stats.totalCabinets}</div>
              <p className="text-xs text-muted-foreground">
                Зарегистрировано
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Всего контроллеров
              </CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.loading ? "..." : stats.totalControllers}</div>
              <p className="text-xs text-muted-foreground">
                В системе
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Активных контроллеров
              </CardTitle>
              <Wifi className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats.loading ? "..." : stats.activeControllers}
              </div>
              <p className="text-xs text-muted-foreground">
                Онлайн сейчас
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Кабинеты</CardTitle>
              <CardDescription>
                Управление кабинетами пользователей
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/superadmin/cabinets">
                  <Building2 className="w-4 h-4 mr-2" />
                  Просмотр кабинетов
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Контроллеры</CardTitle>
              <CardDescription>
                Управление всеми контроллерами
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/superadmin/controllers">
                  <Server className="w-4 h-4 mr-2" />
                  Просмотр контроллеров
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

