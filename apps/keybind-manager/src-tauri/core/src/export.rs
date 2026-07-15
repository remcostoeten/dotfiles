use serde::{Deserialize, Serialize};

use crate::error::CoreError;
use crate::model::{AppConfig, Profile, Settings, SCHEMA_VERSION};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bundle {
    pub schema: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub settings: Option<Settings>,
    pub profiles: Vec<Profile>,
}

pub fn export_profiles(profiles: &[Profile], include_hardware: bool) -> Result<String, CoreError> {
    let profiles: Vec<Profile> = profiles
        .iter()
        .map(|p| strip_hardware(p, include_hardware))
        .collect();
    let bundle = Bundle {
        schema: SCHEMA_VERSION,
        settings: None,
        profiles,
    };
    toml::to_string_pretty(&bundle).map_err(|e| CoreError::Generate(e.to_string()))
}

pub fn export_bundle(config: &AppConfig, include_hardware: bool) -> Result<String, CoreError> {
    let profiles: Vec<Profile> = config
        .profiles
        .iter()
        .map(|p| strip_hardware(p, include_hardware))
        .collect();
    let bundle = Bundle {
        schema: SCHEMA_VERSION,
        settings: Some(config.settings.clone()),
        profiles,
    };
    toml::to_string_pretty(&bundle).map_err(|e| CoreError::Generate(e.to_string()))
}

pub fn import_bundle(content: &str) -> Result<Bundle, CoreError> {
    let bundle: Bundle = toml::from_str(content).map_err(|e| CoreError::Parse(e.to_string()))?;
    if bundle.schema > SCHEMA_VERSION {
        return Err(CoreError::Schema(format!(
            "bundle schema {} is newer than supported {}",
            bundle.schema, SCHEMA_VERSION
        )));
    }
    Ok(bundle)
}

fn strip_hardware(profile: &Profile, include_hardware: bool) -> Profile {
    let mut profile = profile.clone();
    if !include_hardware {
        profile.devices.clear();
    }
    profile
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::DeviceRef;

    #[test]
    fn export_is_deterministic_and_round_trips() {
        let config = AppConfig::empty();
        let a = export_bundle(&config, false).unwrap();
        let b = export_bundle(&config, false).unwrap();
        assert_eq!(a, b);
        let bundle = import_bundle(&a).unwrap();
        assert_eq!(bundle.profiles, config.profiles);
    }

    #[test]
    fn strips_hardware_ids_by_default() {
        let mut config = AppConfig::empty();
        config.profiles[0].devices.push(DeviceRef {
            vendor: "04d9".into(),
            product: "0141".into(),
            name: Some("USB Keyboard".into()),
        });
        let exported = export_bundle(&config, false).unwrap();
        assert!(!exported.contains("04d9"));
        let with_ids = export_bundle(&config, true).unwrap();
        assert!(with_ids.contains("04d9"));
    }

    #[test]
    fn rejects_newer_bundle() {
        let content = "schema = 99\nprofiles = []\n";
        assert!(import_bundle(content).is_err());
    }
}
