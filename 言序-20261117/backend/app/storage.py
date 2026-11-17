"""结构化学习档案与持久化存储；SQLite 连接按请求创建，不共享线程连接。"""

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone, timedelta
from . import config


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _shanghai_day_start_iso() -> str:
    cst = timezone(timedelta(hours=8))
    now_cst = datetime.now(cst)
    start_cst = now_cst.replace(hour=0, minute=0, second=0, microsecond=0)
    return start_cst.astimezone(timezone.utc).isoformat()


@contextmanager
def connect():
    config.DATABASE.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(config.DATABASE, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute(
        """CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL UNIQUE COLLATE NOCASE,
          display_name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          english_level TEXT NOT NULL DEFAULT '',
          recommended_course TEXT NOT NULL DEFAULT '',
          assessment_completed INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        )"""
    )
    db.execute(
        "CREATE TABLE IF NOT EXISTS profiles (learner TEXT PRIMARY KEY, payload TEXT NOT NULL, updated TEXT NOT NULL)"
    )
    db.execute(
        """CREATE TABLE IF NOT EXISTS answer_records (
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
        )"""
    )
    db.execute(
        "CREATE INDEX IF NOT EXISTS idx_answer_records_learner ON answer_records(learner, id DESC)"
    )
    db.execute(
        """CREATE TABLE IF NOT EXISTS placement_assessments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          learner TEXT NOT NULL,
          score INTEGER NOT NULL,
          total INTEGER NOT NULL,
          level TEXT NOT NULL,
          level_label TEXT NOT NULL,
          recommended_course TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        )"""
    )
    db.execute(
        "CREATE INDEX IF NOT EXISTS idx_placement_learner ON placement_assessments(learner, id DESC)"
    )
    db.execute(
        "CREATE TABLE IF NOT EXISTS attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, learner TEXT NOT NULL, payload TEXT NOT NULL, created TEXT NOT NULL)"
    )
    db.execute(
        "CREATE INDEX IF NOT EXISTS idx_attempts_learner ON attempts(learner, id DESC)"
    )
    db.execute(
        "CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
    )
    db.execute(
        """CREATE TABLE IF NOT EXISTS article_ai_notes (
          cache_key TEXT PRIMARY KEY,
          article_id TEXT NOT NULL,
          scope TEXT NOT NULL,
          model TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TEXT NOT NULL
        )"""
    )
    try:
        with db:
            yield db
    finally:
        db.close()


def _user_dict(row: sqlite3.Row | None) -> dict | None:
    if not row:
        return None
    return {
        "id": row["id"],
        "username": row["username"],
        "displayName": row["display_name"],
        "englishLevel": row["english_level"],
        "recommendedCourse": row["recommended_course"],
        "assessmentCompleted": row["assessment_completed"] != 0,
        "createdAt": row["created_at"],
    }


def get_meta(key: str) -> str | None:
    with connect() as db:
        row = db.execute("SELECT value FROM app_meta WHERE key=?", (key,)).fetchone()
    return row["value"] if row else None


def set_meta(key: str, value: str) -> None:
    with connect() as db:
        db.execute(
            "INSERT INTO app_meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, value),
        )


def create_user(user_id: str, username: str, display_name: str, password_hash: str) -> dict:
    now = _now_iso()
    with connect() as db:
        db.execute(
            """INSERT INTO users(id, username, display_name, password_hash, english_level, recommended_course, assessment_completed, created_at)
               VALUES (?, ?, ?, ?, '', '', 0, ?)""",
            (user_id, username, display_name, password_hash, now),
        )
    return {
        "id": user_id,
        "username": username,
        "displayName": display_name,
        "englishLevel": "",
        "recommendedCourse": "",
        "assessmentCompleted": False,
        "createdAt": now,
    }


def get_user_auth_row(username: str) -> dict | None:
    with connect() as db:
        row = db.execute(
            """SELECT id, username, display_name, password_hash, english_level, recommended_course, assessment_completed, created_at
               FROM users WHERE username = ? COLLATE NOCASE""",
            (username,),
        ).fetchone()
    return dict(row) if row else None


def get_user_by_id(user_id: str) -> dict | None:
    with connect() as db:
        row = db.execute(
            """SELECT id, username, display_name, english_level, recommended_course, assessment_completed, created_at
               FROM users WHERE id = ?""",
            (user_id,),
        ).fetchone()
    return _user_dict(row)


def update_user_assessment(user_id: str, level: str, recommended_course: str) -> dict | None:
    with connect() as db:
        db.execute(
            "UPDATE users SET english_level=?, recommended_course=?, assessment_completed=1 WHERE id=?",
            (level, recommended_course, user_id),
        )
        row = db.execute(
            """SELECT id, username, display_name, english_level, recommended_course, assessment_completed, created_at
               FROM users WHERE id = ?""",
            (user_id,),
        ).fetchone()
    return _user_dict(row)


def get_profile(learner):
    with connect() as db:
        row = db.execute(
            "SELECT payload FROM profiles WHERE learner=?", (learner,)
        ).fetchone()
    return json.loads(row[0]) if row else None


def put_profile(learner, payload):
    with connect() as db:
        db.execute(
            "INSERT INTO profiles VALUES (?,?,?) ON CONFLICT(learner) DO UPDATE SET payload=excluded.payload,updated=excluded.updated",
            (
                learner,
                json.dumps(payload, ensure_ascii=False),
                _now_iso(),
            ),
        )


def add_attempt(learner, payload):
    with connect() as db:
        cursor = db.execute(
            "INSERT INTO attempts(learner,payload,created) VALUES (?,?,?)",
            (
                learner,
                json.dumps(payload, ensure_ascii=False),
                _now_iso(),
            ),
        )
        return cursor.lastrowid


def get_attempts(learner, limit=50):
    with connect() as db:
        rows = db.execute(
            "SELECT id,payload,created FROM attempts WHERE learner=? ORDER BY id DESC LIMIT ?",
            (learner, limit),
        ).fetchall()
    return [{"id": row[0], "created": row[2], **json.loads(row[1])} for row in rows]


def add_answer_record(learner: str, item: dict) -> tuple[int, str]:
    now = _now_iso()
    with connect() as db:
        cursor = db.execute(
            """INSERT INTO answer_records(learner, lang, course, mode, word, meaning, user_answer, correct_answer, is_correct, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                learner,
                item["lang"],
                item["course"],
                item["mode"],
                item["word"],
                item["meaning"],
                item["userAnswer"],
                item["correctAnswer"],
                1 if item["isCorrect"] else 0,
                now,
            ),
        )
        return int(cursor.lastrowid), now


def get_answer_records(learner: str, filter_mode: str = "all", limit: int = 30, offset: int = 0) -> dict:
    with connect() as db:
        agg = db.execute(
            """SELECT COUNT(*) as total,
                      COALESCE(SUM(CASE WHEN is_correct=1 THEN 1 ELSE 0 END), 0) as correct,
                      COALESCE(SUM(CASE WHEN is_correct=0 THEN 1 ELSE 0 END), 0) as wrong
               FROM answer_records WHERE learner=?""",
            (learner,),
        ).fetchone()
        today_row = db.execute(
            "SELECT COUNT(*) as today FROM answer_records WHERE learner=? AND created_at >= ?",
            (learner, _shanghai_day_start_iso()),
        ).fetchone()
        sql = (
            """SELECT id, lang, course, mode, word, meaning, user_answer, correct_answer, is_correct, created_at
               FROM answer_records WHERE learner=? AND is_correct=0 ORDER BY id DESC LIMIT ? OFFSET ?"""
            if filter_mode == "wrong"
            else """SELECT id, lang, course, mode, word, meaning, user_answer, correct_answer, is_correct, created_at
               FROM answer_records WHERE learner=? ORDER BY id DESC LIMIT ? OFFSET ?"""
        )
        rows = db.execute(sql, (learner, limit, offset)).fetchall()

    records = [
        {
            "id": r["id"],
            "lang": r["lang"],
            "course": r["course"],
            "mode": r["mode"],
            "word": r["word"],
            "meaning": r["meaning"],
            "userAnswer": r["user_answer"],
            "correctAnswer": r["correct_answer"],
            "isCorrect": r["is_correct"] != 0,
            "createdAt": r["created_at"],
        }
        for r in rows
    ]
    return {
        "records": records,
        "stats": {
            "total": int(agg["total"]) if agg else 0,
            "correct": int(agg["correct"]) if agg else 0,
            "wrong": int(agg["wrong"]) if agg else 0,
            "today": int(today_row["today"]) if today_row else 0,
        },
    }


def add_placement_assessment(learner: str, evaluated: dict) -> dict:
    now = _now_iso()
    payload = {**evaluated, "createdAt": now}
    with connect() as db:
        cursor = db.execute(
            """INSERT INTO placement_assessments(learner, score, total, level, level_label, recommended_course, payload_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                learner,
                evaluated["score"],
                evaluated["totalQuestions"],
                evaluated["level"],
                evaluated["levelLabel"],
                evaluated["recommendedCourse"],
                json.dumps(payload, ensure_ascii=False),
                now,
            ),
        )
        row_id = int(cursor.lastrowid)
    return {"id": row_id, **payload}


def get_latest_placement(learner: str) -> dict | None:
    with connect() as db:
        row = db.execute(
            "SELECT id, payload_json, created_at FROM placement_assessments WHERE learner=? ORDER BY id DESC LIMIT 1",
            (learner,),
        ).fetchone()
    if not row:
        return None
    return {**json.loads(row["payload_json"]), "id": row["id"], "createdAt": row["created_at"]}


def get_article_ai_note(cache_key: str) -> dict | None:
    with connect() as db:
        row = db.execute(
            "SELECT model, content, created_at FROM article_ai_notes WHERE cache_key=?",
            (cache_key,),
        ).fetchone()
    return dict(row) if row else None


def put_article_ai_note(cache_key: str, article_id: str, scope: str, model: str, content: str) -> str:
    now = _now_iso()
    with connect() as db:
        db.execute(
            """INSERT INTO article_ai_notes(cache_key, article_id, scope, model, content, created_at)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(cache_key) DO UPDATE SET model=excluded.model, content=excluded.content, created_at=excluded.created_at""",
            (cache_key, article_id, scope, model, content, now),
        )
    return now
