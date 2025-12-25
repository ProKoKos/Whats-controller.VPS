/**
 * Тестовый скрипт для проверки API запроса доступа к кабинету
 * Запуск: npx tsx scripts/test-request-access.ts
 */

import { generateActivationCode } from '../src/utils/crypto';

const API_URL = process.env.API_URL || 'http://localhost:3000/api';

async function testRequestAccess() {
  console.log('=== Тестирование API запроса доступа к кабинету ===\n');
  console.log(`API URL: ${API_URL}\n`);

  try {
    // Шаг 1: Создание кабинета через активацию контроллера
    console.log('1. Создание кабинета через активацию контроллера...');
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
    
    if (!cabinetId) {
      console.log('   ✗ Cabinet ID не получен');
      return;
    }
    
    console.log(`   Cabinet ID: ${cabinetId}`);
    
    // Шаг 2: Подтверждение активации
    console.log('\n2. Подтверждение активации...');
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
    
    if (requestAccessResponse.ok) {
      console.log('   ✓ Запрос доступа создан');
      console.log(`   Access request code: ${requestAccessData.access_request_code}`);
      console.log(`   Expires at: ${requestAccessData.expires_at}`);
      console.log(`   Message: ${requestAccessData.message}`);
    } else {
      console.log('   ✗ Ошибка при запросе доступа:', requestAccessData.error?.message || requestAccessText);
      console.log('   Статус:', requestAccessResponse.status);
    }
    
    // Шаг 4: Попытка запроса доступа с несуществующим cabinet_id
    console.log('\n4. Попытка запроса доступа с несуществующим cabinet_id...');
    const fakeCabinetId = '00000000-0000-0000-0000-000000000000';
    const invalidResponse = await fetch(`${API_URL}/cabinets/request-access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cabinet_id: fakeCabinetId
      })
    });

    const invalidText = await invalidResponse.text();
    const invalidData = JSON.parse(invalidText);
    
    if (invalidResponse.status === 404) {
      console.log('   ✓ Корректно отклонен запрос с несуществующим cabinet_id');
    } else {
      console.log('   ⚠ Неожиданный статус:', invalidResponse.status);
      console.log('   Ответ:', invalidData.error?.message || invalidText);
    }
    
    // Шаг 5: Попытка запроса доступа с невалидным UUID
    console.log('\n5. Попытка запроса доступа с невалидным UUID...');
    const invalidUuidResponse = await fetch(`${API_URL}/cabinets/request-access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cabinet_id: 'invalid-uuid'
      })
    });

    const invalidUuidText = await invalidUuidResponse.text();
    const invalidUuidData = JSON.parse(invalidUuidText);
    
    if (invalidUuidResponse.status === 400) {
      console.log('   ✓ Корректно отклонен запрос с невалидным UUID');
    } else {
      console.log('   ⚠ Неожиданный статус:', invalidUuidResponse.status);
      console.log('   Ответ:', invalidUuidData.error?.message || invalidUuidText);
    }
    
    // Шаг 6: Проверка rate limiting (множественные запросы)
    console.log('\n6. Проверка rate limiting...');
    let rateLimitHit = false;
    for (let i = 0; i < 12; i++) {
      const rateLimitResponse = await fetch(`${API_URL}/cabinets/request-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cabinet_id: cabinetId
        })
      });
      
      if (rateLimitResponse.status === 429) {
        rateLimitHit = true;
        console.log(`   ✓ Rate limiting сработал после ${i + 1} запросов`);
        break;
      }
    }
    
    if (!rateLimitHit) {
      console.log('   ⚠ Rate limiting не сработал (возможно, нужно больше запросов)');
    }
    
    console.log('\n=== Тесты завершены ===');
  } catch (error: any) {
    console.error('Ошибка при тестировании:', error.message);
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
    await testRequestAccess();
  }
})();

