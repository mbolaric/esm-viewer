// Runs synchronous native work off the Tauri command executor.
pub async fn run_blocking<T: Send + 'static, E: From<String> + Send + 'static>(
    operation: impl FnOnce() -> Result<T, E> + Send + 'static,
) -> Result<T, E> {
    tauri::async_runtime::spawn_blocking(operation).await.map_err(|error| E::from(error.to_string()))?
}

pub async fn run_blocking_string<T: Send + 'static>(
    operation: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    run_blocking(operation).await
}
