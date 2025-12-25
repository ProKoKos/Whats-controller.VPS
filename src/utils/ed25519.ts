import * as ed25519Lib from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';
import crypto from 'crypto';

// Настройка SHA-512 для Ed25519 (должно быть сделано до импорта функций)
(ed25519Lib.etc as any).sha512Sync = (...m: Uint8Array[]) => sha512(ed25519Lib.etc.concatBytes(...m));
(ed25519Lib.etc as any).sha512Async = (...m: Uint8Array[]) => Promise.resolve(sha512(ed25519Lib.etc.concatBytes(...m)));

// Теперь импортируем функции после настройки
const { sign, verify } = ed25519Lib;

/**
 * Генерирует device fingerprint на основе характеристик устройства
 * @param userAgent User-Agent браузера
 * @param screenResolution Разрешение экрана (например, "1920x1080")
 * @param timezone Часовой пояс (например, "Europe/Moscow")
 * @returns Хеш fingerprint
 */
export function generateDeviceFingerprint(
  userAgent: string,
  screenResolution?: string,
  timezone?: string
): string {
  const data = [
    userAgent,
    screenResolution || '',
    timezone || ''
  ].join('|');
  
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Проверяет подпись Ed25519
 * @param message Сообщение для проверки
 * @param signature Подпись в формате hex
 * @param publicKey Публичный ключ в формате hex
 * @returns true если подпись валидна
 */
export async function verifySignature(
  message: string,
  signature: string,
  publicKey: string
): Promise<boolean> {
  try {
    const messageBytes = Buffer.from(message, 'utf-8');
    const signatureBytes = Buffer.from(signature, 'hex');
    const publicKeyBytes = Buffer.from(publicKey, 'hex');
    
    return await verify(signatureBytes, messageBytes, publicKeyBytes);
  } catch (error) {
    return false;
  }
}

/**
 * Создает подпись для сообщения (для тестирования)
 * @param message Сообщение для подписи
 * @param privateKey Приватный ключ в формате hex
 * @returns Подпись в формате hex
 */
export async function signMessage(
  message: string,
  privateKey: string
): Promise<string> {
  const messageBytes = Buffer.from(message, 'utf-8');
  const privateKeyBytes = Buffer.from(privateKey, 'hex');
  
  const signature = await sign(messageBytes, privateKeyBytes);
  return Buffer.from(signature).toString('hex');
}

/**
 * Форматирует публичный ключ для хранения (убирает префиксы, если есть)
 * @param publicKey Публичный ключ
 * @returns Отформатированный ключ
 */
export function formatPublicKey(publicKey: string): string {
  // Убираем возможные префиксы и пробелы
  return publicKey.replace(/^0x/i, '').replace(/\s/g, '');
}

