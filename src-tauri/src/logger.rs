use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, Runtime};
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

use crate::blocking::run_blocking_string;

const MAX_LOG_FILE_SIZE_BYTES: u64 = 1024 * 1024; // 1 MiB
const MAX_BACKUP_FILES: usize = 3;
const MAX_CONTEXT_KEY_LEN: usize = 256;
// 128-bit trace ID length matching OpenTelemetry TraceId field shape.
const TRACE_ID_LEN: usize = 32;

static LOG_MUTEX: Mutex<()> = Mutex::new(());

// OpenTelemetry Log Data Model record shape for app.log and native-debug.log.
#[derive(Debug, Serialize, Deserialize)]
struct OtelLogRecord {
    #[serde(rename = "Timestamp")]
    timestamp: String,
    #[serde(rename = "TraceId", skip_serializing_if = "Option::is_none")]
    trace_id: Option<String>,
    #[serde(rename = "SeverityText")]
    severity_text: String,
    #[serde(rename = "SeverityNumber")]
    severity_number: u8,
    #[serde(rename = "Body")]
    body: String,
    #[serde(rename = "Attributes", skip_serializing_if = "Option::is_none")]
    attributes: Option<Map<String, Value>>,
}

// Maps severity string to OpenTelemetry SeverityText and SeverityNumber pair.
fn severity_fields(severity: &str) -> Option<(&'static str, u8)> {
    match severity {
        "trace" => Some(("TRACE", 1)),
        "debug" => Some(("DEBUG", 5)),
        "info" => Some(("INFO", 9)),
        "warning" => Some(("WARN", 13)),
        "error" => Some(("ERROR", 17)),
        "fatal" => Some(("FATAL", 21)),
        _ => None,
    }
}

fn is_valid_trace_id(value: &str) -> bool {
    !value.is_empty() && value.len() <= TRACE_ID_LEN && value.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

fn iso_now() -> String {
    OffsetDateTime::now_utc().format(&Rfc3339).unwrap_or_default()
}

fn sanitize_record(value: &serde_json::Value) -> Result<OtelLogRecord, String> {
    let obj = value.as_object().ok_or("Expected JSON object")?;

    let code = obj.get("code").and_then(|v| v.as_str()).ok_or("Missing or invalid 'code'")?.to_string();

    let occurred_at = obj
        .get("occurredAt")
        .or_else(|| obj.get("occurred_at"))
        .and_then(|v| v.as_str())
        .ok_or("Missing or invalid 'occurredAt'")?
        .to_string();

    // Restricts app.log to warning and error severities.
    let (severity_text, severity_number) = match obj.get("severity").and_then(|v| v.as_str()) {
        Some(severity @ ("warning" | "error")) => severity_fields(severity).ok_or("Invalid severity")?,
        _ => return Err("Invalid severity".to_string()),
    };

    let source = match obj.get("source").and_then(|v| v.as_str()) {
        Some(source @ ("desktop" | "translation" | "viewer")) => source,
        _ => return Err("Invalid source".to_string()),
    };

    let mut attributes = Map::new();
    attributes.insert("event.source".to_string(), Value::String(source.to_string()));

    if code == "translation.missing-key"
        && let Some(key) = obj
            .get("context")
            .and_then(|c| c.get("key"))
            .and_then(|k| k.as_str())
            .filter(|k| !k.is_empty() && k.len() <= MAX_CONTEXT_KEY_LEN)
    {
        attributes.insert("translation.key".to_string(), Value::String(key.to_string()));
    }

    let trace_id = obj.get("traceId").and_then(|v| v.as_str()).filter(|t| is_valid_trace_id(t)).map(str::to_string);

    Ok(OtelLogRecord {
        timestamp: occurred_at,
        trace_id,
        severity_text: severity_text.to_string(),
        severity_number,
        body: code,
        attributes: Some(attributes),
    })
}

fn get_log_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    app.path().app_log_dir().map_err(|e| format!("Failed to get app_log_dir: {}", e))
}

