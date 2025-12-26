import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../database';
import { getRedisClient } from '../services/redis';
import { logger } from '../utils/logger';
import { NotificationService } from '../services/notifications';
import { verifySecret } from '../utils/crypto';

interface TunnelConnection {
  ws: WebSocket;
  controllerId: string;
  cabinetId: string | null;
  macAddress: string;
  connectedAt: Date;
}

interface HttpRequestMessage {
  type: 'http_request';
  id: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: string;
}

interface HttpResponseMessage {
  type: 'http_response';
  id: string;
  status: number;
  headers: Record<string, string>;
  body: string;
}

interface RegisterMessage {
  type: 'register';
  controller_secret: string;
  firmwareVersion?: string;
}

export class TunnelService {
  private connections: Map<string, TunnelConnection> = new Map();
  private pendingRequests: Map<string, {
    resolve: (response: HttpResponseMessage) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  constructor(private wss: WebSocketServer) {
    this.setupWebSocketServer();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
      const connectionId = uuidv4();
      logger.info(`New WebSocket connection: ${connectionId}`);

      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.type === 'register') {
            await this.handleRegister(ws, message as RegisterMessage, connectionId);
          } else if (message.type === 'http_response') {
            await this.handleHttpResponse(message as HttpResponseMessage);
          }
        } catch (error) {
          logger.error('Error processing WebSocket message:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }));
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(connectionId);
      });

