from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from urllib.error import URLError
from . import config
from .api import articles, auth, bbc, learning, placement, speaking
from .services.bbc_upstream import UpstreamError

app = FastAPI(
    title="言序 API",
    version="2.0.0",
    description="Vue 学习平台的内容、认证、水平评测、分级课文 AI 讲解、BBC、档案和跟读评分服务。",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "HEAD", "POST", "PUT", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Learner-ID", "Range"],
    expose_headers=["Content-Range", "Accept-Ranges"],
)
app.include_router(auth.router, prefix="/api")
app.include_router(placement.router, prefix="/api")
app.include_router(articles.router, prefix="/api")
app.include_router(learning.router, prefix="/api")
app.include_router(bbc.router, prefix="/api")
app.include_router(speaking.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok", "backend": "FastAPI", "domain": "lingua.exhan.dpdns.org"}


@app.exception_handler(UpstreamError)
async def upstream_error(request: Request, error: UpstreamError):
    return JSONResponse({"error": str(error)}, status_code=502)


@app.exception_handler(URLError)
async def network_error(request: Request, error: URLError):
    return JSONResponse(
        {"error": "BBC 服务暂时无法连接，请稍后重试。"}, status_code=502
    )


# 构建后可仅运行 Python（SPA 支持客户端路由刷新）；开发时由 Vite 的 /api 代理访问本服务。
@app.get("/{full_path:path}", include_in_schema=False)
def spa_or_static(full_path: str):
    if full_path.startswith("api/") or full_path == "api":
        raise HTTPException(404, "Not Found")
    if not config.FRONTEND.exists():
        raise HTTPException(404, "Frontend build not found")
    dist_root = config.FRONTEND.resolve()
    candidate = (dist_root / full_path).resolve() if full_path else dist_root / "index.html"
    if candidate.is_file() and candidate.is_relative_to(dist_root):
        return FileResponse(candidate)
    index_file = dist_root / "index.html"
    if index_file.is_file():
        return FileResponse(index_file)
    raise HTTPException(404, "Frontend build not found")
