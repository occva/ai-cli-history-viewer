use std::collections::HashMap;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::sync::LazyLock;

use regex::Regex;
use serde_json::Value;

use crate::paths::get_codex_sessions_dir;
use crate::session_manager::{SessionMessage, SessionMeta};

use super::utils::{
    extract_text, log_scan_error, parse_timestamp_to_ms, path_basename, read_head_tail_lines,
    truncate_summary,
};

const PROVIDER_ID: &str = "codex";

static UUID_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
        .unwrap()
});

pub fn scan_sessions() -> Vec<SessionMeta> {
    let root = get_codex_sessions_dir();
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
    let mut call_names = HashMap::new();

    for line in reader.lines() {
        let line = match line {
            Ok(value) => value,
            Err(_) => continue,
        };
        let value: Value = match serde_json::from_str(&line) {
            Ok(parsed) => parsed,
            Err(_) => continue,
        };

        if value.get("type").and_then(Value::as_str) != Some("response_item") {
            continue;
        }

        let payload = match value.get("payload") {
            Some(payload) => payload,
            None => continue,
        };
        let payload_type = payload
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let ts = value.get("timestamp").and_then(parse_timestamp_to_ms);

        match payload_type {
            "message" => {
                let role = payload
                    .get("role")
                    .and_then(Value::as_str)
                    .unwrap_or("unknown")
                    .to_string();
                let content = payload.get("content").map(extract_text).unwrap_or_default();
                if content.trim().is_empty() {
                    continue;
                }
                messages.push(SessionMessage::plain(role, content, ts));
            }
            "function_call" => {
                let name = payload
                    .get("name")
                    .and_then(Value::as_str)
                    .map(|value| value.to_string());
                let call_id = payload
                    .get("call_id")
                    .and_then(Value::as_str)
                    .map(|value| value.to_string());
                if let (Some(call_id), Some(name)) = (call_id.clone(), name.clone()) {
                    call_names.insert(call_id, name);
                }

                let content = format_function_call_content(payload);
                if content.trim().is_empty() {
                    continue;
                }

                messages.push(SessionMessage::structured(
                    "assistant".to_string(),
                    "function_call",
                    name,
                    call_id,
                    content,
                    ts,
                ));
            }
            "function_call_output" => {
                let call_id = payload
                    .get("call_id")
                    .and_then(Value::as_str)
                    .map(|value| value.to_string());
                let name = call_id
                    .as_ref()
                    .and_then(|value| call_names.get(value))
                    .cloned();
                let content = payload
                    .get("output")
                    .and_then(Value::as_str)
                    .map(|value| value.trim().to_string())
                    .unwrap_or_default();
                if content.is_empty() {
                    continue;
                }

                messages.push(SessionMessage::structured(
                    "tool".to_string(),
                    "function_call_output",
                    name,
                    call_id,
                    content,
                    ts,
                ));
            }
            _ => {}
        }
    }

    Ok(messages)
}

fn format_function_call_content(payload: &Value) -> String {
    let raw_arguments = payload
        .get("arguments")
        .and_then(Value::as_str)
        .map(str::trim)
        .unwrap_or_default();
    if raw_arguments.is_empty() {
        return String::new();
    }

    if let Ok(parsed) = serde_json::from_str::<Value>(raw_arguments) {
        if let Ok(pretty) = serde_json::to_string_pretty(&parsed) {
            return pretty;
        }
    }

    raw_arguments.to_string()
}

pub fn delete_session(_root: &Path, path: &Path, session_id: &str) -> Result<bool, String> {
    let meta = parse_session(path)
        .ok_or_else(|| format!("Failed to parse Codex session metadata: {}", path.display()))?;

    if meta.session_id != session_id {
        return Err(format!(
            "Codex session ID mismatch: expected {session_id}, found {}",
            meta.session_id
        ));
    }

    std::fs::remove_file(path).map_err(|e| {
        format!(
            "Failed to delete Codex session file {}: {e}",
            path.display()
        )
    })?;

    Ok(true)
}

fn parse_session(path: &Path) -> Option<SessionMeta> {
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
        if created_at.is_none() {
            created_at = value.get("timestamp").and_then(parse_timestamp_to_ms);
        }
        if value.get("type").and_then(Value::as_str) == Some("session_meta") {
            if let Some(payload) = value.get("payload") {
                if session_id.is_none() {
                    session_id = payload
                        .get("id")
                        .and_then(Value::as_str)
                        .map(|s| s.to_string());
                }
                if project_dir.is_none() {
                    project_dir = payload
                        .get("cwd")
                        .and_then(Value::as_str)
                        .map(|s| s.to_string());
                }
                if model.is_none() {
                    model = payload
                        .get("model")
                        .and_then(Value::as_str)
                        .or_else(|| payload.get("model_slug").and_then(Value::as_str))
                        .map(|s| s.to_string());
                }
                if let Some(ts) = payload.get("timestamp").and_then(parse_timestamp_to_ms) {
                    created_at.get_or_insert(ts);
                }
            }
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
        if summary.is_none() && value.get("type").and_then(Value::as_str) == Some("response_item") {
            if let Some(payload) = value.get("payload") {
                if payload.get("type").and_then(Value::as_str) == Some("message") {
                    let text = payload.get("content").map(extract_text).unwrap_or_default();
                    if !text.trim().is_empty() {
                        summary = Some(text);
                    }
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
        resume_command: Some(format!("codex resume {session_id}")),
    })
}

fn infer_session_id_from_filename(path: &Path) -> Option<String> {
    let file_name = path.file_name()?.to_string_lossy();
    UUID_RE.find(&file_name).map(|mat| mat.as_str().to_string())
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

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::*;

    #[test]
    fn load_messages_keeps_function_calls_and_outputs() {
        let dir = tempdir().expect("tempdir");
        let path = dir.path().join("session.jsonl");
        let content = [
            r#"{"timestamp":"2026-03-29T06:00:00Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"请检查项目"}]}}"#,
            r#"{"timestamp":"2026-03-29T06:00:01Z","type":"response_item","payload":{"type":"function_call","name":"shell_command","arguments":"{\"command\":\"Get-ChildItem\"}","call_id":"call_123"}}"#,
            r#"{"timestamp":"2026-03-29T06:00:02Z","type":"response_item","payload":{"type":"function_call_output","call_id":"call_123","output":"Exit code: 0\nOutput:\nfile-a"}}"#,
            r#"{"timestamp":"2026-03-29T06:00:03Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"已完成检查"}]}}"#,
        ]
        .join("\n");
        fs::write(&path, format!("{content}\n")).expect("write codex fixture");

        let messages = load_messages(&path).expect("load messages");
        assert_eq!(messages.len(), 4);
        assert_eq!(messages[1].kind, "function_call");
        assert_eq!(messages[1].name.as_deref(), Some("shell_command"));
        assert_eq!(messages[1].call_id.as_deref(), Some("call_123"));
        assert!(messages[1].content.contains("Get-ChildItem"));
        assert_eq!(messages[2].kind, "function_call_output");
        assert_eq!(messages[2].role, "tool");
        assert_eq!(messages[2].name.as_deref(), Some("shell_command"));
        assert_eq!(messages[2].searchable_text(), "");
    }
}
