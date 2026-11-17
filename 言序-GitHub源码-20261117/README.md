> GitHub 源码版：本包不包含 frontend/dist、虚拟环境、数据库或真实密钥。首次运行请先在 frontend 执行 npm ci 和 npm run build，再按下文启动 Python。旧 requirements.lock.txt 未收录，安装请使用 backend/requirements.txt。

# 言序 · Vue 3 + TypeScript + Vite / Python + FastAPI

现有语言自习室的独立重构版本。页面真正改写为 Vue 单文件组件，启用严格 TypeScript；课程、BBC、档案与评分接口统一由 FastAPI 提供。保留原有深色/浅色及主题、桌面/手机布局、学习页、学习偏好、收藏页、BBC 悬浮播放器与跟读体验。

重构前已备份原 `lingua` 和 `lingua-python` 两个项目，原文件未覆盖。备份包位于同次交付的 `lingua-before-vue-fastapi-20261109.zip`；原文件校验值见 `docs/ORIGINAL_HASHES.json`。本项目未替换现有线上网站，FastAPI 需要支持 Python 常驻进程的主机。

## 快速运行

要求 Python 3.11+；修改前端需要 Node.js 22.12+ 和 npm。本 GitHub 源码包需要先安装 Node 并构建前端。

Windows PowerShell，在项目根目录运行：

```powershell
py -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
backend/.venv/Scripts/python.exe run.py
```

打开 `http://127.0.0.1:8000`。接口文档 `http://127.0.0.1:8000/docs`。Linux/macOS 把 Python 路径换成 `backend/.venv/bin/python`。如需严格复现本次完整验证环境可用 `backend/requirements.lock.txt`，其中包含测试和格式化工具。

源码修改后重新构建：

```powershell
cd frontend
npm ci
npm run build
cd ..
backend/.venv/Scripts/python.exe run.py
```

开发模式使用两个终端：

```powershell
# 终端一，项目根目录
cd backend
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

```powershell
# 终端二，项目根目录
cd frontend
npm ci
npm run dev
```

开发页面 `http://127.0.0.1:5173`。Vite 代理 `/api` 给 FastAPI。前后端独立域名部署时构建前设置 `VITE_API_BASE=https://你的接口域名/api`，服务器设置 `CORS_ORIGINS=https://你的前端域名`。生产请使用 HTTPS，浏览器录音需要 HTTPS 或 localhost。环境变量示例见各自 `.env.example`；默认不自动读取 `.env`。

## 已保留的功能

| 区域 | 实现目的 |
|---|---|
| 学习 | 六种语言；基础、四六级、雅思、出国旅游、酒店、机场等课程；10–20 个词轮换，连续正确三次、出错重置；选义、反选、听力、拼写；单击提交、双击揭示；音标、例句与语音 |
| 我的 | 选择学习语言/内容/偏好，查看学习进度、记录与跟读历史；同源旧 localStorage 兼容与 API 档案同步 |
| 设置 | 跟随系统明暗、深色、浅色、小清新、护眼；导出学习数据 |
| 语言角 | 八个 BBC 栏目、倒序节目列表、刷新、分类、独立收藏页、单集详情与官方 PDF 下载 |
| 播放器 | 页面底端悬浮，标题和日期、15 秒前后跳、播放暂停、五档速度；点信息进入详情，无关闭按钮、进度条或时长计数 |
| 音频文本 | 官方文稿、按需 Whisper 时间码、逐句跳 BBC 原声、高亮、仅文本区域跟随滚动、主题细滚动条；手机优先显示文稿 |
| 跟读 | 每句麦克风、真实录音波形、自己的录音回放、Whisper 识别、API 评分、逐词红绿、当前句 BBC 原声、语法提示和例句朗读；弹窗保持，录音后不重复创建模型 |

## AI 模型、评分与数据

