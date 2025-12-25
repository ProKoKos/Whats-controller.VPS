import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../../database';
import { createError } from '../../middleware/errorHandler';
import { authenticateToken } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import {
  generateControllerSecret,
  hashSecret
} from '../../utils/crypto';

const router = express.Router();

// Схема валидации для подтверждения активации
const confirmActivationSchema = z.object({
  activation_code: z.string()
    .min(12)
    .max(12)
    .regex(/^[A-Za-z0-9]{12}$/, 'Activation code must be exactly 12 alphanumeric characters'),
  device_authorization_code: z.string()
    .length(6)
    .regex(/^\d{6}$/, 'Device authorization code must be exactly 6 digits'),
  mac_address: z.string()
    .regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, 'Invalid MAC address format'),
  firmware_version: z.string().optional()
});

/**
 * POST /api/controllers/confirm-activation
 * Подтверждение активации контроллера
 * 
 * Этот эндпоинт НЕ требует авторизации, так как контроллер еще не активирован
 * 
 * Body:
 * {
 *   activation_code: string (12 символов)
 *   device_authorization_code: string (6 цифр)
 *   mac_address: string (формат MAC адреса)
 *   firmware_version?: string
 * }
 * 
 * Response:
 * {
 *   controller_id: uuid
 *   controller_secret: string
 *   cabinet_id: uuid
 * }
 */
