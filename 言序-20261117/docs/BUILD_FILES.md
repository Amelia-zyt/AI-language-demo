# 构建产物逐文件说明

`frontend/dist` 由 Vite 自动生成；修改源码后请在 `frontend` 目录重新运行 `npm run build`。

| 文件 | 作用 | 实现目的 |
|---|---|---|
| `frontend/dist/assets/index-*.css` | 合并压缩样式 | 包含所有页面主题、精简布局与移动端响应式规则 |
| `frontend/dist/assets/index-*.js` | Vue 应用打包代码 | 运行所有页面、认证、评测、学习记录与路由交互 |
| `frontend/dist/assets/ort-wasm-simd-threaded.jsep-*.wasm` | ONNX Runtime WebAssembly 二进制 | 为浏览器端语音与语法模型提供本地推理运行时 |
| `frontend/dist/assets/speech.worker-*.js` | 模型 Worker 打包代码 | 在后台线程运行 Whisper 与 Qwen 推理 |
| `frontend/dist/seed/bbc-catalog.json` | BBC 节目种子目录 | 供 Cloudflare Worker 通过 `env.ASSETS` 内部读取，减小 Worker 脚本体积 |
| `frontend/dist/index.html` | 生产 HTML 入口 | 加载打包后的 Vue 应用与样式 |
