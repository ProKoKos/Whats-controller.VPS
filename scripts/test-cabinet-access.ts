/**
 * Тестовый скрипт для проверки API входа в кабинет
 * Запуск: npx tsx scripts/test-cabinet-access.ts
 */

import { generateActivationCode } from '../src/utils/crypto';
import { generateDeviceFingerprint, signMessage } from '../src/utils/ed25519';
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

async function testCabinetAccess() {
  console.log('=== Тестирование API входа в кабинет ===\n');
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
    const cabinetSecret = initiateData.cabinet_secret;
    
    if (!cabinetId || !cabinetSecret) {
      console.log('   ✗ Cabinet ID или Cabinet Secret не получены');
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
    const controllerSecret = confirmData.controller_secret;
    
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
    
    // Шаг 5: Генерация ключей Ed25519 для устройства
    console.log('\n5. Генерация ключей Ed25519 для устройства...');
    const privateKey = crypto.randomBytes(32);
    const publicKeyBytes = await getPublicKey(privateKey);
    const publicKey = Buffer.from(publicKeyBytes).toString('hex');
    
    // Шаг 6: Генерация device_fingerprint
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    const screenResolution = '1920x1080';
    const timezone = 'Europe/Moscow';
    const deviceFingerprint = generateDeviceFingerprint(userAgent, screenResolution, timezone);
    
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
    
    if (!authorizeResponse.ok) {
      console.log('   ✗ Ошибка при авторизации устройства:', authorizeData.error?.message || authorizeText);
      return;
    }
    
    console.log('   ✓ Устройство авторизовано');
    
    // Шаг 8: Вход в кабинет с Ed25519 подписью
    console.log('\n7. Вход в кабинет с Ed25519 подписью...');
    const message = `cabinet_access_${cabinetId}_${Date.now()}`;
    const signature = await signMessage(message, privateKey.toString('hex'));
    
    const accessResponse = await fetch(`${API_URL}/cabinets/access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cabinetSecret}`
      },
      body: JSON.stringify({
        signature: signature,
        message: message,
        device_fingerprint: deviceFingerprint
      })
    });

    const accessText = await accessResponse.text();
    const accessData = JSON.parse(accessText);
    
    if (accessResponse.ok) {
      console.log('   ✓ Доступ к кабинету получен');
      console.log(`   Access Token: ${accessData.accessToken?.substring(0, 30)}...`);
      console.log(`   Cabinet ID: ${accessData.cabinet_id}`);
      console.log(`   Device ID: ${accessData.device_id}`);
      console.log(`   Expires in: ${accessData.expires_in}`);
    } else {
      console.log('   ✗ Ошибка при доступе к кабинету:', accessData.error?.message || accessText);
      console.log('   Статус:', accessResponse.status);
    }
    
    // Шаг 9: Попытка входа с неправильным cabinet_secret
    console.log('\n8. Попытка входа с неправильным cabinet_secret...');
    const wrongSecretResponse = await fetch(`${API_URL}/cabinets/access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer invalid_secret_12345`
      },
      body: JSON.stringify({
        signature: signature,
        message: message,
        device_fingerprint: deviceFingerprint
      })
    });

    const wrongSecretText = await wrongSecretResponse.text();
    const wrongSecretData = JSON.parse(wrongSecretText);
    
    if (wrongSecretResponse.status === 401) {
      console.log('   ✓ Корректно отклонен запрос с неправильным cabinet_secret');
    } else {
      console.log('   ⚠ Неожиданный статус:', wrongSecretResponse.status);
      console.log('   Ответ:', wrongSecretData.error?.message || wrongSecretText);
    }
    
    // Шаг 10: Попытка входа с неправильной подписью
    console.log('\n9. Попытка входа с неправильной подписью...');
    const wrongSignatureResponse = await fetch(`${API_URL}/cabinets/access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cabinetSecret}`
      },
      body: JSON.stringify({
        signature: 'invalid_signature_12345',
        message: message,
        device_fingerprint: deviceFingerprint
      })
    });

    const wrongSignatureText = await wrongSignatureResponse.text();
    const wrongSignatureData = JSON.parse(wrongSignatureText);
    
    if (wrongSignatureResponse.status === 401) {
      console.log('   ✓ Корректно отклонен запрос с неправильной подписью');
    } else {
      console.log('   ⚠ Неожиданный статус:', wrongSignatureResponse.status);
      console.log('   Ответ:', wrongSignatureData.error?.message || wrongSignatureText);
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
    await testCabinetAccess();
  }
})();

