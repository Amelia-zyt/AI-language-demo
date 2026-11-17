# AI-language-demo

````markdown
# 言序 · 语言自习室

一个支持单词学习、BBC 英语听力、跟读练习和 AI 英语口语对话的学习平台。

言序希望帮助学习者把“认识单词、听懂表达、开口交流”连接起来，按照自己的节奏持续练习。

> 项目采用 Vue 3 + TypeScript + Vite 前端与 Python + FastAPI 后端，通过 API 通信，支持桌面端和移动端布局。

## 功能介绍

### 单词学习

- 支持英语、中文、韩语、日语、法语和西班牙语。
- 英语学习内容包括日常生活、四级、六级、雅思、出国旅游、酒店入住和机场对话。
- 每轮学习 10～20 个词，按轮次依次循环。
- 每个新词需要连续答对三次才能掌握，答错后重新累计。
- 支持看词选义、释义选词、听力和拼写练习。
- 单击选项提交答案，双击展开词义对照。
- 提供单词音标、释义、例句，以及单词和例句朗读。

当前词库属于项目内置学习内容，不代表覆盖完整考试词汇范围。

### BBC 语言角

- 收录多个 BBC Learning English 栏目，支持分类筛选。
- 节目按发布时间倒序排列。
- 提供独立收藏夹和单集详情页。
- 支持播放、暂停、前后跳转 15 秒。
- 支持 0.8×、0.9×、1×、1.3×、1.5× 播放速度。
- 提供官方文稿、BBC 官网链接和可用的官方 PDF 下载。
- 支持生成带时间码的音频文本、点击句子跳播和播放高亮。
- 跟随播放时，仅滚动音频文本区域。

BBC 音频和文稿的可用性取决于官方资源、网络及地区访问条件。

### 跟读练习

- 点击句子旁的麦克风进入跟读弹窗。
- 录音时显示随音量变化的波形。
- 停止录音后可回放自己的声音。
- 使用 Whisper 在浏览器中识别英语语音。
- 后端根据识别文字与参考句进行对齐，显示分数和逐词红绿标记。
- 支持播放当前句 BBC 原声，句末自动暂停，弹窗保持打开。
- 提供基础语法提示和可选的 AI 表达建议。

**跟读分数表示识别文字与参考句的一致程度，不是专业音素级发音准确率，也不是考试成绩。**

### AI 英语口语对话

新增「口语」入口，可选择以下提供商：

- DeepSeek
- ChatGPT / OpenAI
- Gemini
- 千问 Qwen

所有提供商默认使用英语口语老师角色，引导交流、纠正表达，并提出后续问题。

- 支持语音输入和文字输入。
- 语音识别完成后自动发送。
- 显示用户输入和 AI 回答的文字内容。
- 支持自动朗读回答、停止朗读和再次播放。
- 支持开始新对话。

当前实现为**轮流语音对话**：语音识别 → 文字模型回复 → 设备语音朗读，不是全双工实时音频通话。

此功能需要自行配置所选提供商的 API Key 和模型名称。不支持浏览器语音识别时，可使用文字输入。

### 学习档案与主题

- 设置学习语言、内容、轮次大小和学习偏好。
- 查看学习记录、掌握进度和跟读历史。
- 保存收藏内容。
- 导出学习数据。
- 支持跟随系统、深色、浅色、小清新和护眼主题。

## 技术栈

| 部分 | 技术 |
|---|---|
| 前端框架 | Vue 3 |
| 前端语言 | TypeScript |
| 构建工具 | Vite |
| 页面路由 | Vue Router |
| 后端框架 | FastAPI |
| 后端语言 | Python |
| 数据存储 | SQLite、localStorage、IndexedDB |
| 音频录制与处理 | MediaRecorder、Web Audio API |
| 跟读语音识别 | Whisper、Transformers.js、Web Worker |
| 口语输入 | 浏览器 SpeechRecognition |
| 回答朗读 | 浏览器 SpeechSynthesis |
| 测试 | pytest、Node.js Test Runner |

## 项目结构

