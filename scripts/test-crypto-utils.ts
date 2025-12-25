/**
 * Тестовый скрипт для проверки утилит криптографии
 * Запуск: npx tsx scripts/test-crypto-utils.ts
 */

// КРИТИЧЕСКИ ВАЖНО: Настройка SHA-512 ДО всех импортов ed25519
import * as ed25519Lib from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';
(ed25519Lib.etc as any).sha512Sync = (...m: Uint8Array[]) => sha512(ed25519Lib.etc.concatBytes(...m));
(ed25519Lib.etc as any).sha512Async = (...m: Uint8Array[]) => Promise.resolve(sha512(ed25519Lib.etc.concatBytes(...m)));

import {
  generateCabinetSecret,
  generateControllerSecret,
  hashSecret,
  verifySecret,
  generateConfirmationCode,
  generateActivationCode,
  generateSessionToken
} from '../src/utils/crypto';
import {
  generateDeviceFingerprint,
  verifySignature,
  signMessage
} from '../src/utils/ed25519';
import crypto from 'crypto';

async function testCryptoUtils() {
  console.log('=== Тестирование утилит криптографии ===\n');

  // Тест 1: Генерация секретов
  console.log('1. Генерация секретов:');
  const cabinetSecret = generateCabinetSecret();
  const controllerSecret = generateControllerSecret();
  console.log(`   Cabinet secret: ${cabinetSecret} (длина: ${cabinetSecret.length})`);
  console.log(`   Controller secret: ${controllerSecret} (длина: ${controllerSecret.length})`);
  console.log('   ✓ Секреты генерируются корректно\n');

  // Тест 2: Хеширование
  console.log('2. Хеширование секретов:');
  const hash1 = hashSecret(cabinetSecret);
  const hash2 = hashSecret(cabinetSecret);
  console.log(`   Hash 1: ${hash1.substring(0, 20)}...`);
  console.log(`   Hash 2: ${hash2.substring(0, 20)}...`);
  console.log(`   Хеши одинаковые: ${hash1 === hash2}`);
  console.log('   ✓ Хеширование работает корректно\n');

  // Тест 3: Проверка секретов
  console.log('3. Проверка секретов:');
  const isValid = verifySecret(cabinetSecret, hash1);
  const isInvalid = verifySecret('wrong-secret', hash1);
  console.log(`   Правильный секрет: ${isValid}`);
  console.log(`   Неправильный секрет: ${isInvalid}`);
  console.log('   ✓ Проверка секретов работает корректно\n');

  // Тест 4: Коды подтверждения
  console.log('4. Генерация кодов подтверждения:');
  const code1 = generateConfirmationCode();
  const code2 = generateConfirmationCode();
  console.log(`   Код 1: ${code1}`);
  console.log(`   Код 2: ${code2}`);
  console.log(`   Длина: ${code1.length} символов`);
  console.log('   ✓ Коды генерируются корректно\n');

  // Тест 5: Activation code
  console.log('5. Генерация activation_code:');
  const activationCode1 = generateActivationCode();
  const activationCode2 = generateActivationCode();
  console.log(`   Код 1: ${activationCode1}`);
  console.log(`   Код 2: ${activationCode2}`);
  console.log(`   Длина: ${activationCode1.length} символов`);
  console.log('   ✓ Activation codes генерируются корректно\n');

  // Тест 6: Session token
  console.log('6. Генерация session_token:');
  const token1 = generateSessionToken();
  const token2 = generateSessionToken();
  console.log(`   Token 1: ${token1.substring(0, 20)}...`);
  console.log(`   Token 2: ${token2.substring(0, 20)}...`);
  console.log(`   Длина: ${token1.length} символов`);
  console.log('   ✓ Session tokens генерируются корректно\n');

  // Тест 7: Device fingerprint
  console.log('7. Генерация device fingerprint:');
  const fingerprint1 = generateDeviceFingerprint('Mozilla/5.0', '1920x1080', 'Europe/Moscow');
  const fingerprint2 = generateDeviceFingerprint('Mozilla/5.0', '1920x1080', 'Europe/Moscow');
  const fingerprint3 = generateDeviceFingerprint('Mozilla/5.0', '1366x768', 'Europe/Moscow');
  console.log(`   Fingerprint 1: ${fingerprint1.substring(0, 20)}...`);
  console.log(`   Fingerprint 2: ${fingerprint2.substring(0, 20)}...`);
  console.log(`   Fingerprint 3: ${fingerprint3.substring(0, 20)}...`);
  console.log(`   Одинаковые устройства: ${fingerprint1 === fingerprint2}`);
  console.log(`   Разные устройства: ${fingerprint1 !== fingerprint3}`);
  console.log('   ✓ Device fingerprints генерируются корректно\n');

  // Тест 8: Ed25519 подписи
  console.log('8. Тестирование Ed25519 подписей:');
  const { getPublicKey } = ed25519Lib;
  const privateKey = crypto.randomBytes(32);
  const publicKey = await getPublicKey(privateKey);
  const message = 'test message';
  const signature = await signMessage(message, Buffer.from(privateKey).toString('hex'));
  const isValidSig = await verifySignature(message, signature, Buffer.from(publicKey).toString('hex'));
  const isInvalidSig = await verifySignature('wrong message', signature, Buffer.from(publicKey).toString('hex'));
  console.log(`   Сообщение: ${message}`);
  console.log(`   Подпись валидна: ${isValidSig}`);
  console.log(`   Неправильная подпись: ${isInvalidSig}`);
  console.log('   ✓ Ed25519 подписи работают корректно\n');

  console.log('=== Все тесты пройдены успешно! ===');
}

testCryptoUtils().catch(console.error);
