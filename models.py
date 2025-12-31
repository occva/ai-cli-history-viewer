#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""数据模型模块 - 消息和对话的数据结构"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Tuple, Union


@dataclass
class Message:
    """消息模型"""
    role: str
    content: str
    timestamp: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {"role": self.role, "content": self.content, "timestamp": self.timestamp}


@dataclass
class Conversation:
    """对话模型"""
    session_id: str
    project_path: str
    source_type: str
    messages: List[Message] = field(default_factory=list)
    title: str = ""
    timestamp: str = ""

    def add_message(self, role: str, content: str, timestamp: str = "") -> None:
        """添加消息并自动设置首个时间戳"""
        self.messages.append(Message(role, content, timestamp))
        if not self.timestamp and timestamp:
            self.timestamp = timestamp

    def generate_title(self) -> None:
        """根据对话内容生成标题"""
        for msg in self.messages:
            if msg.role == "user" and msg.content:
                content = " ".join(msg.content.split())[:80]
                self.title = content if len(content) <= 80 else content[:77] + "..."
                return
        self.title = f"Session {self.session_id[:8]}"

    def get_pairs(self) -> List[Tuple[str, str]]:
        """获取对话配对列表（用户消息和助手消息配对）"""
        user_msgs = [m.content for m in self.messages if m.role == "user"]
        ai_msgs = [m.content for m in self.messages if m.role == "assistant"]
        max_len = max(len(user_msgs), len(ai_msgs), 1)
        return [
            (user_msgs[i] if i < len(user_msgs) else "",
             ai_msgs[i] if i < len(ai_msgs) else "")
            for i in range(max_len)
        ]

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式（用于列表显示）"""
        return {
            "session_id": self.session_id,
            "project_path": self.project_path,
            "source_type": self.source_type,
            "title": self.title,
            "timestamp": self.timestamp,
            "message_count": len(self.messages),
            "date": self.timestamp[:10] if self.timestamp else "N/A",
        }

    def to_detail_dict(self) -> Dict[str, Any]:
        """转换为详细字典格式（用于详情显示）"""
        return {
            **self.to_dict(),
            "messages": [m.to_dict() for m in self.messages],
            "pairs": [{"user": u, "assistant": a} for u, a in self.get_pairs()],
        }

    def __lt__(self, other: "Conversation") -> bool:
        """用于排序，按时间戳倒序"""
        if self.timestamp and other.timestamp:
            return self.timestamp > other.timestamp
        return bool(self.timestamp)


def extract_text(content: Union[str, List, Any]) -> str:
    """从内容中提取纯文本（通用提取器）"""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        texts = []
        for item in content:
            if isinstance(item, str):
                texts.append(item)
            elif isinstance(item, dict):
                # 只要有 text 字段就提取，不局限于 type='text'
                # 兼容 Codex 的 'input_text' 等类型
                text = item.get("text") or item.get("content")
                if isinstance(text, str) and text:
                    texts.append(text)
                elif isinstance(text, list):
                    texts.append(extract_text(text))
        return "\n".join(texts).strip()
    return str(content) if content else ""
