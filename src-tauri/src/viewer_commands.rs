// Tauri commands and response DTOs for file open, parse, and signature verification.

use std::collections::BTreeMap;
use std::path::Path;

use esm_parser::{
    parse_from_memory,
    tacho::{CardFilesMap, CardGeneration, NationNumeric, VUFilesList, VerifyResultStatus, VerifyStatus, VuVerifyResult},
    verify_card, verify_vu_certificate_chain, verify_vu_full, SerializedTachographData,
};
use serde::{Deserialize, Serialize};

use crate::blocking::{run_blocking, run_blocking_string};
use crate::runtime_versions;
use crate::tachograph_file::{
    read_tachograph_file, TachographFileReadError, MAX_TACHOGRAPH_FILE_SIZE_BYTES, SUPPORTED_TACHOGRAPH_EXTENSIONS,
};

#[derive(Debug, Serialize, Deserialize)]
pub struct ParseFileResponse {
    pub ok: bool,
    pub data: Option<serde_json::Value>,
    pub error: Option<String>,
}

// Why a file could not be read; the file's bytes themselves travel as a raw IPC response, never as JSON.
#[derive(Debug, Serialize, Deserialize)]
pub struct ReadFileFailure {
    pub error: String,
    // Machine-readable failure reason code (e.g. "notFound").
    pub code: Option<String>,
}

impl From<String> for ReadFileFailure {
    fn from(error: String) -> Self {
        ReadFileFailure { error, code: None }
    }
}

impl ParseFileResponse {
    fn failure(error: impl Into<String>) -> Self {
        ParseFileResponse { ok: false, data: None, error: Some(error.into()) }
    }
}

fn serialize_ok<T: Serialize>(value: T) -> ParseFileResponse {
    match serde_json::to_value(value) {
        Ok(val) => ParseFileResponse { ok: true, data: Some(val), error: None },
        Err(e) => ParseFileResponse::failure(format!("Serialization error: {}", e)),
    }
}

// Parse and verification failures travel inside the response, so the command itself only fails on a worker panic.
fn into_response<T: Serialize>(result: Result<T, String>) -> ParseFileResponse {
    match result {
        Ok(value) => serialize_ok(value),
        Err(error) => ParseFileResponse::failure(error),
    }
}

fn parse_bytes(esm_data: &[u8]) -> Result<SerializedTachographData, String> {
    if esm_data.len() > MAX_TACHOGRAPH_FILE_SIZE_BYTES as usize {
        return Err("Data size exceeds 50 MB limit".to_string());
    }
    parse_from_memory(esm_data).map(SerializedTachographData::from).map_err(|e| format!("Parsing error: {:?}", e))
}

fn parse_generation(generation: &str) -> Result<CardGeneration, String> {
    match generation {
        "g1" => Ok(CardGeneration::Gen1),
        "g2" => Ok(CardGeneration::Gen2),
        _ => Err(format!("Unsupported verification generation: {}", generation)),
    }
}

fn verify_card_files(generation: &str, data_files: serde_json::Value, erca_pk: &[u8]) -> Result<impl Serialize, String> {
    let card_generation = parse_generation(generation)?;
    let card_files: CardFilesMap = serde_json::from_value(data_files).map_err(|e| format!("Data files decode error: {}", e))?;
    verify_card(&card_generation, &card_files, erca_pk).map_err(|e| format!("Verification error: {:?}", e))
}

