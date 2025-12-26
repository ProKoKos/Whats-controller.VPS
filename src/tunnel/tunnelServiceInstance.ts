import { TunnelService } from './TunnelService';
import { WebSocketServer } from 'ws';

let tunnelServiceInstance: TunnelService | null = null;

export function initializeTunnelService(wsServer: WebSocketServer): TunnelService {
  if (!tunnelServiceInstance) {
    tunnelServiceInstance = new TunnelService(wsServer);
  }
  return tunnelServiceInstance;
}

export function getTunnelService(): TunnelService {
  if (!tunnelServiceInstance) {
    throw new Error('TunnelService not initialized');
  }
  return tunnelServiceInstance;
}

