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

interface ValueRow extends RowDataPacket { value: string }

export async function getDefaultModel(): Promise<string> {
  const db = getPool();
  const [rows] = await db.execute<ValueRow[]>(
    "SELECT value FROM org_settings WHERE key_name = 'default_model'"
  );
  if (!rows[0]?.value) {
    throw new Error('No default model configured. Set a default model in Settings > Integrations.');
  }
  return rows[0].value;
}
