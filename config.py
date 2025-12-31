#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配置模块 - 不同 CLI 工具的数据目录配置"""

from pathlib import Path
from typing import Dict, List, Optional

import os

# 基础目录配置，默认使用用户的 home 目录
# 允许通过环境变量 HISTORY_VIEWER_HOME 整体偏移所有数据源的基础路径
_home_env = os.environ.get("HISTORY_VIEWER_HOME")
DEFAULT_HOME = Path(_home_env) if _home_env else Path.home()

# 数据源配置
SOURCE_CONFIGS: Dict[str, Dict] = {
    "claude": {
        "base_dir": Path(os.environ.get("CLAUDE_BASE_DIR") or "") if os.environ.get("CLAUDE_BASE_DIR") else DEFAULT_HOME / ".claude",
        "projects_subdir": "projects",
        "transcripts_subdir": "transcripts",
    },
    "codex": {
        "base_dir": Path(os.environ.get("CODEX_BASE_DIR") or "") if os.environ.get("CODEX_BASE_DIR") else DEFAULT_HOME / ".codex",
        "sessions_subdir": "sessions",
    },
    "gemini": {
        "base_dir": Path(os.environ.get("GEMINI_BASE_DIR") or "") if os.environ.get("GEMINI_BASE_DIR") else DEFAULT_HOME / ".gemini",
        "tmp_subdir": "tmp",
    },
}


def get_source_config(source: str) -> Dict:
    """获取指定数据源的配置，如果不存在则返回 claude 配置"""
    return SOURCE_CONFIGS.get(source, SOURCE_CONFIGS["claude"])


def get_subdir(source: str, key: str) -> Optional[Path]:
    """安全获取子目录路径"""
    cfg = get_source_config(source)
    subdir = cfg.get(key)
    return cfg["base_dir"] / subdir if subdir else None


def list_sources() -> List[str]:
    """列出所有配置的数据源"""
    return list(SOURCE_CONFIGS.keys())
