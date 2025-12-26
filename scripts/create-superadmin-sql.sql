-- Создание суперадмина через SQL
-- Пароль: 123
-- Хеш генерируется через bcrypt.hash('123', 10)

-- Сначала проверим, существует ли уже суперадмин
DO $$
DECLARE
    admin_exists INTEGER;
BEGIN
    SELECT COUNT(*) INTO admin_exists FROM superadmins WHERE username = 'admin';
    
    IF admin_exists = 0 THEN
        -- Вставляем суперадмина с хешем пароля "123"
        -- Хеш будет сгенерирован через Node.js скрипт
        INSERT INTO superadmins (username, password_hash, is_active)
        VALUES ('admin', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', true);
        
        RAISE NOTICE 'Superadmin created: admin / 123';
    ELSE
        RAISE NOTICE 'Superadmin with username "admin" already exists';
    END IF;
END $$;

-- Проверка
SELECT id, username, is_active, created_at FROM superadmins WHERE username = 'admin';

