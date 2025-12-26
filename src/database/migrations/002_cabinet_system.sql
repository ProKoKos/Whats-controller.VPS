-- =====================================================
-- Миграция 002: Система кабинетов без персональных данных
-- Дата: 2024-12-19
-- Описание: Замена системы users на cabinets, добавление
--           функционала активации и суперадминов
-- =====================================================

-- Кабинеты (заменяет users)
CREATE TABLE IF NOT EXISTS cabinets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_secret_hash VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cabinets_secret_hash ON cabinets(cabinet_secret_hash);
CREATE INDEX idx_cabinets_created_at ON cabinets(created_at);

-- Обновление таблицы controllers: замена user_id на cabinet_id
-- Сначала добавляем новую колонку
ALTER TABLE controllers 
  ADD COLUMN IF NOT EXISTS cabinet_id UUID REFERENCES cabinets(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS controller_secret_hash VARCHAR(255) UNIQUE;

-- Удаляем NOT NULL constraint с user_id (для обратной совместимости оставляем колонку)
ALTER TABLE controllers 
  ALTER COLUMN user_id DROP NOT NULL;

-- Создаем индекс для cabinet_id
CREATE INDEX IF NOT EXISTS idx_controllers_cabinet_id ON controllers(cabinet_id);
CREATE INDEX IF NOT EXISTS idx_controllers_secret_hash ON controllers(controller_secret_hash);

-- Ожидающие активации (временная таблица)
CREATE TABLE IF NOT EXISTS pending_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activation_code VARCHAR(12) UNIQUE NOT NULL,
  cabinet_id UUID REFERENCES cabinets(id) ON DELETE CASCADE,
  device_authorization_code VARCHAR(6) NOT NULL,
  controller_mac VARCHAR(17),
  cabinet_secret TEXT, -- Временное хранение cabinet_secret для передачи контроллеру (только для нового кабинета)
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pending_activations_code ON pending_activations(activation_code);
CREATE INDEX idx_pending_activations_expires ON pending_activations(expires_at);
CREATE INDEX idx_pending_activations_cabinet ON pending_activations(cabinet_id);

-- Запросы на доступ к кабинету (временная таблица)
CREATE TABLE IF NOT EXISTS pending_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id UUID REFERENCES cabinets(id) ON DELETE CASCADE,
  access_request_code VARCHAR(6) UNIQUE NOT NULL,
  session_token VARCHAR(255) UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP,
  confirmed_by_controller_id UUID REFERENCES controllers(id)
);

CREATE INDEX idx_pending_access_requests_code ON pending_access_requests(access_request_code);
CREATE INDEX idx_pending_access_requests_expires ON pending_access_requests(expires_at);
CREATE INDEX idx_pending_access_requests_cabinet ON pending_access_requests(cabinet_id);
CREATE INDEX idx_pending_access_requests_session_token ON pending_access_requests(session_token);

-- Авторизованные устройства
CREATE TABLE IF NOT EXISTS authorized_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id UUID REFERENCES cabinets(id) ON DELETE CASCADE,
  device_fingerprint VARCHAR(255) NOT NULL,
  public_key TEXT NOT NULL,
  authorized_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(cabinet_id, device_fingerprint)
);

CREATE INDEX idx_authorized_devices_cabinet ON authorized_devices(cabinet_id);
CREATE INDEX idx_authorized_devices_fingerprint ON authorized_devices(device_fingerprint);

-- Суперадмины (для технической поддержки и управления)
CREATE TABLE IF NOT EXISTS superadmins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_superadmins_username ON superadmins(username);
CREATE INDEX idx_superadmins_active ON superadmins(is_active);

-- Триггер для updated_at в superadmins
CREATE TRIGGER update_superadmins_updated_at BEFORE UPDATE ON superadmins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Триггер для last_activity в cabinets
CREATE OR REPLACE FUNCTION update_cabinet_last_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE cabinets 
    SET last_activity = CURRENT_TIMESTAMP 
    WHERE id = NEW.cabinet_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Автоматическое обновление last_activity при активности контроллеров
CREATE TRIGGER update_cabinet_activity_on_controller_update
  AFTER UPDATE OF last_seen_at ON controllers
  FOR EACH ROW
  WHEN (NEW.cabinet_id IS NOT NULL)
  EXECUTE FUNCTION update_cabinet_last_activity();

-- Автоматическое обновление last_activity при использовании устройств
CREATE TRIGGER update_cabinet_activity_on_device_use
  AFTER UPDATE OF last_used_at ON authorized_devices
  FOR EACH ROW
  EXECUTE FUNCTION update_cabinet_last_activity();

-- Комментарии к таблицам
COMMENT ON TABLE cabinets IS 'Кабинеты пользователей (анонимные, без персональных данных)';
COMMENT ON TABLE pending_activations IS 'Временная таблица для ожидающих активации контроллеров';
COMMENT ON TABLE pending_access_requests IS 'Временная таблица для запросов доступа к кабинетам';
COMMENT ON TABLE authorized_devices IS 'Авторизованные устройства для доступа к кабинетам';
COMMENT ON TABLE superadmins IS 'Суперадмины для технической поддержки и управления системой';

COMMENT ON COLUMN cabinets.cabinet_secret_hash IS 'SHA-256 хеш секрета кабинета';
COMMENT ON COLUMN controllers.controller_secret_hash IS 'SHA-256 хеш секрета контроллера';
COMMENT ON COLUMN pending_activations.activation_code IS '12-символьный код активации с контроллера';
COMMENT ON COLUMN pending_activations.device_authorization_code IS '6-значный код для подтверждения на контроллере';
COMMENT ON COLUMN pending_access_requests.access_request_code IS '6-значный код для подтверждения доступа';
COMMENT ON COLUMN authorized_devices.device_fingerprint IS 'SHA-256 хеш характеристик устройства';

