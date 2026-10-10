//! Recoverable snapshots of the application configuration and persistent
//! key/value state. Snapshots are written into a temporary directory and only
//! published after every file and the manifest have been written.

use crate::{
    core::storage::{NYANPASU_TABLE, Storage},
    utils::dirs,
};
use anyhow::{Context, Result, bail};
use redb::{Database, ReadableDatabase, ReadableTable};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{self, Read},
    path::{Component, Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

const BACKUP_FORMAT_VERSION: u32 = 1;
const MANIFEST_FILE: &str = "manifest.json";
const CONFIG_DIR: &str = "config";
const DATA_DIR: &str = "data";
const MIGRATION_PREFIX: &str = "migration-";
const MANUAL_PREFIX: &str = "manual-";
const KEEP_BACKUPS_PER_KIND: usize = 3;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct BackupInfo {
    pub name: String,
    pub kind: String,
    pub created_at: String,
    pub app_version: String,
    pub file_count: usize,
    pub valid: bool,
    pub validation_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Manifest {
    backup_format_version: u32,
    kind: String,
    created_at: String,
    app_version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    from_migration_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    target_migration_version: Option<String>,
    files: Vec<FileEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct FileEntry {
    path: String,
    size: u64,
    sha256: String,
}

#[derive(Debug, Clone)]
pub struct BackupCreated {
    pub name: String,
    pub path: PathBuf,
}

/// Create the automatic snapshot immediately before a migration changes any
/// files. The migration subprocess owns the state directory at this point, so
/// copying `storage.db` is safe here.
pub fn create_migration_backup(
    from_version: Option<&semver::Version>,
    target_version: &semver::Version,
) -> Result<BackupCreated> {
    create_backup(
        MIGRATION_PREFIX,
        "migration",
        from_version.map(ToString::to_string),
        Some(target_version.to_string()),
        None,
    )
}

/// Create a consistent snapshot of live storage using one redb read
/// transaction, then copy the configuration tree.
pub fn create_manual_backup(storage: &Storage) -> Result<BackupInfo> {
    let created = create_backup(MANUAL_PREFIX, "manual", None, None, Some(storage))?;
    verify_backup_path(&created.path)
}

/// Return metadata and validate hashes for every complete backup.
pub fn list_backups() -> Result<Vec<BackupInfo>> {
    let directory = backups_dir()?;
    if !directory.exists() {
        return Ok(Vec::new());
    }

    let mut backups = Vec::new();
    for entry in fs::read_dir(&directory)
        .with_context(|| format!("读取备份目录失败: {}", directory.display()))?
    {
        let entry = entry?;
        if !entry.file_type()?.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        if !(name.starts_with(MANUAL_PREFIX) || name.starts_with(MIGRATION_PREFIX)) {
            continue;
        }
        match verify_backup_path(&entry.path()) {
            Ok(info) => backups.push(info),
            Err(error) => backups.push(BackupInfo {
                name,
                kind: "unknown".into(),
                created_at: String::new(),
                app_version: String::new(),
                file_count: 0,
                valid: false,
                validation_error: Some(format!("{error:#}")),
            }),
        }
    }
    backups.sort_by(|a, b| {
        b.created_at
            .cmp(&a.created_at)
            .then_with(|| b.name.cmp(&a.name))
    });
    Ok(backups)
}

/// Validate a backup by its directory name. Path components are rejected so
/// this API can safely be exposed as an IPC command.
pub fn verify_backup(name: &str) -> Result<BackupInfo> {
    let path = Path::new(name);
    if path
        .components()
        .any(|part| !matches!(part, Component::Normal(_)))
        || path.file_name().and_then(|part| part.to_str()) != Some(name)
        || !(name.starts_with(MANUAL_PREFIX) || name.starts_with(MIGRATION_PREFIX))
    {
        bail!("无效的备份名称");
    }
    verify_backup_path(&backups_dir()?.join(name))
}

pub fn open_backup_directory() -> Result<()> {
    let directory = backups_dir()?;
    fs::create_dir_all(&directory)?;
    crate::utils::open::that(directory).context("打开备份目录失败")
}

fn create_backup(
    prefix: &str,
    kind: &str,
    from_version: Option<String>,
    target_version: Option<String>,
    live_storage: Option<&Storage>,
) -> Result<BackupCreated> {
    let backup_dir = backups_dir()?;
    fs::create_dir_all(&backup_dir)
        .with_context(|| format!("创建备份目录失败: {}", backup_dir.display()))?;
    let stamp = timestamp();
    let mut attempt = 0_u32;
    let (name, partial) = loop {
        let suffix = if attempt == 0 {
            String::new()
        } else {
            format!("-{attempt}")
        };
        let name = format!("{prefix}{stamp}{suffix}");
        if backup_dir.join(&name).exists() {
            attempt = attempt.checked_add(1).context("备份名称空间耗尽")?;
            continue;
        }
        let partial = backup_dir.join(format!(".{name}.partial"));
        match fs::create_dir(&partial) {
            Ok(()) => break (name, partial),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {
                attempt = attempt.checked_add(1).context("备份名称空间耗尽")?;
            }
            Err(error) => {
                return Err(error)
                    .with_context(|| format!("创建临时备份失败: {}", partial.display()));
            }
        }
    };

    let target = backup_dir.join(&name);
    let result = (|| -> Result<()> {
        let mut files = Vec::new();
        let config_root = dirs::app_config_dir()?;
        let data_root = dirs::app_data_dir()?;
        let excluded = [
            backup_dir.clone(),
            dirs::storage_path()?,
            data_root.join("logs"),
            data_root.join("cache"),
            data_root.join("scripts"),
            data_root.join("clash.pid"),
        ];
        copy_tree(
            &config_root,
            &partial.join(CONFIG_DIR),
            &partial,
            &excluded,
            &mut files,
        )?;
        verify_copied_files(&files, &config_root, &partial.join(CONFIG_DIR))?;

        let storage_path = data_root.join("storage.db");
        if let Some(storage) = live_storage {
            let data_root = partial.join(DATA_DIR);
            fs::create_dir_all(&data_root)?;
            let target_path = data_root.join("storage.db");
            export_storage(storage, &target_path)?;
            files.push(file_entry(&target_path, &partial)?);
        } else if storage_path.is_file() {
            let target_path = partial.join(DATA_DIR).join("storage.db");
            fs::create_dir_all(target_path.parent().unwrap())?;
            fs::copy(&storage_path, &target_path)
                .with_context(|| format!("复制持久化数据失败: {}", storage_path.display()))?;
            files.push(file_entry(&target_path, &partial)?);
        }

        files.sort_by(|a, b| a.path.cmp(&b.path));
        let manifest = Manifest {
            backup_format_version: BACKUP_FORMAT_VERSION,
            kind: kind.to_owned(),
            created_at: chrono::Utc::now().to_rfc3339(),
            app_version: crate::consts::BUILD_INFO.pkg_version.to_owned(),
            from_migration_version: from_version,
            target_migration_version: target_version,
            files,
        };
        let manifest_path = partial.join(MANIFEST_FILE);
        fs::write(&manifest_path, serde_json::to_vec_pretty(&manifest)?)
            .with_context(|| format!("写入备份清单失败: {}", manifest_path.display()))?;
        sync_tree(&partial)?;
        fs::rename(&partial, &target)
            .with_context(|| format!("发布备份失败: {}", target.display()))?;
        verify_backup_path(&target)?;
        if let Err(error) = prune_backups(&backup_dir, prefix) {
            log::warn!(target: "app", "failed to prune old backups: {error:#}");
        }
        Ok(())
    })();

    if let Err(error) = result {
        let _ = fs::remove_dir_all(&partial);
        return Err(error);
    }
    Ok(BackupCreated { name, path: target })
}

fn copy_tree(
    source: &Path,
    destination: &Path,
    backup_root: &Path,
    excluded: &[PathBuf],
    files: &mut Vec<FileEntry>,
) -> Result<()> {
    fs::create_dir_all(destination)
        .with_context(|| format!("创建目录失败: {}", destination.display()))?;
    let mut source_entries = fs::read_dir(source)
        .with_context(|| format!("读取配置目录失败: {}", source.display()))?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    source_entries.sort_by_key(|entry| entry.file_name());
    let original_names = source_entries
        .iter()
        .map(|entry| entry.file_name())
        .collect::<Vec<_>>();
    for entry in source_entries {
        let path = entry.path();
        if excluded.iter().any(|excluded_path| excluded_path == &path) {
            continue;
        }
        let file_name = entry.file_name();
        let target = destination.join(&file_name);
        let file_type = entry.file_type()?;
        if file_type.is_symlink() {
            // A symlink can escape the managed config tree and cannot be
            // restored portably. Fail closed instead of claiming completeness.
            bail!("配置目录含有无法安全打包的符号链接: {}", path.display());
        }
        if file_type.is_dir() {
            copy_tree(&path, &target, backup_root, excluded, files)?;
        } else if file_type.is_file() {
            copy_stable_file(&path, &target)?;
            files.push(file_entry(&target, backup_root)?);
        } else {
            bail!("配置目录含有不支持备份的文件类型: {}", path.display());
        }
    }
    let mut final_names = fs::read_dir(source)
        .with_context(|| format!("重新读取配置目录失败: {}", source.display()))?
        .map(|entry| entry.map(|entry| entry.file_name()))
        .collect::<std::result::Result<Vec<_>, _>>()?;
    final_names.sort();
    if original_names != final_names {
        bail!(
            "配置备份期间目录内容正在变化，请稍后重试: {}",
            source.display()
        );
    }
    Ok(())
}

fn copy_stable_file(source: &Path, destination: &Path) -> Result<()> {
    let before = fs::metadata(source)
        .with_context(|| format!("读取配置元数据失败: {}", source.display()))?;
    fs::copy(source, destination).with_context(|| format!("复制配置失败: {}", source.display()))?;
    let after = fs::metadata(source)
        .with_context(|| format!("重新读取配置元数据失败: {}", source.display()))?;
    if before.len() != after.len() || before.modified().ok() != after.modified().ok() {
        let _ = fs::remove_file(destination);
        bail!("配置备份期间文件正在变化，请稍后重试: {}", source.display());
    }
    Ok(())
}

fn verify_copied_files(
    files: &[FileEntry],
    source_root: &Path,
    snapshot_root: &Path,
) -> Result<()> {
    for entry in files {
        if !entry.path.starts_with("config/") {
            continue;
        }
        let relative = Path::new(&entry.path).strip_prefix(CONFIG_DIR)?;
        let source = source_root.join(relative);
        let snapshot = snapshot_root.join(relative);
        let source_entry = file_entry(&source, source_root)?;
        let snapshot_entry = file_entry(&snapshot, snapshot_root)?;
        if source_entry.size != entry.size
            || source_entry.sha256 != entry.sha256
            || snapshot_entry.sha256 != entry.sha256
        {
            bail!("配置在备份期间发生变化，请稍后重试: {}", entry.path);
        }
    }
    Ok(())
}

fn export_storage(storage: &Storage, destination: &Path) -> Result<()> {
    let snapshot = Database::create(destination).context("创建 storage 快照文件失败")?;
    let source_txn = storage
        .get_instance()
        .begin_read()
        .context("读取 storage 快照失败")?;
    let source_table = source_txn
        .open_table(NYANPASU_TABLE)
        .context("打开 storage 表失败")?;
    let target_txn = snapshot.begin_write().context("写入 storage 快照失败")?;
    {
        let mut target_table = target_txn
            .open_table(NYANPASU_TABLE)
            .context("创建 storage 快照表失败")?;
        for row in source_table.iter().context("遍历 storage 快照失败")? {
            let (key, value) = row.context("读取 storage 快照记录失败")?;
            target_table
                .insert(key.value(), value.value())
                .context("复制 storage 快照记录失败")?;
        }
    }
    target_txn.commit().context("提交 storage 快照失败")?;
    drop(source_txn);
    drop(snapshot);
    Ok(())
}

fn file_entry(path: &Path, root: &Path) -> Result<FileEntry> {
    let relative = path.strip_prefix(root)?;
    let mut file = fs::File::open(path)?;
    let mut digest = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    let mut size = 0_u64;
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        digest.update(&buffer[..read]);
        size += read as u64;
    }
    Ok(FileEntry {
        path: relative.to_string_lossy().replace('\\', "/"),
        size,
        sha256: format!("{:x}", digest.finalize()),
    })
}

fn verify_backup_path(path: &Path) -> Result<BackupInfo> {
    let manifest_path = path.join(MANIFEST_FILE);
    if !fs::symlink_metadata(&manifest_path)?.is_file() {
        bail!("备份清单必须是普通文件");
    }
    let manifest: Manifest = serde_json::from_slice(
        &fs::read(&manifest_path)
            .with_context(|| format!("备份清单不存在或不可读: {}", manifest_path.display()))?,
    )
    .context("备份清单格式无效")?;
    if manifest.backup_format_version != BACKUP_FORMAT_VERSION {
        bail!(
            "备份格式版本 {} 不受当前版本支持（当前支持 {}）",
            manifest.backup_format_version,
            BACKUP_FORMAT_VERSION
        );
    }
    let backup_app_version =
        semver::Version::parse(&manifest.app_version).context("备份记录的应用版本无效")?;
    let current_app_version = semver::Version::parse(crate::consts::BUILD_INFO.pkg_version)?;
    if backup_app_version > current_app_version {
        bail!(
            "备份来自较新版本 {}，当前版本 {} 无法确认其配置兼容性",
            backup_app_version,
            current_app_version
        );
    }
    if !matches!(manifest.kind.as_str(), "manual" | "migration") {
        bail!("备份类型无效: {}", manifest.kind);
    }
    let mut actual_files = Vec::new();
    collect_backup_files(path, path, &mut actual_files)?;
    actual_files.sort();
    let mut seen = std::collections::HashSet::new();
    for entry in &manifest.files {
        let relative = Path::new(&entry.path);
        if relative.is_absolute()
            || relative
                .components()
                .any(|part| !matches!(part, Component::Normal(_)))
            || !matches!(relative.components().next(), Some(Component::Normal(root)) if root == CONFIG_DIR || root == DATA_DIR)
            || entry.path == MANIFEST_FILE
            || !seen.insert(entry.path.clone())
        {
            bail!("备份文件清单含有无效或重复路径: {}", entry.path);
        }
        let file_path = path.join(relative);
        let metadata = fs::symlink_metadata(&file_path)
            .with_context(|| format!("备份文件缺失: {}", entry.path))?;
        if !metadata.is_file() || metadata.len() != entry.size {
            bail!("备份文件类型或大小不匹配: {}", entry.path);
        }
        let actual = file_entry(&file_path, path)?;
        if actual.sha256 != entry.sha256 {
            bail!("备份文件校验失败: {}", entry.path);
        }
    }
    let mut manifest_files = seen.into_iter().collect::<Vec<_>>();
    manifest_files.sort();
    if actual_files != manifest_files {
        bail!("备份内容与清单不一致");
    }
    let name = path
        .file_name()
        .and_then(|v| v.to_str())
        .unwrap_or_default()
        .to_owned();
    Ok(BackupInfo {
        name,
        kind: manifest.kind,
        created_at: manifest.created_at,
        app_version: manifest.app_version,
        file_count: manifest.files.len(),
        valid: true,
        validation_error: None,
    })
}

fn collect_backup_files(root: &Path, current: &Path, files: &mut Vec<String>) -> Result<()> {
    for entry in fs::read_dir(current)? {
        let entry = entry?;
        let path = entry.path();
        let file_type = entry.file_type()?;
        if file_type.is_symlink() {
            bail!("备份目录中包含符号链接: {}", path.display());
        }
        if file_type.is_dir() {
            collect_backup_files(root, &path, files)?;
        } else if file_type.is_file() && path != root.join(MANIFEST_FILE) {
            files.push(
                path.strip_prefix(root)?
                    .to_string_lossy()
                    .replace('\\', "/"),
            );
        }
    }
    Ok(())
}

fn prune_backups(directory: &Path, prefix: &str) -> Result<()> {
    let mut valid = Vec::new();
    for entry in fs::read_dir(directory)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if !name.starts_with(prefix) || !entry.file_type()?.is_dir() {
            continue;
        }
        if let Ok(info) = verify_backup_path(&entry.path()) {
            valid.push((info.created_at, entry.path()));
        }
    }
    valid.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| b.1.cmp(&a.1)));
    for (_, path) in valid.into_iter().skip(KEEP_BACKUPS_PER_KIND) {
        fs::remove_dir_all(&path)
            .with_context(|| format!("删除过期备份失败: {}", path.display()))?;
    }
    Ok(())
}

