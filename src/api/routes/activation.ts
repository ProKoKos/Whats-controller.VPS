import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import { getPool } from '../../database';
import { createError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import {
  generateCabinetSecret,
  hashSecret,
  generateConfirmationCode
} from '../../utils/crypto';

const router = express.Router();

// Rate limiting для предотвращения перебора кодов
const activationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 10, // максимум 10 запросов за 15 минут
  message: 'Too many activation attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Схема валидации для инициации активации
const initiateActivationSchema = z.object({
  activation_code: z.string()
    .min(12)
    .max(12)
    .regex(/^[A-Za-z0-9]{12}$/, 'Activation code must be exactly 12 alphanumeric characters'),
  mac_address: z.string()
    .regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, 'Invalid MAC address format'),
  action: z.enum(['create_cabinet', 'add_to_cabinet'], {
    errorMap: () => ({ message: 'Action must be either "create_cabinet" or "add_to_cabinet"' })
  }),
  cabinet_secret: z.string().optional() // Требуется только для add_to_cabinet
}).refine(
  (data) => {
    // Если действие - add_to_cabinet, то cabinet_secret обязателен
    if (data.action === 'add_to_cabinet' && !data.cabinet_secret) {
      return false;
    }
    return true;
  },
  {
    message: 'cabinet_secret is required when action is "add_to_cabinet"',
    path: ['cabinet_secret']
  }
);

/**
 * POST /api/activation/initiate
 * Инициация активации контроллера
 * 
 * Body:
 * {
 *   activation_code: string (12 символов)
 *   mac_address: string (формат MAC адреса)
 *   action: "create_cabinet" | "add_to_cabinet"
 *   cabinet_secret?: string (требуется для add_to_cabinet)
 * }
 * 
 * Response:
 * {
 *   device_authorization_code: string (6 цифр)
 *   expires_at: timestamp
 * }
 */
router.post('/initiate', activationRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPool();
    
    // Валидация входных данных
    const { activation_code, mac_address, action, cabinet_secret } = initiateActivationSchema.parse(req.body);
    
    const macUpper = mac_address.toUpperCase().replace(/[:-]/g, ':');
    
    // Проверка: контроллер с таким MAC уже активирован?
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
      // Если контроллер существует, но не активирован, можно продолжить
    }
    
    // Проверка: не существует ли уже активная pending_activation с таким activation_code
    const existingActivation = await pool.query(
      `SELECT id, expires_at 
       FROM pending_activations 
       WHERE UPPER(activation_code) = UPPER($1) AND expires_at > CURRENT_TIMESTAMP`,
      [activation_code]
    );
    
    if (existingActivation.rows.length > 0) {
      throw createError('Activation code is already in use. Please wait for it to expire or use a different code.', 409);
    }
    
    let cabinetId: string;
    let cabinetSecret: string | undefined;
    
    // Логика создания нового кабинета или добавления в существующий
    if (action === 'create_cabinet') {
      // Создание нового кабинета
      cabinetSecret = generateCabinetSecret();
      const cabinetSecretHash = hashSecret(cabinetSecret);
      
      const cabinetResult = await pool.query(
        `INSERT INTO cabinets (cabinet_secret_hash, created_at, last_activity)
         VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id`,
        [cabinetSecretHash]
      );
      
      cabinetId = cabinetResult.rows[0].id;
      
      logger.info(`New cabinet created: ${cabinetId}`);
    } else {
      // Добавление в существующий кабинет
      if (!cabinet_secret) {
        throw createError('cabinet_secret is required for add_to_cabinet action', 400);
      }
      
      const cabinetSecretHash = hashSecret(cabinet_secret);
      
      // Поиск кабинета по хешу секрета
      const cabinetResult = await pool.query(
        `SELECT id FROM cabinets WHERE cabinet_secret_hash = $1`,
        [cabinetSecretHash]
      );
      
      if (cabinetResult.rows.length === 0) {
        throw createError('Invalid cabinet_secret', 401);
      }
      
      cabinetId = cabinetResult.rows[0].id;
      
      logger.info(`Controller will be added to existing cabinet: ${cabinetId}`);
    }
    
    // Генерация device_authorization_code
    const deviceAuthorizationCode = generateConfirmationCode();
    
    // Срок действия кода: 10 минут
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);
    
    // Сохранение в pending_activations
    // Сохраняем cabinet_secret временно (только для нового кабинета) для передачи контроллеру
    await pool.query(
      `INSERT INTO pending_activations 
       (activation_code, cabinet_id, device_authorization_code, controller_mac, cabinet_secret, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [activation_code.toUpperCase(), cabinetId, deviceAuthorizationCode, macUpper, cabinetSecret || null, expiresAt]
    );
    
    logger.info(`Activation initiated: activation_code=${activation_code}, cabinet_id=${cabinetId}, device_code=${deviceAuthorizationCode}`);
    
    // Формируем ответ
    const response: any = {
      device_authorization_code: deviceAuthorizationCode,
      expires_at: expiresAt.toISOString(),
      message: 'Activation initiated. Enter the device authorization code on the controller.'
    };
    
    // Если создан новый кабинет, возвращаем cabinet_secret
    if (action === 'create_cabinet' && cabinetSecret) {
      response.cabinet_secret = cabinetSecret;
      response.cabinet_id = cabinetId;
    }
    
    res.status(200).json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Обработка ошибок валидации Zod
      const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return next(createError(`Validation error: ${errorMessage}`, 400));
    }
    next(error);
  }
});

export default router;

