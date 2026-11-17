from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from urllib.error import URLError
from . import config
from .api import bbc, learning, speaking
from .services.bbc_upstream import UpstreamError

app = FastAPI(
    title="言序 API",
    version="2.0.0",
    description="Vue 学习平台的内容、BBC、档案和跟读评分服务。",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["GET", "HEAD", "POST", "PUT"],
    allow_headers=["Content-Type", "X-Learner-ID", "Range"],
    expose_headers=["Content-Range", "Accept-Ranges"],
)
app.include_router(learning.router, prefix="/api")
app.include_router(bbc.router, prefix="/api")
app.include_router(speaking.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok", "backend": "FastAPI"}


@app.exception_handler(UpstreamError)
async def upstream_error(request: Request, error: UpstreamError):
    return JSONResponse({"error": str(error)}, status_code=502)


@app.exception_handler(URLError)
async def network_error(request: Request, error: URLError):
    return JSONResponse(
        {"error": "BBC 服务暂时无法连接，请稍后重试。"}, status_code=502
    )


# 构建后可仅运行 Python；开发时由 Vite 的 /api 代理访问本服务。
if config.FRONTEND.exists():
    app.mount("/", StaticFiles(directory=config.FRONTEND, html=True), name="frontend")