      ws.on('error', (error) => {
        logger.error(`WebSocket error for connection ${connectionId}:`, error);
        this.handleDisconnect(connectionId);
      });
    });
  }

  private async handleRegister(
    ws: WebSocket,
    message: RegisterMessage,
    connectionId: string
  ): Promise<void> {
    const pool = getPool();

    try {
      // Validate controller_secret
      if (!message.controller_secret || typeof message.controller_secret !== 'string') {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'controller_secret is required'
        }));
        ws.close();
        return;
      }

      // Find controller by matching controller_secret_hash
      // Note: We cannot directly query by hash since we need to verify the secret.
      // This requires checking all active controllers. For better performance with many controllers,
      // consider adding a cache layer or using a different authentication mechanism.
      const result = await pool.query(
        `SELECT c.id, c.cabinet_id, c.mac_address, c.controller_secret_hash, c.is_active
         FROM controllers c
         WHERE c.is_active = true AND c.controller_secret_hash IS NOT NULL
         ORDER BY c.last_seen_at DESC NULLS LAST
         LIMIT 1000`
      );

      let controllerId: string | null = null;
      let cabinetId: string | null = null;
      let macAddress: string | null = null;

      // Find matching controller by verifying the secret
      // Using timing-safe comparison to prevent timing attacks
      for (const row of result.rows) {
        if (verifySecret(message.controller_secret, row.controller_secret_hash)) {
          controllerId = row.id;
          cabinetId = row.cabinet_id;
          macAddress = row.mac_address;
          break;
        }
      }

      if (!controllerId) {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid controller_secret or controller not activated'
        }));
        ws.close();
        return;
      }

      // Update last seen and firmware version
      await pool.query(
        `UPDATE controllers 
         SET last_seen_at = CURRENT_TIMESTAMP,
             firmware_version = COALESCE($1, firmware_version),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [message.firmwareVersion, controllerId]
      );

      // Store connection
      const connection: TunnelConnection = {
        ws,
        controllerId,
        cabinetId,
        macAddress: macAddress || 'unknown',
        connectedAt: new Date()
      };
      this.connections.set(connectionId, connection);

      // Store session in database
      await pool.query(
        `INSERT INTO controller_sessions (controller_id, websocket_id, connected_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)`,
        [controllerId, connectionId]
      );

      // Store in Redis for quick lookup
      const redis = getRedisClient();
      await redis.set(`controller:${controllerId}:session`, connectionId, {
        EX: 3600 // 1 hour TTL
      });
      await redis.set(`session:${connectionId}:controller`, controllerId, {
        EX: 3600
      });

      ws.send(JSON.stringify({
        type: 'registered',
        controllerId,
        status: 'active'
      }));

      logger.info(`Controller registered: ${macAddress} (${controllerId})`);

      // Send notification about controller coming online (if cabinet_id exists)
      // Note: NotificationService still uses userId, so we'll skip notifications for now
      // TODO: Update NotificationService to use cabinet_id
      if (cabinetId) {
        // For now, we'll log instead of sending notification
        // await NotificationService.notifyControllerOnline(cabinetId, controllerId, macAddress || 'unknown');
        logger.info(`Controller ${controllerId} (${macAddress}) came online for cabinet ${cabinetId}`);
      }
    } catch (error) {
      logger.error('Error during controller registration:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Registration failed'
      }));
      ws.close();
    }
  }

  private async handleHttpResponse(message: HttpResponseMessage): Promise<void> {
    const pending = this.pendingRequests.get(message.id);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.resolve(message);
      this.pendingRequests.delete(message.id);
    }
  }

  private async handleDisconnect(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (connection) {
      logger.info(`Controller disconnected: ${connection.macAddress} (${connection.controllerId})`);

      // Update session in database
      const pool = getPool();
      await pool.query(
        `UPDATE controller_sessions 
         SET disconnected_at = CURRENT_TIMESTAMP 
         WHERE websocket_id = $1`,
        [connectionId]
      );

      // Update controller last_seen
      await pool.query(
        `UPDATE controllers 
         SET last_seen_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [connection.controllerId]
      );

      // Remove from Redis
      const redis = getRedisClient();
      if (connection.controllerId) {
        await redis.del(`controller:${connection.controllerId}:session`);
      }
      await redis.del(`session:${connectionId}:controller`);

      // Send notification about controller going offline (if cabinet_id exists)
      // Note: NotificationService still uses userId, so we'll skip notifications for now
      // TODO: Update NotificationService to use cabinet_id
      if (connection.cabinetId) {
        // For now, we'll log instead of sending notification
        // await NotificationService.notifyControllerOffline(
        //   connection.cabinetId,
        //   connection.controllerId,
        //   connection.macAddress
        // );
        logger.info(`Controller ${connection.controllerId} (${connection.macAddress}) went offline for cabinet ${connection.cabinetId}`);
      }

      this.connections.delete(connectionId);
    }
  }

  public async proxyHttpRequest(
    controllerId: string,
    method: string,
    path: string,
    headers: Record<string, string>,
    body?: string
  ): Promise<{ status: number; headers: Record<string, string>; body: string }> {
    // Find connection for this controller
    const connection = await this.getConnection(controllerId);
    
    if (!connection) {
      throw new Error('Controller not connected');
    }

    // Create request message
    const requestId = uuidv4();
    const requestMessage: HttpRequestMessage = {
      type: 'http_request',
      id: requestId,
      method,
      path,
      headers,
      body
    };

    // Send request and wait for response
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, 30000); // 30 second timeout

      this.pendingRequests.set(requestId, {
        resolve: (response: HttpResponseMessage) => {
          resolve({
            status: response.status,
            headers: response.headers,
            body: response.body
          });
        },
        reject,
        timeout
      });

      connection.ws.send(JSON.stringify(requestMessage));
    });
  }

  public async getConnection(controllerId: string): Promise<TunnelConnection | undefined> {
    // Сначала проверяем в памяти
    for (const conn of this.connections.values()) {
      if (conn.controllerId === controllerId) {
        return conn;
      }
    }
    
    // Если не найдено в памяти, проверяем Redis
    const redis = getRedisClient();
    const sessionId = await redis.get(`controller:${controllerId}:session`);
    
    if (sessionId) {
      const connection = this.connections.get(sessionId as string);
      if (connection) {
        return connection;
      }
    }
    
    return undefined;
  }
}

