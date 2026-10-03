// Build and runtime version metadata for the About dialog.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeVersionsDto {
    pub application: String,
    pub architecture: String,
    pub parser_commit: String,
    pub parser_version: String,
    pub platform: String,
    pub runtime: String,
}

pub fn runtime_versions_dto(application_version: String) -> RuntimeVersionsDto {
    RuntimeVersionsDto {
        application: application_version,
        architecture: std::env::consts::ARCH.to_string(),
        parser_commit: env!("ESM_PARSER_COMMIT").to_string(),
        parser_version: env!("ESM_PARSER_VERSION").to_string(),
        platform: std::env::consts::OS.to_string(),
        runtime: format!("Tauri {}", tauri::VERSION),
    }
}

#[cfg(test)]
mod tests {
    use super::runtime_versions_dto;

    #[test]
    fn reports_the_real_compile_target_platform_and_architecture() {
        let dto = runtime_versions_dto("1.2.3".to_string());

        assert_eq!(dto.application, "1.2.3");
        assert_eq!(dto.platform, std::env::consts::OS);
        assert_eq!(dto.architecture, std::env::consts::ARCH);
        assert_eq!(dto.runtime, format!("Tauri {}", tauri::VERSION));
    }

    #[test]
    fn reports_the_pinned_vendored_parser_version_and_commit_from_build_rs() {
        let dto = runtime_versions_dto("1.2.3".to_string());

        // Verifies parser version and commit extracted by build.rs.
        assert_ne!(dto.parser_version, "unknown");
        assert_ne!(dto.parser_commit, "unknown");
    }
}
