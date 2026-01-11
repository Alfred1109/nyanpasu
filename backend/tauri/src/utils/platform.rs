// Platform-specific utilities consolidated from various modules

#[cfg(target_os = "macos")]
/// Set macOS application activation policy for proper window behavior
/// Moved from nyanpasu-egui/src/widget/mod.rs
#[allow(dead_code)] // Platform-specific utility for future use
pub fn set_application_activation_policy() {
    use objc2_app_kit::{NSApplication, NSApplicationActivationPolicy};
    use objc2_foundation::MainThreadMarker;
    use std::cell::Cell;
    
    thread_local! {
        static MARK: Cell<MainThreadMarker> = Cell::new(MainThreadMarker::new().unwrap());
    }

    let app = NSApplication::sharedApplication(MARK.get());
    app.setActivationPolicy(NSApplicationActivationPolicy::Accessory);
    unsafe {
        app.activate();
    }
}

#[cfg(not(target_os = "macos"))]
/// No-op implementation for non-macOS platforms  
#[allow(dead_code)] // Platform-specific utility for future use
pub fn set_application_activation_policy() {
    // No action needed on other platforms
}

#[cfg(target_os = "windows")]
pub mod windows {
    // Future Windows-specific utilities can be added here
}

#[cfg(target_os = "linux")]
pub mod linux {
    // Future Linux-specific utilities can be added here
}
