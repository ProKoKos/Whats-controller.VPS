#!/bin/bash
# Скрипт для исправления проблемы и сохранения результатов в файл

cd ~/wmoc-server || exit 1

REPORT_FILE="/tmp/fix_report.txt"

{
    echo "=== Отчет об исправлении суперадмина ==="
    echo "Время: $(date)"
    echo ""
    
    echo "=== 1. Проверка JWT_SECRET ==="
    if ! grep -q "^JWT_SECRET=" .env 2>/dev/null; then
        echo "JWT_SECRET не найден, добавляю..."
        echo "" >> .env
        JWT_SECRET=$(openssl rand -base64 32)
        echo "JWT_SECRET=$JWT_SECRET" >> .env
        echo "JWT_EXPIRES_IN=15m" >> .env
        echo "✓ JWT_SECRET добавлен: ${JWT_SECRET:0:20}..."
    else
        echo "✓ JWT_SECRET уже существует"
        grep "^JWT_SECRET=" .env | head -1
    fi
    
    echo ""
    echo "=== 2. Перезапуск API ==="
    docker compose restart api
    sleep 5
    
    echo ""
    echo "=== 3. Проверка JWT_SECRET в контейнере ==="
    if docker compose exec api printenv | grep -q JWT_SECRET; then
        echo "✓ JWT_SECRET установлен"
        docker compose exec api printenv | grep JWT_SECRET
    else
        echo "✗ JWT_SECRET НЕ найден"
    fi
    
    echo ""
    echo "=== 4. Проверка суперадмина ==="
    docker compose exec -T postgres psql -U wmoc -d wmoc_saas -c "SELECT username, is_active, created_at FROM superadmins WHERE username = 'admin';"
    
    echo ""
    echo "=== 5. Тест API входа ==="
    RESPONSE=$(curl -s -X POST http://localhost:3000/api/superadmin/login \
      -H 'Content-Type: application/json' \
      -d '{"username":"admin","password":"123"}')
    
    if echo "$RESPONSE" | grep -q "accessToken"; then
        echo "✓ Вход работает!"
        echo "Токен получен (первые 50 символов):"
        echo "$RESPONSE" | head -1 | cut -c1-50
    else
        echo "✗ Ошибка входа:"
        echo "$RESPONSE"
    fi
    
    echo ""
    echo "=== Готово ==="
} > "$REPORT_FILE" 2>&1

cat "$REPORT_FILE"

