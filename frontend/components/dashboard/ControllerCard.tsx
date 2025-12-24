"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Wifi, WifiOff, Settings, Trash2 } from "lucide-react";
import Link from "next/link";

interface Controller {
  id: string;
  macAddress: string;
  firmwareVersion?: string;
  name: string;
  isActive: boolean;
  lastSeenAt?: string;
  createdAt: string;
}

interface ControllerCardProps {
  controller: Controller;
  onDelete: (id: string) => void;
}

export function ControllerCard({ controller, onDelete }: ControllerCardProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return "Никогда";
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("ru-RU", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl">{controller.name}</CardTitle>
            <CardDescription className="mt-1">
              MAC: {controller.macAddress}
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
      <CardContent>
        <div className="space-y-2">
          {controller.firmwareVersion && (
            <div className="text-sm text-muted-foreground">
              Версия: {controller.firmwareVersion}
            </div>
          )}
          <div className="flex items-center text-sm text-muted-foreground">
            <Clock className="w-4 h-4 mr-2" />
            Последний раз: {formatDate(controller.lastSeenAt)}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        {controller.isActive ? (
          <Button asChild variant="default" className="flex-1">
            <Link href={`/c/${controller.id}`}>
              <Settings className="w-4 h-4 mr-2" />
              Управление
            </Link>
          </Button>
        ) : (
          <Button variant="outline" className="flex-1" disabled>
            <Settings className="w-4 h-4 mr-2" />
            Недоступно
          </Button>
        )}
        <Button
          variant="destructive"
          size="icon"
          onClick={() => {
            if (confirm(`Удалить контроллер ${controller.name}?`)) {
              onDelete(controller.id);
            }
          }}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}

