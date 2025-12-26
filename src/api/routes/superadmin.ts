import express, { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import { getPool } from '../../database';
import { createError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { authenticateSuperadmin } from '../../middleware/superadminAuth';

const router = express.Router();

// Схемы валидации
const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required')
});

const changeCredentialsSchema = z.object({
  username: z.string().min(1, 'Username is required').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  currentPassword: z.string().min(1, 'Current password is required')
}).refine(
  (data) => data.username || data.password,
  {
    message: 'Either username or password must be provided',
    path: ['username']
  }
);

/**
 * POST /api/superadmin/login
 * Авторизация суперадмина
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = loginSchema.parse(req.body);
    const pool = getPool();

    // Поиск суперадмина
    const result = await pool.query(
      'SELECT id, username, password_hash, is_active FROM superadmins WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      throw createError('Invalid username or password', 401);
    }

    const superadmin = result.rows[0];

    // Проверка активности
    if (!superadmin.is_active) {
      throw createError('Superadmin account is inactive', 403);
    }

    // Проверка пароля
    const isValid = await bcrypt.compare(password, superadmin.password_hash);
    if (!isValid) {
      throw createError('Invalid username or password', 401);
    }

    // Обновление last_login_at
    await pool.query(
      'UPDATE superadmins SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [superadmin.id]
    );

    // Генерация JWT токена
    const accessToken = jwt.sign(
      { 
        superadminId: superadmin.id, 
        username: superadmin.username,
        type: 'superadmin'
      },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' } as SignOptions
    );

    logger.info(`Superadmin logged in: ${superadmin.username}`);

    res.json({
      accessToken,
      superadmin: {
        id: superadmin.id,
        username: superadmin.username
      },
      expires_in: process.env.JWT_EXPIRES_IN || '15m'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return next(createError(`Validation error: ${errorMessage}`, 400));
    }
    next(error);
  }
});

/**
 * GET /api/superadmin/profile
 * Получение профиля суперадмина
 */
