import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getPool } from '../database';
import { createError } from './errorHandler';

interface SuperadminJwtPayload {
  superadminId: string;
  username: string;
  type: 'superadmin';
}

declare global {
  namespace Express {
    interface Request {
      superadminId?: string;
      superadminUsername?: string;
    }
  }
}

/**
 * Middleware для авторизации суперадмина
 * Проверяет JWT токен, сгенерированный при входе суперадмина
 */
export async function authenticateSuperadmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    throw createError('Access token required', 401);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as SuperadminJwtPayload;
    
    // Проверка типа токена
    if (decoded.type !== 'superadmin') {
      throw createError('Invalid token type', 403);
    }
    
    // Проверка наличия обязательных полей
    if (!decoded.superadminId || !decoded.username) {
      throw createError('Invalid token payload', 403);
    }
    
    // Проверка активности суперадмина в БД
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, username, is_active
       FROM superadmins
       WHERE id = $1 AND username = $2`,
      [decoded.superadminId, decoded.username]
    );
    
    if (result.rows.length === 0) {
      throw createError('Superadmin not found', 403);
    }
    
    const superadmin = result.rows[0];
    if (!superadmin.is_active) {
      throw createError('Superadmin account is inactive', 403);
    }
    
    // Сохранение данных в request для использования в роутах
    (req as any).superadminId = decoded.superadminId;
    (req as any).superadminUsername = decoded.username;
    
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw createError('Invalid token', 403);
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw createError('Token expired', 403);
    }
    next(error);
  }
}

