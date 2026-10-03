// Tauri command wrapper running PDF rendering on the blocking thread pool.

use super::document::{render_pdf, PdfDocumentRequest};
use crate::blocking::run_blocking_string;

#[tauri::command]
pub async fn generate_pdf_document<R: tauri::Runtime>(
    request: PdfDocumentRequest,
    app: tauri::AppHandle<R>,
) -> Result<tauri::ipc::Response, String> {
    // Engine errors and worker panics also go to the native debug log, since the renderer only reports a generic failure.
    run_blocking_string(move || render_pdf(&request))
        .await
        .inspect_err(|reason| {
            let _ = crate::logger::append_debug_log(&app, "pdf_engine", reason, None, "error");
        })
        .map(tauri::ipc::Response::new)
}
