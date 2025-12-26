# Исправление проблемы входа суперадмина

## Проблема
Вход суперадмина не работает из-за отсутствия JWT_SECRET в переменных окружения.

## Решение

Выполните на сервере следующие команды:

```bash
cd ~/wmoc-server

# 1. Проверьте наличие JWT_SECRET
grep JWT_SECRET .env

# 2. Если JWT_SECRET отсутствует, добавьте его
if ! grep -q "^JWT_SECRET=" .env; then
    echo "" >> .env
    echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
    echo "JWT_EXPIRES_IN=15m" >> .env
    echo "✓ JWT_SECRET добавлен"
fi

# 3. Перезапустите API
docker compose restart api

# 4. Подождите 5 секунд
sleep 5

# 5. Проверьте, что JWT_SECRET установлен в контейнере
docker compose exec api printenv | grep JWT_SECRET

# 6. Проверьте суперадмина в БД
docker compose exec -T postgres psql -U wmoc -d wmoc_saas -c "SELECT username, is_active FROM superadmins WHERE username = 'admin';"

# 7. Протестируйте вход через API
curl -X POST http://localhost:3000/api/superadmin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"123"}'

# 8. Если всё работает, вы увидите JSON с accessToken
```

## Учетные данные суперадмина

- **URL входа:** https://wmoc.online/superadmin/login
- **Логин:** admin
- **Пароль:** 123

## После исправления

После выполнения команд попробуйте войти через веб-интерфейс:
https://wmoc.online/superadmin/login

