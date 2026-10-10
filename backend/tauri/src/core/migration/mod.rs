#![allow(dead_code)]
/// A migration mod indicates the migration of the old version to the new version.
/// Because this runner run at the start of the app, it will use eprintln or println to print the migration log.
///
///
use dyn_clone::{DynClone, clone_trait_object};
use semver::Version;
use std::{
    borrow::Cow,
    cell::{Cell, RefCell},
};

mod db;
pub mod units;

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MigrationState {
    /// The migration is pending.
    NotStarted,
    /// The migration is in progress.
    InProgress,
    /// The migration is completed.
    Completed,
    /// The migration is failed.
    Failed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MigrationAdvice {
    /// The migration is required to run.
    Pending,
    /// The migration is ignored.
    Ignored,
    /// The migration has been run.
    Done,
}

impl std::fmt::Display for MigrationAdvice {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MigrationAdvice::Pending => write!(f, "Pending"),
            MigrationAdvice::Ignored => write!(f, "Ignored"),
            MigrationAdvice::Done => write!(f, "Done"),
        }
    }
}

#[derive(Debug, Clone)]
pub enum Unit<'a, T>
where
    T: Clone + Migration<'a> + Send + Sync,
{
    /// A List of migrations, it should be used to wrap a list of migrations in a single version.
    /// Although the fn signature is T generic, it should use a Vec<DynMigration> as the input.
    Batch(Cow<'a, [T]>),
    Single(Cow<'a, T>),
}

impl<'a, T> From<T> for Unit<'a, T>
where
    T: Clone + Migration<'a> + Send + Sync,
{
    fn from(item: T) -> Self {
        Unit::Single(Cow::Owned(item))
    }
}

impl<'a, T> From<&'a T> for Unit<'a, T>
where
    T: Clone + Migration<'a> + Send + Sync,
{
    fn from(item: &'a T) -> Self {
        Unit::Single(Cow::Borrowed(item))
    }
}

impl<'a, T> From<&'a [T]> for Unit<'a, T>
where
    T: Clone + Migration<'a> + Send + Sync,
{
    fn from(list: &'a [T]) -> Self {
        Unit::Batch(Cow::Borrowed(list))
    }
}

impl<'a, T> From<Vec<T>> for Unit<'a, T>
where
    T: Clone + Migration<'a> + Send + Sync,
{
    fn from(list: Vec<T>) -> Self {
        Unit::Batch(Cow::Owned(list))
    }
}

type DynMigration<'a> = Box<dyn Migration<'a> + Send + Sync + 'a>;

pub trait Migration<'a>: DynClone {
    /// A version field to indicate the version of the migration.
    /// It used to compare with the current version to determine whether the migration is needed.
    fn version(&self) -> &'a Version;

    /// A name field to indicate the name of the migration.
    fn name(&self) -> Cow<'a, str>;

    fn migrate(&self) -> std::io::Result<()> {
        unimplemented!()
    }

    fn discard(&self) -> std::io::Result<()> {
        Ok(())
    }
}

clone_trait_object!(Migration<'_>);

pub trait MigrationExt<'a>: Migration<'a>
where
    Self: Sized + 'static + Send + Sync,
{
    fn boxed(self) -> DynMigration<'a> {
        Box::new(self) as DynMigration
    }
}

impl<'a, T> MigrationExt<'a> for T where T: Sized + 'static + Migration<'a> + Send + Sync {}

impl<'a, T> Migration<'a> for Unit<'a, T>
where
    T: Clone + Migration<'a> + Send + Sync,
{
    fn version(&self) -> &'a Version {
        match self {
            Unit::Single(item) => item.version(),
            Unit::Batch(list) => list.first().unwrap().version(),
        }
    }

    fn name(&self) -> Cow<'a, str> {
        match self {
            Unit::Single(item) => item.name(),
            Unit::Batch(list) => Cow::Owned(format!(
                "{} migrations for v{}",
                list.len(),
                list.first().unwrap().version()
            )),
        }
    }

    fn migrate(&self) -> std::io::Result<()> {
        unimplemented!("Batch migrations should be handled by the runner.")
    }
}

impl<'a> Migration<'a> for DynMigration<'a> {
    fn version(&self) -> &'a Version {
        self.as_ref().version()
    }

    fn name(&self) -> Cow<'a, str> {
        self.as_ref().name()
    }

    fn migrate(&self) -> std::io::Result<()> {
        self.as_ref().migrate()
    }
}

#[derive(Debug)]
pub struct Runner<'a> {
    pub current_version: Cow<'a, Version>,
    skip_advice: bool,
    store: RefCell<db::MigrationFile<'a>>,
    migration_backup_created: Cell<bool>,
}

pub struct DropGuard<'a>(Runner<'a>);

fn validated_migration_file(
    current_version: &Version,
) -> anyhow::Result<db::MigrationFile<'static>> {
    let file = db::read_validated_file()?;
    ensure_version_not_future(file.version.as_ref(), current_version)?;
    Ok(file)
}

