# 架构与扩展

## 分工

Vue 负责页面、交互、音频设备、播放、录音和本机模型推理。FastAPI 负责课程内容、BBC 代理、学习档案、评分计算和评分历史。浏览器通过 `src/api/client.ts` 调用 `/api`，不直接读取数据库。BBC、Hugging Face 模型下载是外部资源请求，不是另一套应用后端。

```text
Vue 页面 → composables → 类型化 API → FastAPI router
                                      ├─ domain/assessment.py
                                      ├─ services/bbc_upstream.py + catalog.py
                                      └─ storage.py → SQLite
录音 → Web Audio 16kHz 单声道 → Worker Whisper → 识别文字 → API 评分
语法建议 → 独立 Worker Qwen → 校验 JSON → 展示建议与例句朗读
```

Whisper 保留浏览器本地运行，避免把原始录音上传到服务器。它不是 Python 后端里的第二套模型服务。所有业务接口后端统一为 Python/FastAPI；本地语音能力继续使用浏览器 API，保留原平台的隐私和交互方式。

## 评分含义与流程

1. MediaRecorder 保存本次音频 Blob，同时 Web Audio Analyser 绘制真实波形。
2. 录音开始时预热 Whisper；停止后立刻生成回放地址，不阻塞回放按钮。
3. 解码并重采样为 16kHz 单声道浮点数组，传给持久 Worker。
4. `onnx-community/whisper-tiny.en_timestamped`，WASM、q8，输出文字与词时间码。Worker 和 pipeline 在页面生命周期内复用；浏览器 Cache Storage 负责后续资源缓存。首次仍需下载模型，清缓存/隐私模式/存储被清理后会重新下载。
5. 识别文字与参考句经 `/api/assessment/text` 发送 FastAPI，做英文分词与词级 Levenshtein 对齐，得到分数、增删替换和红绿标记，再保存 SQLite。
6. 分数是识别文字一致度，**不是专业音素发音准确率**。原平台也采用此类逻辑，本次没有把文字比对包装成专业语音评测 API。
7. 规则提示由后端生成；用户主动点击 AI 语法建议时才加载 `onnx-community/Qwen2.5-0.5B-Instruct`（WASM、q4）。结果须经过 JSON 结构校验，仍需用户核对。

## BBC 文稿与原声

目录包括八个栏目，保留原始 2,871 集快照，可手动刷新官方 RSS。失败保留旧目录，不伪造更新。官方文稿优先读取，不强迫手机加载识别模型；用户按需生成音频时间码。自动转写绑定音频 SHA-256，避免不同版本/广告偏移导致旧时间码误用。

点击已带时间码的句子只操作 BBC Audio.currentTime；不会调用 TTS 替代原声。官方文稿无时间码时明确提示生成，跟读仍可用。弹窗原声播放取当前句 end 与下一句 start 的较小值，到末尾暂停，弹窗保持。高亮滚动只修改 `.bbc-transcript.scrollTop`，不调用页面 scrollIntoView。手动滚动取消跟随，默认不跟随。

PDF 先尝试 BBC 官方下载域名，再由 FastAPI 获取并验证 `%PDF-` 文件头，成功后才生成 Blob 下载。每集仅展示一个优先 transcript 的官方 PDF 入口，不把 worksheet 作为重复文字稿。

## 接入 LangGraph / Agent

已有接口边界在 `backend/app/services/agent_port.py`，当前没有擅自安装 LangGraph 或虚构 Agent 已上线。后续可以：

1. 新建 `services/langgraph_agent.py`，实现 `LearningAgent.recommend(context)`，内部调用编译后的 `graph.ainvoke`。
2. 图节点依次读取学习目标、最近评分与错词，选择薄弱点，检索课程/例句，生成下一轮任务，校验结构，写入计划。
3. 新建 `api/agent.py` 暴露建议接口，在 `main.py` 注册；前端只新增 client 方法与展示组件，录音与播放器无需重写。
4. Graph 状态使用独立 TypedDict/Pydantic 模型，长期记忆与课程向量索引放独立仓储。密钥只放服务器环境变量。
5. 将 `assessment.py` 当作确定性工具节点；如果要真实发音评测，单独实现 `PronunciationProvider`，传入音频、参考文字、评测结果，不用聊天模型猜测发音。

上线多用户前需把当前设备 UUID 档案改为真正认证身份与权限隔离。`X-Learner-ID` 只是本地个人项目的档案定位键，不能作为互联网用户身份验证。
