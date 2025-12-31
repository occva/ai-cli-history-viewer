#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""数据加载器模块 - 统一加载各种格式的对话历史"""

import json
import logging
import os
from collections import defaultdict
from functools import lru_cache
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

import config
from models import Conversation, extract_text

logger = logging.getLogger(__name__)


class DataLoader:
    """数据加载器 - 从指定的 CLI 工具数据源加载对话历史"""

    # ==================== 通用工具方法 ====================

    @staticmethod
    def decode_project_name(encoded: str) -> str:
        """解码项目名称 (如 d-code-demo -> d:\\code\\demo)"""
        if len(encoded) >= 2 and encoded[1] == "-" and encoded[0].isalpha():
            parts = encoded.split("-", 1)
            if len(parts) == 2:
                return f"{parts[0]}:\\{parts[1].replace('-', os.sep)}" if parts[1] else f"{parts[0]}:\\"
        return encoded.replace("-", os.sep)

    @staticmethod
    def load_jsonl(filepath: Path) -> List[Dict]:
        """加载 JSONL 文件"""
        messages = []
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                for line in f:
                    if line := line.strip():
                        try:
                            messages.append(json.loads(line))
                        except json.JSONDecodeError:
                            continue
        except Exception as e:
            logger.warning(f"Failed to read {filepath}: {e}")
        return messages

    @staticmethod
    def load_json(filepath: Path) -> Optional[Dict]:
        """加载 JSON 文件"""
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to read {filepath}: {e}")
            return None

    # ==================== 消息解析器 ====================

    @staticmethod
    def parse_claude_entry(data: Dict) -> Optional[Tuple[str, str, str]]:
        """解析 Claude 格式的条目 -> (role, content, timestamp)"""
        entry_type = data.get("type", "")
        if entry_type not in ("user", "assistant") or data.get("isMeta") or data.get("isApiErrorMessage"):
            return None

        message = data.get("message", {})
        timestamp = data.get("timestamp", "")
        content = message.get("content", "" if entry_type == "user" else [])

        if isinstance(content, list):
            content = extract_text(content)
        
        if entry_type == "user" and isinstance(content, str) and content.startswith("<"):
            return None
        
        return (entry_type, content, timestamp) if content else None

    @staticmethod
    def parse_codex_entry(data: Dict) -> Optional[Tuple[str, str, str]]:
        """解析 Codex 格式的条目 -> (role, content, timestamp)"""
        if data.get("type") != "response_item":
            return None
        
        payload = data.get("payload", {})
        role = payload.get("role", "")
        if role not in ("user", "assistant"):
            return None
        
        content = extract_text(payload.get("content", []))
        return (role, content, data.get("timestamp", "")) if content else None

    @staticmethod
    def parse_gemini_message(msg: Dict) -> Optional[Tuple[str, str, str]]:
        """解析 Gemini 消息 -> (role, content, timestamp)"""
        msg_type = msg.get("type", "")
        content = msg.get("content", "")
        timestamp = msg.get("timestamp", "")
        
        if msg_type == "user":
            return ("user", content, timestamp) if content else None
        elif msg_type == "gemini":
            return ("assistant", content, timestamp) if content else None
        return None

    # ==================== 对话构建器 ====================

    @staticmethod
    def build_conversation(
        session_id: str,
        project_name: str,
        source: str,
        messages: List[Tuple[str, str, str]]
    ) -> Optional[Conversation]:
        """从解析的消息列表创建对话对象"""
        if not messages:
            return None
        
        conv = Conversation(session_id, project_name, source)
        for role, content, timestamp in messages:
            conv.add_message(role, content, timestamp)
        
        if conv.messages:
            conv.generate_title()
            return conv
        return None
        
    @staticmethod
    def _register_conversation(
        projects: Dict,
        skipped: List,
        filepath: Path,
        source: str,
        project_name: str,
        messages: List[Tuple[str, str, str]],
        session_id: str = None
    ) -> Optional[Conversation]:
        """注册对话到项目列表"""
        sid = session_id or filepath.stem
        if conv := DataLoader.build_conversation(sid, project_name, source, messages):
            projects[project_name].append(conv)
            return conv
        else:
            skipped.append({"file": str(filepath), "project": project_name, "reason": "no valid messages"})
            return None

    # ==================== 数据加载 ====================

    @staticmethod
    @lru_cache(maxsize=8)
    def load_all_data(source: str = "claude") -> Dict[str, Any]:
        """根据指定的数据源加载所有对话数据"""
        cfg = config.get_source_config(source)
        base_dir = cfg["base_dir"]

        if not base_dir.exists():
            return {"_source": source, "_error": f"Directory not found: {base_dir}"}

        projects = defaultdict(list)
        skipped = []

        # 根据数据源类型调用对应的加载器
        loaders = {
            "claude": DataLoader._load_claude,
            "codex": DataLoader._load_codex,
            "gemini": DataLoader._load_gemini,
        }
        loader = loaders.get(source, DataLoader._load_claude)
        loader(cfg, projects, skipped)

        # 排序
        for name in projects:
            projects[name].sort()

        return {
            **dict(projects),
            "_skipped_files": skipped,
            "_skipped_count": len(skipped),
            "_source": source,
        }

    @staticmethod
    def _load_claude(cfg: Dict, projects: Dict, skipped: List) -> None:
        """加载 Claude 格式的数据"""
        base = cfg["base_dir"]
        
        # 加载 projects 目录
        if projects_dir := config.get_subdir("claude", "projects_subdir"):
            if projects_dir.exists():
                for project_dir in projects_dir.iterdir():
                    if not project_dir.is_dir():
                        continue
                    project_name = DataLoader.decode_project_name(project_dir.name)

                    for jsonl_file in project_dir.glob("*.jsonl"):
                        if jsonl_file.name.startswith("agent-") or jsonl_file.stat().st_size == 0:
                            continue
                        DataLoader._process_jsonl(
                            jsonl_file, project_name, "claude",
                            DataLoader.parse_claude_entry, projects, skipped
                        )

        # 加载 transcripts 目录
        if transcripts_dir := config.get_subdir("claude", "transcripts_subdir"):
            if transcripts_dir.exists():
                for jsonl_file in transcripts_dir.glob("ses_*.jsonl"):
                    session_id = jsonl_file.stem[4:]
                    DataLoader._process_jsonl(
                        jsonl_file, "Transcripts", "claude",
                        DataLoader.parse_claude_entry, projects, skipped,
                        session_id=session_id
                    )

    @staticmethod
    def _load_codex(cfg: Dict, projects: Dict, skipped: List) -> None:
        """加载 Codex 格式的数据"""
        sessions_dir = config.get_subdir("codex", "sessions_subdir")
        if not sessions_dir or not sessions_dir.exists():
            return

        # 递归遍历 sessions/YYYY/MM/DD/ 目录
        for jsonl_file in sessions_dir.rglob("rollout-*.jsonl"):
            if jsonl_file.stat().st_size == 0:
                continue
            
            raw_data = DataLoader.load_jsonl(jsonl_file)
            if not raw_data:
                continue

            # 获取 cwd 作为项目名
            project_name = "Codex Sessions"
            for data in raw_data:
                if data.get("type") == "session_meta":
                    project_name = data.get("payload", {}).get("cwd", project_name)
                    break

            messages = [m for d in raw_data if (m := DataLoader.parse_codex_entry(d))]
            DataLoader._register_conversation(projects, skipped, jsonl_file, "codex", project_name, messages)

    @staticmethod
    def _load_gemini(cfg: Dict, projects: Dict, skipped: List) -> None:
        """加载 Gemini 格式的数据（JSON 文件在 tmp 目录）"""
        tmp_dir = config.get_subdir("gemini", "tmp_subdir")
        if not tmp_dir or not tmp_dir.exists():
            return

        for hash_dir in tmp_dir.iterdir():
            if not hash_dir.is_dir() or len(hash_dir.name) != 64:
                continue

            chats_dir = hash_dir / "chats"
            if not chats_dir.exists():
                continue

            for session_file in chats_dir.glob("session-*.json"):
                data = DataLoader.load_json(session_file)
                if not data:
                    continue

                session_id = data.get("sessionId", session_file.stem)
                messages = [m for msg in data.get("messages", []) if (m := DataLoader.parse_gemini_message(msg))]
                if conv := DataLoader._register_conversation(
                    projects, skipped, session_file, "gemini", "Gemini Chats", messages, session_id
                ):
                    conv.timestamp = data.get("startTime", "")

    @staticmethod
    def _process_jsonl(
        filepath: Path,
        project_name: str,
        source: str,
        parser: Callable,
        projects: Dict,
        skipped: List,
        session_id: str = None
    ) -> None:
        """通用 JSONL 处理方法"""
        raw_data = DataLoader.load_jsonl(filepath)
        if not raw_data:
            return

        messages = [m for d in raw_data if (m := parser(d))]
        DataLoader._register_conversation(projects, skipped, filepath, source, project_name, messages, session_id)

    # ==================== 查询接口 ====================

    @staticmethod
    def get_conversation(source: str, project_name: str, session_id: str) -> Optional[Conversation]:
        """获取指定对话"""
        data = DataLoader.load_all_data(source)
        for conv in data.get(project_name, []):
            if conv.session_id == session_id:
                return conv
        return None

    @staticmethod
    def search_conversations(source: str, query: str) -> List[Dict[str, Any]]:
        """搜索对话"""
        import re
        if not query:
            return []
        
        try:
            pattern = re.compile(query, re.IGNORECASE)
        except re.error:
            return []

        data = DataLoader.load_all_data(source)
        results = []
        for project_name, conversations in data.items():
            if project_name.startswith("_"):
                continue
            for conv in conversations:
                if pattern.search(conv.title):
                    results.append({
                        "project": project_name,
                        "session_id": conv.session_id,
                        "title": conv.title,
                        "date": conv.timestamp[:10] if conv.timestamp else "N/A",
                    })
        return results

    @staticmethod
    def get_stats(source: str) -> Dict[str, Any]:
        """获取统计信息"""
        import time
        start = time.time()
        data = DataLoader.load_all_data(source)
        load_time = time.time() - start

        project_data = {k: v for k, v in data.items() if not k.startswith("_")}
        total_convs = sum(len(convs) for convs in project_data.values())
        total_msgs = sum(len(c.messages) for convs in project_data.values() for c in convs)

        return {
            "source": source,
            "projects_count": len(project_data),
            "conversations_count": total_convs,
            "messages_count": total_msgs,
            "conversations_loaded": total_convs,
            "skipped_count": data.get("_skipped_count", 0),
            "load_time": load_time,
            "error": data.get("_error"),
        }

    @staticmethod
    def get_projects_list(source: str) -> List[Dict[str, Any]]:
        """获取项目列表"""
        data = DataLoader.load_all_data(source)
        
        if error := data.get("_error"):
            return [{"name": f"Error: {error}", "conversation_count": 0, "latest_date": "N/A"}]

        projects = []
        for name in sorted((k for k in data if not k.startswith("_")), key=str.lower):
            convs = data[name]
            latest = convs[0].timestamp[:10] if convs and convs[0].timestamp else "N/A"
            projects.append({"name": name, "conversation_count": len(convs), "latest_date": latest})
        return projects

    @staticmethod
    def get_project_conversations(source: str, project_name: str) -> List[Conversation]:
        """获取项目对话列表"""
        return DataLoader.load_all_data(source).get(project_name, [])

    @staticmethod
    def clear_cache() -> None:
        """清除缓存"""
        DataLoader.load_all_data.cache_clear()
