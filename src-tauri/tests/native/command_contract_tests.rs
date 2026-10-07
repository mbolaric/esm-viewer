use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::Serialize;
use serde_json::{json, Value};
use tauri::ipc::{InvokeBody, InvokeResponseBody};
use tauri::test::{mock_builder, MockRuntime};
use tauri::{App, AppHandle, Config, Manager, PackageInfo, Runtime, State, WebviewWindow, WebviewWindowBuilder};

use crate::test_support::{invoke, mock_context, IpcError};

const IPC_TIMEOUT: Duration = Duration::from_secs(10);
static NEXT_FIXTURE: AtomicUsize = AtomicUsize::new(0);

struct HostProbeGate {
    receiver: Arc<Mutex<Receiver<()>>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HostProbeResponse {
    name: String,
    version: String,
    identifier: String,
}

#[tauri::command]
async fn host_probe<R: Runtime>(
    app: AppHandle<R>,
    wait_for_release: bool,
    gate: State<'_, HostProbeGate>,
) -> Result<HostProbeResponse, String> {
    if wait_for_release {
        let receiver = Arc::clone(&gate.receiver);
        crate::blocking::run_blocking_string(move || {
            receiver
                .lock()
                .map_err(|_| "Probe gate lock is poisoned".to_string())?
                .recv()
                .map_err(|_| "Probe gate was disconnected".to_string())?;
            Ok(())
        })
        .await?;
    }
    Ok(HostProbeResponse {
        name: app.package_info().name.clone(),
        version: app.package_info().version.to_string(),
        identifier: app.config().identifier.clone(),
    })
}

struct NativeFixture {
    _app: App<MockRuntime>,
    window: WebviewWindow<MockRuntime>,
    directory: PathBuf,
    log_directory: PathBuf,
    identifier: String,
    probe_release: Sender<()>,
}

impl NativeFixture {
    fn new(with_host_probe: bool) -> Self {
        let identifier =
            format!("org.esmviewer.native-test-{}-{}", std::process::id(), NEXT_FIXTURE.fetch_add(1, Ordering::Relaxed));
        let config = Config {
            identifier: identifier.clone(),
            product_name: Some("Test Host".to_string()),
            version: Some("8.7.6".to_string()),
            ..Default::default()
        };
        // Config and package versions deliberately differ: get_runtime_versions must use AppHandle.package_info().
        let package_info = PackageInfo {
            name: "native-test-host".to_string(),
            version: "9.8.7".parse().expect("fixture package version must parse"),
            authors: "Test",
            description: "Synthetic native command contract host",
            crate_name: "native_test_host",
        };
        let builder = if with_host_probe {
            mock_builder().invoke_handler(crate::with_viewer_commands!(tauri::generate_handler, host_probe,))
        } else {
            mock_builder().invoke_handler(crate::with_viewer_commands!(tauri::generate_handler))
        };
        let (probe_release, receiver) = mpsc::channel();
        let app = builder
            .manage(HostProbeGate { receiver: Arc::new(Mutex::new(receiver)) })
            .build(mock_context(config, package_info))
            .expect("headless native host must build");
        let window = WebviewWindowBuilder::new(&app, "main", Default::default()).build().expect("mock window must build");
        let directory = std::env::temp_dir().join(&identifier);
        fs::create_dir(&directory).expect("fixture directory must be new");
        let log_directory = app.path().app_log_dir().expect("fixture log directory must resolve");
        assert!(!log_directory.exists(), "fixture must not reuse existing logs");
        Self { _app: app, window, directory, log_directory, identifier, probe_release }
    }

    fn invoke(&self, command: &str, body: InvokeBody) -> Result<InvokeResponseBody, Value> {
        match invoke(&self.window, command, body, IPC_TIMEOUT) {
            Ok(response) => Ok(response),
            Err(IpcError::Command(error)) => Err(error),
            Err(error) => panic!("{command}: native IPC transport failed: {error:?}"),
        }
    }

