/// This module is a tauri event based handler.
/// Some state is good to be managed by the Tauri Manager. we should not hold the singletons in the global state in some cases.
use tauri::{Emitter, Listener, Manager, Runtime};

#[allow(dead_code)]
mod widget;

#[allow(dead_code)]
pub fn mount_handlers<M, R>(_app: &mut M)
where
    M: Manager<R> + Listener<R> + Emitter<R>,
    R: Runtime,
{
}
