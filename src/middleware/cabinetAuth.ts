import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getPool } from '../database';
import { createError } from './errorHandler';

interface CabinetJwtPayload {
  cabinetId: string;
  deviceId: string;
  deviceFingerprint: string;
  type: 'cabinet';
}

declare global {
  namespace Express {
    interface Request {
      cabinetId?: string;
      deviceId?: string;
      deviceFingerprint?: string;
    }
  }
}

/**
 * Middleware для авторизации кабинетов
 * Проверяет JWT токен, сгенерированный при входе в кабинет
 */
export function authenticateCabinet(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    throw createError('Access token required', 401);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as CabinetJwtPayload;
    
    // Проверка типа токена
    if (decoded.type !== 'cabinet') {
      throw createError('Invalid token type', 403);
    }
    
    // Проверка наличия обязательных полей
    if (!decoded.cabinetId || !decoded.deviceId || !decoded.deviceFingerprint) {
      throw createError('Invalid token payload', 403);
    }
    
    // Сохранение данных в request для использования в роутах
    (req as any).cabinetId = decoded.cabinetId;
    (req as any).deviceId = decoded.deviceId;
    (req as any).deviceFingerprint = decoded.deviceFingerprint;
    
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw createError('Invalid token', 403);
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw createError('Token expired', 403);
    }
    throw createError('Invalid or expired token', 403);
  }
}

/**
 * Middleware для проверки прав доступа к контроллеру
 * Проверяет, что контроллер принадлежит кабинету пользователя
 */
export async function checkControllerAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const pool = getPool();
    const cabinetId = (req as any).cabinetId;
    const controllerId = req.params.id || req.params.controllerId || req.body.controller_id;

    if (!cabinetId) {
      throw createError('Cabinet authentication required', 401);
    }

    if (!controllerId) {
      throw createError('Controller ID is required', 400);
    }

    // Проверка, что контроллер принадлежит кабинету
    const controllerResult = await pool.query(
      `SELECT id, cabinet_id, is_active
       FROM controllers
       WHERE id = $1 AND cabinet_id = $2`,
      [controllerId, cabinetId]
    );

    if (controllerResult.rows.length === 0) {
      throw createError('Controller not found or access denied', 404);
    }

    const controller = controllerResult.rows[0];

    // Проверка, что контроллер активен
    if (!controller.is_active) {
      throw createError('Controller is not active', 403);
    }

    // Сохранение данных контроллера в request
    (req as any).controllerId = controller.id;
    (req as any).controllerCabinetId = controller.cabinet_id;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Комбинированный middleware: авторизация кабинета + проверка доступа к контроллеру
 */
export const authenticateCabinetAndCheckController = [
  authenticateCabinet,
  checkControllerAccess
];

