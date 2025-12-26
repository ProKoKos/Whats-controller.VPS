import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getPool } from '../../database';
import { createError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { generateControllerSecret, hashSecret, verifySecret } from '../../utils/crypto';
import { verifyEd25519Signature } from '../../utils/ed25519';

const router = express.Router();

// Схема валидации для активации контроллера
const activateSchema = z.object({
  mac_address: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, 'Invalid MAC address format'),
  firmware_version: z.string().optional()
});

/**
 * POST /api/controllers/activate
 * Активация контроллера (упрощенная версия)
 * 
 * Body:
 * {
 *   mac_address: string
 *   firmware_version?: string
 * }
 * 
 * Response:
 * {
 *   controller_id: uuid
 *   controller_secret: string
 *   pin: string
 *   pin_expires_at: timestamp
 * }
 */
router.post('/activate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPool();
    
    // Валидация входных данных
    const { mac_address, firmware_version } = activateSchema.parse(req.body);
    
    const macUpper = mac_address.toUpperCase().replace(/[:-]/g, ':');
    
    logger.info(`[ACTIVATION] Activation attempt: mac=${macUpper}`);
    
    // Проверка: не активирован ли уже контроллер с таким MAC
    const existing = await pool.query(
      'SELECT id FROM controllers WHERE mac_address = $1 AND is_active = true',
      [macUpper]
    );
    
    if (existing.rows.length > 0) {
      logger.warn(`[ACTIVATION] Controller already activated: ${existing.rows[0].id}`);
      throw createError('Controller with this MAC address is already activated', 409);
    }
    
    // Генерация controller_secret
    const controllerSecret = generateControllerSecret();
    const controllerSecretHash = hashSecret(controllerSecret);
    
    // Создание записи контроллера
    const result = await pool.query(
      `INSERT INTO controllers (mac_address, controller_secret_hash, firmware_version, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id`,
      [macUpper, controllerSecretHash, firmware_version || null]
    );
    
    const controllerId = result.rows[0].id;
    
    // Генерация первого PIN
    const pin = generatePin();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 минут
    
    await pool.query(
      `INSERT INTO controller_pins (controller_id, pin, expires_at)
       VALUES ($1, $2, $3)`,
      [controllerId, pin, expiresAt]
    );
    
    logger.info(`[ACTIVATION] Controller activated: controller_id=${controllerId}, mac=${macUpper}`);
    
    res.json({
      controller_id: controllerId,
      controller_secret: controllerSecret,
      pin: pin,
      pin_expires_at: expiresAt.toISOString(),
      message: 'Controller activated successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return next(createError(`Validation error: ${errorMessage}`, 400));
    }
    next(error);
  }
});

// Вспомогательная функция для генерации PIN
function generatePin(): string {
  const chars = '0123456789';
  let pin = '';
  for (let i = 0; i < 8; i++) {
    pin += chars[Math.floor(Math.random() * chars.length)];
  }
  return pin;
}

// Расширение Request для хранения devicePublicKey
declare global {
  namespace Express {
    interface Request {
      devicePublicKey?: string;
    }
  }
}

/**
 * GET /api/controllers/:controllerId/pin
 * Получение PIN кода для доступа к контроллеру на сервере
 * 
 * Headers:
 * - Authorization: Bearer {controller_secret}
 * 
 * Response:
 * {
 *   pin: string
 *   expires_at: timestamp
 * }
 */
