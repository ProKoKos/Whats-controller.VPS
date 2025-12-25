/**
 * Утилиты для криптографических операций в браузере
 * Использует @noble/ed25519 для Ed25519 подписей
 */

import * as ed25519Lib from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';

// Настройка SHA-512 для Ed25519
if (!ed25519Lib.hashes.sha512) {
  ed25519Lib.hashes.sha512 = (m: Uint8Array) => sha512(m);
  ed25519Lib.hashes.sha512Async = (m: Uint8Array) => Promise.resolve(sha512(m));
}

const { getPublicKey, sign, verify } = ed25519Lib;

/**
 * Генерирует пару ключей Ed25519
 * @returns Объект с приватным и публичным ключами в hex формате
 */
export async function generateKeyPair(): Promise<{ privateKey: string; publicKey: string }> {
  // Генерируем 32 случайных байта для приватного ключа
  const privateKeyBytes = new Uint8Array(32);
  crypto.getRandomValues(privateKeyBytes);
  
  const publicKey = await getPublicKey(privateKeyBytes);
  
  return {
    privateKey: Array.from(privateKeyBytes).map(b => b.toString(16).padStart(2, '0')).join(''),
    publicKey: Array.from(publicKey).map(b => b.toString(16).padStart(2, '0')).join('')
  };
}

/**
 * Создает подпись для сообщения
 * @param message Сообщение для подписи
 * @param privateKey Приватный ключ в hex формате
 * @returns Подпись в hex формате
 */
export async function signMessage(message: string, privateKey: string): Promise<string> {
  const messageBytes = new TextEncoder().encode(message);
  const privateKeyBytes = Uint8Array.from(
    privateKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );
  
  const signature = await sign(messageBytes, privateKeyBytes);
  return Array.from(signature).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Проверяет подпись Ed25519
 * @param message Сообщение для проверки
 * @param signature Подпись в hex формате
 * @param publicKey Публичный ключ в hex формате
 * @returns true если подпись валидна
 */
export async function verifySignature(
  message: string,
  signature: string,
  publicKey: string
): Promise<boolean> {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = Uint8Array.from(
      signature.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    );
    const publicKeyBytes = Uint8Array.from(
      publicKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    );
    
    return await verify(signatureBytes, messageBytes, publicKeyBytes);
  } catch (error) {
    return false;
  }
}

/**
 * Генерирует device fingerprint на основе характеристик устройства
 * @returns Promise с SHA-256 хешем fingerprint
 */
export async function generateDeviceFingerprint(): Promise<string> {
  const userAgent = navigator.userAgent;
  const screenResolution = `${window.screen.width}x${window.screen.height}`;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  const data = [userAgent, screenResolution, timezone].join('|');
  
  // Используем Web Crypto API для хеширования
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Сохраняет приватный ключ в localStorage (в зашифрованном виде)
 * Для простоты используем base64 кодирование (в продакшене нужен реальный шифр)
 * @param privateKey Приватный ключ
 * @param deviceId ID устройства
 */
export function savePrivateKey(privateKey: string, deviceId: string): void {
  if (typeof window !== 'undefined') {
    // Простое base64 кодирование (в продакшене нужен реальный шифр)
    const encoded = btoa(privateKey);
    localStorage.setItem(`device_private_key_${deviceId}`, encoded);
  }
}

/**
 * Загружает приватный ключ из localStorage
 * @param deviceId ID устройства
 * @returns Приватный ключ или null
 */
export function loadPrivateKey(deviceId: string): string | null {
  if (typeof window !== 'undefined') {
    const encoded = localStorage.getItem(`device_private_key_${deviceId}`);
    if (encoded) {
      try {
        return atob(encoded);
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Сохраняет публичный ключ в localStorage
 * @param publicKey Публичный ключ
 * @param deviceId ID устройства
 */
export function savePublicKey(publicKey: string, deviceId: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`device_public_key_${deviceId}`, publicKey);
  }
}

/**
 * Загружает публичный ключ из localStorage
 * @param deviceId ID устройства
 * @returns Публичный ключ или null
 */
export function loadPublicKey(deviceId: string): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(`device_public_key_${deviceId}`);
  }
  return null;
}

