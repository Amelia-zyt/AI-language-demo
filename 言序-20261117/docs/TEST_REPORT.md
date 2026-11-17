# 验证与测试报告

验证日期：2026-11-17。运行架构：Vue 3 + TypeScript + Vite 前端（`frontend/`），双后端兼容 **Python FastAPI + SQLite**（`backend/`、`run.py`）与 **Cloudflare Workers + D1**（`worker/`、`db/schema.sql`）。

## 自动化检查结果

| 检查项 | 命令 | 结果 |
|---|---|---|
| FastAPI 后端 pytest | `cd backend && ./.venv/Scripts/python -m pytest -v` | 13/13 通过：含原 `main` 全部 9 项基础测试（健康检查、词库音标、档案隔离、对齐评分、输入限制、URL 白名单、PDF 回退、文稿解析、Range 音频、RSS 解析）及新增 4 项（账号认证与隔离、12 题 CEFR 水平评测、答题记录持久化与错题筛选、7 篇分级课文排序与 DeepSeek 缓存） |
| 前端类型检查与生产构建 | `cd frontend && npm run build` (`vue-tsc --noEmit && vite build`) | 通过（72 个模块） |
| 前端领域单元测试 | `cd frontend && npm test` (`tsx --test tests/*.test.ts`) | 4/4 通过：`learning.test.ts`、`speech.test.ts`、`markdown.test.ts` |
| Worker TypeScript 类型检查 | `tsc -p worker/tsconfig.json` | 通过（0 类型错误） |
| Worker 核心逻辑单测 | `tsx --test worker/worker.test.ts` | 3/3 通过：对齐评分、12 题 CEFR A1–C1 评测、7 篇分级课文排序 |
| Wrangler 打包预检 | `npx wrangler deploy --dry-run` | 通过（绑定 `env.DB` 与 `env.ASSETS`） |

## 线上环境与端到端验证

- **线上域名**：`https://lingua.exhan.dpdns.org`（Cloudflare Workers + D1 `lingua-db` 共 7 张数据表）。
- **核心链路**：账号注册/登录与游客模式隔离、注册后 12 题新手英语水平评测与推荐词库匹配、词汇答题实时持久化与「我的」页错题筛选、移动端点击「下一题」自动回顶、7 篇人教版教材分级课文双语阅读与 DeepSeek（`deepseek-flash`）全文/逐段/问答 AI 讲解与缓存，以及 BBC 栏目与浏览器端 Whisper / Qwen 跟读评分。
