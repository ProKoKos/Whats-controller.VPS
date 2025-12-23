#!/bin/bash
# Скрипт для деплоя на VPS

set -e

echo "🚀 Начинаем деплой WMOC SaaS Platform..."

# Проверка наличия .env файла
if [ ! -f .env ]; then
    echo "❌ Файл .env не найден. Создайте его из .env.example"
    exit 1
fi

# Загрузка переменных окружения
export $(cat .env | grep -v '^#' | xargs)

echo "📦 Останавливаем контейнеры..."
docker-compose -f docker-compose.prod.yml down

echo "🔄 Обновляем код..."
git pull origin main

echo "🏗️  Собираем Docker образы..."
docker-compose -f docker-compose.prod.yml build --no-cache api

echo "🗄️  Проверяем миграции БД..."
# Миграции нужно применить вручную первый раз
# docker-compose -f docker-compose.prod.yml exec postgres psql -U $DB_USER -d $DB_NAME -f /path/to/migrations

echo "🚀 Запускаем контейнеры..."
docker-compose -f docker-compose.prod.yml up -d

echo "⏳ Ожидаем готовности сервисов..."
sleep 5

echo "🔍 Проверяем статус..."
docker-compose -f docker-compose.prod.yml ps

echo "✅ Деплой завершен!"
echo "📊 Логи: docker-compose -f docker-compose.prod.yml logs -f"

