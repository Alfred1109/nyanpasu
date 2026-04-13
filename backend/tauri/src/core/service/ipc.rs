use std::sync::atomic::{AtomicBool, AtomicU8, Ordering};

use atomic_enum::atomic_enum;

use nyanpasu_ipc::types::ServiceStatus;
use nyanpasu_utils::runtime::block_on;
use serde::Serialize;
use tracing::instrument;

use crate::log_err;

#[derive(PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
#[atomic_enum]
pub enum IpcState {
    Connected,
    Disconnected,
}

impl IpcState {
    pub fn is_connected(&self) -> bool {
        *self == IpcState::Connected
    }
}

static IPC_STATE: AtomicIpcState = AtomicIpcState::new(IpcState::Disconnected);
pub(super) static KILL_FLAG: AtomicBool = AtomicBool::new(false);
pub(super) static HEALTH_CHECK_RUNNING: AtomicBool = AtomicBool::new(false);
static DISCONNECT_STREAK: AtomicU8 = AtomicU8::new(0);

pub fn get_ipc_state() -> IpcState {
    IPC_STATE.load(Ordering::Relaxed)
}

pub(super) fn set_ipc_state(state: IpcState) {
    IPC_STATE.store(state, Ordering::Relaxed);
    on_ipc_state_changed(state);
}

fn dispatch_disconnected() {
    if IPC_STATE
        .compare_exchange_weak(
            IpcState::Connected,
            IpcState::Disconnected,
            Ordering::SeqCst,
            Ordering::Relaxed,
        )
        .is_ok()
    {
        on_ipc_state_changed(IpcState::Disconnected)
    }
}

fn dispatch_connected() {
    if IPC_STATE
        .compare_exchange_weak(
            IpcState::Disconnected,
            IpcState::Connected,
            Ordering::SeqCst,
            Ordering::Relaxed,
        )
        .is_ok()
    {
        on_ipc_state_changed(IpcState::Connected)
    }
}

pub(crate) fn notify_connected() {
    dispatch_connected();
}

pub(crate) fn notify_disconnected() {
    dispatch_disconnected();
}

// TODO: it might be moved to outer scope?
#[instrument]
fn on_ipc_state_changed(state: IpcState) {
    tracing::info!("IPC state changed: {:?}", state);
    let enabled_service = {
        *crate::config::Config::verge()
            .latest()
            .enable_service_mode
            .as_ref()
            .unwrap_or(&false)
    };

    // 使用 tauri 运行时而非创建新线程，避免线程泄漏
    tauri::async_runtime::spawn(async move {
        if enabled_service {
            let (_, _, run_type) = crate::core::CoreManager::global().status().await;
            match (state, run_type) {
                (IpcState::Connected, crate::core::RunType::Normal) => {
                    tracing::info!("Restarting core due to IPC state change");
                    log_err!(crate::core::CoreManager::global().run_core().await);
                }
                (IpcState::Disconnected, crate::core::RunType::Service) => {
                    tracing::warn!(
                        "Service IPC disconnected while core is running in service mode; skipping immediate fallback restart to avoid restart flapping"
                    );
                }
                _ => {
                    tracing::debug!(
                        "IPC state change does not require core restart (state={:?}, run_type={:?})",
                        state,
                        run_type
                    );
                }
            }
        } else {
            tracing::debug!("Service mode not enabled, skipping core restart on IPC state change");
        }
    });
}

pub(crate) fn ensure_health_check_running() {
    if HEALTH_CHECK_RUNNING.load(Ordering::Acquire) {
        return;
    }
    spawn_health_check();
}

pub(super) fn spawn_health_check() {
    KILL_FLAG.store(false, Ordering::Relaxed);
    std::thread::spawn(|| {
        HEALTH_CHECK_RUNNING.store(true, Ordering::Release);
        block_on(async {
            // 初次检查使用较短间隔确保快速响应
            let mut check_count = 0;
            loop {
                if KILL_FLAG.load(Ordering::Acquire) {
                    set_ipc_state(IpcState::Disconnected);
                    HEALTH_CHECK_RUNNING.store(false, Ordering::Release);
                    tracing::info!("Health check terminated by kill flag");
                    break;
                }

                health_check().await;
                check_count += 1;

                // 自适应间隔：前 3 次检查间隔 5 秒，之后改为 30 秒
                // 这样既能快速响应初始状态，又能减少长期运行的开销
                let interval = if check_count < 3 {
                    std::time::Duration::from_secs(5)
                } else {
                    std::time::Duration::from_secs(30)
                };

                if check_count == 3 {
                    tracing::debug!(
                        "Health check interval changed to 30 seconds after {} checks",
                        check_count
                    );
                }

                tokio::time::sleep(interval).await;
            }
        })
    });
}

#[instrument]
async fn health_check() {
    match super::control::status().await {
        Ok(info) => match info.status {
            ServiceStatus::Running => {
                DISCONNECT_STREAK.store(0, Ordering::Release);
                dispatch_connected();
            }
            ServiceStatus::Stopped | ServiceStatus::NotInstalled => {
                let streak = DISCONNECT_STREAK.fetch_add(1, Ordering::AcqRel) + 1;
                tracing::warn!(
                    "Service health check reported {:?} (disconnect streak: {})",
                    info.status,
                    streak
                );
                if streak >= 2 {
                    dispatch_disconnected();
                }
            }
        },
        Err(e) => {
            tracing::error!("IPC health check failed: {}", e);
            let streak = DISCONNECT_STREAK.fetch_add(1, Ordering::AcqRel) + 1;
            if streak >= 2 {
                dispatch_disconnected();
            }
        }
    }
}