Whisper：`onnx-community/whisper-tiny.en_timestamped`，浏览器 Worker，WASM/q8。语法建议：`onnx-community/Qwen2.5-0.5B-Instruct`，独立 Worker，WASM/q4，点击后按需加载。模型首次运行需要联网下载，之后复用实例和浏览器缓存；低内存手机与弱网仍可能较慢。没有调用付费语音评测 API，也不需要 API Key。

分数是识别文字与原文的词级对齐一致度，**不代表专业发音准确率**。Python 执行确定性评分、规则提示与历史保存，Qwen 用于可选的表达建议。原始录音仅在浏览器内存中处理，关闭跟读后释放；识别文字和评分经 API 保存到 SQLite。数据库不放入源码交付包。

设备 UUID 仅用于本地个人档案识别，未实现公开网站的账号认证。跨域名不会自动搬迁旧浏览器数据。部署和数据迁移边界、接入 LangGraph 的具体位置见 [架构文档](docs/ARCHITECTURE.md) 与 [API 文档](docs/API.md)。

## 检查与重新打包

```powershell
cd frontend
npm run build  # vue-tsc 严格类型检查和生产构建
npm test       # 学习轮转、错题重置、时间码与 PDF 选择
cd ../backend
.venv/Scripts/python.exe -m pytest -q
cd ..
backend/.venv/Scripts/python.exe scripts/package.py
```

浏览器验证入口（仅开发）：`http://127.0.0.1:5173/tests/browser.html`。它使用合成音轨，不访问真人麦克风；评分走真实 API。另有按钮运行真实 Whisper、Qwen。此测试入口不会被构建进生产首页。完整检查结果与未覆盖范围见 [验证记录](docs/TEST_REPORT.md)。

## 每个文件的作用与实现目的

下表覆盖交付的全部源码、配置、数据和文档。`frontend/dist` 是 Vite 自动生成的运行产物，实际文件及作用另见 [构建文件清单](docs/BUILD_FILES.md)，修改源码后由构建覆盖，不直接编辑。

<!-- FILE_INVENTORY -->