    fn json(&self, command: &str, arguments: Value) -> Result<Value, Value> {
        self.invoke(command, InvokeBody::Json(arguments))
            .map(|response| response.deserialize().expect("command must return JSON"))
    }
}

impl Drop for NativeFixture {
    fn drop(&mut self) {
        self.probe_release.send(()).expect("fixture must release its pending probe");
        fs::remove_dir_all(&self.directory).expect("fixture files must be removed");
        if self.log_directory.exists() {
            fs::remove_dir_all(&self.log_directory).expect("fixture logs must be removed");
            #[cfg(not(target_os = "macos"))]
            fs::remove_dir(self.log_directory.parent().expect("fixture log directory must have a parent"))
                .expect("empty fixture log parent must be removed");
        }
    }
}

#[test]
fn shared_catalogues_dispatch_without_host_commands() {
    let fixture = NativeFixture::new(false);
    assert_eq!(
        fixture.json("get_supported_tachograph_extensions", json!({})).unwrap(),
        json!(["ddd", "esm", "v1b", "c1b", "tgd", "tlg", "v1c", "c1c"])
    );
    let codes: BTreeMap<String, String> =
        serde_json::from_value(fixture.json("get_supported_nation_alpha_codes", json!({})).unwrap())
            .expect("nation codes must be a string map");
    assert!(!codes.is_empty());
    assert!(codes.values().any(|code| code == "D"), "catalogue must include Germany");
    assert_eq!(codes, crate::viewer_commands::get_supported_nation_alpha_codes());
    assert_eq!(fixture.json("host_probe", json!({"waitForRelease": false})), Err(json!("Command host_probe not found")));
}

#[test]
fn one_combined_handler_dispatches_shared_and_explicit_host_commands() {
    let fixture = NativeFixture::new(true);
    assert_eq!(
        fixture.json("host_probe", json!({"waitForRelease": false})).unwrap(),
        json!({"name": "native-test-host", "version": "9.8.7", "identifier": fixture.identifier})
    );
    assert!(fixture.json("get_supported_tachograph_extensions", json!({})).unwrap().is_array());
    assert_eq!(fixture.json("not_registered", json!({})), Err(json!("Command not_registered not found")));
}

#[test]
fn runtime_metadata_uses_host_package_info_and_exact_nested_parser_checkout() {
    let fixture = NativeFixture::new(true);
    let response = fixture.json("get_runtime_versions", json!({})).unwrap();
    let parser_manifest = include_str!("../../../vendor/esm-parser/Cargo.toml");
    let parser_version = parser_manifest
        .lines()
        .find_map(|line| line.strip_prefix("version = \"").and_then(|version| version.strip_suffix('"')))
        .expect("nested parser manifest must declare its version");
    let output = Command::new("git")
        .args(["-C", concat!(env!("CARGO_MANIFEST_DIR"), "/../vendor/esm-parser"), "rev-parse", "HEAD"])
        .output()
        .expect("nested parser commit must be readable");
    assert!(output.status.success());
    let parser_commit = String::from_utf8(output.stdout).expect("git commit must be UTF-8");
    assert_eq!(
        response,
        json!({
            "application": "9.8.7",
            "architecture": std::env::consts::ARCH,
            "parserCommit": parser_commit.trim(),
            "parserVersion": parser_version,
            "platform": std::env::consts::OS,
            "runtime": format!("Tauri {}", tauri::VERSION)
        })
    );
}

#[test]
fn parsing_dispatch_preserves_failure_dto_and_rejects_json_instead_of_raw_bytes() {
    let fixture = NativeFixture::new(false);
    assert_eq!(
        fixture.json("parse_ddd_memory", json!([0, 1, 2])).unwrap(),
        json!({"ok": false, "data": null, "error": "Expected the file bytes as a raw request body"})
    );
    for bytes in [vec![], vec![0xff, 0xff, 0xff]] {
        let response = fixture.invoke("parse_ddd_memory", InvokeBody::Raw(bytes)).unwrap();
        let response: Value = response.deserialize().expect("parse failure must be a JSON DTO");
        assert_eq!(response.as_object().unwrap().len(), 3);
        assert_eq!(response["ok"], false);
        assert_eq!(response["data"], Value::Null);
        assert!(response["error"].as_str().unwrap().starts_with("Parsing error:"));
    }
}

#[test]
fn verification_dispatch_validates_arguments_and_preserves_failure_dtos() {
    let fixture = NativeFixture::new(false);
    for (command, arguments) in [
        ("verify_document", json!({"generation": "invalid", "dataFiles": {}, "ercaPk": []})),
        (
            "verify_vu_document",
            json!({"generation": "invalid", "memberStateCertificateRaw": [], "vuCertificateRaw": [], "ercaPk": []}),
        ),
    ] {
        assert_eq!(
            fixture.json(command, arguments).unwrap(),
            json!({"ok": false, "data": null, "error": "Unsupported verification generation: invalid"})
        );
        let missing = fixture.json(command, json!({})).unwrap_err();
        assert!(missing.as_str().unwrap().contains("missing required key generation"));
    }
    let wrong_type = fixture.json("verify_document", json!({"generation": 2, "dataFiles": {}, "ercaPk": []})).unwrap_err();
    assert!(wrong_type.as_str().unwrap().contains("invalid args `generation`"));
    let invalid_bytes =
        fixture.json("verify_document", json!({"generation": "g1", "dataFiles": {}, "ercaPk": [256]})).unwrap_err();
    assert!(invalid_bytes.as_str().unwrap().contains("invalid args `ercaPk`"));
}

#[test]
fn export_guard_dispatch_rejects_access_failures_without_exposing_paths() {
    let fixture = NativeFixture::new(false);
    assert_eq!(
        fixture.json(
            "export_destination_is_source",
            json!({
                "sourcePath": "opaque-drop-token",
                "destinationPath": fixture.directory.to_str().expect("fixture path must be UTF-8"),
                "sourceSha256": "a".repeat(64)
            })
        ),
        Err(json!("Export destination could not be checked"))
    );
    assert_eq!(
        fixture.json(
            "export_destination_is_source",
            json!({
                "sourcePath": "opaque-drop-token",
                "destinationPath": fixture.directory.join("report.html").to_str().expect("fixture path must be UTF-8"),
                "sourceSha256": "a".repeat(64)
            })
        ),
        Ok(json!(false))
    );
}

#[test]
fn guarded_file_read_dispatch_returns_raw_bytes_and_typed_not_found_rejection() {
    let fixture = NativeFixture::new(false);
    let bytes = [0, 1, 127, 128, 255];
    let path = fixture.directory.join("synthetic.ddd");
    fs::write(&path, bytes).expect("synthetic bytes must be written");
    let response = fixture
        .invoke("read_ddd_file", InvokeBody::Json(json!({"filePath": path.to_str().expect("fixture path must be UTF-8")})))
        .unwrap();
    assert!(matches!(response, InvokeResponseBody::Raw(ref raw) if raw == &bytes));
    assert_eq!(fs::read(&path).unwrap(), bytes, "source bytes must remain unchanged");
    assert_eq!(
        fixture.json("read_ddd_file", json!({"filePath": fixture.directory.join("missing.ddd")})),
        Err(json!({"code": "notFound", "error": "File does not exist"}))
    );
    assert!(fixture.json("read_ddd_file", json!({})).unwrap_err().as_str().unwrap().contains("missing required key filePath"));
}

#[test]
fn pdf_dispatch_returns_raw_pdf_bytes_and_rejects_unknown_document_kinds() {
    let fixture = NativeFixture::new(false);
    let response = fixture
        .invoke(
            "generate_pdf_document",
            InvokeBody::Json(json!({"request": {"kind": "factualReport", "title": "Synthetic report", "locale": "en"}})),
        )
        .unwrap();
    assert!(matches!(response, InvokeResponseBody::Raw(ref raw) if raw.starts_with(b"%PDF") && raw.len() > 4));
    let failure = fixture.json("generate_pdf_document", json!({"request": {"kind": "unknown"}})).unwrap_err();
    assert!(failure.as_str().unwrap().contains("invalid args `request`"));
}

#[test]
fn logging_dispatch_uses_host_log_location_and_sanitizes_error_events() {
    let fixture = NativeFixture::new(false);
    assert_eq!(fixture.json("read_error_logs", json!({})).unwrap(), "");
    assert_eq!(fixture.json("report_error_event", json!({"event": {}})), Err(json!("Missing or invalid 'code'")));
    assert!(!fixture.log_directory.exists(), "invalid events must not create logs");
    assert_eq!(
        fixture
            .json(
                "report_error_event",
                json!({"event": {
                    "code": "viewer.synthetic-error",
                    "occurredAt": "2026-10-01T00:00:00Z",
                    "severity": "error",
                    "source": "viewer",
                    "context": {"discarded": "synthetic-sensitive-value"}
                }}),
            )
            .unwrap(),
        Value::Null
    );
    assert_eq!(
        fixture.json("append_native_debug_log", json!({"component": "native-test", "message": "synthetic diagnostic"})).unwrap(),
        Value::Null
    );
    let logs = fixture.json("read_error_logs", json!({})).unwrap();
    let logs = logs.as_str().expect("exported logs must remain a JSON string");
    assert!(logs.contains("viewer.synthetic-error"));
    assert!(logs.contains("synthetic diagnostic"));
    assert!(!logs.contains("synthetic-sensitive-value"));
    let error_log: Value = serde_json::from_str(&fs::read_to_string(fixture.log_directory.join("app.log")).unwrap()).unwrap();
    assert_eq!(error_log["Body"], "viewer.synthetic-error");
    assert_eq!(error_log["Attributes"], json!({"event.source": "viewer"}));
}

#[test]
fn export_guard_dispatch_compares_real_paths_and_rejects_invalid_arguments() {
    let fixture = NativeFixture::new(false);
    let directory = fixture.directory.join("export-guard");
    std::fs::create_dir(&directory).expect("fixture directory should be creatable");
    let source = directory.join("tacho.ddd");
    std::fs::write(&source, b"source").expect("source file should be writable");
    let source_text = source.to_string_lossy().into_owned();

    // The same file spelled through a redundant separator is the source.
    let aliased = format!("{}//./tacho.ddd", directory.display());
    assert_eq!(
        fixture.json("export_destination_is_source", json!({ "sourcePath": source_text, "destinationPath": aliased }),),
        Ok(json!(true)),
    );
    // A destination that does not exist yet cannot be the source.
    assert_eq!(
        fixture.json(
            "export_destination_is_source",
            json!({
                "sourcePath": source_text,
                "destinationPath": directory.join("report.html").to_string_lossy(),
            }),
        ),
        Ok(json!(false)),
    );
    // Missing arguments are rejected at the boundary rather than compared as empty paths.
    assert!(fixture.json("export_destination_is_source", json!({ "sourcePath": source_text })).is_err());
}

#[test]
fn devtools_command_remains_callable_with_packaged_devtools_disabled() {
    let config: Config = serde_json::from_str(include_str!("../../tauri.conf.json")).expect("Viewer config must decode");
    let main = config.app.windows.iter().find(|window| window.label == "main").expect("main window must be configured");
    assert_eq!(main.devtools, Some(false));
    let fixture = NativeFixture::new(false);
    assert_eq!(fixture.json("open_devtools", json!({})).unwrap(), Value::Null);
    // MockRuntime does not emulate devtools; profile/feature checks cover whether the native implementation is compiled.
}

#[test]
fn window_command_dispatch_accepts_fullscreen_and_rejects_unknown_actions() {
    let fixture = NativeFixture::new(false);
    assert_eq!(fixture.json("execute_window_command", json!({"command": "view.fullscreen"})).unwrap(), Value::Null);
    // MockRuntime accepts window operations but does not emulate fullscreen state or application exit.
    for arguments in [json!({}), json!({"command": "file.open"}), json!({"command": 1})] {
        let failure = fixture.json("execute_window_command", arguments).unwrap_err();
        assert!(failure.as_str().unwrap().contains("command"));
    }
    assert!(matches!(
        serde_json::from_value::<crate::viewer_commands::NativeWindowCommand>(json!("application.quit")),
        Ok(crate::viewer_commands::NativeWindowCommand::Quit)
    ));
}

#[test]
fn print_dispatch_validates_arguments_without_opening_native_ui() {
    let fixture = NativeFixture::new(false);
    assert!(fixture.json("print_html_document", json!({})).unwrap_err().as_str().unwrap().contains("missing required key html"));
    #[cfg(not(target_os = "macos"))]
    assert_eq!(
        fixture.json("print_html_document", json!({"html": "<!doctype html><title>Synthetic</title>"})),
        Err(json!("Native printing is not supported on this platform yet; the renderer falls back to DOM printing."))
    );
}

#[test]
fn asynchronous_ipc_response_wait_is_bounded_without_replacing_command_bodies() {
    let fixture = NativeFixture::new(true);
    let result = invoke(&fixture.window, "host_probe", InvokeBody::Json(json!({"waitForRelease": true})), Duration::ZERO);
    assert!(matches!(result, Err(IpcError::Response(RecvTimeoutError::Timeout))));
    assert!(fixture.json("host_probe", json!({"waitForRelease": false})).is_ok(), "later requests must still dispatch");
}
