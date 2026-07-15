use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;

use keybind_core::model::{migrate, AppConfig};
use keybind_core::StructuredError;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct LocalState {
    #[serde(default)]
    pub applied_hashes: BTreeMap<String, String>,
    #[serde(default)]
    pub last_applied: Option<String>,
    #[serde(default)]
    pub last_error: Option<String>,
}

pub fn config_dir() -> Result<PathBuf, StructuredError> {
    let dir = dirs::config_dir()
        .ok_or_else(|| StructuredError::new("NO_HOME", "cannot resolve config directory"))?
        .join("keybind-manager");
    fs::create_dir_all(&dir)
        .map_err(|e| StructuredError::new("IO", format!("cannot create config dir: {e}")))?;
    Ok(dir)
}

pub fn load_config() -> Result<AppConfig, StructuredError> {
    let path = config_dir()?.join("keybinds.json");
    if !path.exists() {
        return Ok(AppConfig::empty());
    }
    let raw = fs::read_to_string(&path)
        .map_err(|e| StructuredError::new("IO", format!("cannot read config: {e}")))?;
    let value: serde_json::Value = serde_json::from_str(&raw)
        .map_err(|e| StructuredError::new("PARSE", format!("config is not valid JSON: {e}")))?;
    migrate(value).map_err(StructuredError::from)
}

pub fn save_config(config: &AppConfig) -> Result<(), StructuredError> {
    let dir = config_dir()?;
    let path = dir.join("keybinds.json");
    let tmp = dir.join(".keybinds.json.tmp");
    let raw = serde_json::to_string_pretty(config)
        .map_err(|e| StructuredError::new("SERIALIZE", e.to_string()))?;
    fs::write(&tmp, raw)
        .and_then(|_| fs::rename(&tmp, &path))
        .map_err(|e| StructuredError::new("IO", format!("cannot write config: {e}")))
}

pub fn load_state() -> LocalState {
    let Ok(dir) = config_dir() else {
        return LocalState::default();
    };
    fs::read_to_string(dir.join("state.json"))
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

pub fn save_state(state: &LocalState) {
    if let Ok(dir) = config_dir() {
        if let Ok(raw) = serde_json::to_string_pretty(state) {
            let _ = fs::write(dir.join("state.json"), raw);
        }
    }
}
