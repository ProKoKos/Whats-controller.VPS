import crypto from 'crypto';

/**
 * Генерирует криптографически стойкий секрет для кабинета
 * @returns Секрет в формате base64url (43 символа)
 */
export function generateCabinetSecret(): string {
  const bytes = crypto.randomBytes(32);
  return bytes.toString('base64url');
}

/**
 * Генерирует криптографически стойкий секрет для контроллера
 * @returns Секрет в формате base64url (43 символа)
 */
export function generateControllerSecret(): string {
  const bytes = crypto.randomBytes(32);
  return bytes.toString('base64url');
}

/**
 * Хеширует секрет с использованием SHA-256
 * @param secret Секрет для хеширования
 * @returns Хеш в формате hex (64 символа)
 */
export function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

/**
 * Проверяет соответствие секрета хешу
 * @param secret Секрет для проверки
 * @param hash Хеш для сравнения
 * @returns true если секрет соответствует хешу
 */
export function verifySecret(secret: string, hash: string): boolean {
  const computedHash = hashSecret(secret);
  return crypto.timingSafeEqual(
    Buffer.from(computedHash, 'hex'),
    Buffer.from(hash, 'hex')
  );
}

/**
 * Генерирует код подтверждения (6 цифр)
 * @returns Код из 6 цифр
 */
export function generateConfirmationCode(): string {
  const min = 100000;
  const max = 999999;
  const code = Math.floor(Math.random() * (max - min + 1)) + min;
  return code.toString();
}

/**
 * Генерирует activation_code для контроллера (12 символов: буквы и цифры)
 * @returns Код из 12 символов (A-Z, a-z, 0-9)
 */
export function generateActivationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  const randomBytes = crypto.randomBytes(12);
  
  for (let i = 0; i < 12; i++) {
    code += chars[randomBytes[i] % chars.length];
  }
  
  return code;
}

/**
 * Генерирует session_token (32 байта, base64url)
 * @returns Токен сессии
 */
export function generateSessionToken(): string {
  const bytes = crypto.randomBytes(32);
  return bytes.toString('base64url');
}

