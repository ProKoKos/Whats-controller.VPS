# Настройка VPS для разработки WMOC SaaS

## Рекомендуемая конфигурация

### Минимальная конфигурация (для начальной разработки)
- **CPU**: 2 ядра
- **RAM**: 2 GB
- **Диск**: 20 GB SSD
- **ОС**: Ubuntu Server 22.04 LTS или 24.04 LTS
- **Стоимость**: ~$5-8/месяц (DigitalOcean, Hetzner, Vultr)

### Рекомендуемая конфигурация (для комфортной разработки)
- **CPU**: 2-4 ядра
- **RAM**: 4 GB
- **Диск**: 40-60 GB SSD
- **ОС**: Ubuntu Server 22.04 LTS или 24.04 LTS
- **Стоимость**: ~$12-20/месяц

### Производительная конфигурация (для тестирования под нагрузкой)
- **CPU**: 4 ядра
- **RAM**: 8 GB
- **Диск**: 80 GB SSD
- **ОС**: Ubuntu Server 24.04 LTS
- **Стоимость**: ~$24-40/месяц

## Распределение ресурсов

При 4GB RAM:
- **PostgreSQL**: ~1-1.5 GB
- **Redis**: ~200-300 MB
- **Node.js приложение**: ~300-500 MB
- **Nginx**: ~50-100 MB
- **Система (Ubuntu)**: ~500-800 MB
- **Резерв**: ~1 GB (для пиковых нагрузок)

## Рекомендуемые провайдеры VPS

### 1. Hetzner (Рекомендуется для Европы)
- **Плюсы**: Отличное соотношение цена/качество, быстрые SSD, низкая задержка
- **Минусы**: Регистрация может потребовать верификации
- **Стартовая конфигурация**: CPX11 (2 vCPU, 4GB RAM, 80GB SSD) - ~€5/месяц

### 2. DigitalOcean
- **Плюсы**: Простая настройка, хорошая документация, стабильность
- **Минусы**: Чуть дороже
- **Стартовая конфигурация**: Basic Droplet (2 vCPU, 4GB RAM, 80GB SSD) - ~$24/месяц

### 3. Vultr
- **Плюсы**: Много локаций, хорошая производительность
- **Минусы**: Может быть дороже конкурентов
- **Стартовая конфигурация**: Regular Performance (2 vCPU, 4GB RAM, 80GB SSD) - ~$24/месяц

### 4. Contabo (Бюджетный вариант)
- **Плюсы**: Очень дешево, хорошее для разработки
- **Минусы**: Может быть медленнее при высокой нагрузке
- **Стартовая конфигурация**: VPS S (4 vCPU, 8GB RAM, 200GB SSD) - ~€5/месяц

## Операционная система

### Ubuntu Server 22.04 LTS (Рекомендуется)
- **Стабильность**: Отличная
- **Поддержка**: До 2027 года
- **Пакеты**: Широкий выбор, актуальные версии
- **Документация**: Огромное количество материалов

### Ubuntu Server 24.04 LTS (Альтернатива)
- **Стабильность**: Хорошая (более новая)
- **Поддержка**: До 2029 года
- **Пакеты**: Самые актуальные версии

### Установка Ubuntu Server
1. При создании VPS выберите Ubuntu Server 22.04/24.04 LTS
2. Добавьте SSH ключ для безопасного доступа
3. Запишите IP адрес сервера

## Начальная настройка сервера

### 1. Подключение к серверу

```bash
ssh root@your-server-ip
# или
ssh ubuntu@your-server-ip  # для некоторых провайдеров
```

### 2. Обновление системы

```bash
apt update && apt upgrade -y
```

### 3. Создание пользователя (если работаете от root)

```bash
adduser wmoc
usermod -aG sudo wmoc
su - wmoc
```

### 4. Настройка firewall

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### 5. Установка необходимых пакетов

```bash
# Node.js (опционально, только если нужны утилиты на хосте)
# Обычно не требуется, так как приложение работает в Docker
# curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
# sudo apt install -y nodejs

# Docker и Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Docker Compose (уже включен в новые версии Docker)
# Или установить отдельно:
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Caddy будет использоваться в Docker контейнере
# НЕ нужно устанавливать Nginx и Certbot на хост!

# Git
sudo apt install -y git

# PostgreSQL клиент (опционально, для миграций через Docker не нужен)
# sudo apt install -y postgresql-client
```

