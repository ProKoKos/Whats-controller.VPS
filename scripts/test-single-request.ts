/**
 * Простой тест одного запроса
 */
import { generateActivationCode } from '../src/utils/crypto';

const API_URL = 'http://localhost:3000/api';

async function testSingleRequest() {
  const activationCode = generateActivationCode();
  
  console.log('Тестирование создания кабинета...');
  console.log(`Activation code: ${activationCode}`);
  
  try {
    const response = await fetch(`${API_URL}/activation/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        activation_code: activationCode,
        mac_address: 'AA:BB:CC:DD:EE:FF',
        action: 'create_cabinet'
      })
    });

    const text = await response.text();
    const data = JSON.parse(text);
    
    if (response.ok) {
      console.log('\n✓ Успешно!');
      console.log(`Device authorization code: ${data.device_authorization_code}`);
      console.log(`Cabinet secret: ${data.cabinet_secret}`);
      console.log(`Cabinet ID: ${data.cabinet_id}`);
      console.log(`Expires at: ${data.expires_at}`);
    } else {
      console.log('\n✗ Ошибка:', data.error?.message || text);
      console.log('Статус:', response.status);
    }
  } catch (error: any) {
    console.error('Ошибка:', error.message);
  }
}

testSingleRequest();


