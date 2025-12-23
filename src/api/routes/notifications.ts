import express, { Request, Response, NextFunction } from 'express';
import { getPool } from '../../database';
import { authenticateToken } from '../../middleware/auth';

const router = express.Router();

router.use(authenticateToken);

// Get user notifications
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const pool = getPool();

    const result = await pool.query(
      `SELECT id, type, title, message, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId]
    );

    res.json({
      notifications: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// Mark notification as read
router.put('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const notificationId = req.params.id;
    const pool = getPool();

    await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      [notificationId, userId]
    );

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
});

export default router;

