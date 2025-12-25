/**
 * Тестовый скрипт для проверки API активации
 * Запуск: npx tsx scripts/test-activation-api.ts
 */

import { generateActivationCode } from '../src/utils/crypto';

const API_URL = process.env.API_URL || 'http://localhost:3000/api';

async function testActivationAPI() {
  console.log('=== Тестирование API активации ===\n');
  console.log(`API URL: ${API_URL}\n`);

  const testMac = 'AA:BB:CC:DD:EE:FF';
  const activationCode = generateActivationCode();

  // Тест 1: Создание нового кабинета
  console.log('1. Тест создания нового кабинета:');
  try {
    const response1 = await fetch(`${API_URL}/activation/initiate`, {
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

    const responseText1 = await response1.text();
    let data1;
    try {
      data1 = JSON.parse(responseText1);
    } catch (error) {
      console.log('   ✗ Ошибка парсинга ответа:', responseText1);
      console.log('   Статус:', response1.status);
      return;
    }
    
    if (response1.ok) {
      console.log('   ✓ Успешно создан кабинет');
      console.log(`   Device authorization code: ${data1.device_authorization_code}`);
      console.log(`   Expires at: ${data1.expires_at}`);
      if (data1.cabinet_secret) {
        console.log(`   Cabinet secret: ${data1.cabinet_secret.substring(0, 20)}...`);
        console.log(`   Cabinet ID: ${data1.cabinet_id}`);
        console.log('   ✓ Cabinet secret возвращен корректно');
        
        // Тест добавления в существующий кабинет с правильным секретом
        console.log('\n2a. Тест добавления в существующий кабинет с правильным секретом:');
        const response2a = await fetch(`${API_URL}/activation/initiate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            activation_code: generateActivationCode(),
            mac_address: '11:22:33:44:55:66',
            action: 'add_to_cabinet',
            cabinet_secret: data1.cabinet_secret
          })
        });

        const data2a = await response2a.json();
        if (response2a.ok && data2a.device_authorization_code) {
          console.log('   ✓ Успешно добавлен в существующий кабинет');
          console.log(`   Device authorization code: ${data2a.device_authorization_code}`);
        } else {
          console.log('   ✗ Ошибка при добавлении в кабинет:', data2a.error?.message || 'Unknown error');
        }
      }
      
      // Тест 2: Попытка использовать тот же activation_code
      console.log('\n2. Тест повторного использования activation_code:');
      const response2 = await fetch(`${API_URL}/activation/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          activation_code: activationCode,
          mac_address: '11:22:33:44:55:66',
          action: 'create_cabinet'
        })
      });

      const data2 = await response2.json();
      if (response2.status === 409) {
        console.log('   ✓ Корректно отклонен повторный запрос');
      } else {
        console.log('   ✗ Ожидалась ошибка 409, получен статус:', response2.status);
      }

      // Тест 3: Добавление в существующий кабинет (с неправильным секретом)
      console.log('\n3. Тест добавления в кабинет с неправильным секретом:');
      const response3 = await fetch(`${API_URL}/activation/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          activation_code: generateActivationCode(),
          mac_address: '11:22:33:44:55:66',
          action: 'add_to_cabinet',
          cabinet_secret: 'wrong-secret'
        })
      });

      const data3 = await response3.json();
      if (response3.status === 401) {
        console.log('   ✓ Корректно отклонен запрос с неправильным секретом');
      } else {
        console.log('   ✗ Ожидалась ошибка 401, получен статус:', response3.status);
      }

      // Тест 4: Валидация данных
      console.log('\n4. Тест валидации данных:');
      const response4 = await fetch(`${API_URL}/activation/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          activation_code: 'short', // слишком короткий
          mac_address: 'invalid-mac',
          action: 'invalid_action'
        })
      });

      const data4 = await response4.json();
      if (response4.status === 400) {
        console.log('   ✓ Корректно отклонен запрос с невалидными данными');
      } else {
        console.log('   ✗ Ожидалась ошибка 400, получен статус:', response4.status);
      }

      // Тест 5: Rate limiting (попытка превысить лимит)
      console.log('\n5. Тест rate limiting:');
      let rateLimitHit = false;
      for (let i = 0; i < 12; i++) {
        const response = await fetch(`${API_URL}/activation/initiate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            activation_code: generateActivationCode(),
            mac_address: testMac,
            action: 'create_cabinet'
          })
        });
        
        if (response.status === 429) {
          rateLimitHit = true;
          console.log(`   ✓ Rate limit сработал на запросе ${i + 1}`);
          break;
        }
      }
      
      if (!rateLimitHit) {
        console.log('   ⚠ Rate limiting не сработал (возможно, лимит выше)');
      }

      console.log('\n=== Тесты завершены ===');
    } else {
      console.log('   ✗ Ошибка:', data1.error?.message || 'Unknown error');
      console.log('   Статус:', response1.status);
    }
  } catch (error) {
    console.error('   ✗ Ошибка при тестировании:', error);
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
    await testActivationAPI();
  }
})();

