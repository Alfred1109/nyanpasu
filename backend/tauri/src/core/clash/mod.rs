use backon::ExponentialBuilder;
use once_cell::sync::Lazy;
use tauri::Emitter;

pub mod api;
pub mod core;
pub mod proxies;
pub mod ws;

pub static CLASH_API_DEFAULT_BACKOFF_STRATEGY: Lazy<ExponentialBuilder> = Lazy::new(|| {
    ExponentialBuilder::default()
        .with_min_delay(std::time::Duration::from_millis(50))
        .with_max_delay(std::time::Duration::from_secs(5))
        .with_max_times(5)
});

pub fn setup<R: tauri::Runtime, M: tauri::Manager<R>>(manager: &M) -> anyhow::Result<()> {
    let ws_connector = ws::ClashConnectionsConnector::new();
    manager.manage(ws_connector.clone());
    let app_handle = manager.app_handle().clone();

    tauri::async_runtime::spawn(async move {
        // 等待 clash core 启动并就绪
        // 通过轮询 core 状态判断，而非硬编码延迟
        tracing::info!("Waiting for clash core to be ready before starting WS connector...");

        let mut retry_count = 0;
        let max_retries = 60; // 最多等待 60 秒

        loop {
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;

            let (state, _, _) = super::CoreManager::global().status().await;
            if matches!(
                state.as_ref(),
                nyanpasu_ipc::api::status::CoreState::Running
            ) {
                // Core 已运行，再等待 2 秒确保 API 端点完全就绪
                tracing::info!("Clash core is running, waiting 2 seconds for API to be ready...");
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                break;
            }

            retry_count += 1;
            if retry_count >= max_retries {
                tracing::warn!(
                    "Clash core did not start within {} seconds, attempting WS connection anyway",
                    max_retries
                );
                break;
            }

            if retry_count % 10 == 0 {
                tracing::debug!(
                    "Still waiting for clash core to start... ({}/{}s)",
                    retry_count,
                    max_retries
                );
            }
        }

        // 启动 WS 连接，带重试机制
        let mut ws_retry_count = 0;
        let max_ws_retries = 5;

        loop {
            match ws_connector.start().await {
                Ok(_) => {
                    tracing::info!("WS connector started successfully");
                    break;
                }
                Err(e) => {
                    ws_retry_count += 1;
                    if ws_retry_count >= max_ws_retries {
                        tracing::error!(
                            "Failed to start WS connector after {} attempts: {:?}. Connections monitoring will be unavailable.",
                            max_ws_retries,
                            e
                        );
                        break;
                    }
                    tracing::warn!(
                        "WS connector failed to start (attempt {}/{}): {:?}, retrying in 3 seconds...",
                        ws_retry_count,
                        max_ws_retries,
                        e
                    );
                    tokio::time::sleep(std::time::Duration::from_secs(3)).await;
                }
            }
        }

        // 订阅事件并发送到前端
        let mut rx = ws_connector.subscribe();
        while let Ok(event) = rx.recv().await {
            emit_clash_connections_event(&app_handle, event);
        }
    });
    Ok(())
}

fn emit_clash_connections_event<R: tauri::Runtime>(
    app_handle: &tauri::AppHandle<R>,
    event: ws::ClashConnectionsConnectorEvent,
) {
    if let Err(err) = app_handle.emit("clash-connections-event", event) {
        tracing::error!("failed to emit clash connections event: {err}");
    }
}
