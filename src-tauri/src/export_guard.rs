// Guards an export destination against the file it was opened from.

use std::fs::{File, Metadata};
use std::io::Read;
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};

// A tachograph source file cannot exceed this, so a larger destination cannot be one.
const MAXIMUM_SOURCE_BYTES: u64 = 50 * 1024 * 1024;

fn canonicalize_existing(path: &str) -> Option<PathBuf> {
    Path::new(path).canonicalize().ok()
}

#[cfg(unix)]
fn same_file_identity(left: &Metadata, right: &Metadata) -> bool {
    use std::os::unix::fs::MetadataExt;
    left.dev() == right.dev() && left.ino() == right.ino()
}

#[cfg(windows)]
fn same_file_identity(left: &Metadata, right: &Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    left.volume_serial_number() == right.volume_serial_number() && left.file_index() == right.file_index()
}

#[cfg(not(any(unix, windows)))]
fn same_file_identity(_left: &Metadata, _right: &Metadata) -> bool {
    false
}

fn sha256_of(path: &Path) -> Option<String> {
    let metadata = std::fs::metadata(path).ok()?;
    if !metadata.is_file() || metadata.len() > MAXIMUM_SOURCE_BYTES {
        return None;
    }
    let mut file = File::open(path).ok()?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer).ok()?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Some(hex::encode(hasher.finalize()))
}

// True when the destination is the file the source was read from, or otherwise holds exactly its bytes.
//
// Path and file identity cannot answer for a document the user dropped into the window: the webview receives no path
// for a dropped file, so the renderer only has the digest it computed. Comparing that digest against the destination
// also refuses a byte-identical copy of an opened tachograph file, which is intended rather than a false positive:
// writing export output over tachograph data is what this guard exists to stop.
pub fn is_same_existing_file(source_path: &str, destination_path: &str, source_sha256: Option<&str>) -> bool {
    // An unresolvable destination does not exist yet or is unreadable, so it cannot hold the source's bytes.
    let Some(destination) = canonicalize_existing(destination_path) else {
        return false;
    };

    // The path side is best effort: a dropped document has no usable path, only the digest below.
    if let Some(source) = canonicalize_existing(source_path) {
        if source == destination {
            return true;
        }
        if let (Ok(source_metadata), Ok(destination_metadata)) = (std::fs::metadata(&source), std::fs::metadata(&destination))
            && same_file_identity(&source_metadata, &destination_metadata)
        {
            return true;
        }
    }

    match (source_sha256, sha256_of(&destination)) {
        (Some(expected), Some(actual)) => expected.eq_ignore_ascii_case(&actual),
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn temporary_directory(name: &str) -> PathBuf {
        let directory = std::env::temp_dir().join(format!("esm-viewer-export-guard-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&directory);
        std::fs::create_dir_all(&directory).expect("temporary directory should be creatable");
        directory
    }

    fn write_file(path: &Path, contents: &str) {
        let mut file = std::fs::File::create(path).expect("file should be creatable");
        file.write_all(contents.as_bytes()).expect("file should be writable");
    }

    fn as_text(path: &Path) -> String {
        path.to_string_lossy().into_owned()
    }

    #[test]
    fn detects_the_same_file_through_a_different_path_spelling() {
        let directory = temporary_directory("spelling");
        let source = directory.join("tacho.ddd");
        write_file(&source, "source");

        // A redundant separator and a dot segment resolve to the same file.
        let spelled_differently = format!("{}//./tacho.ddd", directory.display());
        assert!(is_same_existing_file(&as_text(&source), &spelled_differently, None));

        std::fs::remove_dir_all(&directory).expect("temporary directory should be removable");
    }

    #[cfg(unix)]
    #[test]
    fn detects_the_same_file_through_a_symlinked_directory() {
        let directory = temporary_directory("symlink");
        let real = directory.join("real");
        std::fs::create_dir_all(&real).expect("real directory should be creatable");
        let source = real.join("tacho.ddd");
        write_file(&source, "source");
        let link = directory.join("link");
        std::os::unix::fs::symlink(&real, &link).expect("symlink should be creatable");

        assert!(is_same_existing_file(&as_text(&source), &as_text(&link.join("tacho.ddd")), None));

        std::fs::remove_dir_all(&directory).expect("temporary directory should be removable");
    }

    #[test]
    fn detects_a_hard_link_to_the_source() {
        let directory = temporary_directory("hardlink");
        let source = directory.join("tacho.ddd");
        write_file(&source, "source");
        let link = directory.join("alias.ddd");
        std::fs::hard_link(&source, &link).expect("hard link should be creatable");

        assert!(is_same_existing_file(&as_text(&source), &as_text(&link), None));

        std::fs::remove_dir_all(&directory).expect("temporary directory should be removable");
    }

    #[test]
    fn detects_a_destination_holding_the_sources_bytes_under_another_path() {
        let directory = temporary_directory("digest");
        let source = directory.join("tacho.ddd");
        write_file(&source, "source bytes");
        let digest = sha256_of(&source).expect("source digest should be computable");
        // A copy stands in for a dropped document, whose path the renderer never learns.
        let copy = directory.join("copy.ddd");
        std::fs::copy(&source, &copy).expect("copy should be creatable");

        assert!(is_same_existing_file("", &as_text(&copy), Some(&digest)));

        let different = directory.join("other.ddd");
        write_file(&different, "other bytes");
        assert!(!is_same_existing_file("", &as_text(&different), Some(&digest)));

        std::fs::remove_dir_all(&directory).expect("temporary directory should be removable");
    }

    #[test]
    fn ignores_a_digest_when_the_destination_does_not_exist() {
        let directory = temporary_directory("digest-missing");
        let source = directory.join("tacho.ddd");
        write_file(&source, "source bytes");
        let digest = sha256_of(&source).expect("source digest should be computable");

        assert!(!is_same_existing_file(&as_text(&source), &as_text(&directory.join("report.html")), Some(&digest)));

        std::fs::remove_dir_all(&directory).expect("temporary directory should be removable");
    }

    #[test]
    fn allows_a_destination_that_does_not_exist_yet_or_differs() {
        let directory = temporary_directory("destination");
        let source = directory.join("tacho.ddd");
        write_file(&source, "source");

        assert!(!is_same_existing_file(&as_text(&source), &as_text(&directory.join("report.html")), None));
        let other = directory.join("other.ddd");
        write_file(&other, "other");
        assert!(!is_same_existing_file(&as_text(&source), &as_text(&other), None));

        std::fs::remove_dir_all(&directory).expect("temporary directory should be removable");
    }
}
