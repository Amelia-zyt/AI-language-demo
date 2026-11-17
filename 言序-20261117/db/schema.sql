-- Lingua SQLite / Cloudflare D1 Schema
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  english_level TEXT NOT NULL DEFAULT '',
  recommended_course TEXT NOT NULL DEFAULT '',
  assessment_completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  learner TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS answer_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  learner TEXT NOT NULL,
  lang TEXT NOT NULL,
  course TEXT NOT NULL,
  mode TEXT NOT NULL,
  word TEXT NOT NULL,
  meaning TEXT NOT NULL,
  user_answer TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  is_correct INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_answer_records_learner ON answer_records(learner, id DESC);

CREATE TABLE IF NOT EXISTS placement_assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  learner TEXT NOT NULL,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  level TEXT NOT NULL,
  level_label TEXT NOT NULL,
  recommended_course TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_placement_learner ON placement_assessments(learner, id DESC);

CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  learner TEXT NOT NULL,
  payload TEXT NOT NULL,
  created TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attempts_learner ON attempts(learner, id DESC);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS article_ai_notes (
  cache_key TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  model TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

