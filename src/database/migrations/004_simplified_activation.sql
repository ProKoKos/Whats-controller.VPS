-- =====================================================
-- Миграция 004: Упрощенная активация контроллеров
-- Дата: 2025-12-26
-- Описание: Упрощенная система активации без кабинетов,
--           PIN-коды для доступа, Ed25519 авторизация устройств
-- =====================================================

-- 1. Обновление таблицы controllers
-- Удаляем зависимость от user_id и cabinet_id (делаем nullable)
ALTER TABLE controllers 
  ALTER COLUMN user_id DROP NOT NULL,
  ALTER COLUMN cabinet_id DROP NOT NULL;

-- Удаляем старые колонки, которые не нужны
ALTER TABLE controllers 
  DROP COLUMN IF EXISTS activation_token;

-- Убеждаемся, что controller_secret_hash есть и не NULL
ALTER TABLE controllers 
  ALTER COLUMN controller_secret_hash SET NOT NULL;

-- 2. Создание таблицы controller_pins
CREATE TABLE IF NOT EXISTS controller_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  controller_id UUID NOT NULL REFERENCES controllers(id) ON DELETE CASCADE,
  pin VARCHAR(8) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(controller_id, pin)
);

CREATE INDEX IF NOT EXISTS idx_controller_pins_controller ON controller_pins(controller_id);
CREATE INDEX IF NOT EXISTS idx_controller_pins_pin ON controller_pins(pin);
CREATE INDEX IF NOT EXISTS idx_controller_pins_expires ON controller_pins(expires_at);

-- 3. Обновление таблицы authorized_devices
-- Удаляем старую версию (если существует с cabinet_id)
DROP TABLE IF EXISTS authorized_devices CASCADE;

-- Создаем новую версию с controller_id
CREATE TABLE authorized_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  controller_id UUID NOT NULL REFERENCES controllers(id) ON DELETE CASCADE,
  device_name VARCHAR(255),
  public_key TEXT NOT NULL, -- Ed25519 публичный ключ (base64)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP,
  UNIQUE(controller_id, public_key)
);

CREATE INDEX idx_authorized_devices_controller ON authorized_devices(controller_id);
CREATE INDEX idx_authorized_devices_public_key ON authorized_devices(public_key);

-- 4. Удаление старых таблиц (больше не нужны)
DROP TABLE IF EXISTS pending_activations CASCADE;
DROP TABLE IF EXISTS pending_access_requests CASCADE;

-- 5. Таблица cabinets (для будущего использования, если еще не создана)
-- Оставляем как есть, но не используем в упрощенной активации

-- Комментарии к таблицам
COMMENT ON TABLE controller_pins IS 'PIN-коды для доступа к контроллерам на сервере (обновляются каждые 15 минут)';
COMMENT ON TABLE authorized_devices IS 'Авторизованные устройства для доступа к контроллерам через Ed25519';

COMMENT ON COLUMN controller_pins.pin IS '8-значный PIN-код для доступа';
COMMENT ON COLUMN authorized_devices.public_key IS 'Ed25519 публичный ключ устройства (base64)';
COMMENT ON COLUMN authorized_devices.device_name IS 'Имя устройства (опционально)';

