import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import pino from 'pino';
import { getPool } from '../db/pool.js';
import type { CountRow, UserRow } from '../db/types.js';

const log = pino({ name: 'auth-db' });

const BCRYPT_ROUNDS = 12;

export async function seedAdminUser() {
  const db = getPool();
  const [rows] = await db.execute<CountRow[]>('SELECT COUNT(*) as c FROM users');
  if (rows[0].c === 0) {
    const hash = await hashPassword('supaproxy2026');
    await db.execute(
      'INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [randomBytes(16).toString('hex'), 'admin@supaproxy.dev', 'Supaproxy Admin', hash, 'admin']
    );
    log.info('Seeded default admin user');
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  // Support legacy SHA256 hashes (salt:hash format) during migration
  if (stored.includes(':') && stored.length < 200) {
    const { createHash } = await import('crypto');
    const [salt, hash] = stored.split(':');
    const check = createHash('sha256').update(password + salt).digest('hex');
    return check === hash;
  }
  // bcrypt hash
  return bcrypt.compare(password, stored);
}

export async function findUserByEmail(email: string) {
  const [rows] = await getPool().execute<UserRow[]>('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0] || null;
}
