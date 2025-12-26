#!/bin/bash
# Скрипт для исправления пароля суперадмина

cd ~/wmoc-server || exit 1

echo "=== Исправление пароля суперадмина ==="
echo ""

# Генерируем новый хеш для пароля "123"
echo "Генерация нового хеша пароля..."
NEW_HASH=$(docker compose exec api node -e "const bcrypt = require('bcrypt'); bcrypt.hash('123', 10).then(h => { console.log(h); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });")

if [ -z "$NEW_HASH" ]; then
    echo "✗ Ошибка генерации хеша"
    exit 1
fi

echo "Новый хеш: ${NEW_HASH:0:30}..."
echo ""

# Обновляем пароль в БД
echo "Обновление пароля в БД..."
docker compose exec -T postgres psql -U wmoc -d wmoc_saas <<EOF
UPDATE superadmins 
SET password_hash = '$NEW_HASH', updated_at = CURRENT_TIMESTAMP 
WHERE username = 'admin';
SELECT username, is_active, updated_at FROM superadmins WHERE username = 'admin';
EOF

echo ""
echo "=== Проверка пароля ==="
docker compose exec api node -e "const bcrypt = require('bcrypt'); bcrypt.compare('123', '$NEW_HASH').then(r => { console.log('Password match:', r ? 'YES' : 'NO'); process.exit(r ? 0 : 1); }).catch(e => { console.error('Error:', e); process.exit(1); });"

echo ""
echo "=== Тест API входа ==="
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

