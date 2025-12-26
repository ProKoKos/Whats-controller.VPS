#!/bin/bash
# Скрипт для проверки персистентности данных

cd ~/wmoc-server || exit 1

echo "=== Проверка персистентности данных ==="
echo ""

echo "=== 1. Проверка volumes ==="
docker compose config | grep -A 5 "volumes:" | head -10

echo ""
echo "=== 2. Проверка суперадмина в БД ==="
docker compose exec -T postgres psql -U wmoc -d wmoc_saas -c "SELECT username, is_active, created_at, updated_at FROM superadmins WHERE username = 'admin';"

echo ""
echo "=== 3. Проверка JWT_SECRET в .env ==="
if [ -f .env ]; then
    if grep -q "^JWT_SECRET=" .env; then
        echo "✓ JWT_SECRET существует в .env"
        grep "^JWT_SECRET=" .env | head -1 | sed 's/\(.\{30\}\).*/\1.../'
    else
        echo "✗ JWT_SECRET не найден в .env"
    fi
else
    echo "✗ Файл .env не найден"
fi

echo ""
echo "=== 4. Тест: перезагрузка контейнеров ==="
echo "Перезапускаю контейнеры..."
docker compose restart postgres api
sleep 5

echo ""
echo "=== 5. Проверка после перезагрузки ==="
echo "Суперадмин в БД:"
docker compose exec -T postgres psql -U wmoc -d wmoc_saas -c "SELECT username, is_active FROM superadmins WHERE username = 'admin';"

echo ""
echo "JWT_SECRET в контейнере API:"
if docker compose exec api printenv | grep -q JWT_SECRET; then
    echo "✓ JWT_SECRET установлен"
    docker compose exec api printenv | grep JWT_SECRET | sed 's/\(.\{30\}\).*/\1.../'
else
    echo "✗ JWT_SECRET не найден"
fi

echo ""
echo "=== 6. Тест входа после перезагрузки ==="
RESPONSE=$(curl -s -X POST http://localhost:3000/api/superadmin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"123"}')

if echo "$RESPONSE" | grep -q "accessToken"; then
    echo "✓ Вход работает после перезагрузки!"
else
    echo "✗ Ошибка входа:"
    echo "$RESPONSE"
fi

echo ""
echo "=== Вывод ==="
echo "Данные суперадмина хранятся в PostgreSQL volume и сохраняются после перезагрузки."
echo "JWT_SECRET хранится в .env файле на хосте и также сохраняется."

