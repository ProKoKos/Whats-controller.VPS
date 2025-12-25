/**
 * Тестовый скрипт для проверки API подтверждения доступа к кабинету
 * Запуск: npx tsx scripts/test-confirm-access.ts
 */

import { generateActivationCode } from '../src/utils/crypto';

const API_URL = process.env.API_URL || 'http://localhost:3000/api';

async function testConfirmAccess() {
  console.log('=== Тестирование API подтверждения доступа к кабинету ===\n');
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
    const controllerId = confirmData.controller_id;
    console.log(`   Controller ID: ${controllerId}`);
    console.log(`   Controller secret: ${controllerSecret?.substring(0, 20)}...`);
    
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
    console.log(`   Access request code: ${accessRequestCode}`);
    
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
    
    if (confirmAccessResponse.ok) {
      console.log('   ✓ Доступ подтвержден');
      console.log(`   Session token: ${confirmAccessData.session_token?.substring(0, 20)}...`);
      console.log(`   Cabinet ID: ${confirmAccessData.cabinet_id}`);
      console.log(`   Message: ${confirmAccessData.message}`);
    } else {
      console.log('   ✗ Ошибка при подтверждении доступа:', confirmAccessData.error?.message || confirmAccessText);
      console.log('   Статус:', confirmAccessResponse.status);
    }
    
    // Шаг 5: Попытка повторного подтверждения (должна быть ошибка)
    console.log('\n5. Попытка повторного подтверждения...');
    const duplicateResponse = await fetch(`${API_URL}/cabinets/confirm-access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        controller_secret: controllerSecret,
        access_request_code: accessRequestCode
      })
    });

    const duplicateText = await duplicateResponse.text();
    const duplicateData = JSON.parse(duplicateText);
    
    if (duplicateResponse.status === 409) {
      console.log('   ✓ Корректно отклонен повторный запрос (код уже использован)');
    } else {
      console.log('   ⚠ Неожиданный статус:', duplicateResponse.status);
      console.log('   Ответ:', duplicateData.error?.message || duplicateText);
    }
    
    // Шаг 6: Попытка подтверждения с неправильным controller_secret
    console.log('\n6. Попытка подтверждения с неправильным controller_secret...');
    const wrongSecretResponse = await fetch(`${API_URL}/cabinets/confirm-access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        controller_secret: 'invalid_secret_12345',
        access_request_code: accessRequestCode
      })
    });

    const wrongSecretText = await wrongSecretResponse.text();
    const wrongSecretData = JSON.parse(wrongSecretText);
    
    if (wrongSecretResponse.status === 401) {
      console.log('   ✓ Корректно отклонен запрос с неправильным controller_secret');
    } else {
      console.log('   ⚠ Неожиданный статус:', wrongSecretResponse.status);
      console.log('   Ответ:', wrongSecretData.error?.message || wrongSecretText);
    }
    
    // Шаг 7: Попытка подтверждения с неправильным access_request_code
    console.log('\n7. Попытка подтверждения с неправильным access_request_code...');
    const wrongCodeResponse = await fetch(`${API_URL}/cabinets/confirm-access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        controller_secret: controllerSecret,
        access_request_code: '999999'
      })
    });

    const wrongCodeText = await wrongCodeResponse.text();
    const wrongCodeData = JSON.parse(wrongCodeText);
    
    if (wrongCodeResponse.status === 404) {
      console.log('   ✓ Корректно отклонен запрос с неправильным access_request_code');
    } else {
      console.log('   ⚠ Неожиданный статус:', wrongCodeResponse.status);
      console.log('   Ответ:', wrongCodeData.error?.message || wrongCodeText);
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
    await testConfirmAccess();
  }
})();