fn ensure_version_not_future(
    stored_version: &Version,
    current_version: &Version,
) -> anyhow::Result<()> {
    if stored_version > current_version {
        anyhow::bail!(
            "migration.lock records version {}, newer than this application ({}); refusing to run migrations",
            stored_version,
            current_version
        );
    }
    Ok(())
}

fn run_and_advance_version(
    store: &RefCell<db::MigrationFile<'_>>,
    target_version: &Version,
    run: impl FnOnce() -> std::io::Result<()>,
    persist: impl FnOnce(&db::MigrationFile<'_>) -> std::io::Result<()>,
) -> std::io::Result<()> {
    run()?;
    let mut updated = store.borrow().clone();
    updated.version = Cow::Owned(target_version.clone());
    persist(&updated)?;
    store.borrow_mut().version = updated.version;
    Ok(())
}

/// Fail startup before spawning the migration subprocess if the lock file is
/// malformed or records a state newer than this build understands.
pub fn validate_migration_lock() -> anyhow::Result<()> {
    let current_version = Version::parse(crate::consts::BUILD_INFO.pkg_version)?;
    validated_migration_file(&current_version).map(|_| ())
}

impl<'a> std::ops::Deref for DropGuard<'a> {
    type Target = Runner<'a>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl<'a> std::ops::DerefMut for DropGuard<'a> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

impl Default for Runner<'_> {
    fn default() -> Self {
        let ver = Version::parse(crate::consts::BUILD_INFO.pkg_version).unwrap();
        let file = validated_migration_file(&ver)
            .unwrap_or_else(|error| panic!("migration preflight failed: {error:#}"));
        Self {
            current_version: Cow::Owned(ver),
            skip_advice: false,
            store: RefCell::new(file),
            migration_backup_created: Cell::new(false),
        }
    }
}

impl Drop for DropGuard<'_> {
    fn drop(&mut self) {
        if let Err(error) = self.0.store.borrow().write_file() {
            log::error!(target: "app", "failed to persist migration state: {error}");
        }
    }
}