fn rotate_logs_if_needed(log_dir: &Path, base_name: &str, active_log_path: &Path, bytes_to_write: u64) -> Result<(), String> {
    if !active_log_path.exists() {
        return Ok(());
    }

    let metadata = fs::metadata(active_log_path).map_err(|e| e.to_string())?;
    if metadata.len() + bytes_to_write <= MAX_LOG_FILE_SIZE_BYTES {
        return Ok(());
    }

    // Rotates backup log files {base}.N.log up to MAX_BACKUP_FILES.
    let oldest = log_dir.join(format!("{base_name}.{}.log", MAX_BACKUP_FILES));
    if oldest.exists() {
        let _ = fs::remove_file(oldest);
    }

    for i in (1..MAX_BACKUP_FILES).rev() {
        let current = log_dir.join(format!("{base_name}.{}.log", i));
        let next = log_dir.join(format!("{base_name}.{}.log", i + 1));
        if current.exists() {
            let _ = fs::rename(current, next);
        }
    }

    let backup_1 = log_dir.join(format!("{base_name}.1.log"));
    let _ = fs::rename(active_log_path, backup_1);

    Ok(())
}

fn append_line_to_dir(log_dir: &Path, base_name: &str, line: &str) -> Result<(), String> {
    let mut line = line.to_string();
    line.push('\n');

    let _guard = LOG_MUTEX.lock().map_err(|_| "Failed to lock log mutex".to_string())?;

    if !log_dir.exists() {
        fs::create_dir_all(log_dir).map_err(|e| format!("Failed to create log dir: {}", e))?;
    }

    let active_log = log_dir.join(format!("{base_name}.log"));
    rotate_logs_if_needed(log_dir, base_name, &active_log, line.len() as u64)?;

    let mut open_options = OpenOptions::new();
    open_options.create(true).append(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        open_options.mode(0o600);
    }

    let mut file = open_options.open(&active_log).map_err(|e| format!("Failed to open log file: {}", e))?;
    file.write_all(line.as_bytes()).map_err(|e| format!("Failed to write log line: {}", e))?;

    Ok(())
}

pub fn write_record_to_dir(log_dir: &Path, record_value: &serde_json::Value) -> Result<(), String> {
    let safe_record = sanitize_record(record_value)?;
    let line = serde_json::to_string(&safe_record).map_err(|e| e.to_string())?;
    append_line_to_dir(log_dir, "app", &line)
}

pub fn log_record<R: Runtime>(app: &AppHandle<R>, record_value: &serde_json::Value) -> Result<(), String> {
    let log_dir = get_log_dir(app)?;
    write_record_to_dir(&log_dir, record_value)
}

// Appends a diagnostic log line to rotating native-debug.log.
pub fn append_debug_log_to_dir(
    log_dir: &Path,
    component: &str,
    message: &str,
    trace_id: Option<&str>,
    severity: &str,
) -> Result<(), String> {
    // Falls back to ERROR severity for unrecognized severity strings.
    let (severity_text, severity_number) = severity_fields(severity).unwrap_or(("ERROR", 17));
    let record = OtelLogRecord {
        timestamp: iso_now(),
        trace_id: trace_id.map(str::to_string),
        severity_text: severity_text.to_string(),
        severity_number,
        body: message.to_string(),
        attributes: Some(Map::from_iter([("component".to_string(), Value::String(component.to_string()))])),
    };
    let line = serde_json::to_string(&record).map_err(|e| e.to_string())?;
    append_line_to_dir(log_dir, "native-debug", &line)
}

pub fn append_debug_log<R: Runtime>(
    app: &AppHandle<R>,
    component: &str,
    message: &str,
    trace_id: Option<&str>,
    severity: &str,
) -> Result<(), String> {
    let log_dir = get_log_dir(app)?;
    append_debug_log_to_dir(&log_dir, component, message, trace_id, severity)
}

