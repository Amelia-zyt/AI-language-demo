# 言序 · Python FastAPI + Vue 语言自习室

基于原仓库 **Python FastAPI + Vue 3 + TypeScript + Vite** 架构持续演进的语言自习室平台，同时提供 **Cloudflare Workers + D1 (`lingua-db`)** 无服务器边缘部署适配（主域名：`https://lingua.exhan.dpdns.org`；已移除阶段性 Go 语言后端）。

## 核心特性

- **精简专注的学习布局**：学习页采用居中单栏卡片，默认折叠本轮词表；保留 5 套主题（跟随系统 / 深色 / 小清新 / 护眼 / 浅色）。
- **移动端题面自动回顶**：手机端及窄屏下点击「下一题 →」后，自动收起详解并平滑滚回题目顶部。
- **账号体系与新手英语评测**：支持用户名密码注册登录（PBKDF2-SHA256 + JWT + HttpOnly Cookie）与 `X-Learner-ID` 游客隔离。新注册用户自动引导完成 12 题英语水平评测（词汇、语法、阅读理解、听力理解），计算 CEFR 等级（A1–C1）并一键匹配推荐词库。
- **答题记录持久化**：每次词汇提交实时写入 SQLite（FastAPI 后端）或 Cloudflare D1（Workers）`answer_records` 表，在「我的」页面支持全部 / 错题 / 完成轮次 / 跟读评分分页回看。
- **分级课文阅读与 DeepSeek AI 讲解**：收录参考 GitHub `TapXWorld/ChinaTextbook` 的 7 篇人教版英语教材课文（A1–C1 由浅入深），支持双语对照、TTS 朗读与 DeepSeek（默认 `deepseek-flash`）全文精讲、逐段拆解、自由提问及数据库缓存。
- **语言角与跟读练习**：保留 8 个 BBC Learning English 官方栏目、收藏夹、官方文稿与 PDF 下载、Range 原声播放、浏览器端 Whisper（`onnx-community/whisper-tiny.en_timestamped`）语音识别与 Qwen（`onnx-community/Qwen2.5-0.5B-Instruct`）语法建议。

## 目录结构

| 路径 | 作用 |
|---|---|
| [`run.py`](run.py) | Python FastAPI 生产/单机一键启动入口（`127.0.0.1:8000`） |
| [`backend/`](backend/requirements.txt) | Python 3 + FastAPI + SQLite 后端（认证、评测、学习记录、课文 AI 讲解、BBC 代理、口语对话） |
| [`backend/data/`](backend/data/learning.json) | 词汇课程（`learning.json`）、7 篇分级课文（`articles.json`）、BBC 目录（`bbc-catalog.json`） |
| [`frontend/`](frontend/package.json) | Vue 3 + TypeScript + Vite 前端源码与构建产物 |
| [`worker/`](worker/index.ts) | Cloudflare Worker 后端入口，实现相同 `/api/*` 契约并对接 Cloudflare D1 |
| [`db/schema.sql`](db/schema.sql) | SQLite / Cloudflare D1 统一建表脚本（7 张表及索引） |
| [`wrangler.jsonc`](wrangler.jsonc) | Cloudflare Workers + D1 + 静态资源绑定配置（需填入 D1 ID） |
| [`docs/`](docs/API.md) | 接口文档、架构说明、构建清单与测试报告 |

## 本地运行（Python FastAPI + Vue）

1. 构建前端：
   ```powershell
   cd frontend
   npm install
   npm run build
   ```
2. 创建并激活 Python 虚拟环境，运行后端（含前端静态托管）：
   ```powershell
   cd ..
   py -m venv backend/.venv
   ./backend/.venv/Scripts/pip install -r backend/requirements.txt
   ./backend/.venv/Scripts/python run.py
   ```
   打开 `http://127.0.0.1:8000`。前端热更新开发可另开终端在 `frontend/` 运行 `npm run dev`（访问 `http://127.0.0.1:5173`，自动代理 `/api/*` 至 `http://127.0.0.1:8000`）。

## 验证与测试

```powershell
# Python FastAPI 后端测试（13 项）
cd backend
./.venv/Scripts/python -m pytest -v

# 前端类型检查、构建与单元测试（4 项）
cd ../frontend
npm run build
npm test

# Cloudflare Worker 类型检查与单元测试（3 项）
cd ..
./frontend/node_modules/.bin/tsc -p worker/tsconfig.json
./frontend/node_modules/.bin/tsx --test worker/worker.test.ts
```

## Cloudflare Workers 部署（`lingua.exhan.dpdns.org`）

```powershell
npm install
npx wrangler d1 execute lingua-db --remote --file=db/schema.sql
npx wrangler secret put JWT_SECRET
npx wrangler secret put DEEPSEEK_API_KEY
npm run deploy
```

更多细节参见 [API 文档](docs/API.md) 与 [架构文档](docs/ARCHITECTURE.md)。
