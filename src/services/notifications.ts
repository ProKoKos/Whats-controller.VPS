import { getPool } from '../database';
import { logger } from '../utils/logger';
import { getRedisClient } from './redis';

export enum NotificationType {
  CONTROLLER_ONLINE = 'controller_online',
  CONTROLLER_OFFLINE = 'controller_offline',
  CONTROLLER_ERROR = 'controller_error',
  SYSTEM_ALERT = 'system_alert',
  INFO = 'info'
}

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
}

export class NotificationService {
  /**
   * Создать уведомление
   */
  static async create(params: CreateNotificationParams): Promise<string> {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [params.userId, params.type, params.title, params.message || null]
    );

    const notificationId = result.rows[0].id;

    // Отправить через WebSocket если пользователь онлайн (будущая реализация)
    // Пока просто логируем
    logger.info(`Notification created: ${notificationId} for user ${params.userId}`);

    return notificationId;
  }

  /**
   * Отправить уведомление о подключении контроллера
   */
  static async notifyControllerOnline(userId: string, controllerId: string, macAddress: string): Promise<void> {
    await this.create({
      userId,
      type: NotificationType.CONTROLLER_ONLINE,
      title: 'Контроллер подключен',
      message: `Контроллер ${macAddress} подключился к системе`
    });
  }

  /**
   * Отправить уведомление об отключении контроллера
   */
  static async notifyControllerOffline(userId: string, controllerId: string, macAddress: string): Promise<void> {
    await this.create({
      userId,
      type: NotificationType.CONTROLLER_OFFLINE,
      title: 'Контроллер отключен',
      message: `Контроллер ${macAddress} отключился от системы`
    });
  }

  /**
   * Отправить уведомление об ошибке контроллера
   */
  static async notifyControllerError(
    userId: string,
    controllerId: string,
    macAddress: string,
    errorMessage: string
  ): Promise<void> {
    await this.create({
      userId,
      type: NotificationType.CONTROLLER_ERROR,
      title: 'Ошибка контроллера',
      message: `Контроллер ${macAddress}: ${errorMessage}`
    });
  }
}

