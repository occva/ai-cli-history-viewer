# AI CLI History Viewer

多源 CLI 对话历史的 Web 查看器，支持 Claude、Codex、Gemini CLI。

## 功能

- 支持多数据源：Claude CLI / Codex CLI / Gemini CLI
- 按项目分组查看对话
- 对话详情显示（用户消息和 AI 回复配对）
- 代码语法高亮
- 深色/浅色主题切换
- 全局搜索（仅搜索对话标题）

## 安装

```bash
pip install -r requirements.txt
```

## 使用

```bash
py -3 app.py
```

然后在浏览器中打开 http://localhost:5000

## 项目结构

```
ai-cli-history-viewer/
├── app.py              # Flask Web 服务器 (入口)
├── data_loader.py      # 统一数据加载器（支持所有数据源）
├── models.py           # 数据模型（Message, Conversation）
├── config.py           # 数据源配置
├── requirements.txt    # Python 依赖
├── templates/
│   └── index.html      # 主页面
└── static/
    ├── css/style.css   # 样式
    └── js/app.js       # 前端逻辑
```

## 数据来源

| 数据源 | 目录 |
|--------|------|
| Claude | `~/.claude/projects/` 和 `~/.claude/transcripts/` |
| Codex  | `~/.codex/sessions/` |
| Gemini | `~/.gemini/tmp/*/chats/` |

## 注意事项

- 只包含消息的文件会被正常加载
- 只包含元数据的文件（如取消的会话）会被跳过
