use serde::{Deserialize, Serialize};

use crate::error::CoreError;

pub const SCHEMA_VERSION: u32 = 1;
pub const MANAGED_PREFIX: &str = "keybind-manager";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AppConfig {
    pub version: u32,
    pub active: String,
    pub profiles: Vec<Profile>,
    #[serde(default)]
    pub settings: Settings,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    #[serde(default)]
    pub devices: Vec<DeviceRef>,
    #[serde(default)]
    pub mappings: Vec<Mapping>,
    #[serde(default)]
    pub layers: Vec<Layer>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub preserved: Vec<PreservedEntry>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DeviceRef {
    pub vendor: String,
    pub product: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Mapping {
    pub id: String,
    pub source: KeyInput,
    pub target: KeyAction,
    pub enabled: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct KeyInput {
    pub key: String,
    #[serde(default)]
    pub mods: Vec<String>,
    #[serde(default)]
    pub mode: InputMode,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InputMode {
    #[default]
    Press,
    Tap,
    Hold,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct KeyAction {
    pub kind: ActionKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub key: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub mods: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub layer: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub macro_text: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ActionKind {
    Key,
    Combo,
    Layer,
    Disable,
    Macro,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Layer {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub mappings: Vec<Mapping>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PreservedEntry {
    pub section: String,
    pub raw: String,
}

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
pub struct Settings {
    #[serde(default)]
    pub confirm_dangerous: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dotfiles_dir: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub export_hardware_ids: Option<bool>,
}

impl AppConfig {
    pub fn empty() -> Self {
        let profile = Profile {
            id: "default".into(),
            name: "Default".into(),
            enabled: true,
            devices: Vec::new(),
            mappings: Vec::new(),
            layers: Vec::new(),
            preserved: Vec::new(),
        };
        AppConfig {
            version: SCHEMA_VERSION,
            active: "default".into(),
            profiles: vec![profile],
            settings: Settings::default(),
        }
    }

    pub fn profile(&self, id: &str) -> Option<&Profile> {
        self.profiles.iter().find(|p| p.id == id)
    }
}

pub fn migrate(value: serde_json::Value) -> Result<AppConfig, CoreError> {
    let version = value
        .get("version")
        .and_then(|v| v.as_u64())
        .ok_or_else(|| CoreError::Schema("missing schema version".into()))?;
    if version > SCHEMA_VERSION as u64 {
        return Err(CoreError::Schema(format!(
            "config schema version {version} is newer than supported version {SCHEMA_VERSION}"
        )));
    }
    let migrated = value;
    serde_json::from_value(migrated).map_err(|e| CoreError::Schema(e.to_string()))
}

pub fn slug(input: &str) -> String {
    let mut out = String::new();
    for ch in input.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
        } else if (ch == '-' || ch == '_' || ch == ' ') && !out.ends_with('-') {
            out.push('-');
        }
    }
    let trimmed = out.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "profile".into()
    } else {
        trimmed.chars().take(32).collect()
    }
}

pub fn managed_filename(profile: &Profile) -> String {
    format!("{MANAGED_PREFIX}-{}.conf", slug(&profile.id))
}

pub fn is_managed_filename(name: &str) -> bool {
    name.starts_with(MANAGED_PREFIX)
        && name.ends_with(".conf")
        && !name.contains('/')
        && !name.contains("..")
        && name.len() <= 96
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_newer_schema() {
        let value = serde_json::json!({ "version": 999, "active": "x", "profiles": [] });
        assert!(migrate(value).is_err());
    }

    #[test]
    fn migrates_current_schema() {
        let config = AppConfig::empty();
        let value = serde_json::to_value(&config).unwrap();
        assert_eq!(migrate(value).unwrap(), config);
    }

    #[test]
    fn slug_sanitizes() {
        assert_eq!(slug("My Laptop! Keyboard"), "my-laptop-keyboard");
        assert_eq!(slug("---"), "profile");
    }

    #[test]
    fn managed_filename_is_valid() {
        let mut profile = AppConfig::empty().profiles[0].clone();
        profile.id = "Weird/../Name".into();
        assert!(is_managed_filename(&managed_filename(&profile)));
    }
}
