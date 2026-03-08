# AI CLI History Viewer (Rust + Tauri)

基于 Tauri 2 + Rust + Svelte 5 的 AI CLI 会话历史查看器。

## 

![image-20260309012909954](https://i.postimg.cc/RSDTVvc8/20260309012919172.png?dl=1)


功能

- 支持多 Provider：`claude`、`codex`、`gemini`、`openclaw`、`opencode`
- 会话列表统一扫描，按最近活跃时间排序
- 点击会话按需加载消息详情
- 支持暗色/亮色主题切换
- Markdown 渲染与复制按钮

## 当前架构

后端已迁移到统一 `session_manager` 架构：

- `list_sessions`：扫描全部 provider，返回标准化 `SessionMeta[]`
- `get_session_messages`：按 `providerId + sourcePath` 加载消息
- `launch_session_terminal`：Windows 下启动终端执行恢复命令


## 技术栈

- Desktop: Tauri 2
- Backend: Rust (`serde`, `serde_json`, `chrono`, `regex`, `dirs`)
- Frontend: Svelte 5 + Vite
- Markdown/Security: `marked` + `highlight.js` + `DOMPurify`

## 开发

环境要求：

- Node.js 18+
- Rust stable
- Tauri CLI (`cargo install tauri-cli`)

安装依赖：

```bash
npm install
```

开发运行：

```bash
cargo tauri dev
```

构建：

```bash
cargo tauri build
```

产物路径：

- EXE: `src-tauri/target/release/ai-cli-history-viewer-rust-tauri.exe`
- Bundle: `src-tauri/target/release/bundle/`

## 项目结构

```text
.
├── src/                          # Svelte 前端
│   ├── App.svelte
│   └── lib/
│       ├── api.ts
│       └── components/Markdown.svelte
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs                # Tauri 入口与命令注册
│   │   ├── cmd.rs                # Tauri Commands
│   │   ├── paths.rs              # 各 CLI 默认目录解析
│   │   └── session_manager/
│   │       └── providers/        # claude/codex/gemini/openclaw/opencode
│   └── tauri.conf.json
├── public/
└── docs/
```

## License

MIT
