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
import authRoutes from './api/routes/auth';
import controllerRoutes from './api/routes/controllers';
import notificationRoutes from './api/routes/notifications';
import metricsRoutes from './api/routes/metrics';
import { createProxyRouter } from './api/routes/proxy';

// Tunnel service
import { TunnelService } from './tunnel/TunnelService';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const wsServer = new WebSocketServer({ 
  server: httpServer,
  path: process.env.TUNNEL_PATH || '/tunnel'
});

const PORT = process.env.PORT || 3000;
const TUNNEL_PORT = process.env.TUNNEL_PORT || 3001;

// Serve static files first (before helmet to avoid CSP issues)
app.use(express.static(path.join(__dirname, 'public')));

// Landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Middleware (after static files)
app.use(helmet({
  contentSecurityPolicy: false // Disable CSP for landing page with inline styles
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/controllers', controllerRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/metrics', metricsRoutes);

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
    const tunnelService = new TunnelService(wsServer);
    logger.info('Tunnel service initialized');

    // Proxy routes (needs tunnel service)
    app.use('/proxy', createProxyRouter(tunnelService));

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

