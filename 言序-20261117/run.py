"""交付包生产启动入口；运行前按 README 安装后端依赖。"""

from pathlib import Path
import os
import sys

root = Path(__file__).resolve().parent
if not (root / "frontend" / "dist" / "index.html").exists():
    raise SystemExit("缺少前端构建，请先在 frontend 运行 npm ci && npm run build")
sys.path.insert(0, str(root / "backend"))
os.chdir(root / "backend")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "8000")),
    )
