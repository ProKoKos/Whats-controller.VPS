"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";
import { ArrowLeft, Building2, Server, Trash2 } from "lucide-react";

export default function SuperadminCabinetsPage() {
  const router = useRouter();
  const [cabinets, setCabinets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadCabinets();
  }, []);

  const loadCabinets = async () => {
    try {
      setError("");
      setLoading(true);
      const data = await apiClient.getSuperadminCabinets();
      setCabinets(data.cabinets);
    } catch (err: any) {
      setError(err.message || "Ошибка при загрузке кабинетов");
      if (err.status === 401 || err.status === 403) {
        router.push("/superadmin/login");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (cabinetId: string) => {
    if (!confirm(`Удалить кабинет ${cabinetId}? Это действие нельзя отменить.`)) {
      return;
    }

    try {
      await apiClient.deleteSuperadminCabinet(cabinetId);
      await loadCabinets();
    } catch (err: any) {
      alert(err.message || "Ошибка при удалении кабинета");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Кабинеты</h1>
            <p className="text-muted-foreground">Управление кабинетами пользователей</p>
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
            <p className="mt-4 text-muted-foreground">Загрузка кабинетов...</p>
          </div>
        ) : cabinets.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Нет кабинетов</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cabinets.map((cabinet) => (
              <Card key={cabinet.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">Кабинет</CardTitle>
                      <CardDescription className="font-mono text-xs mt-1">
                        {cabinet.id.substring(0, 8)}...
                      </CardDescription>
                    </div>
                    <Badge variant="outline">
                      <Server className="w-3 h-3 mr-1" />
                      {cabinet.controllerCount}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    <p>Создан: {new Date(cabinet.createdAt).toLocaleDateString('ru-RU')}</p>
                    {cabinet.lastActivity && (
                      <p>Активность: {new Date(cabinet.lastActivity).toLocaleDateString('ru-RU')}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="default" className="flex-1">
                      <Link href={`/superadmin/cabinets/${cabinet.id}`}>
                        Детали
                      </Link>
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDelete(cabinet.id)}
                    >
                      <Trash2 className="w-4 h-4" />
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

