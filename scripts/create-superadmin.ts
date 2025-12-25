/**
 * Скрипт для создания первого суперадмина
 * Запуск: npx tsx scripts/create-superadmin.ts <username> <password>
 */

import bcrypt from 'bcrypt';
import { getPool } from '../src/database';
import { initializeDatabase } from '../src/database';

async function createSuperadmin() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: npx tsx scripts/create-superadmin.ts <username> <password>');
    process.exit(1);
  }

  const username = args[0];
  const password = args[1];

  if (username.length < 3) {
    console.error('Username must be at least 3 characters long');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Password must be at least 8 characters long');
    process.exit(1);
  }

  try {
    // Инициализация БД
    await initializeDatabase();
    const pool = getPool();

    // Проверка существования суперадмина с таким username
    const existing = await pool.query(
      'SELECT id FROM superadmins WHERE username = $1',
      [username]
    );

    if (existing.rows.length > 0) {
      console.error(`Superadmin with username "${username}" already exists`);
      process.exit(1);
    }

    // Хеширование пароля
    const passwordHash = await bcrypt.hash(password, 10);

    // Создание суперадмина
    const result = await pool.query(
      `INSERT INTO superadmins (username, password_hash, is_active)
       VALUES ($1, $2, true)
       RETURNING id, username, created_at`,
      [username, passwordHash]
    );

    const superadmin = result.rows[0];

    console.log('✓ Superadmin created successfully!');
    console.log(`  ID: ${superadmin.id}`);
    console.log(`  Username: ${superadmin.username}`);
    console.log(`  Created at: ${superadmin.created_at}`);
    console.log('\nYou can now login at POST /api/superadmin/login');

    process.exit(0);
  } catch (error: any) {
    console.error('Error creating superadmin:', error.message);
    process.exit(1);
  }
}

createSuperadmin();

