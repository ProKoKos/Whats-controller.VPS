import express, { Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../../middleware/auth';
import { TunnelService } from '../../tunnel/TunnelService';
import { getPool } from '../../database';
import { createError } from '../../middleware/errorHandler';

const router = express.Router();

// This router needs access to TunnelService instance
// We'll use a factory function to pass it
export function createProxyRouter(tunnelService: TunnelService) {
  // All routes require authentication
  router.use(authenticateToken);

  // Proxy all requests to controller
  router.all('/:controllerId/*', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const controllerId = req.params.controllerId;
      const path = req.params[0] || '/';

      // Verify ownership
      const pool = getPool();
      const result = await pool.query(
        'SELECT id FROM controllers WHERE id = $1 AND user_id = $2',
        [controllerId, userId]
      );

      if (result.rows.length === 0) {
        throw createError('Controller not found', 404);
      }

      // Extract headers (exclude host, connection, etc.)
      const headers: Record<string, string> = {};
      Object.keys(req.headers).forEach(key => {
        const lowerKey = key.toLowerCase();
        if (!['host', 'connection', 'upgrade', 'content-length'].includes(lowerKey)) {
          const value = req.headers[key];
          if (typeof value === 'string') {
            headers[key] = value;
          } else if (Array.isArray(value)) {
            headers[key] = value.join(', ');
          }
        }
      });

      // Get request body
      let body: string | undefined;
      if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
        body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      }

      // Proxy request through tunnel
      const response = await tunnelService.proxyHttpRequest(
        controllerId,
        req.method,
        path,
        headers,
        body
      );

      // Send response
      Object.keys(response.headers).forEach(key => {
        res.setHeader(key, response.headers[key]);
      });
      res.status(response.status).send(response.body);
    } catch (error: any) {
      if (error.message === 'Controller not connected') {
        res.status(503).json({
          error: 'Controller is offline',
          message: 'The controller is not currently connected'
        });
      } else {
        next(error);
      }
    }
  });

  return router;
}

