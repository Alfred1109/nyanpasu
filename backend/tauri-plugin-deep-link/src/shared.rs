use std::io::{Error, ErrorKind, Result};
use crate::ID;

/// Common utilities shared across all platform implementations
pub mod utils {
    use super::*;

    /// Format socket address for inter-process communication
    pub fn format_socket_addr(identifier: &str) -> String {
        format!("/tmp/{}-deep-link.sock", identifier)
    }

    /// Get the ID with a descriptive error message
    pub fn expect_id_set(action: &str) -> String {
        ID.get()
            .unwrap_or_else(|| panic!("{} called before prepare()", action))
            .clone()
    }

    /// Common error handling for socket operations
    pub fn handle_socket_error(err: &std::io::Error, action: &str) {
        log::error!("Error during {}: {}", action, err.to_string());
    }

    /// Common logging for deep link events
    pub fn log_deep_link_received(buffer: &str) {
        log::debug!("Deep link received: {}", buffer);
    }
}

/// Common error types and handling
pub mod errors {
    use super::*;

    pub fn id_already_set() -> Error {
        Error::new(
            ErrorKind::AlreadyExists,
            "prepare() called more than once with different identifiers"
        )
    }

    pub fn handler_already_set() -> Error {
        Error::new(
            ErrorKind::AlreadyExists,
            "Handler was already set"
        )
    }

    pub fn data_directory_not_found() -> Error {
        Error::new(ErrorKind::NotFound, "data directory not found.")
    }

    pub fn executable_name_not_found() -> Error {
        Error::new(
            ErrorKind::NotFound,
            "Couldn't get file name of current executable."
        )
    }
}

/// Platform-agnostic handler trait
pub trait DeepLinkHandler<F>
where
    F: FnMut(String) + Send + 'static,
{
    fn register_scheme(schemes: &[&str], handler: F) -> Result<()>;
    fn start_listener(handler: F) -> Result<()>;
    fn unregister_scheme(schemes: &[&str]) -> Result<()>;
    fn prepare_instance(identifier: &str);
}
