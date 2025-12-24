# WMOC Frontend

Frontend приложение для платформы WMOC, построенное на Next.js 16 с использованием React, TypeScript, Tailwind CSS и shadcn/ui.

## Технологии

- **Next.js 16** - React фреймворк с App Router
- **TypeScript** - типизированный JavaScript
- **Tailwind CSS** - utility-first CSS фреймворк
- **shadcn/ui** - компоненты UI на базе Radix UI
- **Radix UI** - доступные компоненты без стилей

## Структура проекта

```
frontend/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Главная страница (landing)
│   ├── login/             # Страница входа
│   ├── register/          # Страница регистрации
│   ├── layout.tsx         # Корневой layout
│   └── globals.css        # Глобальные стили
├── components/
│   └── ui/                # shadcn/ui компоненты
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── label.tsx
│       └── alert.tsx
├── lib/
│   ├── api.ts            # API клиент
│   └── utils.ts          # Утилиты (cn, и т.д.)
└── public/               # Статические файлы
```

## Установка

```bash
# Установить зависимости
npm install

# Запустить dev сервер
npm run dev

# Собрать production сборку
npm run build

# Запустить production сервер
npm start

# Проверить код линтером
npm run lint
```

## Переменные окружения

Создайте файл `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

Для продакшена:
```env
NEXT_PUBLIC_API_URL=/api
```

## API клиент

API клиент находится в `lib/api.ts` и предоставляет методы для работы с backend:

- `apiClient.register(email, password)` - регистрация
- `apiClient.login(email, password)` - вход
- `apiClient.getControllers()` - список контроллеров
- `apiClient.getController(id)` - информация о контроллере

Токены автоматически сохраняются в `localStorage` и добавляются в заголовки запросов.

## Компоненты UI

Проект использует shadcn/ui с нейтральной темой. Все компоненты доступны в `components/ui/`.

### Добавление новых компонентов

```bash
npx shadcn@latest add [component-name]
```

Например:
```bash
npx shadcn@latest add dialog
npx shadcn@latest add table
npx shadcn@latest add toast
```

## Разработка

1. Убедитесь, что backend сервер запущен на порту 3000
2. Запустите frontend: `npm run dev`
3. Откройте http://localhost:3000 (или порт, указанный Next.js)

## Стили

Проект использует Tailwind CSS с кастомными CSS переменными для темы. Тема настраивается в `app/globals.css` через CSS переменные.

### Нейтральная тема (shadcn/ui)

Тема использует нейтральные цвета (grayscale). Для изменения темы отредактируйте CSS переменные в `app/globals.css`.

## Деплой

### Статическая сборка

```bash
npm run build
```

Файлы будут в папке `.next/`.

### Docker (планируется)

Frontend можно развернуть отдельным Docker контейнером или интегрировать в существующий сервер.

## Интеграция с Backend

Frontend общается с backend через REST API. Все запросы идут через API клиент (`lib/api.ts`), который:

1. Автоматически добавляет токены авторизации
2. Обрабатывает ошибки
3. Возвращает типизированные данные

## Дальнейшая разработка

- [ ] Дашборд с списком контроллеров
- [ ] Страница управления контроллерами
- [ ] Страница активации контроллера
- [ ] Графики и метрики
- [ ] Уведомления
- [ ] Настройки профиля
