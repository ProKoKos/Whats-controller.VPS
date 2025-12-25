/**
 * Тестовый скрипт для проверки API подтверждения активации
 * Запуск: npx tsx scripts/test-confirm-activation.ts
 */

import { generateActivationCode } from '../src/utils/crypto';

const API_URL = process.env.API_URL || 'http://localhost:3000/api';

async function testConfirmActivation() {
  console.log('=== Тестирование API подтверждения активации ===\n');
  console.log(`API URL: ${API_URL}\n`);

  // Шаг 1: Инициация активации
  console.log('1. Инициация активации...');
  const activationCode = generateActivationCode();
  const testMac = 'AA:BB:CC:DD:EE:FF';
  
  try {
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
    console.log(`   Activation code: ${activationCode}`);
    console.log(`   Device authorization code: ${initiateData.device_authorization_code}`);
    console.log(`   Cabinet secret: ${initiateData.cabinet_secret?.substring(0, 20)}...`);
    
    const deviceCode = initiateData.device_authorization_code;
    
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
        firmware_version: '1.0.0'
      })
    });

    const confirmText = await confirmResponse.text();
    const confirmData = JSON.parse(confirmText);
    
    if (confirmResponse.ok) {
      console.log('   ✓ Активация подтверждена');
      console.log(`   Controller ID: ${confirmData.controller_id}`);
      console.log(`   Controller secret: ${confirmData.controller_secret?.substring(0, 20)}...`);
      console.log(`   Cabinet ID: ${confirmData.cabinet_id}`);
    } else {
      console.log('   ✗ Ошибка при подтверждении:', confirmData.error?.message || confirmText);
      console.log('   Статус:', confirmResponse.status);
    }
    
    // Шаг 3: Попытка повторного подтверждения (должна быть ошибка)
    console.log('\n3. Попытка повторного подтверждения...');
    const duplicateResponse = await fetch(`${API_URL}/controllers/confirm-activation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        activation_code: activationCode,
        device_authorization_code: deviceCode,
        mac_address: testMac
      })
    });

    const duplicateText = await duplicateResponse.text();
    const duplicateData = JSON.parse(duplicateText);
    
    if (duplicateResponse.status === 404) {
      console.log('   ✓ Корректно отклонен повторный запрос (код уже использован)');
    } else {
      console.log('   ⚠ Неожиданный статус:', duplicateResponse.status);
      console.log('   Ответ:', duplicateData.error?.message || duplicateText);
    }
    
    // Шаг 4: Попытка подтверждения с неправильным кодом
    console.log('\n4. Попытка подтверждения с неправильным device_authorization_code...');
    const wrongCodeResponse = await fetch(`${API_URL}/controllers/confirm-activation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        activation_code: generateActivationCode(),
        device_authorization_code: '999999',
        mac_address: '11:22:33:44:55:66'
      })
    });

    const wrongCodeText = await wrongCodeResponse.text();
    const wrongCodeData = JSON.parse(wrongCodeText);
    
    if (wrongCodeResponse.status === 404 || wrongCodeResponse.status === 401) {
      console.log('   ✓ Корректно отклонен запрос с неправильным кодом');
    } else {
      console.log('   ⚠ Неожиданный статус:', wrongCodeResponse.status);
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
    await testConfirmActivation();
  }
})();

