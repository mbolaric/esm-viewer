//! Optional headless native test support; no renderer assets, plugins, or production ACL.

use std::sync::mpsc::{self, RecvTimeoutError};
use std::time::Duration;

use tauri::ipc::{CallbackFn, InvokeBody, InvokeError, InvokeResponse, InvokeResponseBody};
use tauri::test::{mock_context as tauri_mock_context, noop_assets, MockRuntime, INVOKE_KEY};
use tauri::webview::InvokeRequest;
use tauri::{Config, Context, PackageInfo, WebviewWindow};

/// Creates an empty MockRuntime context with the caller's product identity and package metadata.
pub fn mock_context(config: Config, package_info: PackageInfo) -> Context<MockRuntime> {
    let mut context = tauri_mock_context(noop_assets());
    *context.config_mut() = config;
    *context.package_info_mut() = package_info;
    context
}

#[derive(Debug)]
pub enum IpcError {
    Command(serde_json::Value),
    Response(RecvTimeoutError),
    Window(tauri::Error),
}

/// Dispatches through Tauri's real invoke path, bounding the wait for an asynchronous response.
/// Like `tauri::test::get_ipc_response`, this does not verify production capabilities or render native UI.
pub fn invoke(
    window: &WebviewWindow<MockRuntime>,
    command: &str,
    body: InvokeBody,
    timeout: Duration,
) -> Result<InvokeResponseBody, IpcError> {
    let request = InvokeRequest {
        cmd: command.to_string(),
        callback: CallbackFn(0),
        error: CallbackFn(1),
        url: window.url().map_err(IpcError::Window)?,
        body,
        headers: Default::default(),
        invoke_key: INVOKE_KEY.to_string(),
    };
    let (sender, receiver) = mpsc::sync_channel(1);
    window.as_ref().clone().on_message(
        request,
        Box::new(move |_webview, _command, response, _callback, _error| {
            // A timed-out caller may have dropped the receiver before an async command completes.
            let _ = sender.send(response);
        }),
    );
    match receiver.recv_timeout(timeout).map_err(IpcError::Response)? {
        InvokeResponse::Ok(body) => Ok(body),
        InvokeResponse::Err(InvokeError(error)) => Err(IpcError::Command(error)),
    }
}