| 文件 | 作用 | 实现目的 |
|---|---|---|
| [`.gitignore`](.gitignore) | 版本控制排除规则 | 防止依赖、数据库、环境密钥被误提交 |
| [`README.md`](README.md) | 总说明和逐文件索引 | 帮助接手者启动、修改、验证和理解每个文件 |
| [`backend/.env.example`](backend/.env.example) | 后端环境配置示例 | 说明 SQLite 路径和允许的前端源 |
| [`backend/app/__init__.py`](backend/app/__init__.py) | Python 包标记 | 允许 Uvicorn 按 app.main 导入服务 |
| [`backend/app/api/bbc.py`](backend/app/api/bbc.py) | BBC HTTP 接口 | 提供目录、官方文稿、PDF 与支持 Range 的音频流 |
| [`backend/app/api/learning.py`](backend/app/api/learning.py) | 课程、档案、评分接口 | 把页面数据读写与确定性评分通过 API 提供给 Vue |
| [`backend/app/config.py`](backend/app/config.py) | 集中配置 | 统一数据路径、数据库位置、静态构建和 CORS 来源 |
| [`backend/app/domain/assessment.py`](backend/app/domain/assessment.py) | 纯 Python 评分领域逻辑 | 分词、编辑距离、红绿对齐、基础语法提示；不依赖页面 |
| [`backend/app/main.py`](backend/app/main.py) | FastAPI 应用入口 | 注册路由、错误处理、CORS、健康检查和前端静态服务 |
| [`backend/app/schemas.py`](backend/app/schemas.py) | Pydantic 请求响应模型 | 校验数据长度、固定评分契约，便于未来 Agent 复用 |
| [`backend/app/services/agent_port.py`](backend/app/services/agent_port.py) | LearningAgent 协议与上下文类型 | 明确未来 LangGraph 适配边界，避免 Agent 混入评分和路由 |
| [`backend/app/services/bbc_upstream.py`](backend/app/services/bbc_upstream.py) | BBC 上游访问与解析 | 校验白名单和跳转、解析文稿、验证 PDF、查找可用原声音频 |
| [`backend/app/services/catalog.py`](backend/app/services/catalog.py) | 多栏目目录服务 | 解析八个官方 RSS、合并倒序目录、失败保留旧内容 |
| [`backend/app/storage.py`](backend/app/storage.py) | SQLite 仓储 | 保存设备档案和跟读历史，按请求事务与显式关闭连接 |
| [`backend/data/bbc-catalog.json`](backend/data/bbc-catalog.json) | 原 BBC 节目目录快照 | 首次打开即可显示原有 2,871 集，弱网仍有目录 |
| [`backend/data/learning.json`](backend/data/learning.json) | 原项目全部课程数据 | 保留六种语言、七种课程、释义、音标、例句与来源 |
| [`backend/requirements.lock.txt`](backend/requirements.lock.txt) | 完整验证环境版本 | 固定本次实际使用的 Python 依赖树 |
| [`backend/requirements.txt`](backend/requirements.txt) | 直接依赖版本 | 安装 FastAPI、Uvicorn 及测试所需依赖 |
| [`backend/tests/test_api.py`](backend/tests/test_api.py) | API 与评分回归测试 | 验证内容、档案隔离、对齐、历史、输入上限、BBC白名单/PDF/Range/RSS |
| [`docs/API.md`](docs/API.md) | API 与数据说明 | 列出端点、请求用途、档案与迁移限制 |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | 架构与 Agent 扩展说明 | 明确数据流、模型边界、评分含义和 LangGraph 接入步骤 |
| [`docs/BUILD_FILES.md`](docs/BUILD_FILES.md) | 构建产物逐文件说明 | 说明 dist 中各个实际文件负责运行的哪一部分 |
| [`docs/ORIGINAL_HASHES.json`](docs/ORIGINAL_HASHES.json) | 原文件 SHA-256 清单 | 证明重构前备份范围，便于对照原项目未改变 |
| [`docs/TEST_REPORT.md`](docs/TEST_REPORT.md) | 本次验证记录 | 列出通过的自动和浏览器检查以及未覆盖范围 |
| [`docs/THIRD_PARTY_NOTICES.txt`](docs/THIRD_PARTY_NOTICES.txt) | 第三方许可证集合 | 保留随构建/依赖使用的开源许可与版权信息 |
| [`frontend/.env.example`](frontend/.env.example) | 前端环境配置示例 | 说明构建 API 基址和开发代理目标 |
| [`frontend/index.html`](frontend/index.html) | Vite HTML 容器 | 挂载 Vue 根组件，配置中文语言和移动端视口 |
| [`frontend/package-lock.json`](frontend/package-lock.json) | npm 完整依赖锁 | 让 npm ci 安装可复现的依赖版本 |
| [`frontend/package.json`](frontend/package.json) | 前端依赖与命令 | 固定 Vue、Vite、TypeScript、模型运行时及开发/构建/测试命令 |
| [`frontend/src/App.vue`](frontend/src/App.vue) | 全局页面外壳 | 保留导航、页眉页脚、初始化、同步提示、主题与悬浮播放器 |
| [`frontend/src/api/cache.ts`](frontend/src/api/cache.ts) | IndexedDB 缓存适配 | 缓存公开文稿和带音频哈希的时间码，避免反复识别 |
| [`frontend/src/api/client.ts`](frontend/src/api/client.ts) | 类型化 HTTP 客户端 | 集中 API 基址、设备 ID、超时、错误与业务接口 |
| [`frontend/src/components/PageIntro.vue`](frontend/src/components/PageIntro.vue) | 通用页标题 | 复用原有标题、副标题和语言切换布局 |
| [`frontend/src/components/PlayerDock.vue`](frontend/src/components/PlayerDock.vue) | 底部悬浮播放器 | 展示 Logo、标题、日期和独立播放控件，支持手机布局和详情跳转 |
| [`frontend/src/components/ProgressDots.vue`](frontend/src/components/ProgressDots.vue) | 三个进度点 | 直观表示当前单词连续答对次数 |
| [`frontend/src/components/RecorderDialog.vue`](frontend/src/components/RecorderDialog.vue) | 跟读录音弹窗 | 真实波形、停止录音、立即回放、识别评分、逐词颜色、原声单句及 AI 建议 |
| [`frontend/src/components/SkipIcon.vue`](frontend/src/components/SkipIcon.vue) | 15秒圆形箭头 SVG | 保持前后跳按钮一致且适配主题 |
| [`frontend/src/components/TranscriptRow.vue`](frontend/src/components/TranscriptRow.vue) | 音频文本行 | 显示时间码和高亮，提供原声跳播与本句跟读入口 |
| [`frontend/src/components/WordDetails.vue`](frontend/src/components/WordDetails.vue) | 单词详解 | 展示词义、音标、来源例句及单词/例句发音按钮 |
| [`frontend/src/composables/useCatalog.ts`](frontend/src/composables/useCatalog.ts) | BBC 数据与转写流程 | 目录筛选状态、文稿缓存、官方 PDF 下载、分段识别与时间码缓存 |
| [`frontend/src/composables/usePlayer.ts`](frontend/src/composables/usePlayer.ts) | 单例 BBC 播放控制 | 原声播放、暂停、跳转、倍速、当前句自动停止及 Blob 音频同步 |
| [`frontend/src/composables/useProfile.ts`](frontend/src/composables/useProfile.ts) | 学习档案状态 | 兼容旧本地键、自动 API 同步、收藏、通知与课程初始化 |
| [`frontend/src/composables/useSpeech.ts`](frontend/src/composables/useSpeech.ts) | 浏览器发音与语音输入 | 单词/例句朗读和拼写语音输入，播放前停止冲突音频 |
| [`frontend/src/composables/useSpeechEngine.ts`](frontend/src/composables/useSpeechEngine.ts) | 模型 Worker 客户端 | 复用模型、消息分发、取消和超时、16kHz 解码、语法输出校验 |
| [`frontend/src/composables/useTheme.ts`](frontend/src/composables/useTheme.ts) | 主题生命周期 | 跟随系统明暗及手动主题，统一 CSS 变量 |
| [`frontend/src/domain/learning.ts`](frontend/src/domain/learning.ts) | 学习状态机 | 实现10–20词轮换、三连正确、错误清零、课程映射和答案规范化 |
| [`frontend/src/domain/transcript.ts`](frontend/src/domain/transcript.ts) | 文本与时间码纯函数 | 分句、高亮索引、当前句终点、日期时长格式和唯一文字稿 PDF 选择 |
| [`frontend/src/main.ts`](frontend/src/main.ts) | Vue 启动入口 | 注册路由、挂载应用并加载主题样式 |
| [`frontend/src/router.ts`](frontend/src/router.ts) | 页面路由表 | 管理学习、我的、设置、BBC、独立收藏和单集详情导航 |
| [`frontend/src/styles/bbc.css`](frontend/src/styles/bbc.css) | BBC 区域样式 | 保留节目、收藏、文本细滚动条和手机悬浮播放器体验 |
| [`frontend/src/styles/coach.css`](frontend/src/styles/coach.css) | 跟读区域样式 | 保留半透明弹窗、波形、逐词颜色和建议排版 |
| [`frontend/src/styles/refactor.css`](frontend/src/styles/refactor.css) | Vue 组件补充样式 | 适配路由链接、加载状态、历史行和移动端细节 |
| [`frontend/src/styles/style.css`](frontend/src/styles/style.css) | 原平台基础样式与色板 | 保留导航、学习页、主题和响应式布局体验 |
| [`frontend/src/types/index.ts`](frontend/src/types/index.ts) | 共享 TypeScript 类型 | 统一课程、档案、节目、时间码、评分、模型消息的数据契约 |
| [`frontend/src/views/CornerView.vue`](frontend/src/views/CornerView.vue) | 语言角首页 | 提供 BBC 和独立收藏夹入口 |
| [`frontend/src/views/EpisodeView.vue`](frontend/src/views/EpisodeView.vue) | 单集详情页 | 播放/下载/收藏、文本独立滚动、跟读弹窗与位于末尾的概述 |
| [`frontend/src/views/EpisodesView.vue`](frontend/src/views/EpisodesView.vue) | 节目列表与收藏列表组件 | 保留栏目下拉框、列表播放跳转、倒序与分页；收藏显示独立页面结构 |
| [`frontend/src/views/LearnView.vue`](frontend/src/views/LearnView.vue) | 学习页 | Vue 呈现所有题型、单击提交/双击揭示、轮次与单词列表 |
| [`frontend/src/views/MyView.vue`](frontend/src/views/MyView.vue) | 我的页 | 设置学习偏好与内容，查看学习统计、完成记录和跟读历史 |
| [`frontend/src/views/SettingsView.vue`](frontend/src/views/SettingsView.vue) | 设置页 | 选择主题并导出包含收藏的学习数据 |
| [`frontend/src/workers/speech.worker.ts`](frontend/src/workers/speech.worker.ts) | 后台 Whisper/Qwen 推理 | 把首次模型加载和本地推理移出 UI 主线程，串行执行避免内存竞争 |
| [`frontend/tests/browser.html`](frontend/tests/browser.html) | 开发浏览器测试容器 | 挂载可手动验证的录音测试页面，不进入生产构建 |
| [`frontend/tests/browser.ts`](frontend/tests/browser.ts) | 合成录音集成验证入口 | 在不访问真人麦克风下测试真实录音组件/API/回放/句末暂停，另测真实模型 |
| [`frontend/tests/learning.test.ts`](frontend/tests/learning.test.ts) | 前端领域回归测试 | 验证10词按轮循环、错误重置、完成条件和时间码工具 |
| [`frontend/tests/speech.test.ts`](frontend/tests/speech.test.ts) | 语法输出兼容回归测试 | 验证结构化结果校验、普通文字建议保留、空输出错误处理 |
| [`frontend/tsconfig.json`](frontend/tsconfig.json) | 严格 TypeScript 配置 | 对 Vue、Worker、领域代码与测试做静态类型检查 |
| [`frontend/vite.config.ts`](frontend/vite.config.ts) | Vite 构建与开发配置 | 编译 Vue/Worker/WASM，代理 API，固定端口与目标浏览器 |
| [`run.py`](run.py) | 生产启动入口 | 一个 Python 命令同时提供构建好的 Vue 页面与 FastAPI |
| [`scripts/package.py`](scripts/package.py) | 可复现打包脚本 | 生成排除用户数据和依赖的 ZIP，并做压缩完整性检查 |

## 英语口语入口
新增导航“口语”。支持 DeepSeek、ChatGPT/OpenAI、Gemini、千问，默认英语老师，显示双方文字，语音输入结束自动发送，设备英语语音朗读回答。使用浏览器 SpeechRecognition；不支持时可文字输入。此版本为轮流语音对话，不是全双工实时音频。
服务器环境变量：每家使用 DEEPSEEK / OPENAI / GEMINI / QWEN 前缀，设置 `<前缀>_API_KEY`、`<前缀>_MODEL`，可设置 `<前缀>_BASE_URL`（千问按账户地域配置）。模型名称请填账户可用模型；密钥不放浏览器。配置后重启服务。
文件作用：`backend/app/api/speaking.py` 提供模型配置状态和口语对话 API，服务器注入英语老师提示词；`frontend/src/views/SpeakingView.vue` 实现模型选择、语音输入、文字对话与朗读；`router.ts` 和 `App.vue` 注册路由与入口。
