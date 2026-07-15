use keybind_core::devices::InputDevice;
use keybind_core::distro::{install_guidance, Capabilities, PackageInfo};
use keybind_core::export::Bundle;
use keybind_core::keyd::{generate_all, ManagedFile};
use keybind_core::model::{migrate, AppConfig};
use keybind_core::validation::{validate, CheckResult};
use keybind_core::StructuredError;

use crate::applying::{self, ApplyResult};
use crate::dotfiles;
use crate::store::{self, LocalState};
use crate::system::{self, BackendStatus};

fn checked_config(value: serde_json::Value) -> Result<AppConfig, StructuredError> {
    migrate(value).map_err(StructuredError::from)
}

#[tauri::command]
pub fn get_capabilities() -> Capabilities {
    system::capabilities()
}

#[tauri::command]
pub fn get_backend_status() -> BackendStatus {
    system::keyd_status()
}

#[tauri::command]
pub fn get_devices() -> Vec<InputDevice> {
    system::keyboards()
}

#[tauri::command]
pub fn get_install_guidance() -> Vec<PackageInfo> {
    let caps = system::capabilities();
    install_guidance(&caps.distro, &caps.package_managers)
}

#[tauri::command]
pub fn get_config() -> Result<AppConfig, StructuredError> {
    store::load_config()
}

#[tauri::command]
pub fn put_config(config: serde_json::Value) -> Result<(), StructuredError> {
    store::save_config(&checked_config(config)?)
}

#[tauri::command]
pub fn check_config(config: serde_json::Value) -> Result<CheckResult, StructuredError> {
    Ok(validate(&checked_config(config)?))
}

#[tauri::command]
pub fn preview_config(config: serde_json::Value) -> Result<Vec<ManagedFile>, StructuredError> {
    generate_all(&checked_config(config)?).map_err(StructuredError::from)
}

#[tauri::command]
pub fn apply_config(
    config: serde_json::Value,
    force: bool,
) -> Result<ApplyResult, StructuredError> {
    let config = checked_config(config)?;
    store::save_config(&config)?;
    applying::apply(&config, force)
}

#[tauri::command]
pub fn helper_action(action: String) -> Result<String, StructuredError> {
    applying::helper_action(&action)
}

#[tauri::command]
pub fn get_local_state() -> LocalState {
    store::load_state()
}

#[tauri::command]
pub fn export_profiles(
    config: serde_json::Value,
    profile_id: Option<String>,
    dir: String,
    include_hardware: bool,
) -> Result<String, StructuredError> {
    let config = checked_config(config)?;
    dotfiles::export_to(&config, profile_id.as_deref(), &dir, include_hardware)
}

#[tauri::command]
pub fn import_bundle(path: String) -> Result<Bundle, StructuredError> {
    dotfiles::import_from(&path)
}
