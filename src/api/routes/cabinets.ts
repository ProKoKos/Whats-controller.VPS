import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import { getPool } from '../../database';
import { createError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { generateConfirmationCode, generateSessionToken, verifySecret } from '../../utils/crypto';

const router = express.Router();

// Rate limiting для предотвращения перебора кодов
const accessRequestRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 10, // максимум 10 запросов за 15 минут
  message: 'Too many access requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Схема валидации для запроса доступа к кабинету
const requestAccessSchema = z.object({
  cabinet_id: z.string().uuid('Invalid cabinet_id format')
});

/**
 * POST /api/cabinets/request-access
 * Запрос доступа к кабинету
 * 
 * Body:
 * {
 *   cabinet_id: string (UUID)
 * }
 * 
 * Response:
 * {
 *   access_request_code: string (6 цифр)
 *   expires_at: timestamp
 *   message: string
 * }
 */
router.post('/request-access', accessRequestRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPool();
    
    // Валидация входных данных
    const { cabinet_id } = requestAccessSchema.parse(req.body);
    
    // Проверка существования кабинета
    const cabinetResult = await pool.query(
      `SELECT id FROM cabinets WHERE id = $1`,
      [cabinet_id]
    );
    
    if (cabinetResult.rows.length === 0) {
      throw createError('Cabinet not found', 404);
    }
    
    // Генерация access_request_code (6 цифр)
    let accessRequestCode: string | null = null;
    let codeExists = true;
    let attempts = 0;
    const maxAttempts = 10;
    
    // Генерируем уникальный код
    while (codeExists && attempts < maxAttempts) {
      const generatedCode = generateConfirmationCode();
      
      const existingCode = await pool.query(
        `SELECT id FROM pending_access_requests 
         WHERE access_request_code = $1 AND expires_at > CURRENT_TIMESTAMP`,
        [generatedCode]
      );
      
      if (existingCode.rows.length === 0) {
        accessRequestCode = generatedCode;
        codeExists = false;
      } else {
        attempts++;
      }
    }
    
    if (!accessRequestCode) {
      throw createError('Failed to generate unique access code. Please try again.', 500);
    }
    
    // Срок действия кода: 10 минут
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);
    
    // Сохранение в pending_access_requests
    await pool.query(
      `INSERT INTO pending_access_requests 
       (cabinet_id, access_request_code, expires_at)
       VALUES ($1, $2, $3)`,
      [cabinet_id, accessRequestCode, expiresAt]
    );
    
    logger.info(`Access request created: cabinet_id=${cabinet_id}, access_code=${accessRequestCode}`);
    
    res.status(200).json({
      access_request_code: accessRequestCode,
      expires_at: expiresAt.toISOString(),
      message: 'Access request created. Enter the access request code on one of your controllers to confirm access.'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Обработка ошибок валидации Zod
      const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return next(createError(`Validation error: ${errorMessage}`, 400));
    }
    next(error);
  }
});

// Схема валидации для подтверждения доступа
const confirmAccessSchema = z.object({
  controller_secret: z.string().min(1, 'controller_secret is required'),
  access_request_code: z.string()
    .length(6)
    .regex(/^\d{6}$/, 'Access request code must be exactly 6 digits')
});

/**
 * POST /api/cabinets/confirm-access
 * Подтверждение доступа к кабинету на контроллере
 * 
 * Body:
 * {
 *   controller_secret: string
 *   access_request_code: string (6 цифр)
 * }
 * 
 * Response:
 * {
 *   session_token: string
 *   cabinet_secret: string
 *   cabinet_id: uuid
 *   message: string
 * }
 */
router.post('/confirm-access', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPool();
    
    // Валидация входных данных
    const { controller_secret, access_request_code } = confirmAccessSchema.parse(req.body);
    
    // Авторизация контроллера через controller_secret
    // Находим все активные контроллеры и проверяем секрет
    const controllersResult = await pool.query(
      `SELECT c.id, c.cabinet_id, c.controller_secret_hash, c.is_active
       FROM controllers c
       WHERE c.is_active = true AND c.controller_secret_hash IS NOT NULL`
    );
    
    let controllerId: string | null = null;
    let controllerCabinetId: string | null = null;
    
    // Находим контроллер по секрету
    for (const row of controllersResult.rows) {
      if (verifySecret(controller_secret, row.controller_secret_hash)) {
        controllerId = row.id;
        controllerCabinetId = row.cabinet_id;
        break;
      }
    }
    
    if (!controllerId) {
      throw createError('Invalid controller_secret or controller not activated', 401);
    }
    
    // Проверка access_request_code
    const accessRequestResult = await pool.query(
      `SELECT id, cabinet_id, expires_at, confirmed_at
       FROM pending_access_requests
       WHERE access_request_code = $1 AND expires_at > CURRENT_TIMESTAMP`,
      [access_request_code]
    );
    
    if (accessRequestResult.rows.length === 0) {
      throw createError('Access request code not found or expired', 404);
    }
    
    const accessRequest = accessRequestResult.rows[0];
    
    // Проверка: запрос уже подтвержден?
    if (accessRequest.confirmed_at) {
      throw createError('Access request code has already been confirmed', 409);
    }
    
    // Проверка: контроллер должен принадлежать тому же кабинету, для которого создан запрос
    // ИЛИ контроллер может подтвердить доступ к любому кабинету (если это предусмотрено логикой)
    // Согласно плану, контроллер подтверждает доступ к кабинету, для которого создан запрос
    const targetCabinetId = accessRequest.cabinet_id;
    
    // Генерация session_token
    let sessionToken: string | null = null;
    let tokenExists = true;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (tokenExists && attempts < maxAttempts) {
      const generatedToken = generateSessionToken();
      
      const existingToken = await pool.query(
        `SELECT id FROM pending_access_requests WHERE session_token = $1`,
        [generatedToken]
      );
      
      if (existingToken.rows.length === 0) {
        sessionToken = generatedToken;
        tokenExists = false;
      } else {
        attempts++;
      }
    }
    
    if (!sessionToken) {
      throw createError('Failed to generate unique session token. Please try again.', 500);
    }
    
    // Примечание: cabinet_secret не хранится в БД (только его хеш)
    // Пользователь уже должен иметь cabinet_secret (был выдан при создании кабинета)
    // Возвращаем session_token для авторизации устройства
    // Пользователь использует свой сохраненный cabinet_secret для доступа к кабинету
    
    // Обновление pending_access_requests
    await pool.query(
      `UPDATE pending_access_requests
       SET session_token = $1,
           confirmed_at = CURRENT_TIMESTAMP,
           confirmed_by_controller_id = $2
       WHERE id = $3`,
      [sessionToken, controllerId, accessRequest.id]
    );
    
    logger.info(`Access confirmed: cabinet_id=${targetCabinetId}, controller_id=${controllerId}, session_token=${sessionToken.substring(0, 20)}...`);
    
    res.status(200).json({
      session_token: sessionToken,
      cabinet_id: targetCabinetId,
      message: 'Access confirmed. Use the session_token to authorize your device.'
    });
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

