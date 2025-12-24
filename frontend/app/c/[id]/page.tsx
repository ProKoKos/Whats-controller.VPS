"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ControllerPage() {
  const params = useParams();
  const controllerId = params.id as string;

  return (
    <RequireAuth>
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800">
        <div className="container mx-auto px-4 py-8">
          <Button asChild variant="outline" className="mb-6">
            <Link href="/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад к дашборду
            </Link>
          </Button>

          <Card>
            <CardHeader>
              <CardTitle>Управление контроллером</CardTitle>
              <CardDescription>
                ID контроллера: {controllerId}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Страница управления контроллером находится в разработке.
                Здесь будет доступен веб-интерфейс контроллера через прокси.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </RequireAuth>
  );
}

