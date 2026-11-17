# 言序（AI-language-demo）

> 基于 **Python FastAPI + Vue 3 + TypeScript + Vite** 架构持续升级的 AI 语言自习室，同时提供 **Cloudflare Workers + Cloudflare D1** 无服务器边缘部署适配（线上自定义域名：`https://lingua.exhan.dpdns.org`）。
>
> 最新功能与变更说明参见 [`更新文档.md`](更新文档.md) · 源码目录位于 [`言序-20261117/`](言序-20261117/)

---

## 核心功能亮点

- **精简专注的学习布局**：学习页改造为居中单栏卡片并默认折叠本轮词表；支持 **跟随系统 / 深色 / 小清新 / 护眼 / 浅色** 5 套主题切换。
- **移动端答题自动回顶**：手机端及窄屏下点击「下一题 →」时自动收起解析并平滑滚动回题面顶部。
- **账号系统与游客隔离**：支持用户名密码注册登录（**PBKDF2-SHA256** + **HMAC-SHA256 JWT** + `HttpOnly` Cookie），兼容免登录 `X-Learner-ID` 游客模式，账号与游客数据严格隔离。
- **新用户 CEFR 水平评测**：刚注册的用户自动引导进入 12 题（满分 100 分）英语水平测评（词汇 / 语法 / 阅读 / 听力），生成 A1–C1 等级报告并一键匹配推荐词库。
- **答题记录实时持久化**：每次词汇提交实时写入 SQLite / Cloudflare D1 `answer_records` 表，并在「我的」页面支持按 **全部 / 错题 / 完成轮次 / 跟读评分** 分页回看。
- **人教版分级课文 + DeepSeek AI 讲解**：收录参考 GitHub `TapXWorld/ChinaTextbook` 的 7 篇由浅入深人教版教材课文（A1–C1），支持双语对照、TTS 朗读，并接入 DeepSeek API（默认 `deepseek-flash`）提供**全文精讲 / 逐段拆解 / 自由提问**与数据库缓存。
- **BBC 语言角与本地离线跟读**：支持 8 个 BBC Learning English 官方栏目、收藏夹、官方文稿与 PDF 下载、Range 原声音频播放，并在浏览器端通过 ONNX WASM 运行 **Whisper** 语音识别与 **Qwen2.5** 语法建议模型。

---

## 技术栈与架构（双后端对齐同一 `/api` 契约）

| 层级 | 组件选型 |
|---|---|
| **前端框架** | Vue 3 (`^3.5.45`)、TypeScript (`^5.9.3`)、Vite (`^8.3.6`)、Vue Router (`^4.6.4`) |
| **浏览器端本地 AI** | `@huggingface/transformers` (`^3.8.1`) + ONNX Runtime WebAssembly（后台 Web Worker） |
| **本地 / 单机后端** | Python 3 + FastAPI (`0.121.1`) + Uvicorn + SQLite（入口 [`run.py`](言序-20261117/run.py)） |
| **边缘无服务器后端** | Cloudflare Workers + Assets + Cloudflare D1（入口 [`worker/index.ts`](言序-20261117/worker/index.ts)） |
| **云端 AI 讲解** | DeepSeek Chat Completions API（默认模型 `deepseek-flash`） |

---

## 仓库目录结构