### 6. Настройка PostgreSQL и Redis

**Используйте Docker Compose (рекомендуется):**

Все приложения (PostgreSQL, Redis, API) будут работать в Docker контейнерах.

```bash
cd ~
git clone https://github.com/ProKoKos/Whats-controller.VPS.git wmoc-server
cd wmoc-server/server
cp .env.example .env
# Отредактируйте .env с реальными значениями

# Запустить только БД и Redis для начала
docker-compose -f docker-compose.prod.yml up -d postgres redis
```

> **Важно:** PostgreSQL и Redis устанавливаются в Docker, а не напрямую в ОС. Это обеспечивает изоляцию, простоту управления и обновлений. См. `docs/DEPLOYMENT_ARCHITECTURE.md` для деталей.

### 7. Настройка домена

```bash
# Убедитесь, что DNS записи настроены:
# A запись: wmoc.online -> ваш-ip-адрес
# A запись: *.wmoc.online -> ваш-ip-адрес (для поддоменов)
```

> **Важно:** SSL сертификаты будут автоматически получены Caddy при первом запуске. Ничего настраивать вручную не нужно!

### 8. Запуск всех сервисов

**Все сервисы (включая Caddy reverse proxy) запускаются в Docker:**

```bash
cd ~/wmoc-server/server

# Собрать и запустить все сервисы (Caddy, API, PostgreSQL, Redis)
docker-compose -f docker-compose.prod.yml up -d --build

# Caddy автоматически получит SSL сертификат при первом запуске
# Это может занять 1-2 минуты

# Проверить статус
docker-compose -f docker-compose.prod.yml ps

# Просмотр логов
docker-compose -f docker-compose.prod.yml logs -f

# Логи Caddy (SSL получение)
docker-compose -f docker-compose.prod.yml logs -f caddy
```

### 9. Применение миграций БД

```bash
# Скопировать SQL файл в контейнер
docker cp src/database/migrations/001_initial_schema.sql wmoc-postgres:/tmp/

# Выполнить миграцию
docker-compose -f docker-compose.prod.yml exec postgres psql -U wmoc -d wmoc_saas -f /tmp/001_initial_schema.sql
```

> **Примечание:** Все компоненты (Caddy, API, PostgreSQL, Redis) работают в Docker контейнерах. На хосте установлены только Docker, Git и firewall. См. `docs/DEPLOYMENT_CADDY.md` для подробностей.

## Мониторинг ресурсов

### Проверка использования ресурсов

```bash
# CPU и память
htop
# или
top

# Диск
df -h

# Сетевая активность
iftop

# Docker контейнеры
docker stats
```

### Настройка алертов

Можно настроить мониторинг через:
- UptimeRobot (бесплатный мониторинг)
- HetrixTools
- Prometheus + Grafana (для более продвинутого мониторинга)

## Рекомендации для продакшена

Когда проект перейдет в продакшен:

1. **Увеличьте RAM до 8GB+** для комфортной работы
2. **Настройте резервное копирование БД** (автоматические бэкапы)
3. **Используйте CDN** для статических файлов (Cloudflare)
4. **Настройте мониторинг** (Prometheus + Grafana)
5. **Настройте логирование** (ELK stack или аналог)
6. **Рассмотрите отдельные инстансы** для БД и приложения при росте нагрузки

## Бюджет на месяц (разработка)

- **VPS**: $5-20/месяц (в зависимости от конфигурации)
- **Домен**: ~$10-15/год (один раз)
- **SSL**: Бесплатно (Let's Encrypt)
- **Итого**: ~$5-20/месяц

## Быстрый старт (checklist)

- [ ] Выбрать провайдера VPS
- [ ] Создать VPS с Ubuntu Server 22.04/24.04 LTS
- [ ] Настроить SSH доступ
- [ ] Обновить систему
- [ ] Настроить firewall
- [ ] Установить Node.js, Docker, Nginx
- [ ] Настроить DNS записи для домена
- [ ] Клонировать репозиторий
- [ ] Настроить .env файл
- [ ] Запустить PostgreSQL и Redis (Docker Compose)
- [ ] Применить миграции БД
- [ ] Настроить Nginx
- [ ] Получить SSL сертификат
- [ ] Запустить приложение
- [ ] Проверить работу всех сервисов

