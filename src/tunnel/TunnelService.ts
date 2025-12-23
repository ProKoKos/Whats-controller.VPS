import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../database';
import { getRedisClient } from '../services/redis';
import { logger } from '../utils/logger';
import { NotificationService } from '../services/notifications';

interface TunnelConnection {
  ws: WebSocket;
  controllerId: string;
  userId: string;
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
  token?: string;
  mac?: string;
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
      let controllerId: string;
      let userId: string;
      let macAddress: string;

      // If token provided, it's activation
      if (message.token) {
        const result = await pool.query(
          `SELECT c.id, c.user_id, c.mac_address 
           FROM controllers c
           WHERE c.activation_token = $1 AND c.is_active = false`,
          [message.token]
        );

        if (result.rows.length === 0) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid or expired activation token'
          }));
          ws.close();
          return;
        }

        const controller = result.rows[0];
        controllerId = controller.id;
        userId = controller.user_id;
        macAddress = controller.mac_address;

        // Activate controller
        await pool.query(
          `UPDATE controllers 
           SET is_active = true, 
               activation_token = NULL,
               last_seen_at = CURRENT_TIMESTAMP,
               firmware_version = COALESCE($1, firmware_version),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [message.firmwareVersion, controllerId]
        );

        logger.info(`Controller activated: ${macAddress} (${controllerId})`);
      } else if (message.mac) {
        // Regular connection with MAC address
        const result = await pool.query(
          `SELECT c.id, c.user_id, c.mac_address 
           FROM controllers c
           WHERE c.mac_address = $1 AND c.is_active = true`,
          [message.mac.toUpperCase()]
        );

        if (result.rows.length === 0) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Controller not found or not activated'
          }));
          ws.close();
          return;
        }

        const controller = result.rows[0];
        controllerId = controller.id;
        userId = controller.user_id;
        macAddress = controller.mac_address;

        // Update last seen
        await pool.query(
          `UPDATE controllers 
           SET last_seen_at = CURRENT_TIMESTAMP,
               firmware_version = COALESCE($1, firmware_version),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [message.firmwareVersion, controllerId]
        );
      } else {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Either token or mac required'
        }));
        ws.close();
        return;
      }

      // Store connection
      const connection: TunnelConnection = {
        ws,
        controllerId,
        userId,
        macAddress,
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

      // Send notification about controller coming online
      await NotificationService.notifyControllerOnline(userId, controllerId, macAddress);
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

      // Send notification about controller going offline
      await NotificationService.notifyControllerOffline(
        connection.userId,
        connection.controllerId,
        connection.macAddress
      );

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
    const redis = getRedisClient();
    const sessionId = await redis.get(`controller:${controllerId}:session`);
    
    if (!sessionId) {
      throw new Error('Controller not connected');
    }

    const connection = this.connections.get(sessionId as string);
    if (!connection) {
      throw new Error('Controller connection not found');
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

  public getConnection(controllerId: string): TunnelConnection | undefined {
    // This would need Redis lookup in production
    for (const conn of this.connections.values()) {
      if (conn.controllerId === controllerId) {
        return conn;
      }
    }
    return undefined;
  }
}

