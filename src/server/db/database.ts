import Database from 'better-sqlite3';
import path from 'path';

export type DatabaseInstance = Database.Database;

const DEFAULT_DB_PATH = path.join(process.cwd(), 'data', 'vybecheck.db');

/**
 * Initialize the SQLite database with all tables.
 * Uses WAL mode for better concurrent read performance.
 */
export function initDatabase(dbPath?: string): DatabaseInstance {
  const resolvedPath = dbPath || process.env.DB_PATH || DEFAULT_DB_PATH;
  const db = new Database(resolvedPath);

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  createTables(db);
  return db;
}

/**
 * Initialize an in-memory database (for testing).
 */
export function initTestDatabase(): DatabaseInstance {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  createTables(db);
  return db;
}

function createTables(db: DatabaseInstance): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      twitter_id TEXT UNIQUE,
      username TEXT,
      display_name TEXT,
      profile_image_url TEXT,
      access_token TEXT,
      refresh_token TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('live', 'active', 'expired')),
      results_released INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      user_id TEXT REFERENCES users(id),
      username TEXT,
      is_owner INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      joined_at TEXT NOT NULL,
      last_active_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      prompt TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      timer INTEGER,
      sort_order INTEGER NOT NULL,
      added_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS responses (
      id TEXT PRIMARY KEY,
      participant_id TEXT NOT NULL REFERENCES participants(id),
      question_id TEXT NOT NULL REFERENCES questions(id),
      session_id TEXT NOT NULL REFERENCES sessions(id),
      option_chosen TEXT NOT NULL,
      answered_at TEXT NOT NULL,
      UNIQUE(participant_id, question_id)
    );

    CREATE TABLE IF NOT EXISTS ledger (
      id TEXT PRIMARY KEY,
      participant_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS feature_unlocks (
      id TEXT PRIMARY KEY,
      participant_id TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      feature TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(participant_id, resource_id, feature)
    );

    CREATE TABLE IF NOT EXISTS processed_stripe_sessions (
      session_id TEXT PRIMARY KEY,
      processed_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_participants_session ON participants(session_id);
    CREATE INDEX IF NOT EXISTS idx_questions_session ON questions(session_id);
    CREATE INDEX IF NOT EXISTS idx_responses_session ON responses(session_id);
    CREATE INDEX IF NOT EXISTS idx_responses_participant ON responses(participant_id);
    CREATE INDEX IF NOT EXISTS idx_ledger_participant ON ledger(participant_id);
    CREATE INDEX IF NOT EXISTS idx_feature_unlocks_participant ON feature_unlocks(participant_id);
  `);
}
