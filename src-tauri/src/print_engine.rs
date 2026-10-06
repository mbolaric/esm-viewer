// Native desktop printing for self-contained HTML documents via OS print panel.

#[cfg(target_os = "macos")]
use std::sync::mpsc;
#[cfg(target_os = "macos")]
use std::time::Duration;

// A4 page size in points (595.2 x 841.8).
#[cfg(target_os = "macos")]
const PAGE_WIDTH_POINTS: f64 = 595.2;
#[cfg(target_os = "macos")]
const PAGE_HEIGHT_POINTS: f64 = 841.8;

// Layout settle delay allowing WebKit styling and pagination before printing.
#[cfg(target_os = "macos")]
const LAYOUT_SETTLE_MS: u64 = 600;

// Opens native print panel, returning Err if unavailable to trigger DOM print fallback.
pub async fn print_html<R: tauri::Runtime>(html: &str, app: &tauri::AppHandle<R>) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        macos::print_html_macos(html, app).await
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (html, app);
        Err("Native printing is not supported on this platform yet; the renderer falls back to DOM printing.".to_string())
    }
}

#[tauri::command]
pub async fn print_html_document<R: tauri::Runtime>(html: String, app: tauri::AppHandle<R>) -> Result<(), String> {
    print_html(&html, &app).await
}

#[cfg(target_os = "macos")]
mod macos {
    use super::{mpsc, Duration, LAYOUT_SETTLE_MS, PAGE_HEIGHT_POINTS, PAGE_WIDTH_POINTS};
    use objc2::rc::Retained;
    use objc2::MainThreadOnly;
    use objc2_app_kit::{NSBackingStoreType, NSPrintInfo, NSWindow, NSWindowStyleMask};
    use objc2_foundation::{MainThreadMarker, NSPoint, NSRect, NSSize, NSString, NSURL};
    use objc2_web_kit::{WKWebView, WKWebViewConfiguration};

    // Main-thread handles transferred between run_on_main_thread closures.
    struct PrintWebview(*mut WKWebView, *mut NSWindow);

    // SAFETY: Raw handles are only dereferenced on the main thread.
    unsafe impl Send for PrintWebview {}

    impl PrintWebview {
        // Takes the handles so exactly one owner releases each of them.
        fn take(&mut self) -> (*mut WKWebView, *mut NSWindow) {
            let handles = (self.0, self.1);
            self.0 = std::ptr::null_mut();
            self.1 = std::ptr::null_mut();
            handles
        }
    }

    impl Drop for PrintWebview {
        fn drop(&mut self) {
            let (webview, window) = self.take();
            if webview.is_null() && window.is_null() {
                return;
            }
            if MainThreadMarker::new().is_none() {
                // AppKit objects must be released on the main thread. A holder that reaches this point was abandoned
                // on a failure path that could not hop back to the main thread, and leaking it is safer than
                // releasing it from the wrong thread.
                return;
            }
            unsafe {
                if !webview.is_null() {
                    drop(Retained::from_raw(webview));
                }
                if !window.is_null() {
                    drop(Retained::from_raw(window));
                }
            }
        }
    }

    pub(super) async fn print_html_macos<R: tauri::Runtime>(html: &str, app: &tauri::AppHandle<R>) -> Result<(), String> {
        let html_string = html.to_string();

        // Create hidden A4 webview on main thread and load HTML.
        let (sender, receiver) = mpsc::channel();
        app.run_on_main_thread(move || {
            let _ = sender.send(init_print_webview(&html_string));
        })
        .map_err(|error| error.to_string())?;

        let holder = receiver.recv().map_err(|_| "Failed to initialize the print webview.".to_string())??;

        // Wait for WebKit layout.
        if let Err(error) = tauri::async_runtime::spawn_blocking(|| {
            std::thread::sleep(Duration::from_millis(LAYOUT_SETTLE_MS));
        })
        .await
        {
            // Release the hidden webview on the thread AppKit requires before reporting the failure.
            let _ = app.run_on_main_thread(move || drop(holder));
            return Err(error.to_string());
        }

        // Open native print panel on main thread.
        let (sender, receiver) = mpsc::channel();
        app.run_on_main_thread(move || {
            run_print_operation(holder, sender);
        })
        .map_err(|error| error.to_string())?;

        receiver.recv().map_err(|_| "The print operation was interrupted.".to_string())?
    }

    fn init_print_webview(html: &str) -> Result<PrintWebview, String> {
        let mtm = MainThreadMarker::new().ok_or_else(|| "The main thread is unavailable.".to_string())?;

        let configuration = unsafe { WKWebViewConfiguration::new(mtm) };
        let webview = unsafe {
            WKWebView::initWithFrame_configuration(
                WKWebView::alloc(mtm),
                NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(PAGE_WIDTH_POINTS, PAGE_HEIGHT_POINTS)),
                &configuration,
            )
        };

        let window = unsafe {
            NSWindow::initWithContentRect_styleMask_backing_defer(
                NSWindow::alloc(mtm),
                NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(PAGE_WIDTH_POINTS, PAGE_HEIGHT_POINTS)),
                NSWindowStyleMask::Borderless,
                NSBackingStoreType::Buffered,
                false,
            )
        };
        window.setContentView(Some(&webview));
        window.setAlphaValue(0.01);
        window.orderFront(None);

        let html_string = NSString::from_str(html);
        let base_url = NSURL::fileURLWithPath(&NSString::from_str("/"));
        unsafe {
            webview.loadHTMLString_baseURL(&html_string, Some(&base_url));
        }

        let webview_raw = Retained::into_raw(webview);
        let window_raw = Retained::into_raw(window);
        Ok(PrintWebview(webview_raw, window_raw))
    }

    fn run_print_operation(mut holder: PrintWebview, sender: mpsc::Sender<Result<(), String>>) {
        let (webview_pointer, window_pointer) = holder.take();
        // Consume the window first so an unusable webview handle cannot leak it.
        let window = unsafe { Retained::from_raw(window_pointer) };
        let webview = match unsafe { Retained::from_raw(webview_pointer) } {
            Some(w) => w,
            None => {
                drop(window);
                let _ = sender.send(Err("Invalid webview handle.".to_string()));
                return;
            }
        };

        let print_info = NSPrintInfo::sharedPrintInfo();
        // Enforce ISO A4 dimensions matching PDF engine layout.
        print_info.setPaperSize(NSSize::new(PAGE_WIDTH_POINTS, PAGE_HEIGHT_POINTS));
        let operation = unsafe { webview.printOperationWithPrintInfo(&print_info) };
        operation.setShowsPrintPanel(true);
        // Modal runOperation returns on dismiss or cancel.
        operation.runOperation();
        drop(window);
        let _ = sender.send(Ok(()));
    }
}
