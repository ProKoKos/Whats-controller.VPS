/**
 * Тестовый скрипт для проверки WebSocket регистрации контроллера
 * Запуск: npx tsx scripts/test-websocket-registration.ts
 */

import WebSocket from 'ws';
import { generateActivationCode } from '../src/utils/crypto';
import crypto from 'crypto';

const API_URL = process.env.API_URL || 'http://localhost:3000/api';
const WS_URL = process.env.WS_URL || 'ws://localhost:3000/tunnel';

// Генерация случайного MAC адреса для теста
function generateRandomMac(): string {
  const bytes = crypto.randomBytes(6);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join(':');
}

async function testWebSocketRegistration() {
  console.log('=== Тестирование WebSocket регистрации ===\n');
  console.log(`API URL: ${API_URL}`);
  console.log(`WebSocket URL: ${WS_URL}\n`);

  try {
    // Шаг 1: Активация контроллера через API
    console.log('1. Активация контроллера через API...');
    const activationCode = generateActivationCode();
    const testMac = generateRandomMac();
    console.log(`   Используется MAC: ${testMac}`);
    
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
    console.log(`   Controller ID: ${confirmData.controller_id}`);
    console.log(`   Controller secret: ${confirmData.controller_secret?.substring(0, 20)}...`);
    
    const controllerSecret = confirmData.controller_secret;
    const controllerId = confirmData.controller_id;
    
    // Шаг 3: Подключение к WebSocket и регистрация
    console.log('\n3. Подключение к WebSocket...');
    
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      
      ws.on('open', () => {
        console.log('   ✓ WebSocket подключен');
        
        // Отправка сообщения регистрации
        console.log('\n4. Отправка сообщения регистрации...');
        const registerMessage = {
          type: 'register',
          controller_secret: controllerSecret,
          firmwareVersion: '1.0.0-test'
        };
        
        ws.send(JSON.stringify(registerMessage));
        console.log('   ✓ Сообщение отправлено');
      });
      
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('\n5. Получен ответ от сервера:');
          console.log('   ', JSON.stringify(message, null, 2));
          
          if (message.type === 'registered') {
            console.log('\n   ✓ Регистрация успешна!');
            console.log(`   Controller ID: ${message.controllerId}`);
            console.log(`   Status: ${message.status}`);
            
            // Проверка, что controllerId совпадает
            if (message.controllerId === controllerId) {
              console.log('   ✓ Controller ID совпадает');
            } else {
              console.log('   ✗ Controller ID не совпадает!');
            }
            
            // Закрываем соединение
            setTimeout(() => {
              ws.close();
              console.log('\n6. Соединение закрыто');
              console.log('\n=== Тесты завершены успешно ===');
              resolve();
            }, 1000);
          } else if (message.type === 'error') {
            console.log('\n   ✗ Ошибка регистрации:', message.message);
            ws.close();
            reject(new Error(message.message));
          }
        } catch (error: any) {
          console.error('   ✗ Ошибка при парсинге сообщения:', error.message);
          ws.close();
          reject(error);
        }
      });
      
      ws.on('error', (error) => {
        console.error('   ✗ Ошибка WebSocket:', error.message);
        reject(error);
      });
      
      ws.on('close', () => {
        console.log('   WebSocket соединение закрыто');
      });
      
      // Таймаут для теста
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          console.log('\n   ⚠ Таймаут ожидания ответа');
          ws.close();
          reject(new Error('Timeout waiting for response'));
        }
      }, 10000);
    });
    
  } catch (error: any) {
    console.error('\n✗ Ошибка при тестировании:', error.message);
    throw error;
  }
}

// Тест с неправильным секретом
async function testInvalidSecret() {
  console.log('\n=== Тест с неправильным controller_secret ===\n');
  
  return new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    
    ws.on('open', () => {
      console.log('✓ WebSocket подключен');
      
      const registerMessage = {
        type: 'register',
        controller_secret: 'invalid_secret_12345',
        firmwareVersion: '1.0.0-test'
      };
      
      ws.send(JSON.stringify(registerMessage));
      console.log('✓ Сообщение с неправильным секретом отправлено');
    });
    
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('\nПолучен ответ:', JSON.stringify(message, null, 2));
        
        if (message.type === 'error') {
          console.log('✓ Корректно отклонен запрос с неправильным секретом');
          ws.close();
          resolve();
        } else {
          console.log('✗ Неожиданный ответ:', message);
          ws.close();
          reject(new Error('Expected error message'));
        }
      } catch (error: any) {
        console.error('✗ Ошибка при парсинге:', error.message);
        ws.close();
        reject(error);
      }
    });
    
    ws.on('error', (error) => {
      console.error('✗ Ошибка WebSocket:', error.message);
      reject(error);
    });
    
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
        reject(new Error('Timeout'));
      }
    }, 5000);
  });
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
    try {
      await testWebSocketRegistration();
      await testInvalidSecret();
      console.log('\n=== Все тесты завершены ===');
    } catch (error: any) {
      console.error('\n✗ Тесты завершились с ошибкой:', error.message);
      process.exit(1);
    }
  }
})();

