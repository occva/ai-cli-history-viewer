use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::{collections::HashMap, mem};

use serde_json::Value;

use crate::paths::get_claude_projects_dir;
use crate::session_manager::{SessionMessage, SessionMeta};

use super::utils::{
    extract_text, log_scan_error, parse_timestamp_to_ms, path_basename, read_head_tail_lines,
    truncate_summary,
};

const PROVIDER_ID: &str = "claude";

pub fn scan_sessions() -> Vec<SessionMeta> {
    let root = get_claude_projects_dir();
    let mut files = Vec::new();
    collect_jsonl_files(&root, &mut files);

    let mut sessions = Vec::new();
    for path in files {
        if let Some(meta) = parse_session(&path) {
            sessions.push(meta);
        }
    }

    sessions
}

pub fn load_messages(path: &Path) -> Result<Vec<SessionMessage>, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open session file: {e}"))?;
    let reader = BufReader::new(file);
    let mut messages = Vec::new();
    let mut tool_names = HashMap::new();

    for line in reader.lines() {
        let line = match line {
            Ok(value) => value,
            Err(_) => continue,
        };
        let value: Value = match serde_json::from_str(&line) {
            Ok(parsed) => parsed,
            Err(_) => continue,
        };

        if value.get("isMeta").and_then(Value::as_bool) == Some(true) {
            continue;
        }

        let message = match value.get("message") {
            Some(message) => message,
            None => continue,
        };

        let role = message
            .get("role")
            .and_then(Value::as_str)
            .unwrap_or("unknown")
            .to_string();
        let ts = value.get("timestamp").and_then(parse_timestamp_to_ms);

        if let Some(content_blocks) = message.get("content").and_then(Value::as_array) {
            append_structured_blocks(
                &mut messages,
                &mut tool_names,
                &role,
                ts,
                content_blocks,
            );
            continue;
        }

        let role = message
            .get("role")
            .and_then(Value::as_str)
            .unwrap_or("unknown")
            .to_string();
        let content = message.get("content").map(extract_text).unwrap_or_default();
        if content.trim().is_empty() {
            continue;
        }

        messages.push(SessionMessage::plain(role, content, ts));
    }

    Ok(messages)
}

fn append_structured_blocks(
    messages: &mut Vec<SessionMessage>,
    tool_names: &mut HashMap<String, String>,
    role: &str,
    ts: Option<i64>,
    content_blocks: &[Value],
) {
    let mut text_buffer = String::new();

    for block in content_blocks {
        let block_type = block.get("type").and_then(Value::as_str).unwrap_or_default();
        match block_type {
            "text" => {
                if let Some(text) = block.get("text").and_then(Value::as_str) {
                    append_text_buffer(&mut text_buffer, text);
                }
            }
            "tool_use" => {
                flush_text_buffer(messages, role, ts, &mut text_buffer);
                let name = block
                    .get("name")
                    .and_then(Value::as_str)
                    .map(|value| value.to_string());
                let call_id = block
                    .get("id")
                    .and_then(Value::as_str)
                    .map(|value| value.to_string());
                if let (Some(call_id), Some(name)) = (call_id.clone(), name.clone()) {
                    tool_names.insert(call_id, name);
                }

                let content = block
                    .get("input")
                    .map(format_json_block)
                    .unwrap_or_default();
                if content.trim().is_empty() {
                    continue;
                }

                let mut message = SessionMessage::structured(
                    "assistant".to_string(),
                    "tool_use",
                    name.clone(),
                    call_id,
                    content,
                    ts,
                );
                if let Some(name) = name {
                    message.tool_names.push(name);
                }
                messages.push(message);
            }
            "tool_result" => {
                flush_text_buffer(messages, role, ts, &mut text_buffer);
                let call_id = block
                    .get("tool_use_id")
                    .and_then(Value::as_str)
                    .map(|value| value.to_string());
                let name = call_id
                    .as_ref()
                    .and_then(|value| tool_names.get(value))
                    .cloned();
                let content = block.get("content").map(extract_text).unwrap_or_default();
                if content.trim().is_empty() {
                    continue;
                }

                messages.push(SessionMessage::structured(
                    "tool".to_string(),
                    "tool_result",
                    name,
                    call_id,
                    content,
                    ts,
                ));
            }
            _ => {}
        }
    }

    flush_text_buffer(messages, role, ts, &mut text_buffer);
}

