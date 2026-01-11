pub mod network_statistic_large;
pub mod network_statistic_small;

use std::path::PathBuf;

pub use network_statistic_large::NyanpasuNetworkStatisticLargeWidget;
pub use network_statistic_small::NyanpasuNetworkStatisticSmallWidget;

/// Get window state path with fallback to system temp directory
fn get_window_state_path() -> std::io::Result<PathBuf> {
    // Try environment variable first
    if let Ok(env_path) = std::env::var("NYANPASU_EGUI_WINDOW_STATE_PATH") {
        let path = PathBuf::from(env_path);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        return Ok(path);
    }
    
    // Fallback to system temp directory
    let mut path = std::env::temp_dir();
    path.push("nyanpasu-egui");
    std::fs::create_dir_all(&path)?;
    path.push("window_state.json");
    Ok(path)
}

// Platform-specific activation policy moved to tauri/src/utils/platform.rs

// pub fn launch_widget<'app, T: Send + Sync + Sized, A: EframeAppCreator<'app, T>>(
//     name: &str,
//     opts: eframe::NativeOptions,
//     creator: A,
// ) -> std::io::Result<Receiver<WidgetEvent<T>>> {
//     let (tx, rx) = mpsc::channel();
// }

#[derive(
    Debug,
    serde::Serialize,
    serde::Deserialize,
    specta::Type,
    Copy,
    Clone,
    PartialEq,
    Eq,
    clap::ValueEnum,
)]
#[serde(rename_all = "snake_case")]
pub enum StatisticWidgetVariant {
    Large,
    Small,
}

impl std::fmt::Display for StatisticWidgetVariant {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StatisticWidgetVariant::Large => write!(f, "large"),
            StatisticWidgetVariant::Small => write!(f, "small"),
        }
    }
}

pub fn start_statistic_widget(size: StatisticWidgetVariant) -> eframe::Result {
    match size {
        StatisticWidgetVariant::Large => NyanpasuNetworkStatisticLargeWidget::run(),
        StatisticWidgetVariant::Small => NyanpasuNetworkStatisticSmallWidget::run(),
    }
}
