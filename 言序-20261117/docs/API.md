# API 与数据说明

本项目提供两套完全兼容同一 `/api` 契约的后端实现：
- **Python FastAPI 后端**（`backend/` + `run.py`）：本地开发与单机运行，使用 SQLite（`backend/data/lingua.sqlite3`）。
- **Cloudflare Worker 后端**（`worker/`）：边缘无服务器部署（`https://lingua.exhan.dpdns.org`），使用 Cloudflare D1（`lingua-db`）。

## 接口清单

| 方法与路径 | 说明 |
|---|---|
| `GET /api/health` | 检查服务状态、运行后端与域名信息 |
| `POST /api/auth/register` | 用户注册（`username`、`password`、`displayName?`），返回用户信息与 JWT 并设置 `lingua_session` HttpOnly Cookie |
| `POST /api/auth/login` | 用户登录，返回用户信息与 JWT 并设置会话 Cookie |
| `POST /api/auth/logout` | 退出登录，清除会话 Cookie |
| `GET /api/auth/me` | 获取当前登录用户（未登录返回 `{ user: null }`） |
| `GET /api/placement/test` | 获取新用户英语水平评测题目（12 题，满分 100，覆盖词汇、语法、阅读、听力） |
| `POST /api/placement/submit` | 提交评测答案，计算 CEFR 等级（A1–C1）、分项能力与推荐词库，持久化并更新用户评测状态 |
| `GET /api/placement/latest` | 读取当前学习者最近一次水平评测报告 |
| `GET /api/learning/content` | 获取 6 种语言、7 类课程、音标与例句 |
| `GET /api/articles` | 获取从小学六年级到高中选择性必修由浅入深的 7 篇人教版教材阅读文章（含译文与知识点） |
| `POST /api/articles/explain` | 调用 DeepSeek（默认 `deepseek-flash`）生成全文精讲、段落精讲或自由问答，支持数据库缓存 |
| `GET /api/profile` | 获取学习档案与 BBC 收藏（已登录按账号隔离，未登录按 `X-Learner-ID` 游客隔离） |
| `PUT /api/profile` | 保存 `{ state, favorites }`（上限 2MB） |
| `POST /api/learning/answers` | 持久化单题答题记录（词条、释义、模式、用户答案、正确答案、正误） |
| `GET /api/learning/answers` | 分页读取答题记录与统计（支持 `filter=all\|wrong`、`limit`、`offset`） |
| `POST /api/assessment/text` | 跟读识别对齐评分并保存跟读记录（每项不超过 15,000 字符、500 词） |
| `GET /api/attempts` | 读取最近 50 条 BBC 跟读评分记录 |
| `GET /api/bbc/episodes` | 获取 BBC 节目目录，支持 `refresh=true` 刷新 8 个官方 RSS（冷却 60 秒） |
| `GET/HEAD /api/bbc/feed` | 代理读取白名单 BBC RSS |
| `GET /api/bbc/document` | 解析 BBC 官方页面文稿与 PDF 链接 |
| `GET/HEAD /api/bbc/pdf` | 获取并校验官方 `%PDF-` 文字稿附件 |
| `GET/HEAD /api/bbc/audio` | 流式代理 BBC 原声音频，支持 `Range` 206 分段请求 |
| `GET /api/speaking/providers` / `POST /api/speaking/chat` | Python FastAPI 后端兼容的口语对话代理接口 |

## 数据持久化与隔离

- 已注册用户以 `user:<user_id>` 作为档案与记录隔离键，密码使用 PBKDF2-SHA256（100,000 次迭代）哈希保存，会话采用 HMAC-SHA256 JWT。
- 未登录游客使用浏览器 `X-Learner-ID` 并以 `guest:<device_id>` 隔离；游客请求头无法伪造 `user:` 前缀访问已注册用户数据。
- 所有单题作答实时写入 `answer_records` 表，水平评测结果写入 `placement_assessments` 表，AI 课文讲解缓存写入 `article_ai_notes` 表。
