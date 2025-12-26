#!/bin/bash
# Скрипт для получения секретов контроллера (для отладки)
# ВНИМАНИЕ: controller_secret хранится только в виде хеша, оригинал недоступен!

cd ~/wmoc-server || exit 1

CONTROLLER_MAC="14:33:5C:45:F4:A4"

echo "=== Информация о контроллере ==="
docker compose exec -T postgres psql -U wmoc -d wmoc_saas <<EOF
SELECT 
    c.id as controller_id,
    c.mac_address,
    c.is_active,
    c.cabinet_id,
    cab.id as cabinet_exists
FROM controllers c
LEFT JOIN cabinets cab ON cab.id = c.cabinet_id
WHERE c.mac_address = '$CONTROLLER_MAC';
EOF

echo ""
echo "=== ВАЖНО ==="
echo "controller_secret хранится только в виде хеша в БД."
echo "Оригинальный controller_secret был возвращен только при активации."
echo "Если секрет не был сохранен на контроллере, нужно:"
echo "1. Либо сбросить активацию и повторить процесс"
echo "2. Либо использовать суперадмин панель для сброса контроллера"

