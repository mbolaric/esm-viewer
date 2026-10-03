use std::fs;
use std::process::Command;

// Reads pinned esm-parser version from Cargo.toml for About dialog.
fn esm_parser_version() -> String {
    fs::read_to_string("../vendor/esm-parser/Cargo.toml")
        .ok()
        .and_then(|contents| {
            contents.lines().find_map(|line| {
                let rest = line.trim().strip_prefix("version")?.trim_start();
                let value = rest.strip_prefix('=')?.trim();
                Some(value.trim_matches('"').to_string())
            })
        })
        .unwrap_or_else(|| "unknown".to_string())
}

// Reads pinned esm-parser git commit for About dialog, falling back to "unknown".
fn esm_parser_commit() -> String {
    Command::new("git")
        .args(["-C", "../vendor/esm-parser", "rev-parse", "HEAD"])
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "unknown".to_string())
}

fn main() {
    tauri_build::build();

    println!("cargo:rustc-env=ESM_PARSER_VERSION={}", esm_parser_version());
    println!("cargo:rustc-env=ESM_PARSER_COMMIT={}", esm_parser_commit());
    println!("cargo:rerun-if-changed=../vendor/esm-parser/Cargo.toml");
    println!("cargo:rerun-if-changed=../vendor/esm-parser/.git/HEAD");
}
