-- Добавление поля cabinet_secret в pending_activations для временного хранения
-- Это поле используется только для передачи cabinet_secret контроллеру при активации нового кабинета

ALTER TABLE pending_activations 
  ADD COLUMN IF NOT EXISTS cabinet_secret TEXT;

COMMENT ON COLUMN pending_activations.cabinet_secret IS 'Временное хранение cabinet_secret для передачи контроллеру (только для нового кабинета)';

