/**
 * Скрипт для проверки миграции БД
 * Запуск: npx tsx scripts/check-migration.ts
 */

import { initializeDatabase, getPool } from '../src/database';

async function checkMigration() {
  try {
    await initializeDatabase();
    const pool = getPool();

    console.log('=== Проверка миграции 002_cabinet_system ===\n');

    // Проверка таблиц
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('Созданные таблицы:');
    tablesResult.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });

    // Проверка новых таблиц
    const newTables = ['cabinets', 'pending_activations', 'pending_access_requests', 'authorized_devices', 'superadmins'];
    console.log('\nПроверка новых таблиц:');
    for (const table of newTables) {
      const exists = tablesResult.rows.some(row => row.table_name === table);
      console.log(`  ${exists ? '✓' : '✗'} ${table}`);
    }

    // Проверка структуры cabinets
    console.log('\nСтруктура таблицы cabinets:');
    const cabinetsColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'cabinets'
      ORDER BY ordinal_position
    `);
    cabinetsColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'NOT NULL'})`);
    });

    // Проверка структуры superadmins
    console.log('\nСтруктура таблицы superadmins:');
    const superadminsColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'superadmins'
      ORDER BY ordinal_position
    `);
    superadminsColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'NOT NULL'})`);
    });

    // Проверка индексов
    console.log('\nПроверка индексов:');
    const indexesResult = await pool.query(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename IN ('cabinets', 'pending_activations', 'pending_access_requests', 'authorized_devices', 'superadmins')
      ORDER BY tablename, indexname
    `);
    indexesResult.rows.forEach(idx => {
      console.log(`  ✓ ${idx.tablename}.${idx.indexname}`);
    });

    // Проверка триггеров
    console.log('\nПроверка триггеров:');
    const triggersResult = await pool.query(`
      SELECT trigger_name, event_object_table
      FROM information_schema.triggers
      WHERE event_object_schema = 'public'
      AND event_object_table IN ('cabinets', 'superadmins', 'controllers', 'authorized_devices')
      ORDER BY event_object_table, trigger_name
    `);
    triggersResult.rows.forEach(trg => {
      console.log(`  ✓ ${trg.event_object_table}.${trg.trigger_name}`);
    });

    // Проверка изменений в controllers
    console.log('\nПроверка изменений в таблице controllers:');
    const controllersColumns = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'controllers'
      AND column_name IN ('cabinet_id', 'controller_secret_hash', 'user_id')
      ORDER BY column_name
    `);
    const hasCabinetId = controllersColumns.rows.some(col => col.column_name === 'cabinet_id');
    const hasSecretHash = controllersColumns.rows.some(col => col.column_name === 'controller_secret_hash');
    console.log(`  ${hasCabinetId ? '✓' : '✗'} cabinet_id добавлен`);
    console.log(`  ${hasSecretHash ? '✓' : '✗'} controller_secret_hash добавлен`);

    // Проверка счетчиков записей
    console.log('\nКоличество записей в новых таблицах:');
    const counts = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM cabinets) as cabinets,
        (SELECT COUNT(*) FROM pending_activations) as pending_activations,
        (SELECT COUNT(*) FROM pending_access_requests) as pending_access_requests,
        (SELECT COUNT(*) FROM authorized_devices) as authorized_devices,
        (SELECT COUNT(*) FROM superadmins) as superadmins
    `);
    const count = counts.rows[0];
    console.log(`  cabinets: ${count.cabinets}`);
    console.log(`  pending_activations: ${count.pending_activations}`);
    console.log(`  pending_access_requests: ${count.pending_access_requests}`);
    console.log(`  authorized_devices: ${count.authorized_devices}`);
    console.log(`  superadmins: ${count.superadmins}`);

    console.log('\n=== Миграция успешно применена! ===');
    process.exit(0);
  } catch (error) {
    console.error('Ошибка при проверке миграции:', error);
    process.exit(1);
  }
}

checkMigration();