router.post('/confirm-activation', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPool();
    
    // Валидация входных данных
    const { activation_code, device_authorization_code, mac_address, firmware_version } = confirmActivationSchema.parse(req.body);
    
    const macUpper = mac_address.toUpperCase().replace(/[:-]/g, ':');
    
    // Поиск pending_activation
    const pendingResult = await pool.query(
      `SELECT pa.id, pa.cabinet_id, pa.device_authorization_code, pa.controller_mac, pa.expires_at
       FROM pending_activations pa
       WHERE pa.activation_code = $1 AND pa.expires_at > CURRENT_TIMESTAMP`,
      [activation_code]
    );
    
    if (pendingResult.rows.length === 0) {
      throw createError('Activation code not found or expired', 404);
    }
    
    const pending = pendingResult.rows[0];
    
    // Проверка device_authorization_code
    if (pending.device_authorization_code !== device_authorization_code) {
      throw createError('Invalid device authorization code', 401);
    }
    
    // Проверка MAC адреса (должен совпадать с тем, что был указан при инициации)
    if (pending.controller_mac && pending.controller_mac !== macUpper) {
      throw createError('MAC address does not match the one used during activation initiation', 400);
    }
    
    // Проверка: контроллер с таким MAC уже существует и активирован?
    const existingController = await pool.query(
      `SELECT id, is_active, cabinet_id 
       FROM controllers 
       WHERE mac_address = $1`,
      [macUpper]
    );
    
    if (existingController.rows.length > 0) {
      const controller = existingController.rows[0];
      if (controller.is_active) {
        throw createError('Controller with this MAC address is already activated', 409);
      }
      // Если контроллер существует, но не активирован, удаляем его перед созданием нового
      await pool.query('DELETE FROM controllers WHERE id = $1', [controller.id]);
    }
    
    // Генерация controller_secret
    const controllerSecret = generateControllerSecret();
    const controllerSecretHash = hashSecret(controllerSecret);
    
    // Создание записи контроллера
    const controllerResult = await pool.query(
      `INSERT INTO controllers 
       (cabinet_id, mac_address, controller_secret_hash, firmware_version, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id`,
      [pending.cabinet_id, macUpper, controllerSecretHash, firmware_version || null]
    );
    
    const controllerId = controllerResult.rows[0].id;
    
    // Обновление last_activity кабинета
    await pool.query(
      `UPDATE cabinets SET last_activity = CURRENT_TIMESTAMP WHERE id = $1`,
      [pending.cabinet_id]
    );
    
    // Удаление записи из pending_activations
    await pool.query(
      'DELETE FROM pending_activations WHERE id = $1',
      [pending.id]
    );
    
    logger.info(`Controller activated: controller_id=${controllerId}, cabinet_id=${pending.cabinet_id}, mac=${macUpper}`);
    
    // Формируем ответ
    res.status(200).json({
      controller_id: controllerId,
      controller_secret: controllerSecret,
      cabinet_id: pending.cabinet_id,
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

// All other routes require authentication
router.use(authenticateToken);

const activateControllerSchema = z.object({
  mac: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/),
  firmwareVersion: z.string().optional()
});

// Get user's controllers
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const pool = getPool();

    const result = await pool.query(
      `SELECT id, mac_address, firmware_version, name, is_active, 
              last_seen_at, created_at, updated_at
       FROM controllers 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({
      controllers: result.rows.map(row => ({
        id: row.id,
        macAddress: row.mac_address,
        firmwareVersion: row.firmware_version,
        name: row.name || `Controller ${row.mac_address}`,
        isActive: row.is_active,
        lastSeenAt: row.last_seen_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    });
  } catch (error) {
    next(error);
  }
});

// Activate new controller
router.post('/activate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { mac, firmwareVersion } = activateControllerSchema.parse(req.body);
    const pool = getPool();

    // Check if controller already exists
    const existing = await pool.query(
      'SELECT id, user_id, is_active FROM controllers WHERE mac_address = $1',
      [mac.toUpperCase()]
    );

    if (existing.rows.length > 0) {
      const controller = existing.rows[0];
      if (controller.user_id !== userId) {
        throw createError('Controller is already registered to another user', 403);
      }
      if (controller.is_active) {
        throw createError('Controller is already activated', 400);
      }
    }

    // Generate activation token
    const activationToken = uuidv4();

    // Create or update controller
    let controllerId: string;
    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE controllers 
         SET activation_token = $1, firmware_version = $2, updated_at = CURRENT_TIMESTAMP
         WHERE mac_address = $3
         RETURNING id`,
        [activationToken, firmwareVersion, mac.toUpperCase()]
      );
      controllerId = existing.rows[0].id;
    } else {
      const result = await pool.query(
        `INSERT INTO controllers (user_id, mac_address, firmware_version, activation_token)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [userId, mac.toUpperCase(), firmwareVersion, activationToken]
      );
      controllerId = result.rows[0].id;
    }

    logger.info(`Controller activation initiated: ${mac} for user ${userId}`);

    res.status(201).json({
      controllerId,
      activationToken,
      message: 'Activation token generated. Use this token to connect the controller.'
    });
  } catch (error) {
    next(error);
  }
});

// Get controller by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const controllerId = req.params.id;
    const pool = getPool();

    const result = await pool.query(
      `SELECT id, mac_address, firmware_version, name, is_active, 
              last_seen_at, created_at, updated_at
       FROM controllers 
       WHERE id = $1 AND user_id = $2`,
      [controllerId, userId]
    );

    if (result.rows.length === 0) {
      throw createError('Controller not found', 404);
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      macAddress: row.mac_address,
      firmwareVersion: row.firmware_version,
      name: row.name || `Controller ${row.mac_address}`,
      isActive: row.is_active,
      lastSeenAt: row.last_seen_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  } catch (error) {
    next(error);
  }
});

// Update controller metadata
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const controllerId = req.params.id;
    const { name } = req.body;
    const pool = getPool();

    // Verify ownership
    const check = await pool.query(
      'SELECT id FROM controllers WHERE id = $1 AND user_id = $2',
      [controllerId, userId]
    );

    if (check.rows.length === 0) {
      throw createError('Controller not found', 404);
    }

    // Update
    await pool.query(
      'UPDATE controllers SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [name, controllerId]
    );

    res.json({ message: 'Controller updated successfully' });
  } catch (error) {
    next(error);
  }
});

// Delete controller
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const controllerId = req.params.id;
    const pool = getPool();

    // Verify ownership
    const check = await pool.query(
      'SELECT id FROM controllers WHERE id = $1 AND user_id = $2',
      [controllerId, userId]
    );

    if (check.rows.length === 0) {
      throw createError('Controller not found', 404);
    }

    await pool.query('DELETE FROM controllers WHERE id = $1', [controllerId]);

    logger.info(`Controller deleted: ${controllerId} by user ${userId}`);

    res.json({ message: 'Controller deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;