fn verify_vu_files(
    generation: &str,
    member_state_certificate_raw: &[u8],
    vu_certificate_raw: &[u8],
    data_files: Option<serde_json::Value>,
    erca_pk: &[u8],
) -> Result<VuVerifyResult, String> {
    let vu_generation = parse_generation(generation)?;
    let mut combined_items =
        verify_vu_certificate_chain(&vu_generation, member_state_certificate_raw, vu_certificate_raw, erca_pk)
            .map_err(|e| format!("Verification error: {:?}", e))?
            .result;

    if let Some(files_val) = data_files {
        let vu_files: VUFilesList =
            serde_json::from_value(files_val).map_err(|e| format!("VU data files decode error: {}", e))?;
        if !vu_files.is_empty() {
            let data_result = verify_vu_full(&vu_files, erca_pk).map_err(|e| format!("VU full verification error: {:?}", e))?;
            combined_items.extend(data_result.result);
        }
    }

    let status = if combined_items.is_empty() {
        VerifyResultStatus::Unsigned
    } else if combined_items.iter().all(|item| matches!(item.status(), VerifyStatus::Valid)) {
        VerifyResultStatus::Valid
    } else if combined_items.iter().any(|item| matches!(item.status(), VerifyStatus::Valid)) {
        VerifyResultStatus::PartiallyValid
    } else {
        VerifyResultStatus::Invalid
    };

    Ok(VuVerifyResult { status, result: combined_items })
}

#[tauri::command]
pub fn get_supported_tachograph_extensions() -> Vec<String> {
    SUPPORTED_TACHOGRAPH_EXTENSIONS.iter().map(|ext| ext.to_string()).collect()
}

#[tauri::command]
pub fn get_runtime_versions<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> runtime_versions::RuntimeVersionsDto {
    runtime_versions::runtime_versions_dto(app.package_info().version.to_string())
}

// Returns the file as a raw binary response: a JSON number array would inflate a 50 MB file several times over.
#[tauri::command]
pub async fn read_ddd_file(file_path: String) -> Result<tauri::ipc::Response, ReadFileFailure> {
    run_blocking(move || {
        read_tachograph_file(Path::new(&file_path)).map(tauri::ipc::Response::new).map_err(|error| ReadFileFailure {
            error: error.message().to_string(),
            code: (error == TachographFileReadError::NotFound).then(|| "notFound".to_string()),
        })
    })
    .await
}

// Takes the file as the raw request body rather than a JSON number array.
#[tauri::command]
pub async fn parse_ddd_memory(request: tauri::ipc::Request<'_>) -> Result<ParseFileResponse, String> {
    let tauri::ipc::InvokeBody::Raw(esm_data) = request.body() else {
        return Ok(ParseFileResponse::failure("Expected the file bytes as a raw request body"));
    };
    let esm_data = esm_data.clone();
    run_blocking_string(move || Ok(into_response(parse_bytes(&esm_data)))).await
}

#[tauri::command]
pub fn get_supported_nation_alpha_codes() -> BTreeMap<String, String> {
    NationNumeric::get_supported_nation_alpha_codes().into_iter().map(|(code, alpha)| (code, alpha.to_string())).collect()
}

#[tauri::command]
pub async fn verify_document(
    generation: String,
    data_files: serde_json::Value,
    erca_pk: Vec<u8>,
) -> Result<ParseFileResponse, String> {
    run_blocking_string(move || Ok(into_response(verify_card_files(&generation, data_files, &erca_pk)))).await
}

// Verifies Vehicle Unit certificate chain (ERCA -> MSCA -> VU) and data record signatures.
#[tauri::command]
pub async fn verify_vu_document(
    generation: String,
    member_state_certificate_raw: Vec<u8>,
    vu_certificate_raw: Vec<u8>,
    data_files: Option<serde_json::Value>,
    erca_pk: Vec<u8>,
) -> Result<ParseFileResponse, String> {
    run_blocking_string(move || {
        Ok(into_response(verify_vu_files(&generation, &member_state_certificate_raw, &vu_certificate_raw, data_files, &erca_pk)))
    })
    .await
}

#[tauri::command]
pub fn open_devtools<R: tauri::Runtime>(window: tauri::WebviewWindow<R>) {
    #[cfg(all(debug_assertions, feature = "devtools"))]
    {
        if window.is_devtools_open() {
            window.close_devtools();
        } else {
            window.open_devtools();
        }
    }
    #[cfg(not(all(debug_assertions, feature = "devtools")))]
    let _ = window;
}
