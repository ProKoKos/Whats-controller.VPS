import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../../database';
import { createError } from '../../middleware/errorHandler';
import { authenticateToken } from '../../middleware/auth';
import { logger } from '../../utils/logger';

const router = express.Router();

// All routes require authentication
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