const MAX_FRONTEND_DEBUG_COMPONENT_LEN: usize = 64;
const MAX_FRONTEND_DEBUG_MESSAGE_LEN: usize = 2000;

fn truncate_at_char_boundary(value: &str, max_len: usize) -> &str {
    if value.len() <= max_len {
        return value;
    }
    let mut end = max_len;
    while end > 0 && !value.is_char_boundary(end) {
        end -= 1;
    }
    &value[..end]
}

// Tauri command appending frontend diagnostic log lines to native-debug.log.
#[tauri::command]
pub async fn append_native_debug_log<R: Runtime>(
    component: String,
    message: String,
    trace_id: Option<String>,
    severity: Option<String>,
    app: AppHandle<R>,
) -> Result<(), String> {
    let component = truncate_at_char_boundary(&component, MAX_FRONTEND_DEBUG_COMPONENT_LEN).to_string();
    let message = truncate_at_char_boundary(&message, MAX_FRONTEND_DEBUG_MESSAGE_LEN).to_string();
    let trace_id = trace_id.filter(|t| is_valid_trace_id(t));
    let severity = severity.unwrap_or_else(|| "error".to_string());
    run_blocking_string(move || append_debug_log(&app, &component, &message, trace_id.as_deref(), &severity)).await
}

fn read_log_family_from_dir(log_dir: &Path, base_name: &str) -> String {
    let mut combined = String::new();

    for i in (1..=MAX_BACKUP_FILES).rev() {
        let backup = log_dir.join(format!("{base_name}.{}.log", i));
        if let Ok(content) = fs::read_to_string(&backup) {
            combined.push_str(&content);
        }
    }

    let active_log = log_dir.join(format!("{base_name}.log"));
    if let Ok(content) = fs::read_to_string(&active_log) {
        combined.push_str(&content);
    }

    combined
}

// Combines app.log and native-debug.log into a single exported string.
pub fn read_all_logs_from_dir(log_dir: &Path) -> Result<String, String> {
    let _guard = LOG_MUTEX.lock().map_err(|_| "Failed to lock log mutex".to_string())?;

    if !log_dir.exists() {
        return Ok(String::new());
    }

    let mut combined = read_log_family_from_dir(log_dir, "app");

    let debug_log = read_log_family_from_dir(log_dir, "native-debug");
    if !debug_log.is_empty() {
        combined.push_str("\n--- native-debug.log ---\n");
        combined.push_str(&debug_log);
    }

    Ok(combined)
}

pub fn read_all_logs<R: Runtime>(app: &AppHandle<R>) -> Result<String, String> {
    let log_dir = get_log_dir(app)?;
    read_all_logs_from_dir(&log_dir)
}

#[tauri::command]
pub async fn report_error_event<R: Runtime>(event: serde_json::Value, app: AppHandle<R>) -> Result<(), String> {
    run_blocking_string(move || log_record(&app, &event)).await
}

