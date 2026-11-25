import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

const dataDir = path.join(import.meta.dir, "..", "data");
mkdirSync(dataDir, { recursive: true });
mkdirSync(path.join(dataDir, "uploads"), { recursive: true });

export const db = new Database(path.join(dataDir, "plumi.db"), { create: true });
db.run("PRAGMA journal_mode = WAL;");
db.run("PRAGMA foreign_keys = ON;");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  active_learner_id TEXT,
  guardian_email TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS learners (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INTEGER,
  birthdate TEXT,
  age_group TEXT,
  grade TEXT,
  language TEXT DEFAULT 'English',
  country TEXT,
  curriculum TEXT,
  learner_type TEXT DEFAULT 'student',
  tutor_name TEXT DEFAULT 'Aster',
  tutor_personality TEXT DEFAULT 'friendly',
  voice_style TEXT DEFAULT 'friendly',
  speaking_rate REAL DEFAULT 1,
  theme TEXT DEFAULT 'classic',
  daily_goal INTEGER DEFAULT 20,
  gamification INTEGER DEFAULT 1,
  memory_enabled INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  last_active_date TEXT,
  onboarded INTEGER DEFAULT 0,
  guardian_consent INTEGER DEFAULT 0,
  interests TEXT DEFAULT '[]',
  loves TEXT DEFAULT '[]',
  struggles TEXT DEFAULT '[]',
  styles TEXT DEFAULT '[]',
  lesson_length TEXT DEFAULT 'standard',
  activity_pref TEXT DEFAULT 'mix',
  examples_first INTEGER DEFAULT 1,
  hints_first INTEGER DEFAULT 1,
  extra_time INTEGER DEFAULT 0,
  allowed_subjects TEXT DEFAULT '[]',
  voice_enabled INTEGER DEFAULT 1,
  uploads_enabled INTEGER DEFAULT 1,
  notes TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS memory (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  meta TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  topic TEXT,
  title TEXT NOT NULL,
  level TEXT,
  duration INTEGER DEFAULT 20,
  objectives TEXT DEFAULT '[]',
  sections TEXT DEFAULT '[]',
  next_lesson TEXT,
  status TEXT DEFAULT 'in_progress',
  progress INTEGER DEFAULT 0,
  source TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  topic TEXT,
  title TEXT NOT NULL,
  level TEXT,
  questions TEXT DEFAULT '[]',
  created_by TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  answers TEXT DEFAULT '[]',
  score INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,
  feedback TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS flashcards (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  subject TEXT,
  box INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS library (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  subject TEXT,
  ref_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mime TEXT,
  size INTEGER,
  path TEXT,
  text TEXT,
  summary TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS schedule (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT,
  start_at TEXT NOT NULL,
  minutes INTEGER DEFAULT 20,
  note TEXT,
  done INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS achievements (
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  earned_at INTEGER NOT NULL,
  PRIMARY KEY (learner_id, code)
);

CREATE TABLE IF NOT EXISTS subject_progress (
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  mastery INTEGER DEFAULT 0,
  minutes INTEGER DEFAULT 0,
  lessons_done INTEGER DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (learner_id, subject)
);

CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  detail TEXT,
  xp INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, learner_id)
);

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  ref_id TEXT,
  title TEXT NOT NULL,
  due_at TEXT,
  status TEXT DEFAULT 'assigned',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tutor_appearances (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  character_id TEXT NOT NULL,
  appearance TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_lessons_learner ON lessons(learner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_quizzes_learner ON quizzes(learner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_learner ON activity(learner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_memory_learner ON memory(learner_id);
CREATE INDEX IF NOT EXISTS idx_assignments_learner ON assignments(learner_id, created_at);
`;

db.run(SCHEMA);

db.run(`
CREATE TABLE IF NOT EXISTS topic_mastery (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  lessons_started INTEGER DEFAULT 0,
  lessons_completed INTEGER DEFAULT 0,
  activities INTEGER DEFAULT 0,
  accuracy_sum INTEGER DEFAULT 0,
  accuracy_count INTEGER DEFAULT 0,
  application INTEGER DEFAULT 0,
  written_evidence INTEGER DEFAULT 0,
  mastered_at INTEGER,
  decayed_at INTEGER,
  first_studied_at INTEGER,
  last_studied_at INTEGER,
  status TEXT DEFAULT 'not_started',
  progress INTEGER DEFAULT 0,
  updated_at INTEGER NOT NULL,
  UNIQUE(learner_id, book_id, topic_id)
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL,
  topic_id TEXT,
  page INTEGER DEFAULT 1,
  label TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS learner_quests (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  template_code TEXT NOT NULL,
  kind TEXT NOT NULL,
  period_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metric TEXT NOT NULL,
  target INTEGER NOT NULL,
  xp INTEGER DEFAULT 0,
  progress INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  claimed_at INTEGER,
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(learner_id, template_code, period_key)
);

CREATE TABLE IF NOT EXISTS content_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  learner_id TEXT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS adventure_profiles (
  learner_id TEXT PRIMARY KEY REFERENCES learners(id) ON DELETE CASCADE,
  appearance TEXT,
  position TEXT,
  settings TEXT,
  discoveries TEXT DEFAULT '[]',
  world_time INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS adventure_characters (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  appearance TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS custom_books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  data TEXT NOT NULL,
  status TEXT DEFAULT 'published',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mastery_learner ON topic_mastery(learner_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_bookmarks_learner ON bookmarks(learner_id, book_id);
CREATE INDEX IF NOT EXISTS idx_quests_learner ON learner_quests(learner_id, period_key);
CREATE INDEX IF NOT EXISTS idx_adventure_characters_learner ON adventure_characters(learner_id, created_at);
`);

ensureColumn("lessons", "book_id", "TEXT");
ensureColumn("lessons", "topic_id", "TEXT");
ensureColumn("quizzes", "book_id", "TEXT");
ensureColumn("quizzes", "topic_id", "TEXT");
ensureColumn("topic_mastery", "written_evidence", "INTEGER DEFAULT 0");
ensureColumn("topic_mastery", "mastered_at", "INTEGER");
ensureColumn("topic_mastery", "decayed_at", "INTEGER");

/** Additive migrations for the character system, safe to re-run. */
function ensureColumn(table, name, ddl) {
  const columns = db.query(`PRAGMA table_info(${table})`).all();
  if (!columns.some((c) => c.name === name)) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${name} ${ddl}`);
  }
}

ensureColumn("learners", "tutor_character_id", "TEXT DEFAULT 'auren'");
ensureColumn("learners", "tutor_preset", "TEXT DEFAULT 'supportive'");
ensureColumn("learners", "strictness", "TEXT DEFAULT 'balanced'");
ensureColumn("learners", "appearance", "TEXT");
ensureColumn("learners", "environment", "TEXT DEFAULT 'auto'");
ensureColumn("learners", "voice_accent", "TEXT DEFAULT 'auto'");
ensureColumn("learners", "voice_volume", "REAL DEFAULT 1");
ensureColumn("learners", "auto_environment", "INTEGER DEFAULT 1");
ensureColumn("adventure_profiles", "active_character_id", "TEXT");

/** The academy was renamed from Plumi to Asterwood; only the untouched default is migrated. */
db.run("UPDATE learners SET tutor_name = 'Aster' WHERE tutor_name = 'Plumi'");

export const uid = () => crypto.randomUUID();
export const now = () => Date.now();

export function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export const one = (sql, ...params) => db.query(sql).get(...params);
export const many = (sql, ...params) => db.query(sql).all(...params);
export const run = (sql, ...params) => db.query(sql).run(...params);

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function dateKey(ts) {
  return todayKey(new Date(ts));
}
