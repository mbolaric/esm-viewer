// Guards an export destination against the file it was opened from.

use std::fs::File;
use std::io::{self, Read};
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};

use crate::tachograph_file::MAX_TACHOGRAPH_FILE_SIZE_BYTES;

fn canonicalize_existing(path: &str) -> io::Result<Option<PathBuf>> {
    match Path::new(path).canonicalize() {
        Ok(path) => Ok(Some(path)),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error),
    }
}

#[cfg(unix)]
fn same_file_identity(left: &Path, right: &Path) -> io::Result<bool> {
    use std::os::unix::fs::MetadataExt;
    let left = std::fs::metadata(left)?;
    let right = std::fs::metadata(right)?;
    Ok(left.dev() == right.dev() && left.ino() == right.ino())
}

#[cfg(windows)]
mod windows_identity {
    use super::*;
    use std::os::windows::io::{AsRawHandle, RawHandle};

    #[repr(C)]
    #[derive(Default)]
    struct FileInformation {
        attributes: u32,
        creation_time: [u32; 2],
        last_access_time: [u32; 2],
        last_write_time: [u32; 2],
        volume_serial_number: u32,
        size_high: u32,
        size_low: u32,
        number_of_links: u32,
        file_index_high: u32,
        file_index_low: u32,
    }

    #[link(name = "kernel32")]
    unsafe extern "system" {
        #[link_name = "GetFileInformationByHandle"]
        fn get_file_information_by_handle(handle: RawHandle, information: *mut FileInformation) -> i32;
    }

    fn file_identity(file: &File) -> io::Result<(u32, u32, u32)> {
        let mut information = FileInformation::default();
        // The File owns a live handle, and the output has the Win32 structure's layout and lifetime.
        if unsafe { get_file_information_by_handle(file.as_raw_handle(), &mut information) } == 0 {
            return Err(io::Error::last_os_error());
        }
        Ok((information.volume_serial_number, information.file_index_high, information.file_index_low))
    }

    pub(super) fn same_file_identity(left: &Path, right: &Path) -> io::Result<bool> {
        let left = File::open(left)?;
        let right = File::open(right)?;
        Ok(file_identity(&left)? == file_identity(&right)?)
    }
}

#[cfg(windows)]
use windows_identity::same_file_identity;

#[cfg(not(any(unix, windows)))]
fn same_file_identity(_left: &Path, _right: &Path) -> io::Result<bool> {
    Ok(false)
}

fn sha256_of(path: &Path) -> io::Result<Option<String>> {
    let metadata = std::fs::metadata(path)?;
    if !metadata.is_file() {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "Export destination is not a regular file"));
    }
    // An opened tachograph cannot exceed this limit, so a larger destination cannot match its bytes.
    if metadata.len() > MAX_TACHOGRAPH_FILE_SIZE_BYTES {
        return Ok(None);
    }
    let mut file = File::open(path)?.take(MAX_TACHOGRAPH_FILE_SIZE_BYTES + 1);
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    let mut bytes_read = 0_u64;
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        bytes_read += read as u64;
        if bytes_read > MAX_TACHOGRAPH_FILE_SIZE_BYTES {
            return Ok(None);
        }
        hasher.update(&buffer[..read]);
    }
    Ok(Some(hex::encode(hasher.finalize())))
}

