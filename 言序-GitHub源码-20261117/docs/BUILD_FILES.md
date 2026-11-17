# 构建产物逐文件说明

这些文件由 Vite 自动生成；不应直接修改，源码改动后重新 npm run build。

| 文件 | 作用 | 实现目的 |
|---|---|---|
| `frontend/dist/assets/index-15rUCALI.css` | 合并压缩样式 | 保留所有页面主题和响应式外观 |
| `frontend/dist/assets/index-B56CGWT9.js` | Vue 应用打包代码 | 运行所有页面、状态、路由与交互 |
| `frontend/dist/assets/ort-wasm-simd-threaded.jsep-B0T3yYHD.wasm` | ONNX Runtime WebAssembly 二进制 | 给浏览器 CPU 提供本地模型执行能力 |
| `frontend/dist/assets/speech.worker-Div5y8Zx.js` | 模型 Worker 打包代码 | 在后台执行真实 Whisper 与 Qwen 推理 |
| `frontend/dist/index.html` | 生产 HTML 入口 | 加载打包后的 Vue 与 CSS |
