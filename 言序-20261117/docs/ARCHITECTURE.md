# 架构说明

## 总体结构

前端统一使用 **Vue 3 + TypeScript + Vite**（`frontend/`），支持通过两套共享同一 `/api` 契约的后端运行（已移除阶段性 Go 语言后端）：

1. **Python FastAPI + SQLite 后端（`backend/` + `run.py`）**：与仓库 `main` 分支一脉相承，适合本地开发与单机运行。
2. **Cloudflare Workers + D1（`worker/` + `wrangler.jsonc` + `db/schema.sql`）**：面向公网域名 `https://lingua.exhan.dpdns.org` 的无服务器边缘部署方案。

```text
Vue 3 SPA (frontend/)
  ├─ 页面：学习 (LearnView) / 分级课文 (ArticlesView) / 语言角 (CornerView + BBC) / 我的 (MyView) / 设置 (SettingsView) / 登录注册 (AuthView) / 水平评测 (PlacementView)
  ├─ 本地推理：Web Worker + ONNX WASM（Whisper 语音识别 / Qwen 语法建议）
  └─ API 客户端 (src/api/client.ts) ──► /api/*
                                         ├─ FastAPI 服务 (backend/app/main.py) ──► SQLite + DeepSeek API
                                         └─ Cloudflare Worker (worker/index.ts) ──► Cloudflare D1 (lingua-db) + DeepSeek API
```

## 核心设计要点

- **认证与游客兼容**：支持用户名密码注册登录（PBKDF2-SHA256 + JWT + HttpOnly Cookie），同时保留 `X-Learner-ID` 游客模式。新注册用户完成后自动跳转 `/placement` 进行 12 题英语水平评测，并根据 CEFR 评级（A1–C1）一键匹配起步词库。
- **答题记录持久化**：每次词汇提交都会调用 `POST /api/learning/answers` 立即写入 `answer_records` 表，同时使用短防抖 + `visibilitychange`/`pagehide` `keepalive` 同步课程轮次进度。
- **分级课文与 AI 讲解**：收录 7 篇由浅入深的人教版英语课文（`backend/data/articles.json`），FastAPI 与 Cloudflare Worker 均对接 DeepSeek API（默认 `deepseek-flash`）提供全文精讲、逐段解析与自由问答，并在数据库 `article_ai_notes` 表缓存以降低重复调用成本。
- **移动端体验优化**：学习页与水平评测页精简为居中单栏卡片，默认折叠本轮词表；在移动端点击「下一题 →」后通过 `nextTick` + 焦点释放 + `scrollIntoView({ behavior: "smooth", block: "start" })` 自动回到题目顶部。
- **BBC 上游安全代理**：仅允许 HTTPS 且严格校验白名单域名与每跳重定向（最多 6 跳），支持 PDF 头校验与音频 `Range` 分段流式播放。
