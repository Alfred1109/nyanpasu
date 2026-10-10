use super::{Config, ConfigType, IClashTemp, RUNTIME_CONFIG};
use crate::{core::CoreManager, utils::dirs};
use nyanpasu_ipc::api::status::CoreState;

/// Serializes global override edits, including DNS and field ownership.
pub static SETTINGS_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

/// The caller owns SETTINGS_LOCK for the entire read/modify/apply operation.
/// Generate once, validate before persisting, and restore every changed resource
/// if activation fails. Never rerun user scripts during core activation.
pub async fn apply_override_change(
    change: impl FnOnce(&mut IClashTemp) -> anyhow::Result<()>,
) -> anyhow::Result<()> {
    let old_clash = Config::clash().data().clone();
    let old_runtime = Config::runtime().data().clone();
    let runtime_path = dirs::app_config_dir()?.join(RUNTIME_CONFIG);
    let old_runtime_file = match std::fs::read(&runtime_path) {
        Ok(contents) => Some(contents),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => return Err(error.into()),
    };
    let (state, _, _) = CoreManager::global().status().await;
    let core_running = matches!(state.as_ref(), CoreState::Running);
    let mut next = old_clash.clone();
    change(&mut next)?;
    if next.0 == old_clash.0 {
        return Ok(());
    }
    *Config::clash().draft() = next;
    let mut update_attempted = false;
    let result = async {
        Config::generate().await?;
        CoreManager::global().check_config().await?;
        Config::generate_file(ConfigType::Run)?;
        Config::clash().latest().save_config()?;
        if core_running {
            update_attempted = true;
            CoreManager::global().load_generated_config().await?;
        }
        Config::clash().apply();
        Config::runtime().apply();
        Ok::<_, anyhow::Error>(())
    }
    .await;
    if let Err(error) = result {
        Config::clash().discard();
        Config::runtime().discard();
        let mut failures = Vec::new();
        if let Err(e) = old_clash.save_config() {
            failures.push(format!("restore overrides: {e:#}"));
        }
        *Config::runtime().draft() = old_runtime;
        Config::runtime().apply();
        let restored = match old_runtime_file {
            Some(contents) => std::fs::write(&runtime_path, contents),
            None => match std::fs::remove_file(&runtime_path) {
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
                result => result,
            },
        };
        if let Err(e) = restored {
            failures.push(format!("restore runtime file: {e:#}"));
        }
        if core_running && update_attempted {
            if let Err(e) = CoreManager::global().load_generated_config().await {
                failures.push(format!("restore running core: {e:#}"));
            }
            Config::runtime().apply();
        }
        return if failures.is_empty() {
            Err(error)
        } else {
            Err(anyhow::anyhow!(
                "failed to apply runtime overrides: {error:#}; rollback also failed: {}",
                failures.join("; ")
            ))
        };
    }
    crate::core::handle::Handle::refresh_clash();
    Ok(())
}