// True when the destination is the file the source was read from, or otherwise holds exactly its bytes.
//
// Path and file identity cannot answer for a document the user dropped into the window: the webview receives no path
// for a dropped file, so the renderer only has the digest it computed. Comparing that digest against the destination
// also refuses a byte-identical copy of an opened tachograph file, which is intended rather than a false positive:
// writing export output over tachograph data is what this guard exists to stop.
pub fn is_same_existing_file(source_path: &str, destination_path: &str, source_sha256: Option<&str>) -> io::Result<bool> {
    let Some(destination) = canonicalize_existing(destination_path)? else {
        return Ok(false);
    };

    // A dropped document has no usable source path, only the digest below.
    if let Some(source) = canonicalize_existing(source_path)?
        && (source == destination || same_file_identity(&source, &destination)?)
    {
        return Ok(true);
    }

    let Some(expected) = source_sha256 else {
        return Ok(false);
    };
    Ok(sha256_of(&destination)?.is_some_and(|actual| expected.eq_ignore_ascii_case(&actual)))
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
        assert!(is_same_existing_file(&as_text(&source), &spelled_differently, None).expect("destination should be checkable"));

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

        assert!(is_same_existing_file(&as_text(&source), &as_text(&link.join("tacho.ddd")), None)
            .expect("destination should be checkable"));

        std::fs::remove_dir_all(&directory).expect("temporary directory should be removable");
    }

    #[test]
    fn detects_a_hard_link_to_the_source() {
        let directory = temporary_directory("hardlink");
        let source = directory.join("tacho.ddd");
        write_file(&source, "source");
        let link = directory.join("alias.ddd");
        std::fs::hard_link(&source, &link).expect("hard link should be creatable");

        assert!(is_same_existing_file(&as_text(&source), &as_text(&link), None).expect("destination should be checkable"));

        std::fs::remove_dir_all(&directory).expect("temporary directory should be removable");
    }

    #[test]
    fn detects_a_destination_holding_the_sources_bytes_under_another_path() {
        let directory = temporary_directory("digest");
        let source = directory.join("tacho.ddd");
        write_file(&source, "source bytes");
        let digest = sha256_of(&source).expect("source should be readable").expect("source digest should be computable");
        // A copy stands in for a dropped document, whose path the renderer never learns.
        let copy = directory.join("copy.ddd");
        std::fs::copy(&source, &copy).expect("copy should be creatable");

        assert!(
            is_same_existing_file("opaque-drop-token", &as_text(&copy), Some(&digest)).expect("destination should be checkable")
        );

        let different = directory.join("other.ddd");
        write_file(&different, "other bytes");
        assert!(!is_same_existing_file("opaque-drop-token", &as_text(&different), Some(&digest))
            .expect("destination should be checkable"));

        std::fs::remove_dir_all(&directory).expect("temporary directory should be removable");
    }

    #[test]
    fn ignores_a_digest_when_the_destination_does_not_exist() {
        let directory = temporary_directory("digest-missing");
        let source = directory.join("tacho.ddd");
        write_file(&source, "source bytes");
        let digest = sha256_of(&source).expect("source should be readable").expect("source digest should be computable");

        assert!(!is_same_existing_file(&as_text(&source), &as_text(&directory.join("report.html")), Some(&digest))
            .expect("destination should be checkable"));

        std::fs::remove_dir_all(&directory).expect("temporary directory should be removable");
    }

    #[test]
    fn allows_a_destination_that_does_not_exist_yet_or_differs() {
        let directory = temporary_directory("destination");
        let source = directory.join("tacho.ddd");
        write_file(&source, "source");

        assert!(!is_same_existing_file(&as_text(&source), &as_text(&directory.join("report.html")), None)
            .expect("destination should be checkable"));
        let other = directory.join("other.ddd");
        write_file(&other, "other");
        assert!(!is_same_existing_file(&as_text(&source), &as_text(&other), None).expect("destination should be checkable"));

        std::fs::remove_dir_all(&directory).expect("temporary directory should be removable");
    }

    #[cfg(unix)]
    #[test]
    fn refuses_an_unreadable_destination_for_a_dropped_source() {
        use std::os::unix::fs::PermissionsExt;

        let directory = temporary_directory("unreadable");
        let source = directory.join("tacho.ddd");
        write_file(&source, "source bytes");
        let digest = sha256_of(&source).expect("source should be readable").expect("source digest should be computable");
        let permissions = std::fs::metadata(&source).expect("source metadata should be readable").permissions();
        std::fs::set_permissions(&source, std::fs::Permissions::from_mode(0o0)).expect("source should be restrictable");
        let unreadable = File::open(&source).is_err();
        let result = is_same_existing_file("opaque-drop-token", &as_text(&source), Some(&digest));
        std::fs::set_permissions(&source, permissions).expect("source permissions should be restorable");
        std::fs::remove_dir_all(&directory).expect("temporary directory should be removable");

        // Privileged test runners may still read mode-000 files, but must reject matching bytes either way.
        if unreadable {
            assert_eq!(result.expect_err("unreadable destination must refuse the check").kind(), io::ErrorKind::PermissionDenied);
        } else {
            assert!(result.expect("privileged runner should detect matching bytes"));
        }
    }

    #[cfg(unix)]
    #[test]
    fn does_not_treat_a_symlink_loop_as_a_missing_destination() {
        let directory = temporary_directory("symlink-loop");
        let destination = directory.join("loop");
        std::os::unix::fs::symlink(&destination, &destination).expect("symlink should be creatable");

        assert!(is_same_existing_file("opaque-drop-token", &as_text(&destination), Some("digest")).is_err());

        std::fs::remove_dir_all(&directory).expect("temporary directory should be removable");
    }

    #[test]
    fn refuses_a_non_regular_destination_for_a_dropped_source() {
        let directory = temporary_directory("non-regular");

        assert_eq!(
            is_same_existing_file("opaque-drop-token", &as_text(&directory), Some("digest"))
                .expect_err("directory must refuse the check")
                .kind(),
            io::ErrorKind::InvalidInput
        );

        std::fs::remove_dir_all(&directory).expect("temporary directory should be removable");
    }
}
