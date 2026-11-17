from pathlib import Path
import os

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DATABASE = Path(os.getenv("LINGUA_DATABASE", str(DATA / "lingua.sqlite3")))
FRONTEND = ROOT.parent / "frontend" / "dist"
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://127.0.0.1:5173,http://localhost:5173,https://lingua.exhan.dpdns.org",
).split(",")

JWT_SECRET = os.getenv("JWT_SECRET", "").strip()
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "").strip()
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "").strip() or "deepseek-flash"
DEEPSEEK_BASE_URL = (
    os.getenv("DEEPSEEK_BASE_URL", "").strip() or "https://api.deepseek.com"
)
