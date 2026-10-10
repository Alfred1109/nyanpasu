use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::{sync::OnceLock, time::Instant};
use tauri::command;
use tracing::{error, warn};

const MAX_MESSAGE_BYTES: usize = 4 * 1024;
const MAX_STACK_BYTES: usize = 12 * 1024;
const MAX_COMPONENT_STACK_BYTES: usize = 6 * 1024;
const MAX_METADATA_BYTES: usize = 4 * 1024;
const RATE_LIMIT_EVENTS: usize = 120;

/// Stable, serializable IPC error shape. `details` remains a string so older
/// callers can show it directly and the UI can offer a copyable report.
#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct StructuredIpcError {
    pub code: String,
    pub message: String,
    pub details: String,
}

/// Convert the existing error enum into a stable category while preserving its
/// full Rust context for local diagnosis.
pub fn ipc_error_payload(error: &crate::ipc::IpcError) -> StructuredIpcError {
    let code = match error {
        crate::ipc::IpcError::Io(_) => "io_error",
        crate::ipc::IpcError::SerdeYaml(_) | crate::ipc::IpcError::SerdeJson(_) => {
            "serialization_error"
        }
        crate::ipc::IpcError::Tauri(_) => "tauri_error",
        crate::ipc::IpcError::Storage(_) => "storage_error",
        crate::ipc::IpcError::Anyhow(_) => "operation_error",
        crate::ipc::IpcError::Custom(_) => "application_error",
    };

    StructuredIpcError {
        code: code.to_owned(),
        message: error.to_string(),
        details: format!("{error:#?}"),
    }
}

#[derive(Debug, Clone, Copy, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum DiagnosticSeverity {
    Warn,
    Error,
}

#[derive(Debug, Clone, Copy, Deserialize, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum DiagnosticSource {
    GlobalError,
    UnhandledRejection,
    ConsoleWarn,
    ConsoleError,
    ErrorBoundary,
}

#[derive(Debug, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct FrontendDiagnostic {
    pub severity: DiagnosticSeverity,
    pub source: DiagnosticSource,
    pub message: String,
    pub stack: Option<String>,
    pub component_stack: Option<String>,
    pub metadata: Option<String>,
}

#[derive(Default)]
struct RateLimitState {
    window_started: Option<Instant>,
    accepted: usize,
}

fn rate_limit_state() -> &'static Mutex<RateLimitState> {
    static STATE: OnceLock<Mutex<RateLimitState>> = OnceLock::new();
    STATE.get_or_init(|| Mutex::new(RateLimitState::default()))
}

fn within_rate_limit() -> bool {
    let now = Instant::now();
    let mut state = rate_limit_state().lock();
    if state
        .window_started
        .is_none_or(|started| now.duration_since(started).as_secs() >= 60)
    {
        state.window_started = Some(now);
        state.accepted = 0;
    }

    if state.accepted >= RATE_LIMIT_EVENTS {
        return false;
    }
    state.accepted += 1;
    true
}

fn truncate_utf8(value: &str, max_bytes: usize) -> String {
    if value.len() <= max_bytes {
        return value.to_owned();
    }
    let mut end = max_bytes;
    while !value.is_char_boundary(end) {
        end -= 1;
    }
    format!("{}…[truncated]", &value[..end])
}

#[command]
#[specta::specta]
pub fn report_frontend_diagnostic(diagnostic: FrontendDiagnostic) -> Result<(), String> {
    if !within_rate_limit() {
        return Err("frontend diagnostic rate limit exceeded".to_owned());
    }

    let message = truncate_utf8(diagnostic.message.trim(), MAX_MESSAGE_BYTES);
    if message.is_empty() {
        return Err("diagnostic message must not be empty".to_owned());
    }
    let stack = diagnostic
        .stack
        .as_deref()
        .map(|value| truncate_utf8(value, MAX_STACK_BYTES));
    let component_stack = diagnostic
        .component_stack
        .as_deref()
        .map(|value| truncate_utf8(value, MAX_COMPONENT_STACK_BYTES));
    let metadata = diagnostic
        .metadata
        .as_deref()
        .map(|value| truncate_utf8(value, MAX_METADATA_BYTES));
    let source = match diagnostic.source {
        DiagnosticSource::GlobalError => "global_error",
        DiagnosticSource::UnhandledRejection => "unhandled_rejection",
        DiagnosticSource::ConsoleWarn => "console_warn",
        DiagnosticSource::ConsoleError => "console_error",
        DiagnosticSource::ErrorBoundary => "error_boundary",
    };

    match diagnostic.severity {
        DiagnosticSeverity::Warn => warn!(
            target: "frontend",
            source = %source,
            message = %message,
            stack = ?stack,
            component_stack = ?component_stack,
            metadata = ?metadata,
            "frontend diagnostic"
        ),
        DiagnosticSeverity::Error => error!(
            target: "frontend",
            source = %source,
            message = %message,
            stack = ?stack,
            component_stack = ?component_stack,
            metadata = ?metadata,
            "frontend diagnostic"
        ),
    }

    Ok(())
}
