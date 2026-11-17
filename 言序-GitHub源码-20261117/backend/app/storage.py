"""结构化学习档案；SQLite 连接按请求创建，不共享线程连接。"""

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from . import config


@contextmanager
def connect():
    config.DATABASE.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(config.DATABASE, timeout=10)
    db.execute(
        "CREATE TABLE IF NOT EXISTS profiles (learner TEXT PRIMARY KEY, payload TEXT NOT NULL, updated TEXT NOT NULL)"
    )
    db.execute(
        "CREATE TABLE IF NOT EXISTS attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, learner TEXT NOT NULL, payload TEXT NOT NULL, created TEXT NOT NULL)"
    )
    try:
        with db:
            yield db
    finally:
        db.close()


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
                datetime.now(timezone.utc).isoformat(),
            ),
        )


def add_attempt(learner, payload):
    with connect() as db:
        cursor = db.execute(
            "INSERT INTO attempts(learner,payload,created) VALUES (?,?,?)",
            (
                learner,
                json.dumps(payload, ensure_ascii=False),
                datetime.now(timezone.utc).isoformat(),
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
