import mysql from 'mysql2/promise';
import pino from 'pino';
import type { ColumnInfoRow } from './types.js';

const log = pino({ name: 'migrations' });

interface Migration {
  version: number;
  name: string;
  up: (pool: mysql.Pool) => Promise<void>;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial schema',
    up: async (pool) => {
      // --- Organisation layer ---

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS organisations (
          id VARCHAR(64) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(100) UNIQUE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS org_settings (
          id VARCHAR(64) PRIMARY KEY,
          org_id VARCHAR(64) NOT NULL,
          key_name VARCHAR(100) NOT NULL,
          value TEXT NOT NULL,
          is_secret BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE,
          UNIQUE KEY unique_setting (org_id, key_name)
        )
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS org_compliance (
          id VARCHAR(64) PRIMARY KEY,
          org_id VARCHAR(64) NOT NULL,
          rule_type VARCHAR(50) NOT NULL,
          enabled BOOLEAN DEFAULT TRUE,
          config JSON NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE,
          UNIQUE KEY unique_org_rule (org_id, rule_type)
        )
      `);

      // --- Teams (belongs to org) ---

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS teams (
          id VARCHAR(64) PRIMARY KEY,
          org_id VARCHAR(64) NOT NULL,
          name VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE,
          UNIQUE KEY unique_team_name (org_id, name)
        )
      `);

      // --- Users (belongs to org, optionally to a team) ---

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(64) PRIMARY KEY,
          org_id VARCHAR(64),
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          password_hash VARCHAR(512) NOT NULL,
          org_role ENUM('admin', 'workspace_admin', 'user') DEFAULT 'user',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE
        )
      `);

      // --- Workspaces (belongs to org) ---

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS workspaces (
          id VARCHAR(64) PRIMARY KEY,
          org_id VARCHAR(64),
          team_id VARCHAR(64),
          name VARCHAR(255) NOT NULL,
          status ENUM('active', 'paused', 'archived') DEFAULT 'active',
          model VARCHAR(100) NOT NULL,
          system_prompt TEXT,
          max_tool_rounds INT DEFAULT 10,
          max_thread_history INT DEFAULT 50,
          created_by VARCHAR(64),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE,
          FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        )
      `);

      // --- Workspace resources ---

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS connections (
          id VARCHAR(64) PRIMARY KEY,
          workspace_id VARCHAR(64) NOT NULL,
          name VARCHAR(100) NOT NULL,
          type ENUM('mcp', 'rest', 'graphql', 'database', 'webhook') NOT NULL,
          status ENUM('connected', 'disconnected', 'error', 'idle') DEFAULT 'disconnected',
          config JSON NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
          UNIQUE KEY unique_conn_name (workspace_id, name)
        )
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS connection_tools (
          id VARCHAR(64) PRIMARY KEY,
          connection_id VARCHAR(64) NOT NULL,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          input_schema JSON,
          is_write BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE,
          UNIQUE KEY unique_tool_name (connection_id, name)
        )
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS knowledge_sources (
          id VARCHAR(64) PRIMARY KEY,
          workspace_id VARCHAR(64) NOT NULL,
          type ENUM('confluence', 'file', 'inline', 'url') NOT NULL,
          name VARCHAR(255) NOT NULL,
          config JSON NOT NULL,
          status ENUM('pending', 'syncing', 'synced', 'error') DEFAULT 'pending',
          chunks INT DEFAULT 0,
          last_synced_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        )
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS guardrails (
          id VARCHAR(64) PRIMARY KEY,
          workspace_id VARCHAR(64) NOT NULL,
          rule_type VARCHAR(50) NOT NULL,
          enabled BOOLEAN DEFAULT TRUE,
          config JSON NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
          UNIQUE KEY unique_guardrail (workspace_id, rule_type)
        )
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS consumers (
          id VARCHAR(64) PRIMARY KEY,
          workspace_id VARCHAR(64) NOT NULL,
          type ENUM('slack', 'api', 'claude-code', 'whatsapp') NOT NULL,
          config JSON NOT NULL,
          status ENUM('active', 'inactive') DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        )
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS permissions (
          id VARCHAR(64) PRIMARY KEY,
          workspace_id VARCHAR(64) NOT NULL,
          role VARCHAR(50) NOT NULL,
          tool_patterns JSON NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
          UNIQUE KEY unique_role (workspace_id, role)
        )
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id VARCHAR(64) PRIMARY KEY,
          workspace_id VARCHAR(64) NOT NULL,
          consumer_type VARCHAR(20),
          channel VARCHAR(100),
          user_id VARCHAR(64),
          user_name VARCHAR(255),
          query TEXT NOT NULL,
          tools_called JSON,
          connections_hit JSON,
          knowledge_chunks_used INT DEFAULT 0,
          tokens_input INT DEFAULT 0,
          tokens_output INT DEFAULT 0,
          cost_usd DECIMAL(10,6) DEFAULT 0,
          duration_ms INT DEFAULT 0,
          guardrails_applied JSON,
          error TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_workspace (workspace_id),
          INDEX idx_created (created_at),
          INDEX idx_user (user_id),
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        )
      `);

      // --- Conversations (ticket lifecycle) ---

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS conversations (
          id VARCHAR(64) PRIMARY KEY,
          workspace_id VARCHAR(64) NOT NULL,
          consumer_type VARCHAR(20) NOT NULL,
          external_thread_id VARCHAR(255),
          status ENUM('open', 'cold', 'closed') DEFAULT 'open',
          user_id VARCHAR(64),
          user_name VARCHAR(255),
          channel VARCHAR(100),
          message_count INT DEFAULT 0,
          first_message_at TIMESTAMP NULL,
          last_activity_at TIMESTAMP NULL,
          cold_at TIMESTAMP NULL,
          closed_at TIMESTAMP NULL,
          parent_conversation_id VARCHAR(64),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_workspace_status (workspace_id, status),
          INDEX idx_last_activity (last_activity_at),
          INDEX idx_external_thread (workspace_id, consumer_type, external_thread_id),
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
          FOREIGN KEY (parent_conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
        )
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS conversation_messages (
          id VARCHAR(64) PRIMARY KEY,
          conversation_id VARCHAR(64) NOT NULL,
          role ENUM('user', 'assistant') NOT NULL,
          content TEXT NOT NULL,
          audit_log_id VARCHAR(64),
          seq INT NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_conversation_seq (conversation_id, seq),
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        )
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS conversation_stats (
          id VARCHAR(64) PRIMARY KEY,
          conversation_id VARCHAR(64) NOT NULL UNIQUE,
          sentiment_score TINYINT,
          resolution_status ENUM('resolved', 'unresolved', 'escalated', 'abandoned'),
          compliance_violations JSON,
          knowledge_gaps JSON,
          tools_used JSON,
          total_tokens_input INT DEFAULT 0,
          total_tokens_output INT DEFAULT 0,
          total_cost_usd DECIMAL(10,6) DEFAULT 0,
          total_duration_ms INT DEFAULT 0,
          message_count INT DEFAULT 0,
          duration_seconds INT DEFAULT 0,
          summary TEXT,
          category VARCHAR(30),
          stats_status ENUM('pending', 'complete', 'failed') DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        )
      `);
    },
  },
  {
    version: 2,
    name: 'add seq column to conversation_messages',
    up: async (pool) => {
      const [cols] = await pool.execute<ColumnInfoRow[]>("SHOW COLUMNS FROM conversation_messages LIKE 'seq'");
      if (cols.length === 0) {
        await pool.execute("ALTER TABLE conversation_messages ADD COLUMN seq INT NOT NULL DEFAULT 0 AFTER audit_log_id, ADD INDEX idx_conversation_seq (conversation_id, seq)");
      }
    },
  },
  {
    version: 3,
    name: 'add category column to conversation_stats',
    up: async (pool) => {
      const [cols] = await pool.execute<ColumnInfoRow[]>("SHOW COLUMNS FROM conversation_stats LIKE 'category'");
      if (cols.length === 0) {
        await pool.execute("ALTER TABLE conversation_stats ADD COLUMN category VARCHAR(30) AFTER summary");
      }
    },
  },
  {
    version: 4,
    name: 'add conversation_id to audit_logs',
    up: async (pool) => {
      const [cols] = await pool.execute<ColumnInfoRow[]>("SHOW COLUMNS FROM audit_logs LIKE 'conversation_id'");
      if (cols.length === 0) {
        await pool.execute("ALTER TABLE audit_logs ADD COLUMN conversation_id VARCHAR(64) AFTER workspace_id, ADD INDEX idx_conversation (conversation_id)");
      }
    },
  },
  {
    version: 5,
    name: 'add timeout config to workspaces',
    up: async (pool) => {
      const [cols] = await pool.execute<ColumnInfoRow[]>("SHOW COLUMNS FROM workspaces LIKE 'cold_timeout_minutes'");
      if (cols.length === 0) {
        await pool.execute("ALTER TABLE workspaces ADD COLUMN cold_timeout_minutes INT DEFAULT 30, ADD COLUMN close_timeout_minutes INT DEFAULT 60");
      }
    },
  },
];

interface SchemaMigrationRow extends mysql.RowDataPacket {
  version: number;
}

export async function runMigrations(pool: mysql.Pool) {
  log.info('Running migrations...');

  // Ensure schema_migrations tracking table exists
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Fetch already-applied versions
  const [applied] = await pool.execute<SchemaMigrationRow[]>(
    'SELECT version FROM schema_migrations ORDER BY version'
  );
  const appliedVersions = new Set(applied.map((row) => row.version));

  // Run each unapplied migration in order
  const pending = migrations
    .filter((m) => !appliedVersions.has(m.version))
    .sort((a, b) => a.version - b.version);

  if (pending.length === 0) {
    log.info('No pending migrations');
    return;
  }

  for (const migration of pending) {
    log.info({ version: migration.version, name: migration.name }, 'Applying migration');
    try {
      await migration.up(pool);
      await pool.execute(
        'INSERT INTO schema_migrations (version, name) VALUES (?, ?)',
        [migration.version, migration.name]
      );
      log.info({ version: migration.version }, 'Migration applied');
    } catch (err) {
      log.error({ err, version: migration.version, name: migration.name }, 'Migration failed');
      throw err;
    }
  }

  log.info({ applied: pending.length, total: migrations.length }, 'Migrations complete');
}