fn backups_dir() -> Result<PathBuf> {
    Ok(dirs::app_data_dir()?.join("backups"))
}

fn timestamp() -> String {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    chrono::DateTime::<chrono::Utc>::from_timestamp(seconds as i64, 0)
        .unwrap_or_else(chrono::Utc::now)
        .format("%Y%m%dT%H%M%SZ")
        .to_string()
}

fn sync_tree(path: &Path) -> Result<()> {
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        if entry.file_type()?.is_dir() {
            sync_tree(&entry.path())?;
        } else if entry.file_type()?.is_file() {
            fs::OpenOptions::new()
                .write(true)
                .open(entry.path())?
                .sync_all()?;
        }
    }
    #[cfg(unix)]
    fs::File::open(path)?.sync_all()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::storage::WebStorage;

    #[test]
    fn live_storage_snapshot_is_a_consistent_redb_database() {
        let temp = tempfile::tempdir().unwrap();
        let source = Storage::try_new(&temp.path().join("source.db")).unwrap();
        source.set_item("first", &1_u32).unwrap();
        source.set_item("second", &"two").unwrap();
        let destination = temp.path().join("snapshot.db");

        export_storage(&source, &destination).unwrap();

        let snapshot = Storage::try_new(&destination).unwrap();
        assert_eq!(snapshot.get_item::<u32>("first").unwrap(), Some(1));
        assert_eq!(
            snapshot.get_item::<String>("second").unwrap(),
            Some("two".into())
        );
        source.set_item("later", &true).unwrap();
        assert_eq!(snapshot.get_item::<bool>("later").unwrap(), None);
    }

    #[test]
    fn backup_validation_checks_manifest_version_and_file_hashes() {
        let temp = tempfile::tempdir().unwrap();
        let backup = temp.path().join("manual-sample");
        let config_file = backup.join(CONFIG_DIR).join("nyanpasu.yaml");
        fs::create_dir_all(config_file.parent().unwrap()).unwrap();
        fs::write(&config_file, "theme: dark\n").unwrap();
        let manifest = Manifest {
            backup_format_version: BACKUP_FORMAT_VERSION,
            kind: "manual".into(),
            created_at: "2026-10-11T00:00:00Z".into(),
            app_version: "3.0.4".into(),
            from_migration_version: None,
            target_migration_version: None,
            files: vec![file_entry(&config_file, &backup).unwrap()],
        };
        fs::write(
            backup.join(MANIFEST_FILE),
            serde_json::to_vec(&manifest).unwrap(),
        )
        .unwrap();

        assert!(verify_backup_path(&backup).unwrap().valid);
        fs::write(&config_file, "theme: light\n").unwrap();
        assert!(verify_backup_path(&backup).is_err());
        fs::write(&config_file, "theme: dark\n").unwrap();

        let newer = Manifest {
            app_version: "99.0.0".into(),
            ..manifest.clone()
        };
        fs::write(
            backup.join(MANIFEST_FILE),
            serde_json::to_vec(&newer).unwrap(),
        )
        .unwrap();
        assert!(
            verify_backup_path(&backup)
                .unwrap_err()
                .to_string()
                .contains("较新版本")
        );

        let unsupported = Manifest {
            backup_format_version: BACKUP_FORMAT_VERSION + 1,
            files: vec![],
            ..manifest
        };
        fs::write(
            backup.join(MANIFEST_FILE),
            serde_json::to_vec(&unsupported).unwrap(),
        )
        .unwrap();
        assert!(
            verify_backup_path(&backup)
                .unwrap_err()
                .to_string()
                .contains("备份格式版本")
        );
    }
}
