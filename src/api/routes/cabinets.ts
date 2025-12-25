import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import { getPool } from '../../database';
import { createError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { generateConfirmationCode } from '../../utils/crypto';

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

export default router;

