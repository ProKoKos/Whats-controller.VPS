import express, { Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../../middleware/auth';
import { MetricsService } from '../../services/metrics';
import { getPool } from '../../database';
import { createError } from '../../middleware/errorHandler';

const router = express.Router();

router.use(authenticateToken);

// Get metrics for a controller
router.get('/:controllerId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const controllerId = req.params.controllerId;
    const type = req.query.type as string | undefined;
    const from = req.query.from ? new Date(req.query.from as string) : undefined;
    const to = req.query.to ? new Date(req.query.to as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 1000;

    // Verify ownership
    const pool = getPool();
    const check = await pool.query(
      'SELECT id FROM controllers WHERE id = $1 AND user_id = $2',
      [controllerId, userId]
    );

    if (check.rows.length === 0) {
      throw createError('Controller not found', 404);
    }

    const metrics = await MetricsService.getMetrics(controllerId, type, from, to, limit);

    res.json({
      controllerId,
      metrics,
      count: metrics.length
    });
  } catch (error) {
    next(error);
  }
});

export default router;

