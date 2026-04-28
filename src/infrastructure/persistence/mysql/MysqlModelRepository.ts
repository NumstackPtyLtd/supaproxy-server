import type mysql from 'mysql2/promise'
import type { RowDataPacket } from 'mysql2'
import type { ModelRepository, ModelData } from '../../../application/ports/ModelRepository.js'

interface ModelRow extends RowDataPacket { id: string; label: string; is_default: boolean }

export class MysqlModelRepository implements ModelRepository {
  constructor(private readonly pool: mysql.Pool) {}

  async listByProvider(provider: string): Promise<ModelData[]> {
    const [rows] = await this.pool.execute<ModelRow[]>(
      'SELECT id, label, is_default FROM models WHERE enabled = 1 AND provider = ? ORDER BY sort_order', [provider]
    )
    return rows
  }

  async listAll(): Promise<ModelData[]> {
    const [rows] = await this.pool.execute<ModelRow[]>(
      'SELECT id, label, is_default FROM models WHERE enabled = 1 ORDER BY sort_order'
    )
    return rows
  }
}
