from pathlib import Path
import os

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DATABASE = Path(os.getenv("LINGUA_DATABASE", str(DATA / "lingua.sqlite3")))
FRONTEND = ROOT.parent / "frontend" / "dist"
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173"
).split(",")
