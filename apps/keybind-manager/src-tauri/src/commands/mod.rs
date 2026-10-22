use keybind_core::devices::InputDevice;
use keybind_core::distro::{install_guidance, Capabilities, PackageInfo};
use keybind_core::export::Bundle;
use keybind_core::keyd::{generate_all, KeyboardConflict, ManagedFile, ScannedConfig};
use keybind_core::model::{migrate, AppConfig, Profile};
use keybind_core::validation::{validate, CheckResult};
use keybind_core::StructuredError;

use crate::applying::{self, ApplyResult};
use crate::dotfiles;
use crate::launchers::{self, DesktopApp};
use crate::notify;
use crate::store::{self, LocalState};
use crate::system::{self, BackendStatus};
use crate::via::{self, ViaKeyboard};

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
    system::input_devices()
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
    let outcome = applying::apply(&config, force);
    notify::apply_outcome(&outcome);
    outcome
}

#[tauri::command]
pub fn helper_action(action: String) -> Result<String, StructuredError> {
    let outcome = applying::helper_action(&action);
    notify::helper_outcome(&action, &outcome);
    outcome
}

#[tauri::command]
pub fn scan_keyd_configs() -> Result<Vec<ScannedConfig>, StructuredError> {
    applying::scan()
}

#[tauri::command]
pub fn get_keyboard_conflicts() -> Result<Vec<KeyboardConflict>, StructuredError> {
    applying::keyboard_conflicts(&system::keyboards())
}

#[tauri::command]
pub fn get_keyboard_ownership(
    config: serde_json::Value,
) -> Result<Vec<KeyboardConflict>, StructuredError> {
    applying::keyboard_ownership(&checked_config(config)?, &system::keyboards())
}

#[tauri::command]
pub fn import_keyd_config(filename: String) -> Result<Profile, StructuredError> {
    applying::import_foreign(&filename)
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

#[tauri::command]
pub fn get_session_user() -> Option<String> {
    launchers::session_user()
}

#[tauri::command]
pub fn get_desktop_apps() -> Vec<DesktopApp> {
    launchers::desktop_apps()
}

#[tauri::command]
pub fn via_detect(vendor: String, product: String) -> Result<ViaKeyboard, StructuredError> {
    via::detect(&vendor, &product)
}

#[tauri::command]
pub fn via_read_keymap(
    vendor: String,
    product: String,
    layers: u8,
    rows: u8,
    cols: u8,
) -> Result<Vec<u16>, StructuredError> {
    via::read_keymap(&vendor, &product, layers, rows, cols)
}

#[tauri::command]
pub fn via_set_keycode(
    vendor: String,
    product: String,
    layer: u8,
    row: u8,
    col: u8,
    keycode: u16,
) -> Result<(), StructuredError> {
    via::set_keycode(&vendor, &product, layer, row, col, keycode)
}

#[tauri::command]
pub fn via_get_layout_options(vendor: String, product: String) -> Result<u32, StructuredError> {
    via::get_layout_options(&vendor, &product)
}

#[tauri::command]
pub fn via_set_layout_options(vendor: String, product: String, options: u32) -> Result<(), StructuredError> {
    via::set_layout_options(&vendor, &product, options)
}

#[tauri::command]
pub fn via_save_layout(path: String, contents: String) -> Result<(), StructuredError> {
    via::write_file(&path, &contents)
}
