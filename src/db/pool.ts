import mysql, { type RowDataPacket } from 'mysql2/promise';
import { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } from '../config.js';

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
    });
  }
  return pool;
}

let cachedDefaultModel: string | null = null;

interface DefaultModelRow extends RowDataPacket { id: string }

export async function getDefaultModel(): Promise<string> {
  if (cachedDefaultModel) return cachedDefaultModel;
  const db = getPool();
  const [rows] = await db.execute<DefaultModelRow[]>(
    "SELECT id FROM models WHERE is_default = 1 AND enabled = 1 LIMIT 1"
  );
  if (!rows[0]?.id) {
    throw new Error('No default model configured. Add at least one model to the models table with is_default = 1.');
  }
  cachedDefaultModel = rows[0].id;
  return cachedDefaultModel;
}

export function clearModelCache(): void {
  cachedDefaultModel = null;
}
