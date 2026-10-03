use crate::is_allowed_navigation_url;
use tauri::Url;

fn url(raw: &str) -> Url {
    Url::parse(raw).expect("fixture URL must parse")
}

#[test]
fn accepts_the_packaged_app_custom_scheme_used_on_macos_and_linux() {
    assert!(is_allowed_navigation_url(&url("tauri://localhost/index.html")));
}

#[test]
fn accepts_the_packaged_app_https_host_used_on_windows_and_android() {
    assert!(is_allowed_navigation_url(&url("https://tauri.localhost/index.html")));
}

#[test]
fn rejects_an_unrelated_https_host_even_with_a_tauri_looking_path() {
    assert!(!is_allowed_navigation_url(&url("https://evil.example/tauri.localhost")));
}

#[test]
fn rejects_an_arbitrary_external_origin() {
    assert!(!is_allowed_navigation_url(&url("https://example.com/")));
    assert!(!is_allowed_navigation_url(&url("http://evil.example/")));
    assert!(!is_allowed_navigation_url(&url("file:///etc/passwd")));
}

#[test]
fn only_accepts_the_plain_http_localhost_dev_server_url_in_a_dev_build() {
    let accepted = is_allowed_navigation_url(&url("http://localhost:1420/"));
    assert_eq!(accepted, cfg!(dev));
}
