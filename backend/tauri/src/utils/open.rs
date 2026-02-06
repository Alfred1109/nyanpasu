use std::ffi::OsStr;

pub fn that<T: AsRef<OsStr>>(path: T) -> std::io::Result<()> {
    open::that(path)
}

#[cfg(not(windows))]
pub fn with<P: AsRef<OsStr>, S: Into<String>>(path: P, app: S) -> std::io::Result<()> {
    open::with(path, app)
}