```text
lingua-vue-fastapi/
├── frontend/
│   ├── src/
│   │   ├── api/              # API 请求与浏览器缓存
│   │   ├── components/       # 播放器、跟读弹窗、单词详情等组件
│   │   ├── composables/      # 档案、播放、语音、主题等状态与逻辑
│   │   ├── domain/           # 学习轮转、文本与时间码处理
│   │   ├── styles/           # 页面样式和主题
│   │   ├── types/            # TypeScript 数据类型
│   │   ├── views/            # 页面
│   │   ├── workers/          # 本地 AI 模型推理
│   │   ├── App.vue           # 应用外壳与导航
│   │   ├── main.ts           # 前端启动入口
│   │   └── router.ts         # 页面路由
│   ├── tests/                # 前端测试
│   ├── .env.example          # 前端配置示例
│   ├── package.json          # 依赖与运行命令
│   └── vite.config.ts        # 构建与开发代理配置
├── backend/
│   ├── app/
│   │   ├── api/              # 学习、BBC、口语对话 API
│   │   ├── domain/           # 跟读评分逻辑
│   │   ├── services/         # BBC 服务和未来 Agent 接口
│   │   ├── config.py         # 后端配置
│   │   ├── schemas.py        # 请求与响应模型
│   │   ├── storage.py        # SQLite 数据读写
│   │   └── main.py           # FastAPI 应用入口
│   ├── data/                 # 课程数据、节目目录及运行时数据库
│   ├── tests/                # 后端测试
│   ├── .env.example          # 后端配置示例
│   └── requirements.txt      # Python 依赖
├── docs/                     # 架构、接口和验证说明
├── scripts/                  # 打包工具
├── run.py                    # 生产启动入口
├── .gitignore
└── README.md
```

## 本地运行

### 环境要求

- Python：建议使用 3.12。
- Node.js：22.12 或更高版本。
- npm。
- 支持现代浏览器 API 的浏览器。

录音需要 HTTPS 或 localhost，并需要用户允许麦克风权限。

### 1. 启动后端

以下命令以 Windows PowerShell 为例，在项目根目录打开终端：

```powershell
cd backend

py -m venv .venv

.\.venv\Scripts\python.exe -m pip install -r requirements.txt

.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

后端接口文档：

```text
http://127.0.0.1:8000/docs
```

健康检查：

```text
http://127.0.0.1:8000/api/health
```

### 2. 启动前端

另外打开一个终端，在项目根目录执行：

```powershell
cd frontend

npm ci

npm run dev
```

打开：

```text
http://127.0.0.1:5173
```

Vite 已配置开发代理，将 `/api` 请求转发至 `http://127.0.0.1:8000`。

开发时需要同时保持前端和后端运行。

### 3. 构建后统一启动

也可以先构建前端，再由 FastAPI 提供静态页面和 API：

```powershell
# 在项目根目录执行
cd frontend
npm ci
npm run build
cd ..

.\backend\.venv\Scripts\python.exe run.py
```

打开：

```text
http://127.0.0.1:8000
```

GitHub 源码包不包含构建产物，需要先执行 `npm run build`。

Linux/macOS 下，将虚拟环境的 Python 路径替换为：

```text
backend/.venv/bin/python
```

## 配置 AI 口语模型

口语对话通过 FastAPI 调用所选提供商的 API。真实密钥只应配置在运行后端的电脑或服务器上。

| 提供商 | API Key 环境变量 | 模型名称环境变量 |
|---|---|---|
| DeepSeek | `DEEPSEEK_API_KEY` | `DEEPSEEK_MODEL` |
| OpenAI | `OPENAI_API_KEY` | `OPENAI_MODEL` |
| Gemini | `GEMINI_API_KEY` | `GEMINI_MODEL` |
| 千问 | `QWEN_API_KEY` | `QWEN_MODEL` |

模型名称应填写对应账号实际可调用的模型 ID。

例如，在启动后端的 PowerShell 终端中设置：