router.get('/:controllerId/pin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPool();
    const { controllerId } = req.params;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized. Missing or invalid Authorization header' });
    }
    
    const controllerSecret = authHeader.substring(7);
    
    // Проверка controller_secret
    const controller = await pool.query(
      `SELECT id, controller_secret_hash FROM controllers WHERE id = $1 AND is_active = true`,
      [controllerId]
    );
    
    if (controller.rows.length === 0) {
      return res.status(404).json({ error: 'Controller not found or inactive' });
    }
    
    // Проверка секрета
    if (!verifySecret(controllerSecret, controller.rows[0].controller_secret_hash)) {
      return res.status(401).json({ error: 'Invalid controller secret' });
    }
    
    // Проверяем текущий PIN
    const currentPin = await pool.query(
      `SELECT pin, expires_at FROM controller_pins
       WHERE controller_id = $1 AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC LIMIT 1`,
      [controllerId]
    );
    
    // Если PIN валидный и не истек, возвращаем его
    if (currentPin.rows.length > 0) {
      return res.json({
        pin: currentPin.rows[0].pin,
        expires_at: currentPin.rows[0].expires_at
      });
    }
    
    // Если PIN истек или не существует, генерируем новый
    const newPin = generatePin();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 минут
    
    await pool.query(
      `INSERT INTO controller_pins (controller_id, pin, expires_at)
       VALUES ($1, $2, $3)`,
      [controllerId, newPin, expiresAt]
    );
    
    logger.info(`[PIN] New PIN generated for controller ${controllerId}`);
    
    res.json({
      pin: newPin,
      expires_at: expiresAt.toISOString()
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/controllers/:controllerId/verify-pin
 * Проверка PIN кода для доступа к контроллеру
 * 
 * Query:
 * - pin: string (8 цифр)
 * 
 * Response:
 * {
 *   valid: boolean
 *   expires_at?: timestamp
 *   error?: string
 * }
 */
router.get('/:controllerId/verify-pin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPool();
    const { controllerId } = req.params;
    const { pin } = req.query;
    
    if (!pin || typeof pin !== 'string') {
      return res.json({ valid: false, error: 'PIN is required' });
    }
    
    const result = await pool.query(
      `SELECT expires_at FROM controller_pins
       WHERE controller_id = $1 AND pin = $2 AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC LIMIT 1`,
      [controllerId, pin]
    );
    
    if (result.rows.length === 0) {
      return res.json({ valid: false, error: 'Invalid or expired PIN' });
    }
    
    res.json({
      valid: true,
      expires_at: result.rows[0].expires_at
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/controllers/:controllerId
 * Получение информации о контроллере
 * 
 * Headers:
 * - X-Device-Signature: Ed25519 подпись запроса (base64)
 * - X-Device-Public-Key: Ed25519 публичный ключ (base64)
 * 
 * Response:
 * {
 *   controller_id: uuid
 *   mac_address: string
 *   firmware_version?: string
 *   is_active: boolean
 *   last_seen_at?: timestamp
 * }
 */
router.get('/:controllerId', verifyDeviceSignature, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPool();
    const { controllerId } = req.params;
    const publicKey = req.devicePublicKey;
    
    if (!publicKey) {
      return res.status(401).json({ error: 'Missing public key' });
    }
    
    // Проверка авторизации устройства
    const deviceCheck = await pool.query(
      `SELECT id FROM authorized_devices
       WHERE controller_id = $1 AND public_key = $2`,
      [controllerId, publicKey]
    );
    
    if (deviceCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Device not authorized' });
    }
    
    // Обновляем last_used_at
    await pool.query(
      `UPDATE authorized_devices SET last_used_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [deviceCheck.rows[0].id]
    );
    
    // Получаем информацию о контроллере
    const controller = await pool.query(
      `SELECT id, mac_address, firmware_version, is_active, last_seen_at
       FROM controllers
       WHERE id = $1`,
      [controllerId]
    );
    
    if (controller.rows.length === 0) {
      return res.status(404).json({ error: 'Controller not found' });
    }
    
    const ctrl = controller.rows[0];
    
    res.json({
      controller_id: ctrl.id,
      mac_address: ctrl.mac_address,
      firmware_version: ctrl.firmware_version,
      is_active: ctrl.is_active,
      last_seen_at: ctrl.last_seen_at
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /api/controllers/:controllerId
 * Удаление контроллера (только для суперадмина или через Ed25519 авторизацию)
 */
router.delete('/:controllerId', verifyDeviceSignature, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPool();
    const { controllerId } = req.params;
    const publicKey = req.devicePublicKey;
    
    if (!publicKey) {
      return res.status(401).json({ error: 'Missing public key' });
    }
    
    // Проверка авторизации устройства
    const deviceCheck = await pool.query(
      `SELECT id FROM authorized_devices
       WHERE controller_id = $1 AND public_key = $2`,
      [controllerId, publicKey]
    );
    
    if (deviceCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Device not authorized' });
    }
    
    // Удаляем контроллер (CASCADE удалит связанные записи)
    await pool.query(
      `DELETE FROM controllers WHERE id = $1`,
      [controllerId]
    );
    
    res.json({
      message: 'Controller deleted successfully',
      controller_id: controllerId
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/controllers/:controllerId/deactivate
 * Деактивация контроллера (удаление из базы, очистка данных на контроллере)
 */
router.post('/:controllerId/deactivate', verifyDeviceSignature, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPool();
    const { controllerId } = req.params;
    const publicKey = req.devicePublicKey;
    
    if (!publicKey) {
      return res.status(401).json({ error: 'Missing public key' });
    }
    
    // Проверка авторизации устройства
    const deviceCheck = await pool.query(
      `SELECT id FROM authorized_devices
       WHERE controller_id = $1 AND public_key = $2`,
      [controllerId, publicKey]
    );
    
    if (deviceCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Device not authorized' });
    }
    
    // Удаляем контроллер (CASCADE удалит связанные записи)
    await pool.query(
      `DELETE FROM controllers WHERE id = $1`,
      [controllerId]
    );
    
    res.json({
      message: 'Controller deactivated successfully',
      controller_id: controllerId
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * Middleware для проверки Ed25519 подписи
 */
async function verifyDeviceSignature(req: Request, res: Response, next: NextFunction) {
  try {
    const signature = req.headers['x-device-signature'] as string;
    const publicKey = req.headers['x-device-public-key'] as string;
    
    if (!signature || !publicKey) {
      return res.status(401).json({ error: 'Missing signature or public key' });
    }
    
    // Проверка подписи Ed25519
    // Формируем сообщение для подписи: метод + путь + тело запроса
    const message = req.method + req.path + JSON.stringify(req.body || {});
    const isValid = verifyEd25519Signature(
      Buffer.from(signature, 'base64'),
      Buffer.from(message),
      Buffer.from(publicKey, 'base64')
    );
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    req.devicePublicKey = publicKey;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid signature format' });
  }
}

/**
 * POST /api/controllers/:controllerId/authorize-device
 * Привязка устройства к контроллеру через Ed25519
 * 
 * Headers:
 * - X-Device-Signature: Ed25519 подпись запроса (base64)
 * - X-Device-Public-Key: Ed25519 публичный ключ (base64)
 * 
 * Body:
 * {
 *   device_name?: string
 *   public_key: string (base64)
 * }
 * 
 * Response:
 * {
 *   device_id: uuid
 *   message: string
 * }
 */
router.post('/:controllerId/authorize-device', verifyDeviceSignature, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPool();
    const { controllerId } = req.params;
    const { device_name, public_key } = req.body;
    const publicKeyHeader = req.headers['x-device-public-key'] as string;
    
    // Проверка, что public_key из body совпадает с public_key из заголовка
    if (public_key !== publicKeyHeader) {
      return res.status(400).json({ error: 'Public key mismatch' });
    }
    
    // Проверяем, что контроллер существует
    const controller = await pool.query(
      `SELECT id FROM controllers WHERE id = $1 AND is_active = true`,
      [controllerId]
    );
    
    if (controller.rows.length === 0) {
      return res.status(404).json({ error: 'Controller not found' });
    }
    
    // Привязываем устройство (первая привязка через Ed25519, PIN не требуется)
    const result = await pool.query(
      `INSERT INTO authorized_devices (controller_id, device_name, public_key)
       VALUES ($1, $2, $3)
       ON CONFLICT (controller_id, public_key) DO UPDATE
       SET device_name = $2, last_used_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [controllerId, device_name || 'Unnamed Device', public_key]
    );
    
    logger.info(`[DEVICE] Device authorized for controller ${controllerId}: device_id=${result.rows[0].id}`);
    
    res.json({
      device_id: result.rows[0].id,
      message: 'Device authorized successfully'
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/controllers/:controllerId/authorized-devices
 * Список авторизованных устройств для контроллера
 * 
 * Headers:
 * - X-Device-Signature: Ed25519 подпись запроса (base64)
 * - X-Device-Public-Key: Ed25519 публичный ключ (base64)
 * 
 * Response:
 * {
 *   devices: Array<{
 *     device_id: uuid
 *     device_name: string
 *     created_at: timestamp
 *     last_used_at: timestamp
 *   }>
 * }
 */
router.get('/:controllerId/authorized-devices', verifyDeviceSignature, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPool();
    const { controllerId } = req.params;
    const publicKey = req.devicePublicKey;
    
    if (!publicKey) {
      return res.status(401).json({ error: 'Missing public key' });
    }
    
    // Проверка авторизации устройства
    const deviceCheck = await pool.query(
      `SELECT id FROM authorized_devices
       WHERE controller_id = $1 AND public_key = $2`,
      [controllerId, publicKey]
    );
    
    if (deviceCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Device not authorized' });
    }
    
    // Обновляем last_used_at
    await pool.query(
      `UPDATE authorized_devices SET last_used_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [deviceCheck.rows[0].id]
    );
    
    // Получаем список устройств
    const devices = await pool.query(
      `SELECT id, device_name, created_at, last_used_at
       FROM authorized_devices
       WHERE controller_id = $1
       ORDER BY created_at DESC`,
      [controllerId]
    );
    
    res.json({
      devices: devices.rows.map(device => ({
        device_id: device.id,
        device_name: device.device_name,
        created_at: device.created_at,
        last_used_at: device.last_used_at
      }))
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /api/controllers/:controllerId/authorized-devices/:deviceId
 * Удаление авторизованного устройства
 * 
 * Headers:
 * - X-Device-Signature: Ed25519 подпись запроса (base64)
 * - X-Device-Public-Key: Ed25519 публичный ключ (base64)
 * 
 * Response:
 * {
 *   message: string
 * }
 */
router.delete('/:controllerId/authorized-devices/:deviceId', verifyDeviceSignature, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPool();
    const { controllerId, deviceId } = req.params;
    const publicKey = req.devicePublicKey;
    
    if (!publicKey) {
      return res.status(401).json({ error: 'Missing public key' });
    }
    
    // Проверка авторизации устройства
    const deviceCheck = await pool.query(
      `SELECT id FROM authorized_devices
       WHERE controller_id = $1 AND public_key = $2`,
      [controllerId, publicKey]
    );
    
    if (deviceCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Device not authorized' });
    }
    
    // Удаляем устройство
    const result = await pool.query(
      `DELETE FROM authorized_devices
       WHERE id = $1 AND controller_id = $2
       RETURNING id`,
      [deviceId, controllerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    logger.info(`[DEVICE] Device removed: device_id=${deviceId}, controller_id=${controllerId}`);
    
    res.json({
      message: 'Device removed successfully'
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
