import { getPool } from '../database';
import { logger } from '../utils/logger';

interface MetricData {
  controllerId: string;
  type: string;
  value: any;
  timestamp?: Date;
}

export class MetricsService {
  /**
   * Сохранить метрику
   */
  static async recordMetric(data: MetricData): Promise<void> {
    try {
      const pool = getPool();
      await pool.query(
        `INSERT INTO metrics (controller_id, metric_type, value, timestamp)
         VALUES ($1, $2, $3, $4)`,
        [data.controllerId, data.type, JSON.stringify(data.value), data.timestamp || new Date()]
      );
    } catch (error) {
      logger.error('Error recording metric:', error);
      // Не пробрасываем ошибку, чтобы не нарушать основной поток
    }
  }

  /**
   * Получить метрики контроллера
   */
  static async getMetrics(
    controllerId: string,
    type?: string,
    from?: Date,
    to?: Date,
    limit: number = 1000
  ): Promise<any[]> {
    const pool = getPool();
    let query = `
      SELECT id, metric_type, value, timestamp
      FROM metrics
      WHERE controller_id = $1
    `;
    const params: any[] = [controllerId];
    let paramIndex = 2;

    if (type) {
      query += ` AND metric_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (from) {
      query += ` AND timestamp >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }

    if (to) {
      query += ` AND timestamp <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }

    query += ` ORDER BY timestamp DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await pool.query(query, params);
    return result.rows.map(row => ({
      id: row.id,
      type: row.metric_type,
      value: row.value,
      timestamp: row.timestamp
    }));
  }

  /**
   * Очистить старые метрики (старше указанного количества дней)
   */
  static async cleanupOldMetrics(days: number = 90): Promise<number> {
    const pool = getPool();
    const result = await pool.query(
      `DELETE FROM metrics 
       WHERE timestamp < NOW() - INTERVAL '${days} days'`
    );
    return result.rowCount || 0;
  }
}

