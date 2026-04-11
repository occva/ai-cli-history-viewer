use std::path::Path;

use serde_json::Value;

use super::utils::{log_scan_error, normalize_title_candidate, parse_timestamp_to_ms};
use crate::paths::get_gemini_tmp_dir;
use crate::session_manager::{SessionMessage, SessionMeta};
const PROVIDER_ID: &str = "gemini";

pub fn scan_sessions() -> Vec<SessionMeta> {
    let tmp_dir = get_gemini_tmp_dir();
    if !tmp_dir.exists() {
        return Vec::new();
    }

    let mut sessions = Vec::new();

    // Iterate over project hash directories: tmp/<project_hash>/chats/session-*.json
    let project_dirs = match std::fs::read_dir(&tmp_dir) {
        Ok(entries) => entries,
        Err(err) => {
            log_scan_error(PROVIDER_ID, &tmp_dir, &err);
            return Vec::new();
        }
    };

    for entry in project_dirs.flatten() {
        let chats_dir = entry.path().join("chats");
        if !chats_dir.is_dir() {
            continue;
        }

        let chat_files = match std::fs::read_dir(&chats_dir) {
            Ok(entries) => entries,
            Err(err) => {
                log_scan_error(PROVIDER_ID, &chats_dir, &err);
                continue;
            }
        };

        for file_entry in chat_files.flatten() {
            let path = file_entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            if let Some(meta) = parse_session(&path) {
                sessions.push(meta);
            }
        }
    }

    sessions
}

pub fn load_messages(path: &Path) -> Result<Vec<SessionMessage>, String> {
    let data = std::fs::read_to_string(path).map_err(|e| format!("Failed to read session: {e}"))?;
    let value: Value =
        serde_json::from_str(&data).map_err(|e| format!("Failed to parse session JSON: {e}"))?;

    let messages = value
        .get("messages")
        .and_then(Value::as_array)
        .ok_or_else(|| "No messages array found".to_string())?;

    let mut result = Vec::new();
    for msg in messages {
        let content = match msg.get("content").and_then(Value::as_str) {
            Some(c) if !c.trim().is_empty() => c.to_string(),
            _ => continue,
        };

        let role = match msg.get("type").and_then(Value::as_str) {
            Some("gemini") => "assistant".to_string(),
            Some("user") => "user".to_string(),
            Some(other) => other.to_string(),
            None => continue,
        };

        let ts = msg.get("timestamp").and_then(parse_timestamp_to_ms);

        result.push(SessionMessage::plain(role, content, ts));
    }

    Ok(result)
}

pub fn delete_session(_root: &Path, path: &Path, session_id: &str) -> Result<bool, String> {
    let meta = parse_session(path).ok_or_else(|| {
        format!(
            "Failed to parse Gemini session metadata: {}",
            path.display()
        )
    })?;

    if meta.session_id != session_id {
        return Err(format!(
            "Gemini session ID mismatch: expected {session_id}, found {}",
            meta.session_id
        ));
    }

    std::fs::remove_file(path).map_err(|e| {
        format!(
            "Failed to delete Gemini session file {}: {e}",
            path.display()
        )
    })?;

    Ok(true)
}

fn parse_session(path: &Path) -> Option<SessionMeta> {
    let data = std::fs::read_to_string(path).ok()?;
    let value: Value = serde_json::from_str(&data).ok()?;

    let session_id = value.get("sessionId").and_then(Value::as_str)?.to_string();

    let created_at = value.get("startTime").and_then(parse_timestamp_to_ms);
    let last_active_at = value.get("lastUpdated").and_then(parse_timestamp_to_ms);

    let summary_title = value
        .get("summary")
        .and_then(Value::as_str)
        .and_then(|summary| normalize_title_candidate(summary, 160));

    let first_user_title = value
        .get("messages")
        .and_then(Value::as_array)
        .and_then(|msgs| {
            msgs.iter()
                .find(|m| m.get("type").and_then(Value::as_str) == Some("user"))
                .and_then(|m| m.get("content").and_then(Value::as_str))
                .and_then(|content| normalize_title_candidate(content, 160))
        });

    let title = summary_title.or(first_user_title);

    let source_path = path.to_string_lossy().to_string();

    Some(SessionMeta {
        provider_id: PROVIDER_ID.to_string(),
        session_id: session_id.clone(),
        title: title.clone(),
        summary: title,
        project_dir: None, // project hash is not reversible
        cwd: None,
        model: value
            .get("model")
            .and_then(Value::as_str)
            .map(|s| s.to_string()),
        created_at,
        last_active_at: last_active_at.or(created_at),
        source_path: Some(source_path),
        resume_command: Some(format!("gemini --resume {session_id}")),
    })
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::*;

    #[test]
    fn parse_session_prefers_summary_for_title() {
        let dir = tempdir().expect("tempdir");
        let path = dir.path().join("session.json");
        fs::write(
            &path,
            r#"{
  "sessionId": "827eede4-2d4d-4d9b-900b-ddea7069ffb1",
  "startTime": "2025-12-20T10:07:54.366Z",
  "lastUpdated": "2025-12-20T13:48:46.055Z",
  "summary": "Summarize video transcript and save to file.",
  "messages": [
    {
      "type": "user",
      "timestamp": "2025-12-20T10:07:54.366Z",
      "content": "总结 https://www.youtube.com/watch?v=Hzl4WtUKg-U"
    }
  ]
}"#,
        )
        .expect("write gemini fixture");

        let meta = parse_session(&path).expect("parse session");

        assert_eq!(
            meta.title.as_deref(),
            Some("Summarize video transcript and save to file.")
        );
    }
}
