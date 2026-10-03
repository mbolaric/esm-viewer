// Reading and validating tachograph files from disk.

use std::fs::File;
use std::io::Read;
use std::path::Path;

// Maximum allowed file size for tachograph binary processing (50 MB).
pub const MAX_TACHOGRAPH_FILE_SIZE_BYTES: u64 = 50 * 1024 * 1024;

pub const SUPPORTED_TACHOGRAPH_EXTENSIONS: &[&str] = &["ddd", "esm", "v1b", "c1b", "tgd", "tlg", "v1c", "c1c"];

pub fn is_supported_tachograph_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| SUPPORTED_TACHOGRAPH_EXTENSIONS.contains(&ext.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TachographFileReadError {
    InvalidFile,
    FileReadFailed,
    NotFound,
    TooLarge,
}

impl TachographFileReadError {
    pub fn message(self) -> &'static str {
        match self {
            Self::InvalidFile => "Path is not a supported regular file",
            Self::FileReadFailed => "File could not be read",
            Self::NotFound => "File does not exist",
            Self::TooLarge => "File size exceeds 50 MB limit",
        }
    }
}

fn map_file_access_error(error: std::io::Error) -> TachographFileReadError {
    if error.kind() == std::io::ErrorKind::NotFound {
        TachographFileReadError::NotFound
    } else {
        TachographFileReadError::FileReadFailed
    }
}

fn read_with_limit(reader: impl Read, maximum_bytes: u64) -> Result<Vec<u8>, TachographFileReadError> {
    let mut bytes = Vec::new();
    reader.take(maximum_bytes + 1).read_to_end(&mut bytes).map_err(|_| TachographFileReadError::FileReadFailed)?;
    if bytes.len() as u64 > maximum_bytes {
        return Err(TachographFileReadError::TooLarge);
    }
    Ok(bytes)
}

pub fn read_tachograph_file(path: &Path) -> Result<Vec<u8>, TachographFileReadError> {
    let canonical_path = path.canonicalize().map_err(map_file_access_error)?;
    if !is_supported_tachograph_extension(path) {
        return Err(TachographFileReadError::InvalidFile);
    }
    // Check the target as well as the selected name so a symlink cannot disguise another file type.
    if !is_supported_tachograph_extension(&canonical_path) {
        return Err(TachographFileReadError::InvalidFile);
    }
    // Checked before opening as well as after: opening a named pipe or device blocks until a writer appears, which
    // would stall a worker thread indefinitely.
    if !std::fs::metadata(&canonical_path).map_err(map_file_access_error)?.is_file() {
        return Err(TachographFileReadError::InvalidFile);
    }
    let file = File::open(&canonical_path).map_err(map_file_access_error)?;
    let metadata = file.metadata().map_err(|_| TachographFileReadError::FileReadFailed)?;
    if !metadata.is_file() {
        return Err(TachographFileReadError::InvalidFile);
    }
    if metadata.len() > MAX_TACHOGRAPH_FILE_SIZE_BYTES {
        return Err(TachographFileReadError::TooLarge);
    }

    read_with_limit(file, MAX_TACHOGRAPH_FILE_SIZE_BYTES)
}

#[cfg(test)]
mod tests {
    #[cfg(unix)]
    use super::read_tachograph_file;
    use super::{is_supported_tachograph_extension, read_with_limit, TachographFileReadError};
    #[cfg(unix)]
    use std::fs;
    use std::io::Cursor;
    use std::path::Path;

    #[test]
    fn bounded_reader_rejects_actual_bytes_beyond_the_ceiling() {
        assert_eq!(read_with_limit(Cursor::new(vec![0_u8; 9]), 8), Err(TachographFileReadError::TooLarge));
        assert_eq!(read_with_limit(Cursor::new(vec![0_u8; 8]), 8).unwrap().len(), 8);
    }

    #[cfg(unix)]
    #[test]
    fn symlink_cannot_disguise_an_unsupported_target_extension() {
        use std::os::unix::fs::symlink;

        let base = std::env::temp_dir().join(format!("esm-viewer-tachograph-link-test-{}", std::process::id()));
        fs::create_dir_all(&base).unwrap();
        let target = base.join("private.txt");
        let selected = base.join("selected.ddd");
        fs::write(&target, b"private contents").unwrap();
        symlink(&target, &selected).unwrap();

        assert_eq!(read_tachograph_file(&selected), Err(TachographFileReadError::InvalidFile));

        fs::remove_file(selected).unwrap();
        fs::remove_file(target).unwrap();
        fs::remove_dir(base).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn named_pipe_is_rejected_without_blocking_on_open() {
        let base = std::env::temp_dir().join(format!("esm-viewer-tachograph-fifo-test-{}", std::process::id()));
        fs::create_dir_all(&base).unwrap();
        let fifo = base.join("pipe.ddd");
        let status = std::process::Command::new("mkfifo").arg(&fifo).status().unwrap();
        assert!(status.success());

        // Opening the pipe for reading would block forever with no writer, so returning at all is the assertion.
        assert_eq!(read_tachograph_file(&fifo), Err(TachographFileReadError::InvalidFile));

        fs::remove_file(fifo).unwrap();
        fs::remove_dir(base).unwrap();
    }

    #[test]
    fn test_supported_tachograph_extension_case_insensitive() {
        assert!(is_supported_tachograph_extension(Path::new("a.DDD")));
        assert!(is_supported_tachograph_extension(Path::new("b.esm")));
        assert!(is_supported_tachograph_extension(Path::new("c.V1B")));
        assert!(is_supported_tachograph_extension(Path::new("d.c1b")));
        assert!(is_supported_tachograph_extension(Path::new("e.TGD")));
        assert!(!is_supported_tachograph_extension(Path::new("f.txt")));
        assert!(!is_supported_tachograph_extension(Path::new("g")));
    }

    // Verifies directory collection accepts the full set of tachograph extensions.
    #[test]
    fn test_supported_tachograph_extension_accepts_the_full_shared_set() {
        assert!(is_supported_tachograph_extension(Path::new("a.tlg")));
        assert!(is_supported_tachograph_extension(Path::new("b.v1c")));
        assert!(is_supported_tachograph_extension(Path::new("c.c1c")));
    }
}
