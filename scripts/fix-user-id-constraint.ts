/**
 * Скрипт для исправления NOT NULL constraint на user_id
 * Запуск: npx tsx scripts/fix-user-id-constraint.ts
 */

import { initializeDatabase, getPool } from '../src/database';

async function fixUserIdConstraint() {
  try {
    await initializeDatabase();
    const pool = getPool();
    
    console.log('Удаление NOT NULL constraint с user_id...');
    await pool.query('ALTER TABLE controllers ALTER COLUMN user_id DROP NOT NULL;');
    console.log('✓ NOT NULL constraint удален');
    
    await pool.end();
  } catch (error: any) {
    if (error.message.includes('does not exist') || error.message.includes('column')) {
      console.log('⚠ Колонка user_id не существует или constraint уже удален');
    } else {
      console.error('✗ Ошибка:', error.message);
    }
  }
}

fixUserIdConstraint();

