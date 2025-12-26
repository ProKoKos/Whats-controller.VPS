import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

import { initializeDatabase } from './database';
import { initializeRedis } from './services/redis';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';

// Routes
import controllerRoutes from './api/routes/controllers';
import superadminRoutes from './api/routes/superadmin';

// Tunnel service
import { initializeTunnelService } from './tunnel/tunnelServiceInstance';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const wsServer = new WebSocketServer({ 
  server: httpServer,
  path: process.env.TUNNEL_PATH || '/tunnel'
});

const PORT = process.env.PORT || 3000;
const TUNNEL_PORT = process.env.TUNNEL_PORT || 3001;

// CORS (first)
// Разрешаем запросы с контроллеров (локальные IP) и с основного домена
const allowedOrigins: (string | RegExp)[] = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:3001'];
// Добавляем поддержку локальных IP адресов для контроллеров
allowedOrigins.push(/^http:\/\/192\.168\.\d+\.\d+$/);
allowedOrigins.push(/^http:\/\/10\.\d+\.\d+\.\d+$/);
allowedOrigins.push(/^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+$/);

app.use(cors({
  origin: (origin, callback) => {
    // Разрешаем запросы без origin (например, из мобильных приложений)
    if (!origin) {
      return callback(null, true);
    }
    
    // Проверяем точное совпадение
    if (allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return allowed === origin;
      } else if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    })) {
      return callback(null, true);
    }
    
    callback(null, true); // Разрешаем все для контроллеров (можно ужесточить позже)
  },
  credentials: true
}));

// Middleware (configure Helmet to not block static content)
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for landing page with inline styles
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Статические HTML файлы удалены - теперь используем Next.js frontend
// Frontend запускается отдельно на порту 3001

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/controllers', controllerRoutes);
app.use('/api/superadmin', superadminRoutes);

// Error handler
app.use(errorHandler);

// Initialize services
async function start() {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info('Database connected');

    // Initialize Redis
    await initializeRedis();
    logger.info('Redis connected');

    // Initialize tunnel service
    const tunnelService = initializeTunnelService(wsServer);
    logger.info('Tunnel service initialized');

    // Proxy routes (needs tunnel service) - будет добавлено позже
    // app.use('/proxy', createProxyRouter(tunnelService));

    // Start HTTP server
    httpServer.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`WebSocket tunnel available on path: ${process.env.TUNNEL_PATH || '/tunnel'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

start();

