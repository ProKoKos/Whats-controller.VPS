#!/bin/bash
# Скрипт для исправления проблемы входа суперадмина

set -e

cd ~/wmoc-server || exit 1

echo "=== Проверка JWT_SECRET ==="
if ! grep -q "^JWT_SECRET=" .env 2>/dev/null; then
    echo "JWT_SECRET не найден, добавляю..."
    echo "" >> .env
    echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
    echo "JWT_EXPIRES_IN=15m" >> .env
    echo "✓ JWT_SECRET добавлен в .env"
else
    echo "✓ JWT_SECRET уже существует в .env"
fi

echo ""
echo "=== Текущие JWT настройки ==="
grep JWT .env || echo "JWT настройки не найдены"

echo ""
echo "=== Перезапуск API ==="
docker compose restart api
sleep 5

echo ""
echo "=== Проверка JWT_SECRET в контейнере ==="
docker compose exec api printenv | grep JWT || echo "JWT_SECRET не найден в контейнере"

echo ""
echo "=== Проверка суперадмина в БД ==="
docker compose exec -T postgres psql -U wmoc -d wmoc_saas -c "SELECT username, is_active, created_at FROM superadmins WHERE username = 'admin';"

echo ""
echo "=== Тест проверки пароля ==="
docker compose exec api node -e "const bcrypt = require('bcrypt'); bcrypt.compare('123', '\$2b\$10\$ENSrAxg7Y3Ilcaue5Y50sON/WCXq0oFsXN32c.cJYr/r4gx/70QkW').then(r => { console.log('Password match:', r ? 'YES' : 'NO'); process.exit(r ? 0 : 1); }).catch(e => { console.error('Error:', e); process.exit(1); });"

echo ""
echo "=== Тест API входа ==="
curl -s -X POST http://localhost:3000/api/superadmin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"123"}' | head -5

echo ""
echo "=== Готово ==="

