"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus } from "lucide-react";
import { apiClient } from "@/lib/api";

interface AddControllerDialogProps {
  onControllerAdded: () => void;
}

export function AddControllerDialog({ onControllerAdded }: AddControllerDialogProps) {
  const [open, setOpen] = useState(false);
  const [macAddress, setMacAddress] = useState("");
  const [firmwareVersion, setFirmwareVersion] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activationToken, setActivationToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await apiClient.activateController(macAddress, firmwareVersion || undefined);
      setActivationToken(result.activationToken);
      onControllerAdded();
    } catch (err: any) {
      setError(err.message || "Ошибка при активации контроллера");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setMacAddress("");
    setFirmwareVersion("");
    setError("");
    setActivationToken(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Добавить контроллер
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Активация нового контроллера</DialogTitle>
          <DialogDescription>
            Введите MAC-адрес контроллера для его активации
          </DialogDescription>
        </DialogHeader>
        {activationToken ? (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold">Контроллер успешно зарегистрирован!</p>
                  <p className="text-sm">Используйте этот токен активации при первом подключении контроллера:</p>
                  <div className="bg-muted p-3 rounded-md font-mono text-sm break-all">
                    {activationToken}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Сохраните этот токен в безопасном месте. Он потребуется для подключения контроллера к серверу.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button onClick={handleClose}>Готово</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="mac">MAC-адрес *</Label>
                <Input
                  id="mac"
                  placeholder="00:11:22:33:44:55"
                  value={macAddress}
                  onChange={(e) => setMacAddress(e.target.value)}
                  required
                  pattern="^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$"
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Формат: 00:11:22:33:44:55 или 00-11-22-33-44-55
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="firmware">Версия прошивки (необязательно)</Label>
                <Input
                  id="firmware"
                  placeholder="1.0.0"
                  value={firmwareVersion}
                  onChange={(e) => setFirmwareVersion(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                Отмена
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Активация..." : "Активировать"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

