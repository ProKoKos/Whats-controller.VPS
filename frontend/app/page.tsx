"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-neutral-900 to-neutral-700 dark:from-neutral-100 dark:to-neutral-300 bg-clip-text text-transparent">
            WMOC
          </h1>
          <h2 className="text-3xl font-semibold mb-4 text-neutral-900 dark:text-neutral-100">
            Удалённое управление криптокотлами
          </h2>
          <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-12 max-w-2xl mx-auto">
            Профессиональная платформа для мониторинга и управления вашими майнинг-фермами из любой точки мира
          </p>

          <Card className="max-w-2xl mx-auto mb-12">
            <CardHeader>
              <CardTitle>Возможности</CardTitle>
              <CardDescription>
                Всё что нужно для эффективного управления оборудованием
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-left">
                <li className="flex items-start">
                  <span className="text-green-600 dark:text-green-400 mr-2">✓</span>
                  <span className="text-neutral-700 dark:text-neutral-300">
                    Удалённый доступ к веб-интерфейсам контроллеров
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 dark:text-green-400 mr-2">✓</span>
                  <span className="text-neutral-700 dark:text-neutral-300">
                    Мониторинг температуры и состояния оборудования
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 dark:text-green-400 mr-2">✓</span>
                  <span className="text-neutral-700 dark:text-neutral-300">
                    Управление системами охлаждения
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 dark:text-green-400 mr-2">✓</span>
                  <span className="text-neutral-700 dark:text-neutral-300">
                    Безопасное подключение через защищённый туннель
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 dark:text-green-400 mr-2">✓</span>
                  <span className="text-neutral-700 dark:text-neutral-300">
                    Уведомления о критических событиях
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" variant="outline" className="text-lg px-8">
              <Link href="/superadmin/login">Вход для администратора</Link>
            </Button>
          </div>

          <footer className="mt-16 text-sm text-neutral-500 dark:text-neutral-400">
            © 2024 WMOC. Все права защищены.
          </footer>
        </div>
      </div>
    </div>
  );
}
