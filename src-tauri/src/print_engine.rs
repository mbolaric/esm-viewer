use crate::blocking::run_blocking_string;
use crate::pdf_engine::{render_pdf, PdfDocumentRequest};

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(any(target_os = "linux", target_os = "windows", test))]
mod page;
#[cfg(target_os = "windows")]
mod windows;

#[tauri::command]
pub async fn print_pdf_document<R: tauri::Runtime>(
    request: PdfDocumentRequest,
    window: tauri::WebviewWindow<R>,
) -> Result<(), String> {
    let bytes = run_blocking_string(move || render_pdf(&request)).await?;

    #[cfg(any(target_os = "linux", target_os = "macos"))]
    {
        let (sender, receiver) = std::sync::mpsc::channel();
        let parent = window.clone();
        window
            .run_on_main_thread(move || {
                #[cfg(target_os = "linux")]
                let result = parent
                    .gtk_window()
                    .map_err(|_| "The print window is unavailable.".to_string())
                    .and_then(|parent| linux::print_pdf(bytes, Some(&parent)));
                #[cfg(target_os = "macos")]
                let result = {
                    let _ = parent;
                    macos::print_pdf(&bytes)
                };
                let _ = sender.send(result);
            })
            .map_err(|_| "The print dialog could not be opened.".to_string())?;
        run_blocking_string(move || receiver.recv().map_err(|_| "Printing was interrupted.".to_string())?).await
    }

    #[cfg(target_os = "windows")]
    {
        windows::print_pdf(bytes, window).await
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        let _ = (bytes, window);
        Err("PDF printing is unavailable on this platform.".to_string())
    }
}
