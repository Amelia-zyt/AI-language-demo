# API 与数据

开发接口文档：启动后打开 `http://127.0.0.1:8000/docs`，机器可读契约为 `/openapi.json`。

| 方法与路径 | 输入 | 作用 / 实现目的 |
|---|---|---|
| GET `/api/health` | 无 | 检查 Python 服务存活 |
| GET `/api/learning/content` | 无 | 给 Vue 提供六种语言、七类课程、音标和例句 |
| GET `/api/profile` | X-Learner-ID 请求头 | 恢复本设备档案与收藏 |
| PUT `/api/profile` | `{state, favorites}` | 保存偏好、进度、记录、收藏 |
| POST `/api/assessment/text` | `{reference, transcript, episode_id?}` | 对齐评分、保存跟读记录；每项最多 15,000 字符且不超过 500 词 |
| GET `/api/attempts` | X-Learner-ID 请求头 | 读取最近 50 次跟读评分，作为未来个性化 Agent 上下文 |
| GET `/api/bbc/episodes` | refresh=true 可选 | 聚合目录、栏目与更新时间；刷新至少间隔 60 秒 |
| GET/HEAD `/api/bbc/feed` | series | 读取白名单 RSS |
| GET `/api/bbc/document` | url | 解析官方文稿与 PDF 地址 |
| GET/HEAD `/api/bbc/pdf` | url | 获取并校验官方 PDF，作为附件下载 |
| GET/HEAD `/api/bbc/audio` | vpid、page、quality；可带 Range 请求头 | 流式代理 BBC 原声，支持 206 分段以便跳播 |

错误会以 JSON detail/error 返回；BBC 暂不允许读取时提供官网入口，不能保证所有地区、所有旧节目始终可播放。

`backend/data/learning.json` 与 `bbc-catalog.json` 是课程/节目种子，不含用户数据。SQLite 默认 `backend/data/lingua.sqlite3` 自动建立。表 profiles 保存档案 JSON，attempts 保存识别文字、分数与日期。交付包排除数据库与用户录音。

浏览器继续使用旧 `lingua-v1`、`lingua-bbc-favorites-v1` 键，保留同一域名下的偏好、进度和收藏。浏览器本地数据按域名隔离，旧线上域名与 localhost 间不会自动共享。旧端先导出进度 JSON；更换服务器时同时备份 SQLite。当前没有账号跨设备登录，也没有新增 JSON 导入 UI。
