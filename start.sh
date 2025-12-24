#!/bin/bash
# Единый скрипт запуска WMOC SaaS Platform
# Запускает Docker контейнеры, Backend API и Frontend

set -e

SKIP_DOCKER=false
if [ "$1" == "--skip-docker" ]; then
    SKIP_DOCKER=true
fi

echo ""
echo "🚀 WMOC SaaS Platform - Запуск проекта"
echo "========================================"
echo ""

# Проверка Docker
if [ "$SKIP_DOCKER" = false ]; then
    echo "📦 Проверка Docker..."
    if ! docker ps > /dev/null 2>&1; then
        echo "   ❌ Docker не запущен. Запустите Docker и повторите попытку."
        exit 1
    fi
    echo "   ✓ Docker запущен"

    # Запуск Docker контейнеров
    echo ""
    echo "📦 Запуск Docker контейнеров (PostgreSQL, Redis)..."
    docker compose up -d postgres redis

    echo "   ✓ Контейнеры запущены"

    # Ожидание готовности контейнеров
    echo ""
    echo "⏳ Ожидание готовности базы данных..."
    max_attempts=30
    attempt=0
    db_ready=false

    while [ $attempt -lt $max_attempts ]; do
        sleep 2
        if docker compose exec -T postgres pg_isready -U wmoc > /dev/null 2>&1; then
            db_ready=true
            break
        fi
        attempt=$((attempt + 1))
        echo -n "   ."
    done

    if [ "$db_ready" = true ]; then
        echo ""
        echo "   ✓ База данных готова"
    else
        echo ""
        echo "   ⚠️  База данных может быть ещё не готова, но продолжаем..."
    fi
else
    echo "⏭️  Пропуск запуска Docker контейнеров (используйте --skip-docker)"
fi

echo ""
echo "🔧 Запуск сервисов..."
echo ""
echo "   Backend API:  http://localhost:3000"
echo "   Frontend:     http://localhost:3001"
echo ""
echo "   Нажмите Ctrl+C для остановки всех сервисов"
echo ""
echo "========================================"
echo ""

# Запуск backend и frontend одновременно
npm run dev:full

