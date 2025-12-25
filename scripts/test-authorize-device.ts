/**
 * Тестовый скрипт для проверки API авторизации устройства
 * Запуск: npx tsx scripts/test-authorize-device.ts
 */

import { generateActivationCode } from '../src/utils/crypto';
import { generateDeviceFingerprint } from '../src/utils/ed25519';
import * as ed25519Lib from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';
import crypto from 'crypto';

// Настройка SHA-512 для Ed25519
if (!ed25519Lib.hashes.sha512) {
  ed25519Lib.hashes.sha512 = (m: Uint8Array) => sha512(m);
  ed25519Lib.hashes.sha512Async = (m: Uint8Array) => Promise.resolve(sha512(m));
}

const { getPublicKey } = ed25519Lib;

const API_URL = process.env.API_URL || 'http://localhost:3000/api';

async function testAuthorizeDevice() {
  console.log('=== Тестирование API авторизации устройства ===\n');
  console.log(`API URL: ${API_URL}\n`);

  try {
    // Шаг 1: Создание кабинета и активация контроллера
    console.log('1. Создание кабинета и активация контроллера...');
    const activationCode = generateActivationCode();
    const testMac = `AA:BB:CC:DD:EE:${Math.floor(Math.random() * 256).toString(16).padStart(2, '0')}`;
    
    const initiateResponse = await fetch(`${API_URL}/activation/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        activation_code: activationCode,
        mac_address: testMac,
        action: 'create_cabinet'
      })
    });

    const initiateText = await initiateResponse.text();
    const initiateData = JSON.parse(initiateText);
    
    if (!initiateResponse.ok) {
      console.log('   ✗ Ошибка при инициации:', initiateData.error?.message || initiateText);
      return;
    }
    
    console.log('   ✓ Активация инициирована');
    const deviceCode = initiateData.device_authorization_code;
    const cabinetId = initiateData.cabinet_id;
    
    if (!cabinetId) {
      console.log('   ✗ Cabinet ID не получен');
      return;
    }
    
    console.log(`   Cabinet ID: ${cabinetId}`);
    
    // Шаг 2: Подтверждение активации контроллера
    console.log('\n2. Подтверждение активации контроллера...');
    const confirmResponse = await fetch(`${API_URL}/controllers/confirm-activation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        activation_code: activationCode,
        device_authorization_code: deviceCode,
        mac_address: testMac,
        firmware_version: '1.0.0-test'
      })
    });

    const confirmText = await confirmResponse.text();
    const confirmData = JSON.parse(confirmText);
    
    if (!confirmResponse.ok) {
      console.log('   ✗ Ошибка при подтверждении:', confirmData.error?.message || confirmText);
      return;
    }
    
    console.log('   ✓ Активация подтверждена');
    const controllerSecret = confirmData.controller_secret;
    
    // Шаг 3: Запрос доступа к кабинету
    console.log('\n3. Запрос доступа к кабинету...');
    const requestAccessResponse = await fetch(`${API_URL}/cabinets/request-access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cabinet_id: cabinetId
      })
    });

    const requestAccessText = await requestAccessResponse.text();
    const requestAccessData = JSON.parse(requestAccessText);
    
    if (!requestAccessResponse.ok) {
      console.log('   ✗ Ошибка при запросе доступа:', requestAccessData.error?.message || requestAccessText);
      return;
    }
    
    console.log('   ✓ Запрос доступа создан');
    const accessRequestCode = requestAccessData.access_request_code;
    
    // Шаг 4: Подтверждение доступа на контроллере
    console.log('\n4. Подтверждение доступа на контроллере...');
    const confirmAccessResponse = await fetch(`${API_URL}/cabinets/confirm-access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        controller_secret: controllerSecret,
        access_request_code: accessRequestCode
      })
    });

    const confirmAccessText = await confirmAccessResponse.text();
    const confirmAccessData = JSON.parse(confirmAccessText);
    
    if (!confirmAccessResponse.ok) {
      console.log('   ✗ Ошибка при подтверждении доступа:', confirmAccessData.error?.message || confirmAccessText);
      return;
    }
    
    console.log('   ✓ Доступ подтвержден');
    const sessionToken = confirmAccessData.session_token;
    console.log(`   Session token: ${sessionToken?.substring(0, 20)}...`);
    
    // Шаг 5: Генерация ключей Ed25519 для устройства
    console.log('\n5. Генерация ключей Ed25519 для устройства...');
    const privateKey = crypto.randomBytes(32);
    const publicKeyBytes = await getPublicKey(privateKey);
    const publicKey = Buffer.from(publicKeyBytes).toString('hex');
    
    console.log(`   Public key: ${publicKey.substring(0, 32)}...`);
    
    // Шаг 6: Генерация device_fingerprint
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    const screenResolution = '1920x1080';
    const timezone = 'Europe/Moscow';
    const deviceFingerprint = generateDeviceFingerprint(userAgent, screenResolution, timezone);
    
    console.log(`   Device fingerprint: ${deviceFingerprint.substring(0, 32)}...`);
    
    // Шаг 7: Авторизация устройства
    console.log('\n6. Авторизация устройства...');
    const authorizeResponse = await fetch(`${API_URL}/cabinets/authorize-device`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_token: sessionToken,
        device_fingerprint: deviceFingerprint,
        public_key: publicKey,
        user_agent: userAgent,
        screen_resolution: screenResolution,
        timezone: timezone
      })
    });

    const authorizeText = await authorizeResponse.text();
    const authorizeData = JSON.parse(authorizeText);
    
    if (authorizeResponse.ok) {
      console.log('   ✓ Устройство авторизовано');
      console.log(`   Device ID: ${authorizeData.device_id}`);
      console.log(`   Cabinet ID: ${authorizeData.cabinet_id}`);
      console.log(`   Message: ${authorizeData.message}`);
    } else {
      console.log('   ✗ Ошибка при авторизации устройства:', authorizeData.error?.message || authorizeText);
      console.log('   Статус:', authorizeResponse.status);
    }
    
    // Шаг 8: Повторная авторизация того же устройства
    console.log('\n7. Повторная авторизация того же устройства...');
    const reAuthorizeResponse = await fetch(`${API_URL}/cabinets/authorize-device`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_token: sessionToken,
        device_fingerprint: deviceFingerprint,
        public_key: publicKey
      })
    });

    const reAuthorizeText = await reAuthorizeResponse.text();
    const reAuthorizeData = JSON.parse(reAuthorizeText);
    
    if (reAuthorizeResponse.ok) {
      console.log('   ✓ Устройство повторно авторизовано (обновлен last_used_at)');
      console.log(`   Device ID: ${reAuthorizeData.device_id}`);
    } else {
      console.log('   ⚠ Неожиданный статус:', reAuthorizeResponse.status);
    }
    
    // Шаг 9: Попытка авторизации с неправильным session_token
    console.log('\n8. Попытка авторизации с неправильным session_token...');
    const wrongTokenResponse = await fetch(`${API_URL}/cabinets/authorize-device`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_token: 'invalid_token_12345',
        device_fingerprint: deviceFingerprint,
        public_key: publicKey
      })
    });

    const wrongTokenText = await wrongTokenResponse.text();
    const wrongTokenData = JSON.parse(wrongTokenText);
    
    if (wrongTokenResponse.status === 404) {
      console.log('   ✓ Корректно отклонен запрос с неправильным session_token');
    } else {
      console.log('   ⚠ Неожиданный статус:', wrongTokenResponse.status);
      console.log('   Ответ:', wrongTokenData.error?.message || wrongTokenText);
    }
    
    console.log('\n=== Тесты завершены ===');
  } catch (error: any) {
    console.error('Ошибка при тестировании:', error.message);
    console.error(error.stack);
  }
}

// Проверка доступности сервера
async function checkServer() {
  try {
    const response = await fetch(`${API_URL.replace('/api', '')}/health`);
    if (response.ok) {
      console.log('✓ Сервер доступен\n');
      return true;
    }
  } catch (error) {
    console.error('✗ Сервер недоступен. Убедитесь, что сервер запущен на порту 3000');
    console.error('  Запустите: npm run dev или npm start\n');
    return false;
  }
  return false;
}

(async () => {
  const serverAvailable = await checkServer();
  if (serverAvailable) {
    await testAuthorizeDevice();
  }
})();

