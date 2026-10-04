pub mod blocking;
pub mod logger;
pub mod pdf_engine;
pub mod print_engine;
mod runtime_versions;
pub mod tachograph_file;
#[cfg(any(test, feature = "test-support"))]
pub mod test_support;
pub mod viewer_commands;

/// Passes the shared native inventory and optional host commands to one handler-generating macro.
///
/// ```
/// let builder = tauri::Builder::<tauri::Wry>::new()
///     .invoke_handler(esm_viewer_desktop_lib::with_viewer_commands!(tauri::generate_handler));
/// ```
#[macro_export]
macro_rules! with_viewer_commands {
    ($($receiver:ident)::+ $(, $host_command:path)* $(,)?) => {
        $($receiver)::+![
            $crate::viewer_commands::parse_ddd_memory,
            $crate::viewer_commands::get_supported_nation_alpha_codes,
            $crate::viewer_commands::get_supported_tachograph_extensions,
            $crate::viewer_commands::get_runtime_versions,
            $crate::viewer_commands::verify_document,
            $crate::viewer_commands::verify_vu_document,
            $crate::viewer_commands::read_ddd_file,
            $crate::viewer_commands::open_devtools,
            $crate::viewer_commands::execute_window_command,
            $crate::pdf_engine::commands::generate_pdf_document,
            $crate::print_engine::print_html_document,
            $crate::logger::report_error_event,
            $crate::logger::read_error_logs,
            $crate::logger::append_native_debug_log
            $(, $host_command)*
        ]
    };
}

#[cfg(test)]
#[path = "../tests/native/command_contract_tests.rs"]
mod command_contract_tests;

#[cfg(test)]
#[path = "../tests/native/navigation_tests.rs"]
mod navigation_tests;

// An unbundled `tauri dev` binary has no bundle icon. A bundled app must keep
// the asset-catalog icon so macOS can render its tinted and dark appearances.
#[cfg(all(target_os = "macos", dev))]
pub fn setup_macos_dock_icon() {
    use objc2::AnyThread;
    use objc2_app_kit::{NSApplication, NSImage};
    use objc2_foundation::{MainThreadMarker, NSData};

    if let Some(mtm) = MainThreadMarker::new() {
        let icon_bytes = include_bytes!("../icons/icon.png");
        let ns_data = NSData::with_bytes(icon_bytes);
        if let Some(image) = NSImage::initWithData(NSImage::alloc(), &ns_data) {
            let app = NSApplication::sharedApplication(mtm);
            unsafe {
                app.setApplicationIconImage(Some(&image));
            }
        }
    }
}

// Restricts webview navigation to packaged content or local dev server.
pub fn is_allowed_navigation_url(url: &tauri::Url) -> bool {
    url.scheme() == "tauri"
        || ((url.scheme() == "http" || url.scheme() == "https") && url.domain() == Some("tauri.localhost"))
        || (cfg!(dev) && url.scheme() == "http" && url.host_str() == Some("localhost"))
}

// Builds the standard Tauri desktop window with CSP navigation locks and default icon.
pub fn setup_desktop_window(app: &mut tauri::App) -> tauri::Result<tauri::WebviewWindow> {
    let window_config = app
        .config()
        .app
        .windows
        .iter()
        .find(|config| config.label == "main")
        .ok_or_else(|| std::io::Error::other("main window configuration is missing"))?;
    // Avoid tearing down default GTK shortcuts when the renderer installs its localized menu.
    let menu =
        if cfg!(target_os = "linux") { tauri::menu::Menu::new(app.handle())? } else { tauri::menu::Menu::default(app.handle())? };
    let window_builder = tauri::WebviewWindowBuilder::from_config(app, window_config)?
        .menu(menu)
        .devtools(cfg!(all(debug_assertions, feature = "devtools")))
        .on_navigation(is_allowed_navigation_url)
        .on_new_window(|_url, _features| tauri::webview::NewWindowResponse::Deny);

    let window = window_builder.build()?;

    if let Some(icon) = app.default_window_icon() {
        let _ = window.set_icon(icon.clone());
    }
    Ok(window)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[cfg(feature = "standalone")]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            #[cfg(all(target_os = "macos", dev))]
            setup_macos_dock_icon();

            setup_desktop_window(app)?;
            Ok(())
        })
        .invoke_handler(with_viewer_commands!(tauri::generate_handler))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
