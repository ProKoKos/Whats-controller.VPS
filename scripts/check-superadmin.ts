/**
 * Скрипт для проверки существующих суперадминов
 * Запуск: npx tsx scripts/check-superadmin.ts
 */

import { getPool } from '../src/database';
import { initializeDatabase } from '../src/database';

async function checkSuperadmin() {
  try {
    // Инициализация БД
    await initializeDatabase();
    const pool = getPool();

    // Проверка существующих суперадминов
    const result = await pool.query(
      'SELECT id, username, is_active, created_at, last_login_at FROM superadmins ORDER BY created_at'
    );

    if (result.rows.length === 0) {
      console.log('❌ Суперадмины не найдены в базе данных.');
      console.log('\nДля создания суперадмина выполните:');
      console.log('  npx tsx scripts/create-superadmin.ts <username> <password>');
      console.log('\nПример:');
      console.log('  npx tsx scripts/create-superadmin.ts admin mypassword123');
      process.exit(0);
    }

    console.log(`✓ Найдено суперадминов: ${result.rows.length}\n`);

    result.rows.forEach((row, index) => {
      console.log(`Суперадмин #${index + 1}:`);
      console.log(`  ID: ${row.id}`);
      console.log(`  Username: ${row.username}`);
      console.log(`  Статус: ${row.is_active ? 'Активен' : 'Неактивен'}`);
      console.log(`  Создан: ${row.created_at}`);
      if (row.last_login_at) {
        console.log(`  Последний вход: ${row.last_login_at}`);
      } else {
        console.log(`  Последний вход: Никогда`);
      }
      console.log('');
    });

    process.exit(0);
  } catch (error: any) {
    console.error('Ошибка при проверке суперадминов:', error.message);
    process.exit(1);
  }
}

checkSuperadmin();