#[tauri::command]
pub async fn read_error_logs<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
    run_blocking_string(move || read_all_logs(&app)).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitizes_valid_record_into_otel_shape() {
        let value = serde_json::json!({
            "code": "viewer.chart-render-failed",
            "occurredAt": "2026-08-16T12:00:00.000Z",
            "severity": "error",
            "source": "viewer",
            "sensitiveField": "should_be_ignored"
        });

        let sanitized = sanitize_record(&value).expect("should sanitize");
        assert_eq!(sanitized.timestamp, "2026-08-16T12:00:00.000Z");
        assert_eq!(sanitized.body, "viewer.chart-render-failed");
        assert_eq!(sanitized.severity_text, "ERROR");
        assert_eq!(sanitized.severity_number, 17);
        assert_eq!(sanitized.attributes.unwrap().get("event.source").and_then(|v| v.as_str()), Some("viewer"));
        assert!(sanitized.trace_id.is_none());
    }

    #[test]
    fn test_sanitizes_warning_severity_into_otel_shape() {
        let value = serde_json::json!({
            "code": "viewer.chart-render-failed",
            "occurredAt": "2026-08-16T12:00:00.000Z",
            "severity": "warning",
            "source": "viewer"
        });

        let sanitized = sanitize_record(&value).expect("should sanitize");
        assert_eq!(sanitized.severity_text, "WARN");
        assert_eq!(sanitized.severity_number, 13);
    }

    #[test]
    fn test_sanitizes_translation_missing_key_context_into_an_attribute() {
        let value = serde_json::json!({
            "code": "translation.missing-key",
            "occurredAt": "2026-08-16T12:00:00.000Z",
            "severity": "error",
            "source": "translation",
            "context": {
                "key": "app.welcome",
                "malicious": "dropped"
            }
        });

        let sanitized = sanitize_record(&value).expect("should sanitize");
        assert_eq!(sanitized.body, "translation.missing-key");
        let attributes = sanitized.attributes.unwrap();
        assert_eq!(attributes.get("translation.key").and_then(|v| v.as_str()), Some("app.welcome"));
        assert!(attributes.get("malicious").is_none());
    }

    #[test]
    fn test_carries_a_valid_trace_id_and_drops_a_malformed_one() {
        let with_valid = serde_json::json!({
            "code": "viewer.chart-render-failed",
            "occurredAt": "2026-08-16T12:00:00.000Z",
            "severity": "error",
            "source": "viewer",
            "traceId": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"
        });
        let sanitized = sanitize_record(&with_valid).expect("should sanitize");
        assert_eq!(sanitized.trace_id.as_deref(), Some("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"));

        let with_malformed = serde_json::json!({
            "code": "viewer.chart-render-failed",
            "occurredAt": "2026-08-16T12:00:00.000Z",
            "severity": "error",
            "source": "viewer",
            "traceId": "not-hex-and-too-long-to-be-a-real-trace-id"
        });
        let sanitized = sanitize_record(&with_malformed).expect("should sanitize");
        assert!(sanitized.trace_id.is_none());
    }

    #[test]
    fn test_rejects_invalid_records() {
        assert!(sanitize_record(&serde_json::json!({})).is_err());
        assert!(sanitize_record(&serde_json::json!({
            "code": "unknown",
            "occurredAt": "2026-08-16T12:00:00.000Z",
            "severity": "invalid",
            "source": "viewer"
        }))
        .is_err());
    }

    #[test]
    fn test_writes_record_to_file() {
        let temp_dir = std::env::temp_dir().join(format!("esm_test_logs_{}", std::process::id()));
        let _ = fs::remove_dir_all(&temp_dir);

        let value = serde_json::json!({
            "code": "viewer.chart-render-failed",
            "occurredAt": "2026-08-16T12:00:00.000Z",
            "severity": "error",
            "source": "viewer"
        });

        write_record_to_dir(&temp_dir, &value).expect("write should succeed");

        let log_file = temp_dir.join("app.log");
        assert!(log_file.exists());
        let content = fs::read_to_string(&log_file).expect("read should succeed");
        assert!(content.contains("viewer.chart-render-failed"));

        let read_back = read_all_logs_from_dir(&temp_dir).expect("read all logs should succeed");
        assert!(read_back.contains("viewer.chart-render-failed"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_rotate_logs_cascades_backups_and_evicts_the_oldest() {
        let temp_dir = std::env::temp_dir().join(format!("esm_test_log_rotation_{}", std::process::id()));
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).expect("temp log directory should be created");

        let active_log = temp_dir.join("app.log");
        fs::write(&active_log, "active").expect("active log should be written");
        fs::write(temp_dir.join("app.1.log"), "backup-1").expect("first backup should be written");
        fs::write(temp_dir.join("app.2.log"), "backup-2").expect("second backup should be written");
        fs::write(temp_dir.join("app.3.log"), "backup-3").expect("third backup should be written");

        rotate_logs_if_needed(&temp_dir, "app", &active_log, MAX_LOG_FILE_SIZE_BYTES).expect("rotation should succeed");

        assert!(!active_log.exists());
        assert_eq!(fs::read_to_string(temp_dir.join("app.1.log")).unwrap(), "active");
        assert_eq!(fs::read_to_string(temp_dir.join("app.2.log")).unwrap(), "backup-1");
        assert_eq!(fs::read_to_string(temp_dir.join("app.3.log")).unwrap(), "backup-2");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_append_debug_log_writes_the_raw_message_verbatim_in_otel_shape() {
        let temp_dir = std::env::temp_dir().join(format!("esm_test_debug_logs_{}", std::process::id()));
        let _ = fs::remove_dir_all(&temp_dir);

        append_debug_log_to_dir(&temp_dir, "pdf_engine", "Page overflowed while trying to wrap a string", None, "error")
            .expect("append should succeed");

        let log_file = temp_dir.join("native-debug.log");
        assert!(log_file.exists());
        let content = fs::read_to_string(&log_file).expect("read should succeed");
        let record: serde_json::Value = serde_json::from_str(content.trim()).expect("line should be valid JSON");
        assert_eq!(record["Body"], "Page overflowed while trying to wrap a string");
        assert_eq!(record["Attributes"]["component"], "pdf_engine");
        assert_eq!(record["SeverityText"], "ERROR");
        assert!(record.get("TraceId").is_none());

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_append_debug_log_carries_a_trace_id_when_given() {
        let temp_dir = std::env::temp_dir().join(format!("esm_test_debug_logs_trace_{}", std::process::id()));
        let _ = fs::remove_dir_all(&temp_dir);

        append_debug_log_to_dir(
            &temp_dir,
            "viewer-notifications",
            "invoke: notification plugin not registered",
            Some("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"),
            "error",
        )
        .expect("append should succeed");

        let content = fs::read_to_string(temp_dir.join("native-debug.log")).expect("read should succeed");
        let record: serde_json::Value = serde_json::from_str(content.trim()).expect("line should be valid JSON");
        assert_eq!(record["TraceId"], "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_append_debug_log_writes_the_given_severity() {
        let temp_dir = std::env::temp_dir().join(format!("esm_test_debug_logs_severity_{}", std::process::id()));
        let _ = fs::remove_dir_all(&temp_dir);

        append_debug_log_to_dir(&temp_dir, "viewer-notifications", "sent 3 overdue reminders", None, "info")
            .expect("append should succeed");

        let content = fs::read_to_string(temp_dir.join("native-debug.log")).expect("read should succeed");
        let record: serde_json::Value = serde_json::from_str(content.trim()).expect("line should be valid JSON");
        assert_eq!(record["SeverityText"], "INFO");
        assert_eq!(record["SeverityNumber"], 9);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_append_debug_log_falls_back_to_error_for_an_unrecognised_severity() {
        let temp_dir = std::env::temp_dir().join(format!("esm_test_debug_logs_bad_severity_{}", std::process::id()));
        let _ = fs::remove_dir_all(&temp_dir);

        append_debug_log_to_dir(&temp_dir, "viewer-notifications", "message", None, "not-a-real-severity")
            .expect("append should succeed");

        let content = fs::read_to_string(temp_dir.join("native-debug.log")).expect("read should succeed");
        let record: serde_json::Value = serde_json::from_str(content.trim()).expect("line should be valid JSON");
        assert_eq!(record["SeverityText"], "ERROR");
        assert_eq!(record["SeverityNumber"], 17);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_severity_fields_covers_the_full_otel_range() {
        assert_eq!(severity_fields("trace"), Some(("TRACE", 1)));
        assert_eq!(severity_fields("debug"), Some(("DEBUG", 5)));
        assert_eq!(severity_fields("info"), Some(("INFO", 9)));
        assert_eq!(severity_fields("warning"), Some(("WARN", 13)));
        assert_eq!(severity_fields("error"), Some(("ERROR", 17)));
        assert_eq!(severity_fields("fatal"), Some(("FATAL", 21)));
        assert_eq!(severity_fields("unknown"), None);
    }

    #[test]
    fn test_sanitize_record_rejects_a_severity_outside_the_closed_app_log_taxonomy() {
        let value = serde_json::json!({
            "code": "viewer.chart-render-failed",
            "occurredAt": "2026-08-16T12:00:00.000Z",
            "severity": "info",
            "source": "viewer"
        });

        assert!(sanitize_record(&value).is_err());
    }

    #[test]
    fn test_read_all_logs_combines_the_sanitized_and_debug_logs() {
        let temp_dir = std::env::temp_dir().join(format!("esm_test_combined_logs_{}", std::process::id()));
        let _ = fs::remove_dir_all(&temp_dir);

        write_record_to_dir(
            &temp_dir,
            &serde_json::json!({
                "code": "desktop.pdf-generation-failed",
                "occurredAt": "2026-08-16T12:00:00.000Z",
                "severity": "error",
                "source": "desktop"
            }),
        )
        .expect("write should succeed");
        append_debug_log_to_dir(&temp_dir, "pdf_engine", "Page overflowed while trying to wrap a string", None, "error")
            .expect("append should succeed");

        let combined = read_all_logs_from_dir(&temp_dir).expect("read all logs should succeed");
        assert!(combined.contains("desktop.pdf-generation-failed"));
        assert!(combined.contains("Page overflowed while trying to wrap a string"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_read_all_logs_omits_the_debug_section_when_there_is_no_debug_log() {
        let temp_dir = std::env::temp_dir().join(format!("esm_test_no_debug_logs_{}", std::process::id()));
        let _ = fs::remove_dir_all(&temp_dir);

        write_record_to_dir(
            &temp_dir,
            &serde_json::json!({
                "code": "viewer.chart-render-failed",
                "occurredAt": "2026-08-16T12:00:00.000Z",
                "severity": "error",
                "source": "viewer"
            }),
        )
        .expect("write should succeed");

        let combined = read_all_logs_from_dir(&temp_dir).expect("read all logs should succeed");
        assert!(!combined.contains("native-debug.log"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_rotate_logs_cascades_backups_and_removes_oldest() {
        let temp_dir = std::env::temp_dir().join(format!("esm_test_rotation_{}", std::process::id()));
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).unwrap();

        let active = temp_dir.join("test.log");
        let backup_1 = temp_dir.join("test.1.log");
        let backup_2 = temp_dir.join("test.2.log");
        let backup_3 = temp_dir.join("test.3.log");

        fs::write(&active, "current").unwrap();
        fs::write(&backup_1, "first").unwrap();
        fs::write(&backup_2, "second").unwrap();
        fs::write(&backup_3, "third").unwrap();

        // Trigger rotation with bytes_to_write exceeding MAX_LOG_FILE_SIZE_BYTES
        rotate_logs_if_needed(&temp_dir, "test", &active, MAX_LOG_FILE_SIZE_BYTES + 1).unwrap();

        assert!(!active.exists());
        assert_eq!(fs::read_to_string(&backup_1).unwrap(), "current");
        assert_eq!(fs::read_to_string(&backup_2).unwrap(), "first");
        assert_eq!(fs::read_to_string(&backup_3).unwrap(), "second");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_truncate_at_char_boundary_leaves_short_strings_untouched() {
        assert_eq!(truncate_at_char_boundary("short", 64), "short");
    }

    #[test]
    fn test_truncate_at_char_boundary_cuts_long_ascii_strings_to_the_limit() {
        let long = "a".repeat(100);
        assert_eq!(truncate_at_char_boundary(&long, 10).len(), 10);
    }

    #[test]
    fn test_truncate_at_char_boundary_never_splits_a_multi_byte_character() {
        // Ensures byte-limit does not split multi-byte UTF-8 characters.
        let value = "éééé";
        let truncated = truncate_at_char_boundary(value, 5);
        assert!(std::str::from_utf8(truncated.as_bytes()).is_ok());
        assert_eq!(truncated, "éé");
    }
}