```text
AI-language-demo/
├── README.md                              # 仓库主说明文档（当前文件）
├── 更新文档.md                            # 2026-11-17 xiaoyi-assessment 更新详情与改动文件清单
└── 言序-20261117/                         # 完整源码目录（与 main Python+Vue 结构对齐，已脱敏）
    ├── run.py                             # Python FastAPI 单机生产启动入口（127.0.0.1:8000）
    ├── package.json                       # Wrangler、前端构建与 D1 脚本
    ├── wrangler.jsonc                     # Cloudflare Workers + D1 配置模板（已脱敏）
    ├── db/schema.sql                      # SQLite / Cloudflare D1 统一建表脚本（7 张表）
    ├── backend/
    │   ├── requirements.txt               # fastapi / uvicorn / httpx / pytest
    │   ├── data/
    │   │   ├── learning.json              # 6 语言、7 类课程词汇数据
    │   │   ├── articles.json              # 7 篇由浅入深人教版英语分级课文
    │   │   └── bbc-catalog.json           # BBC 节目目录缓存
    │   ├── app/
    │   │   ├── main.py / config.py / schemas.py / storage.py / auth.py
    │   │   ├── api/                       # auth.py、placement.py、articles.py、learning.py、bbc.py、speaking.py
    │   │   ├── domain/assessment.py       # 词序列对齐评分与基础语法规则提示
    │   │   └── services/                  # bbc_upstream.py、catalog.py、agent_port.py
    │   └── tests/test_api.py              # 13 项 FastAPI 接口与领域测试
    ├── worker/                            # Cloudflare Worker 边缘后端实现与单元测试
    └── frontend/                          # Vue 3 + TypeScript + Vite 前端源码与单元测试
```

---

## AI 模型清单与隐私说明

| 模型标识 | 运行位置 | 用途与说明 |
|---|---|---|
| `deepseek-flash` | 云端（DeepSeek API） | 课文全文精讲、逐段拆解与自由问答（可通过 `DEEPSEEK_MODEL` 环境变量修改；全文/段落讲解缓存在数据库 `article_ai_notes`） |
| `onnx-community/whisper-tiny.en_timestamped` (`q8`) | 浏览器端 ONNX WASM | 离线英文音频/录音识别与逐词时间码（原始音频不上传至外部服务器） |
| `onnx-community/Qwen2.5-0.5B-Instruct` (`q4`) | 浏览器端 ONNX WASM | 离线生成简明英语语法与表达建议 |

---

## 本地运行与部署指南（已脱敏）

### 方式一：Python FastAPI + Vue（与 `main` 一致）

1. 构建前端资源：
   ```powershell
   cd 言序-20261117/frontend
   npm install
   npm run build
   ```
2. 创建并激活 Python 虚拟环境，安装依赖并启动：
   ```powershell
   cd ..
   py -m venv backend/.venv
   ./backend/.venv/Scripts/pip install -r backend/requirements.txt

   # 如需启用课文 DeepSeek AI 讲解，请先在当前终端环境变量中配置（切勿提交密钥）：
   # $env:DEEPSEEK_API_KEY="你的DeepSeek密钥"
   # $env:JWT_SECRET="你的随机JWT密钥"
   ./backend/.venv/Scripts/python run.py
   ```
   浏览器访问 `http://127.0.0.1:8000`（前后端热更新调试可另开终端在 `frontend/` 运行 `npm run dev` 访问 `http://127.0.0.1:5173`）。

### 方式二：Cloudflare Workers + D1 无服务器部署

1. 安装根目录 Wrangler 依赖并创建 D1 数据库：
   ```powershell
   cd 言序-20261117
   npm install
   npx wrangler d1 create lingua-db
   ```
2. 将生成的数据库 ID 填入本地 `wrangler.jsonc` 中的 `database_id`（替换 `<YOUR_D1_DATABASE_ID>` 占位符），并按需修改 `routes` 自定义域名。
3. 初始化远程表结构、配置 Secrets 并部署：
   ```powershell
   npx wrangler d1 execute lingua-db --remote --file=db/schema.sql
   npx wrangler secret put JWT_SECRET
   npx wrangler secret put DEEPSEEK_API_KEY
   npm run deploy
   ```

---

## 自动化验证命令

在 `言序-20261117/` 目录下运行：

```powershell
# 1. Python FastAPI 后端全量测试（13 项）
./backend/.venv/Scripts/python -m pytest backend/tests -v

# 2. 前端类型检查、生产构建与单元测试（4 项）
cd frontend
npm run build
npm test

# 3. Cloudflare Worker 类型检查、单测（3 项）与打包预检
cd ..
./frontend/node_modules/.bin/tsc -p worker/tsconfig.json
./frontend/node_modules/.bin/tsx --test worker/worker.test.ts
npx wrangler deploy --dry-run
```
