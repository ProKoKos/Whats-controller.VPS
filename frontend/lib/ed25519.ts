import * as ed25519Lib from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';

// Настройка SHA-512 для Ed25519
if (!ed25519Lib.hashes.sha512) {
  ed25519Lib.hashes.sha512 = (m: Uint8Array) => sha512(m);
  ed25519Lib.hashes.sha512Async = (m: Uint8Array) => Promise.resolve(sha512(m));
}

const { sign, verify, getPublicKey } = ed25519Lib;

/**
 * Конвертирует Uint8Array в base64 строку
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof window !== 'undefined') {
    // В браузере используем btoa
    const binary = String.fromCharCode(...bytes);
    return btoa(binary);
  } else {
    // В Node.js используем Buffer
    return Buffer.from(bytes).toString('base64');
  }
}

/**
 * Конвертирует base64 строку в Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof window !== 'undefined') {
    // В браузере используем atob
    const binary = atob(base64);
    return Uint8Array.from(binary, c => c.charCodeAt(0));
  } else {
    // В Node.js используем Buffer
    return Uint8Array.from(Buffer.from(base64, 'base64'));
  }
}

/**
 * Генерирует пару Ed25519 ключей
 * @returns Объект с приватным и публичным ключами (base64)
 */
export async function generateKeyPair(): Promise<{
  privateKey: string;
  publicKey: string;
}> {
  const privateKey = ed25519Lib.utils.randomSecretKey();
  const publicKey = getPublicKey(privateKey);
  
  return {
    privateKey: uint8ArrayToBase64(privateKey),
    publicKey: uint8ArrayToBase64(publicKey),
  };
}

/**
 * Создает подпись Ed25519 для сообщения
 * @param message Сообщение для подписи
 * @param privateKeyBase64 Приватный ключ в формате base64
 * @returns Подпись в формате base64
 */
export async function signMessage(
  message: string,
  privateKeyBase64: string
): Promise<string> {
  const messageBytes = new TextEncoder().encode(message);
  const privateKeyBytes = base64ToUint8Array(privateKeyBase64);
  
  const signature = await sign(messageBytes, privateKeyBytes);
  return uint8ArrayToBase64(signature);
}

/**
 * Проверяет подпись Ed25519
 * @param message Сообщение для проверки
 * @param signatureBase64 Подпись в формате base64
 * @param publicKeyBase64 Публичный ключ в формате base64
 * @returns true если подпись валидна
 */
export async function verifySignature(
  message: string,
  signatureBase64: string,
  publicKeyBase64: string
): Promise<boolean> {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = base64ToUint8Array(signatureBase64);
    const publicKeyBytes = base64ToUint8Array(publicKeyBase64);
    
    return await verify(signatureBytes, messageBytes, publicKeyBytes);
  } catch (error) {
    console.error('[Ed25519] Verification error:', error);
    return false;
  }
}

/**
 * Получает публичный ключ из приватного
 * @param privateKeyBase64 Приватный ключ в формате base64
 * @returns Публичный ключ в формате base64
 */
export function getPublicKeyFromPrivate(privateKeyBase64: string): string {
  const privateKeyBytes = base64ToUint8Array(privateKeyBase64);
  const publicKey = getPublicKey(privateKeyBytes);
  return uint8ArrayToBase64(publicKey);
}