fn append_text_buffer(buffer: &mut String, next: &str) {
    let trimmed = next.trim();
    if trimmed.is_empty() {
        return;
    }

    if !buffer.is_empty() {
        buffer.push_str("\n\n");
    }
    buffer.push_str(trimmed);
}

fn flush_text_buffer(
    messages: &mut Vec<SessionMessage>,
    role: &str,
    ts: Option<i64>,
    text_buffer: &mut String,
) {
    let content = mem::take(text_buffer);
    if content.trim().is_empty() {
        return;
    }
    messages.push(SessionMessage::plain(role.to_string(), content, ts));
}

fn format_json_block(value: &Value) -> String {
    serde_json::to_string_pretty(value)
        .unwrap_or_else(|_| value.to_string())
        .trim()
        .to_string()
}

pub fn delete_session(_root: &Path, path: &Path, session_id: &str) -> Result<bool, String> {
    let meta = parse_session(path).ok_or_else(|| {
        format!(
            "Failed to parse Claude session metadata: {}",
            path.display()
        )
    })?;

    if meta.session_id != session_id {
        return Err(format!(
            "Claude session ID mismatch: expected {session_id}, found {}",
            meta.session_id
        ));
    }

    if let Some(stem) = path.file_stem() {
        let sibling = path.parent().unwrap_or_else(|| Path::new("")).join(stem);
        remove_path_if_exists(&sibling).map_err(|e| {
            format!(
                "Failed to delete Claude session sidecar {}: {e}",
                sibling.display()
            )
        })?;
    }

    std::fs::remove_file(path).map_err(|e| {
        format!(
            "Failed to delete Claude session file {}: {e}",
            path.display()
        )
    })?;

    Ok(true)
}

fn parse_session(path: &Path) -> Option<SessionMeta> {
    if is_agent_session(path) {
        return None;
    }

    let (head, tail) = read_head_tail_lines(path, 10, 30).ok()?;

    let mut session_id: Option<String> = None;
    let mut project_dir: Option<String> = None;
    let mut model: Option<String> = None;
    let mut created_at: Option<i64> = None;

    // Extract metadata from head lines
    for line in &head {
        let value: Value = match serde_json::from_str(line) {
            Ok(parsed) => parsed,
            Err(_) => continue,
        };
        if session_id.is_none() {
            session_id = value
                .get("sessionId")
                .and_then(Value::as_str)
                .map(|s| s.to_string());
        }
        if project_dir.is_none() {
            project_dir = value
                .get("cwd")
                .and_then(Value::as_str)
                .map(|s| s.to_string());
        }
        if created_at.is_none() {
            created_at = value.get("timestamp").and_then(parse_timestamp_to_ms);
        }
        if model.is_none() {
            model = value
                .get("model")
                .and_then(Value::as_str)
                .or_else(|| {
                    value
                        .get("message")
                        .and_then(|message| message.get("model"))
                        .and_then(Value::as_str)
                })
                .map(|s| s.to_string());
        }
    }

    // Extract last_active_at and summary from tail lines (reverse order)
    let mut last_active_at: Option<i64> = None;
    let mut summary: Option<String> = None;

    for line in tail.iter().rev() {
        let value: Value = match serde_json::from_str(line) {
            Ok(parsed) => parsed,
            Err(_) => continue,
        };
        if last_active_at.is_none() {
            last_active_at = value.get("timestamp").and_then(parse_timestamp_to_ms);
        }
        if summary.is_none() {
            if value.get("isMeta").and_then(Value::as_bool) == Some(true) {
                continue;
            }
            if let Some(message) = value.get("message") {
                let text = message.get("content").map(extract_text).unwrap_or_default();
                if !text.trim().is_empty() {
                    summary = Some(text);
                }
            }
        }
        if last_active_at.is_some() && summary.is_some() {
            break;
        }
    }

    let session_id = session_id.or_else(|| infer_session_id_from_filename(path));
    let session_id = session_id?;

    let title = project_dir
        .as_deref()
        .and_then(path_basename)
        .map(|value| value.to_string());

    let summary = summary.map(|text| truncate_summary(&text, 160));

    // Skip snapshot-only files (e.g. file-history-snapshot without real chat messages).
    // These files usually have no cwd/message/timestamp and should not appear as sessions.
    if project_dir.is_none()
        && summary.is_none()
        && created_at.is_none()
        && last_active_at.is_none()
    {
        return None;
    }

    Some(SessionMeta {
        provider_id: PROVIDER_ID.to_string(),
        session_id: session_id.clone(),
        title,
        summary,
        project_dir: project_dir.clone(),
        cwd: project_dir.clone(),
        model,
        created_at,
        last_active_at,
        source_path: Some(path.to_string_lossy().to_string()),
        resume_command: Some(format!("claude --resume {session_id}")),
    })
}