impl Runner<'_> {
    pub fn new_with_skip_advice() -> Self {
        let ver = Version::parse(crate::consts::BUILD_INFO.pkg_version).unwrap();
        let file = validated_migration_file(&ver)
            .unwrap_or_else(|error| panic!("migration preflight failed: {error:#}"));
        Self {
            skip_advice: true,
            current_version: Cow::Owned(ver),
            store: RefCell::new(file),
            migration_backup_created: Cell::new(false),
        }
    }

    pub fn advice_migration<'a, T>(&self, migration: &T) -> MigrationAdvice
    where
        T: Clone + Migration<'a> + Send + Sync,
    {
        let migration_ver = migration.version();
        let store = self.store.borrow();
        if migration_ver >= &store.version {
            // Judge the migration is run or not.
            if let Some(state) = store.states.get(&migration.name()) {
                match state {
                    MigrationState::Completed => MigrationAdvice::Done,
                    MigrationState::NotStarted
                    | MigrationState::InProgress
                    | MigrationState::Failed => MigrationAdvice::Pending,
                }
            } else {
                MigrationAdvice::Pending
            }
        } else {
            MigrationAdvice::Ignored
        }
    }

    pub fn advice_unit<'a, T>(&self, unit: &Unit<'a, T>) -> MigrationAdvice
    where
        T: Clone + Migration<'a> + Send + Sync,
    {
        match unit {
            Unit::Single(item) => self.advice_migration(item.as_ref()),
            Unit::Batch(list) => {
                let mut advice = MigrationAdvice::Ignored;
                for item in list.iter() {
                    let item_advice = self.advice_migration(item);
                    if item_advice == MigrationAdvice::Pending {
                        advice = MigrationAdvice::Pending;
                        break;
                    } else if item_advice == MigrationAdvice::Done {
                        advice = MigrationAdvice::Done;
                    }
                }
                advice
            }
        }
    }

    pub fn run_migration<'a, T>(&self, migration: &T) -> std::io::Result<()>
    where
        T: Clone + Migration<'a> + Send + Sync,
    {
        println!("Running migration: {}", migration.name());
        let advice = self.advice_migration(migration);
        println!("Advice: {advice:?}");
        if matches!(advice, MigrationAdvice::Ignored | MigrationAdvice::Done) {
            return Ok(());
        }
        if !self.migration_backup_created.get() {
            let from_version = self.store.borrow().version.clone();
            crate::core::backup::create_migration_backup(
                Some(&from_version),
                self.current_version.as_ref(),
            )
            .map_err(std::io::Error::other)?;
            self.migration_backup_created.set(true);
        }
        let name = migration.name();
        let mut store = self.store.borrow_mut();
        store.set_state(Cow::Owned(name.to_string()), MigrationState::InProgress);
        store.write_file()?;
        let migration_result = match migration.migrate() {
            Ok(_) => {
                println!("Migration {name} completed.");
                store.set_state(Cow::Owned(name.to_string()), MigrationState::Completed);
                Ok(())
            }
            Err(e) => {
                eprintln!("Migration {name} failed: {e}; trying to discard changes");
                match migration.discard() {
                    Ok(_) => {
                        eprintln!("Migration {name} discarded.");
                    }
                    Err(e) => {
                        eprintln!("Migration {name} discard failed: {e}");
                    }
                }
                store.set_state(Cow::Owned(name.to_string()), MigrationState::Failed);
                Err(e)
            }
        };
        let persist_result = store.write_file();
        match (migration_result, persist_result) {
            (Ok(()), Ok(())) => Ok(()),
            (Err(migration_error), Ok(())) => Err(migration_error),
            (Ok(()), Err(persist_error)) => Err(persist_error),
            (Err(migration_error), Err(persist_error)) => Err(std::io::Error::other(format!(
                "migration failed: {migration_error}; failed to persist migration state: {persist_error}"
            ))),
        }
    }

    pub fn run_unit<'a, T>(&self, unit: &Unit<'a, T>) -> std::io::Result<()>
    where
        T: Clone + Migration<'a> + Send + Sync,
    {
        println!("Running unit: {}", unit.name());
        match unit {
            Unit::Single(item) => self.run_migration(item.as_ref()),
            Unit::Batch(list) => {
                for item in list.iter() {
                    self.run_migration(item)?;
                }
                Ok(())
            }
        }
    }

    pub fn run_units_up_to_version(&self, to_ver: &Version) -> std::io::Result<()> {
        println!("Running units up to version: {to_ver}");
        let version = {
            let store = self.store.borrow();
            store.version.clone()
        };
        if to_ver > self.current_version.as_ref() {
            return Err(std::io::Error::other(format!(
                "migration target {to_ver} is newer than this application ({})",
                self.current_version
            )));
        }
        run_and_advance_version(
            &self.store,
            to_ver,
            || {
                let units = units::UNITS
                    .iter()
                    .filter(|(ver, _)| **ver >= &version && **ver <= to_ver);
                for (_, unit) in units {
                    self.run_unit(unit)?;
                }
                Ok(())
            },
            |file| file.write_file(),
        )
    }

    pub fn run_upcoming_units(&self) -> std::io::Result<()> {
        println!(
            "Running all upcoming units. It is supposed to run in Nightly build. If you see this message in Stable channel, report it in Github Issues Tracker please."
        );
        let version = {
            let store = self.store.borrow();
            store.version.clone()
        };
        let units = units::UNITS.iter().filter(|(ver, _)| **ver >= &version);

        run_and_advance_version(
            &self.store,
            self.current_version.as_ref(),
            || {
                for (_, unit) in units {
                    self.run_unit(unit)?;
                }
                Ok(())
            },
            |file| file.write_file(),
        )
    }
}

impl<'a> Runner<'a> {
    pub fn drop_guard(self) -> DropGuard<'a> {
        DropGuard(self)
    }
}

#[cfg(test)]
mod compatibility_tests {
    use super::{ensure_version_not_future, run_and_advance_version};
    use crate::core::migration::db::MigrationFile;
    use semver::Version;
    use std::{cell::RefCell, io};

    #[test]
    fn migration_lock_version_must_not_be_newer_than_the_application() {
        let app = Version::parse("3.0.4").unwrap();
        let old = Version::parse("2.0.0").unwrap();
        let same = Version::parse("3.0.4").unwrap();
        let newer = Version::parse("3.1.0").unwrap();
        assert!(ensure_version_not_future(&old, &app).is_ok());
        assert!(ensure_version_not_future(&same, &app).is_ok());
        assert!(ensure_version_not_future(&newer, &app).is_err());
    }

    #[test]
    fn migration_version_advances_only_after_the_whole_run_succeeds() {
        let original = Version::parse("1.5.1").unwrap();
        let target = Version::parse("3.0.4").unwrap();
        let store = RefCell::new(MigrationFile::default());
        let temp = tempfile::tempdir().unwrap();
        let lock_path = temp.path().join("migration.lock");

        let failed = run_and_advance_version(
            &store,
            &target,
            || Err(io::Error::other("backup or migration failed")),
            |candidate| MigrationFile::write_file_to(&lock_path, candidate),
        );
        assert!(failed.is_err());
        assert_eq!(store.borrow().version.as_ref(), &original);
        assert!(!lock_path.exists());

        run_and_advance_version(
            &store,
            &target,
            || Ok(()),
            |candidate| MigrationFile::write_file_to(&lock_path, candidate),
        )
        .unwrap();
        assert_eq!(store.borrow().version.as_ref(), &target);
        let persisted: MigrationFile<'_> =
            serde_yaml::from_slice(&std::fs::read(lock_path).unwrap()).unwrap();
        assert_eq!(persisted.version.as_ref(), &target);
    }
}
