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
- 支持 Linux Web 模式（默认端口 `17860`）

## 当前架构

后端已迁移到统一 `session_manager` 架构：

- `list_sessions`：扫描全部 provider，返回标准化 `SessionMeta[]`
- `get_session_messages`：按 `providerId + sourcePath` 加载消息
- `launch_session_terminal`：Windows 下启动终端执行恢复命令
- `aichv-web`：独立 Web 入口（`/api/*`），复用同一套 `session_manager`


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

## Linux Web 模式

### Installation Steps

```bash
curl -sSL https://raw.githubusercontent.com/occva/ai-cli-history-viewer/main/deploy/install.sh | sudo bash
```

安装完成后，脚本会打印访问地址（包含 token）。

### 常用命令

```bash
cd /opt/ai-cli-history-viewer/deploy
docker compose -f docker-compose.local.yml up -d --build
docker compose -f docker-compose.local.yml logs -f aichv-web
docker compose -f docker-compose.local.yml down
```

健康检查：

```bash
curl http://127.0.0.1:17860/api/health
```

### 可选：构建 Web 二进制

```bash
npm run web:build
```

产物：

```text
src-tauri/target/release/aichv-web
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
│   │   ├── bin/aichv-web.rs      # Web 入口（二进制）
│   │   ├── paths.rs              # 各 CLI 默认目录解析
│   │   └── session_manager/
│   │       └── providers/        # claude/codex/gemini/openclaw/opencode
│   └── tauri.conf.json
├── public/
├── deploy/                       # Docker 与安装脚本
└── docs/
```

## License

MIT

