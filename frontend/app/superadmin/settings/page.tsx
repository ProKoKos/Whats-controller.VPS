"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiClient } from "@/lib/api";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

export default function SuperadminSettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setError("");
      setLoading(true);
      const data = await apiClient.getSuperadminProfile();
      setProfile(data);
      setNewUsername(data.username);
    } catch (err: any) {
      setError(err.message || "Ошибка при загрузке профиля");
      if (err.status === 401 || err.status === 403) {
        router.push("/superadmin/login");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      await apiClient.changeSuperadminCredentials(
        currentPassword,
        newUsername !== profile.username ? newUsername : undefined,
        newPassword || undefined
      );
      setSuccess("Учетные данные успешно обновлены");
      setCurrentPassword("");
      setNewPassword("");
      await loadProfile();
    } catch (err: any) {
      setError(err.message || "Ошибка при обновлении учетных данных");
    } finally {
      setSaving(false);
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
            <h1 className="text-4xl font-bold mb-2">Настройки</h1>
            <p className="text-muted-foreground">Управление учетными данными</p>
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

        {success && (
          <Alert className="mb-6 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <AlertDescription className="text-green-800 dark:text-green-200 flex items-center">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {success}
            </AlertDescription>
          </Alert>
        )}

        {profile && (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Информация о профиле</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p><strong>Имя пользователя:</strong> {profile.username}</p>
                <p><strong>Статус:</strong> {profile.isActive ? "Активен" : "Неактивен"}</p>
                {profile.lastLoginAt && (
                  <p><strong>Последний вход:</strong> {new Date(profile.lastLoginAt).toLocaleString('ru-RU')}</p>
                )}
                <p><strong>Создан:</strong> {new Date(profile.createdAt).toLocaleString('ru-RU')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Смена учетных данных</CardTitle>
                <CardDescription>
                  Измените имя пользователя или пароль
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="username">Новое имя пользователя</Label>
                    <Input
                      id="username"
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder={profile.username}
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <Label htmlFor="newPassword">Новый пароль (оставьте пустым, чтобы не менять)</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Минимум 8 символов"
                      minLength={8}
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <Label htmlFor="currentPassword">Текущий пароль *</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Введите текущий пароль"
                      required
                      disabled={saving}
                    />
                  </div>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Сохранение..." : "Сохранить изменения"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