```powershell
$env:DEEPSEEK_API_KEY = "你的API密钥"
$env:DEEPSEEK_MODEL = "你的可用模型ID"

.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

如需指定兼容接口地址，可以设置：

```text
DEEPSEEK_BASE_URL
OPENAI_BASE_URL
GEMINI_BASE_URL
QWEN_BASE_URL
```

地址应为 API 基址，不要重复添加 `/chat/completions`。千问等服务需使用与账号地域匹配的地址。

注意：

- `.env.example` 只是配置示例，项目默认不会自动读取 `.env`。
- 更改环境变量后需要重启后端。
- ChatGPT 网页账号或订阅不等于已经配置 OpenAI API。
- 模型服务可能产生费用，以对应提供商的账户和计费规则为准。
- 不要把 API Key 写进前端代码、README 或提交到 GitHub。

## 数据与隐私

- 学习档案和跟读评分保存在 SQLite。
- 默认数据库路径为 `backend/data/lingua.sqlite3`。
- 浏览器使用 localStorage 保存本地偏好和进度。
- IndexedDB 缓存公开文稿和音频时间码。
- 跟读录音通过浏览器内的 Whisper 处理，原始录音不上传到本项目后端；识别文字和评分会经 API 保存。
- 口语对话的文字和最近对话上下文会发送给用户所选的模型提供商。
- 口语输入使用浏览器语音识别，其处理方式取决于浏览器服务，不能视为始终离线。
- 当前设备 ID 用于定位学习档案，不是完整的账号认证系统。

公开部署为多用户服务前，应补充用户认证、访问控制和请求限流，保护档案数据与模型额度。

## AI 能力说明

跟读使用：

```text
onnx-community/whisper-tiny.en_timestamped
```

可选的本地语法建议使用：

```text
onnx-community/Qwen2.5-0.5B-Instruct
```

首次使用需要下载模型资源，之后复用浏览器缓存。网络状况、设备性能和浏览器存储限制会影响速度。

语音识别可能出现漏词、误识别；语法小模型也可能给出不准确的解释。反馈用于辅助练习，应结合原文核对。

## 测试

前端类型检查和生产构建：

```powershell
cd frontend
npm run build
```

前端测试：

```powershell
npm test
```

后端测试：

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q
```

开发环境的录音验证页面：

```text
http://127.0.0.1:5173/tests/browser.html
```

该页面使用合成音轨验证录音组件，并提供真实模型测试入口；不会作为生产首页发布。

既有自动测试不代表所有外部模型提供商均已完成真实调用验证。模型对话需要配置有效密钥后分别测试。

## 常见问题

### 出现 `cannot import name 'ArgsKwargs'`

可能是虚拟环境中残留了其他 Python 版本的 Pydantic 二进制文件，或依赖安装不完整。

在 `backend` 目录尝试：

```powershell
.\.venv\Scripts\python.exe -m pip install --force-reinstall --no-cache-dir --only-binary=:all: -r requirements.txt
```

更换 Python 版本时，应重新创建虚拟环境，不要直接复用旧 `.venv`。

### 页面提示无法连接服务

确认后端已启动，并检查：

```text
http://127.0.0.1:8000/api/health
```

开发模式下，前端和后端需要分别启动。

### 模型显示“待配置”

检查该提供商对应的 `API_KEY` 和 `MODEL` 环境变量，并重启后端。

### 语音输入不可用

检查麦克风权限、HTTPS/localhost 条件及浏览器是否支持 SpeechRecognition。不支持时可使用文字输入。

### 本地更新后线上网站没有变化

本地代码更新不会自动部署到线上。需要重新构建并部署至支持 Python/FastAPI 的服务器。

## 后续扩展

项目已预留 Agent 接口边界，可进一步接入 LangGraph，实现：

- 根据学习记录生成个性化计划。
- 根据错词和跟读结果安排复习。
- 推荐合适的 BBC 节目和练习材料。
- 生成情景口语任务。
- 保存长期学习目标与阶段反馈。

相关接口位于：

```text
backend/app/services/agent_port.py
```

当前尚未实现完整的 LangGraph 学习 Agent。

## 内容与第三方许可

BBC 节目、音频及官方文稿版权归 BBC 所有。项目保留来源链接，源码仓库不应包含未经授权再分发的音频和 PDF。

第三方依赖许可见：

```text
docs/THIRD_PARTY_NOTICES.txt
```

本项目源码的使用和分发权限，以仓库实际提供的 LICENSE 文件为准。

---

**言序：每一次练习，都让表达更自然一点。**
````
