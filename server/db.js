import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine safe storage path
function getDataDirectory() {
  if (process.env.RUXT_DATA_DIR) {
    return process.env.RUXT_DATA_DIR;
  }
  // If running in packaged app on Windows
  if (process.env.APPDATA && process.env.NODE_ENV === 'production') {
    return path.join(process.env.APPDATA, 'RuXt', 'data');
  }
  // macOS fallback in production
  if (process.platform === 'darwin' && process.env.NODE_ENV === 'production') {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    return path.join(home, 'Library', 'Application Support', 'RuXt', 'data');
  }
  // Linux fallback in production
  if (process.platform === 'linux' && process.env.NODE_ENV === 'production') {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    return path.join(home, '.config', 'RuXt', 'data');
  }
  // Default to local project data folder
  return path.join(process.cwd(), 'data');
}

const dataDir = getDataDirectory();
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'ruxt.sqlite');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    role TEXT,
    description TEXT,
    version TEXT DEFAULT '1.0.0',
    avatar TEXT,
    ui_entry TEXT,
    manifest TEXT,
    installed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    agent_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    priority TEXT DEFAULT 'medium',
    agent_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS agent_dispatches (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    leader_slug TEXT NOT NULL,
    specialist_slug TEXT NOT NULL,
    status TEXT DEFAULT 'completed',
    brief TEXT NOT NULL,
    result TEXT,
    sub_chat TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS boardroom_sessions (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    topic TEXT NOT NULL,
    decision TEXT,
    status TEXT DEFAULT 'deliberating',
    squad_name TEXT DEFAULT 'RuXt Specialist Executive Board',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS boardroom_messages (
    id TEXT PRIMARY KEY,
    boardroom_id TEXT NOT NULL,
    agent_slug TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    agent_role TEXT NOT NULL,
    message TEXT NOT NULL,
    phase TEXT DEFAULT 'debate',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(boardroom_id) REFERENCES boardroom_sessions(id) ON DELETE CASCADE
  );
`);

// Add metadata column to chat_messages if missing
try {
  db.prepare('ALTER TABLE chat_messages ADD COLUMN metadata TEXT').run();
} catch (_) {}

// Add workflow_state and host conversation columns to chat_sessions if missing
try {
  db.prepare('ALTER TABLE chat_sessions ADD COLUMN workflow_state TEXT DEFAULT "IDLE"').run();
  db.prepare('ALTER TABLE chat_sessions ADD COLUMN assigned_specialist TEXT').run();
  db.prepare('ALTER TABLE chat_sessions ADD COLUMN project_brief TEXT').run();
} catch (_) {}
try {
  db.prepare('ALTER TABLE chat_sessions ADD COLUMN antigravity_conversation_id TEXT').run();
} catch (_) {}

// Add columns to tasks if missing
try {
  db.prepare('ALTER TABLE tasks ADD COLUMN order_index INTEGER DEFAULT 0').run();
} catch (_) {}
try {
  db.prepare('ALTER TABLE tasks ADD COLUMN boardroom_id TEXT').run();
} catch (_) {}
try {
  db.prepare('ALTER TABLE tasks ADD COLUMN deliverable_output TEXT').run();
} catch (_) {}

// Clean up any empty chat sessions without messages on startup
try {
  db.prepare(`DELETE FROM chat_sessions WHERE id NOT IN (SELECT DISTINCT session_id FROM chat_messages)`).run();
} catch (_) {}

export default db;
export { dataDir, dbPath };
