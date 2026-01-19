// Simplified dialog stub - removed actual dialog functionality

#[allow(dead_code)] // Used by set_custom_app_dir IPC command
pub fn migrate_dialog(_msg: &str) -> bool {
    log::info!("Migration dialog bypassed in simplified version");
    true // Always proceed with migration in simplified version
}
