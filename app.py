#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI CLI History Viewer - Web 版本

使用方法:
    python app.py

然后在浏览器中打开 http://localhost:5000
"""

import os
import re
import time

import config
from flask import Flask, jsonify, render_template, request
from data_loader import DataLoader

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET_KEY", "dev-key-change-in-production")
DEBUG = os.environ.get("DEBUG", "0") == "1"

# 安全：项目名称白名单模式
SAFE_PROJECT_PATTERN = re.compile(r"^[a-zA-Z0-9_\-\:\\/\. ]+$")


def sanitize_project_name(name: str) -> str:
    """清理项目名称，防止路径遍历"""
    if not name:
        return ""
    # 移除路径遍历攻击，但保留原始的斜杠格式（前后端需一致）
    name = name.replace("..", "")
    # 允许反斜杠和正斜杠，因为 Windows 路径使用反斜杠
    return name if SAFE_PROJECT_PATTERN.match(name) else ""


def sanitize_source(source: str) -> str:
    """验证数据源参数"""
    return source if source in config.SOURCE_CONFIGS else "claude"


@app.after_request
def add_security_headers(response):
    """添加安全响应头"""
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response


# ==================== 路由 ====================

@app.route("/")
def index():
    """主页"""
    return render_template("index.html")


@app.route("/api/projects")
def api_projects():
    """获取所有项目列表"""
    source = sanitize_source(request.args.get("source", "claude"))
    return jsonify({"projects": DataLoader.get_projects_list(source), "source": source})


@app.route("/api/conversations")
def api_conversations():
    """获取指定项目的对话列表"""
    source = sanitize_source(request.args.get("source", "claude"))
    project = sanitize_project_name(request.args.get("project", ""))
    
    if not project:
        return jsonify({"error": "Invalid project name"}), 400

    convs = DataLoader.get_project_conversations(source, project)
    return jsonify({
        "project": project,
        "source": source,
        "conversations": [c.to_dict() for c in convs],
        "total": len(convs),
    })


@app.route("/api/conversation/<session_id>")
def api_conversation_detail(session_id):
    """获取对话详情"""
    if not re.match(r"^[a-zA-Z0-9\-_]+$", session_id):
        return jsonify({"error": "Invalid session ID"}), 400

    source = sanitize_source(request.args.get("source", "claude"))
    project = sanitize_project_name(request.args.get("project", ""))

    if conv := DataLoader.get_conversation(source, project, session_id):
        return jsonify(conv.to_detail_dict())
    return jsonify({"error": "Conversation not found"}), 404


@app.route("/api/search")
def api_search():
    """全局搜索"""
    source = sanitize_source(request.args.get("source", "claude"))
    query = request.args.get("q", "")[:100]
    query = re.sub(r"[*{}()\\]", "", query)  # 防止 ReDoS
    
    results = DataLoader.search_conversations(source, query)
    return jsonify({"results": results, "total": len(results), "source": source})


@app.route("/api/stats")
def api_stats():
    """获取统计信息"""
    source = sanitize_source(request.args.get("source", "claude"))
    return jsonify(DataLoader.get_stats(source))


@app.route("/api/reload", methods=["POST"])
def api_reload():
    """重新加载数据"""
    source = sanitize_source(request.args.get("source", "claude"))
    
    # 清除缓存并重新加载
    DataLoader.clear_cache()
    start = time.time()
    data = DataLoader.load_all_data(source)
    load_time = time.time() - start

    # 提取统计信息
    project_data = {k: v for k, v in data.items() if not k.startswith("_")}
    total_convs = sum(len(convs) for convs in project_data.values())
    total_msgs = sum(len(c.messages) for convs in project_data.values() for c in convs)

    return jsonify({
        "success": True,
        "source": source,
        "load_time": load_time,
        "projects_count": len(project_data),
        "conversations_count": total_convs,
        "messages_count": total_msgs,
        "conversations_loaded": total_convs,
        "skipped_count": data.get("_skipped_count", 0),
        "skipped_files": data.get("_skipped_files", [])[:10],
        "data_complete": data.get("_skipped_count", 0) == 0,
    })


def main():
    """主函数"""
    print("Loading Claude Code history...")
    data = DataLoader.load_all_data("claude")

    project_data = {k: v for k, v in data.items() if not k.startswith("_")}
    total_convs = sum(len(convs) for convs in project_data.values())
    skipped = data.get("_skipped_count", 0)

    print(f"Loaded {len(project_data)} projects, {total_convs} conversations")
    if skipped > 0:
        print(f"Warning: {skipped} files had no messages and were skipped")

    print(f"\nAvailable sources: {', '.join(config.list_sources())}")
    print("\nStarting web server...")
    print("Open http://localhost:5000 in your browser\n")

    app.run(debug=DEBUG, port=5000, use_reloader=False)


if __name__ == "__main__":
    main()