fn is_agent_session(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.starts_with("agent-"))
        .unwrap_or(false)
}

fn infer_session_id_from_filename(path: &Path) -> Option<String> {
    path.file_stem()
        .and_then(|stem| stem.to_str())
        .map(|stem| stem.to_string())
}

fn collect_jsonl_files(root: &Path, files: &mut Vec<PathBuf>) {
    if !root.exists() {
        return;
    }

    let entries = match std::fs::read_dir(root) {
        Ok(entries) => entries,
        Err(err) => {
            log_scan_error(PROVIDER_ID, root, &err);
            return;
        }
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_jsonl_files(&path, files);
        } else if path.extension().and_then(|ext| ext.to_str()) == Some("jsonl") {
            files.push(path);
        }
    }
}

fn remove_path_if_exists(path: &Path) -> std::io::Result<()> {
    match std::fs::metadata(path) {
        Ok(meta) => {
            if meta.is_dir() {
                std::fs::remove_dir_all(path)
            } else {
                std::fs::remove_file(path)
            }
        }
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(err) => Err(err),
    }
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::*;

    #[test]
    fn load_messages_keeps_tool_use_and_result_blocks() {
        let dir = tempdir().expect("tempdir");
        let path = dir.path().join("session.jsonl");
        let content = [
            r#"{"sessionId":"claude-tool-1","cwd":"D:\\code","timestamp":"2026-03-29T06:00:00Z","message":{"role":"user","content":"请读取文件"}}"#,
            r#"{"sessionId":"claude-tool-1","cwd":"D:\\code","timestamp":"2026-03-29T06:00:01Z","message":{"role":"assistant","content":[{"type":"text","text":"先读取文件。"},{"type":"tool_use","id":"tooluse_1","name":"Read","input":{"file_path":"D:\\code\\README.md"}}]}}"#,
            r#"{"sessionId":"claude-tool-1","cwd":"D:\\code","timestamp":"2026-03-29T06:00:02Z","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"tooluse_1","content":"line 1\nline 2"}]}}"#,
            r#"{"sessionId":"claude-tool-1","cwd":"D:\\code","timestamp":"2026-03-29T06:00:03Z","message":{"role":"assistant","content":[{"type":"text","text":"读取完成。"}]}}"#,
        ]
        .join("\n");
        fs::write(&path, format!("{content}\n")).expect("write claude fixture");

        let messages = load_messages(&path).expect("load messages");
        assert_eq!(messages.len(), 5);
        assert_eq!(messages[1].kind, "message");
        assert_eq!(messages[1].role, "assistant");
        assert_eq!(messages[2].kind, "tool_use");
        assert_eq!(messages[2].name.as_deref(), Some("Read"));
        assert_eq!(messages[2].call_id.as_deref(), Some("tooluse_1"));
        assert!(messages[2].content.contains("file_path"));
        assert_eq!(messages[3].kind, "tool_result");
        assert_eq!(messages[3].role, "tool");
        assert_eq!(messages[3].name.as_deref(), Some("Read"));
        assert_eq!(messages[3].searchable_text(), "");
    }
}
