use std::io::{Error, ErrorKind};
use crate::ID;

/// Common utilities shared across all platform implementations

/// Format socket address with ID - now used in cross-platform implementations
#[allow(dead_code)]
pub fn format_socket_addr() -> String {
    format!("/tmp/{}-deep-link.sock", ID.get().unwrap_or(&"nyanpasu".to_string()))
}

/// Convert socket errors to deep-link errors - used in error handling
pub fn handle_socket_error(error: Error) -> Error {
    Error::new(ErrorKind::ConnectionRefused, format!("Deep-link socket error: {}", error))
}

/// Log deep-link URL received - used in all platform implementations
pub fn log_deep_link_received(url: &str) {
    log::info!("Deep-link received: {}", url);
}

/// Check if ID is already set - used for validation
pub fn id_already_set() -> bool {
    ID.get().is_some()
}

/// Check if handler is already set - used for handler management
pub fn handler_already_set() -> bool {
    // This would check if a handler is already registered
    // Implementation will vary by platform
    false
}

/// Error types for deep-link operations
#[derive(Debug)]
pub enum DeepLinkError {
    AlreadyExists,
    NotFound,
    ConnectionFailed,
    InvalidUrl,
}

impl std::fmt::Display for DeepLinkError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DeepLinkError::AlreadyExists => write!(f, "Deep-link handler already exists"),
            DeepLinkError::NotFound => write!(f, "Deep-link handler not found"),
            DeepLinkError::ConnectionFailed => write!(f, "Failed to connect to deep-link socket"),
            DeepLinkError::InvalidUrl => write!(f, "Invalid deep-link URL"),
        }
    }
}

impl std::error::Error for DeepLinkError {}

/// Common trait for platform-specific deep-link handlers
/// Used by all platform implementations for consistent interface
pub trait DeepLinkHandler {
    type Error: std::error::Error + Send + Sync + 'static;
    
    /// Register a scheme with the system
    fn register_scheme(&mut self, scheme: &str) -> std::result::Result<(), Self::Error>;
    
    /// Unregister a scheme from the system
    fn unregister_scheme(&mut self, scheme: &str) -> std::result::Result<(), Self::Error>;
    
    /// Start listening for deep-link events
    fn start_listener(&mut self) -> std::result::Result<(), Self::Error>;
    
    /// Stop listening for deep-link events
    fn stop_listener(&mut self) -> std::result::Result<(), Self::Error>;
}

/// Common socket operations used across platforms
pub fn create_socket_path() -> String {
    format_socket_addr()
}

/// Common URL validation used across platforms
pub fn validate_deep_link_url(url: &str) -> bool {
    url.contains("://") && !url.is_empty()
}