router.get('/profile', authenticateSuperadmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const superadminId = (req as any).superadminId;
    const pool = getPool();

    const result = await pool.query(
      `SELECT id, username, is_active, last_login_at, created_at, updated_at
       FROM superadmins
       WHERE id = $1`,
      [superadminId]
    );

    if (result.rows.length === 0) {
      throw createError('Superadmin not found', 404);
    }

    const superadmin = result.rows[0];

    res.json({
      id: superadmin.id,
      username: superadmin.username,
      isActive: superadmin.is_active,
      lastLoginAt: superadmin.last_login_at,
      createdAt: superadmin.created_at,
      updatedAt: superadmin.updated_at
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/superadmin/change-credentials
 * Смена логина/пароля суперадмина
 */
router.put('/change-credentials', authenticateSuperadmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const superadminId = (req as any).superadminId;
    const { username, password, currentPassword } = changeCredentialsSchema.parse(req.body);
    const pool = getPool();

    // Получение текущего суперадмина
    const currentResult = await pool.query(
      'SELECT password_hash, username FROM superadmins WHERE id = $1',
      [superadminId]
    );

    if (currentResult.rows.length === 0) {
      throw createError('Superadmin not found', 404);
    }

    const current = currentResult.rows[0];

    // Проверка текущего пароля
    const isValidPassword = await bcrypt.compare(currentPassword, current.password_hash);
    if (!isValidPassword) {
      throw createError('Invalid current password', 401);
    }

    // Обновление username, если указан
    if (username && username !== current.username) {
      // Проверка уникальности username
      const existingResult = await pool.query(
        'SELECT id FROM superadmins WHERE username = $1 AND id != $2',
        [username, superadminId]
      );

      if (existingResult.rows.length > 0) {
        throw createError('Username already taken', 409);
      }

      await pool.query(
        'UPDATE superadmins SET username = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [username, superadminId]
      );

      logger.info(`Superadmin ${superadminId} changed username to ${username}`);
    }

    // Обновление пароля, если указан
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      await pool.query(
        'UPDATE superadmins SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [passwordHash, superadminId]
      );

      logger.info(`Superadmin ${superadminId} changed password`);
    }

    res.json({
      message: 'Credentials updated successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return next(createError(`Validation error: ${errorMessage}`, 400));
    }
    next(error);
  }
});

/**
 * GET /api/superadmin/cabinets
 * Список всех кабинетов
 */
router.get('/cabinets', authenticateSuperadmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPool();

    const result = await pool.query(
      `SELECT c.id, c.created_at, c.last_activity,
              COUNT(DISTINCT co.id) as controller_count
       FROM cabinets c
       LEFT JOIN controllers co ON co.cabinet_id = c.id
       GROUP BY c.id, c.created_at, c.last_activity
       ORDER BY c.created_at DESC`
    );

    res.json({
      cabinets: result.rows.map(row => ({
        id: row.id,
        createdAt: row.created_at,
        lastActivity: row.last_activity,
        controllerCount: parseInt(row.controller_count) || 0
      }))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/superadmin/cabinets/:id
 * Детали кабинета
 */
router.get('/cabinets/:id', authenticateSuperadmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cabinetId = req.params.id;
    const pool = getPool();

    // Получение информации о кабинете
    const cabinetResult = await pool.query(
      `SELECT id, created_at, last_activity
       FROM cabinets
       WHERE id = $1`,
      [cabinetId]
    );

    if (cabinetResult.rows.length === 0) {
      throw createError('Cabinet not found', 404);
    }

    const cabinet = cabinetResult.rows[0];

    // Получение контроллеров кабинета
    const controllersResult = await pool.query(
      `SELECT id, mac_address, firmware_version, name, is_active, 
              last_seen_at, created_at, updated_at
       FROM controllers
       WHERE cabinet_id = $1
       ORDER BY created_at DESC`,
      [cabinetId]
    );

    res.json({
      id: cabinet.id,
      createdAt: cabinet.created_at,
      lastActivity: cabinet.last_activity,
      controllers: controllersResult.rows.map(row => ({
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

/**
 * DELETE /api/superadmin/controllers/:id
 * Удаление контроллера суперадмином
 */
router.delete('/controllers/:id', authenticateSuperadmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPool();
    const controllerId = req.params.id;

    // Проверяем существование контроллера
    const checkResult = await pool.query(
      'SELECT id FROM controllers WHERE id = $1',
      [controllerId]
    );

    if (checkResult.rows.length === 0) {
      throw createError('Controller not found', 404);
    }

    // Удаляем контроллер (CASCADE удалит связанные записи: pins, authorized_devices)
    await pool.query(
      'DELETE FROM controllers WHERE id = $1',
      [controllerId]
    );

    logger.info(`[SUPERADMIN] Controller deleted: ${controllerId}`);

    res.json({
      message: 'Controller deleted successfully',
      controller_id: controllerId
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/superadmin/controllers
 * Список всех контроллеров
 */
router.get('/controllers', authenticateSuperadmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPool();

    const result = await pool.query(
      `SELECT c.id, c.mac_address, c.firmware_version, c.name, c.is_active,
              c.last_seen_at, c.created_at, c.updated_at, c.cabinet_id
       FROM controllers c
       ORDER BY c.created_at DESC`
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
        updatedAt: row.updated_at,
        cabinetId: row.cabinet_id
      }))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/superadmin/controllers/:id
 * Детали контроллера
 */
router.get('/controllers/:id', authenticateSuperadmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const controllerId = req.params.id;
    const pool = getPool();

    const result = await pool.query(
      `SELECT c.id, c.mac_address, c.firmware_version, c.name, c.is_active,
              c.last_seen_at, c.created_at, c.updated_at, c.cabinet_id
       FROM controllers c
       WHERE c.id = $1`,
      [controllerId]
    );

    if (result.rows.length === 0) {
      throw createError('Controller not found', 404);
    }

    const controller = result.rows[0];

    res.json({
      id: controller.id,
      macAddress: controller.mac_address,
      firmwareVersion: controller.firmware_version,
      name: controller.name || `Controller ${controller.mac_address}`,
      isActive: controller.is_active,
      lastSeenAt: controller.last_seen_at,
      createdAt: controller.created_at,
      updatedAt: controller.updated_at,
      cabinetId: controller.cabinet_id
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/superadmin/controllers/:id/reset
 * Сброс контроллера (отвязка от кабинета)
 */
router.post('/controllers/:id/reset', authenticateSuperadmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const controllerId = req.params.id;
    const pool = getPool();

    // Проверка существования контроллера
    const controllerResult = await pool.query(
      'SELECT id, cabinet_id, mac_address FROM controllers WHERE id = $1',
      [controllerId]
    );

    if (controllerResult.rows.length === 0) {
      throw createError('Controller not found', 404);
    }

    const controller = controllerResult.rows[0];

    // Отвязка от кабинета и деактивация
    await pool.query(
      `UPDATE controllers
       SET cabinet_id = NULL, is_active = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [controllerId]
    );

    logger.info(`Superadmin reset controller ${controllerId} (${controller.mac_address})`);

    res.json({
      message: 'Controller reset successfully',
      controllerId: controller.id
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/superadmin/cabinets/:id
 * Удаление кабинета (с контроллерами)
 */
router.delete('/cabinets/:id', authenticateSuperadmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cabinetId = req.params.id;
    const pool = getPool();

    // Проверка существования кабинета
    const cabinetResult = await pool.query(
      'SELECT id FROM cabinets WHERE id = $1',
      [cabinetId]
    );

    if (cabinetResult.rows.length === 0) {
      throw createError('Cabinet not found', 404);
    }

    // Подсчет контроллеров перед удалением
    const controllersResult = await pool.query(
      'SELECT COUNT(*) as count FROM controllers WHERE cabinet_id = $1',
      [cabinetId]
    );

    const controllerCount = parseInt(controllersResult.rows[0].count) || 0;

    // Удаление кабинета (каскадное удаление контроллеров)
    await pool.query('DELETE FROM cabinets WHERE id = $1', [cabinetId]);

    logger.info(`Superadmin deleted cabinet ${cabinetId} with ${controllerCount} controllers`);

    res.json({
      message: 'Cabinet deleted successfully',
      cabinetId: cabinetId,
      deletedControllers: controllerCount
    });
  } catch (error) {
    next(error);
  }
});

export default router;

