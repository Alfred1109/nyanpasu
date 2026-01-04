//! Setup logic for the app
#[cfg(target_os = "windows")]
use anyhow::Context;

pub fn setup<R: tauri::Runtime, M: tauri::Manager<R>>(_app: &M) -> Result<(), anyhow::Error> {
    #[cfg(target_os = "windows")]
    {
        let app_handle = _app.app_handle().clone();
        super::shutdown_hook::setup_shutdown_hook(move || {
            tracing::info!("Shutdown hook triggered, exiting app...");
            app_handle.exit(0);
        })
        .context("Failed to setup the shutdown hook")?;
    }

    // FIXME: this is a background setup, so be careful use this state in ipc.
    // crate::logging::setup(app).context("Failed to setup logging")?;
    Ok(())
}
