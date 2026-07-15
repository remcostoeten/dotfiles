use std::collections::{BTreeMap, BTreeSet};

use serde::{Deserialize, Serialize};

use crate::keys;
use crate::model::{ActionKind, AppConfig, InputMode, Mapping, Profile};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Issue {
    pub code: String,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mapping_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub profile_id: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CheckResult {
    pub errors: Vec<Issue>,
    pub warnings: Vec<Issue>,
}

impl CheckResult {
    pub fn ok(&self) -> bool {
        self.errors.is_empty()
    }
}

const ESSENTIAL: &[&str] = &["enter", "esc", "escape", "backspace", "space", "tab"];

pub fn validate(config: &AppConfig) -> CheckResult {
    let mut result = CheckResult::default();
    if config.profile(&config.active).is_none() {
        push_error(
            &mut result,
            "NO_ACTIVE",
            "active profile does not exist",
            None,
            None,
        );
    }
    let mut ids = BTreeSet::new();
    for profile in &config.profiles {
        if !ids.insert(&profile.id) {
            push_error(
                &mut result,
                "DUP_PROFILE",
                format!("duplicate profile id '{}'", profile.id),
                None,
                Some(&profile.id),
            );
        }
        validate_profile(profile, &mut result);
    }
    result
}

fn validate_profile(profile: &Profile, result: &mut CheckResult) {
    let layer_names: BTreeSet<&str> = profile.layers.iter().map(|l| l.name.as_str()).collect();

    for layer in &profile.layers {
        if !layer_name_ok(&layer.name) {
            push_error(
                result,
                "BAD_LAYER_NAME",
                format!("layer name '{}' must be alphanumeric", layer.name),
                None,
                Some(&profile.id),
            );
        }
        if keys::is_mod(&layer.name) || layer.name == "main" || layer.name == "ids" {
            push_error(
                result,
                "RESERVED_LAYER",
                format!("layer name '{}' is reserved", layer.name),
                None,
                Some(&profile.id),
            );
        }
    }

    for device in &profile.devices {
        let valid = |s: &str| s.len() == 4 && s.chars().all(|c| c.is_ascii_hexdigit());
        if !valid(&device.vendor) || !valid(&device.product) {
            push_error(
                result,
                "BAD_DEVICE",
                format!("invalid device id '{}:{}'", device.vendor, device.product),
                None,
                Some(&profile.id),
            );
        }
    }

    let mut seen: BTreeMap<(String, String, InputMode), &Mapping> = BTreeMap::new();
    let all_mappings: Vec<&Mapping> = profile
        .mappings
        .iter()
        .chain(profile.layers.iter().flat_map(|l| l.mappings.iter()))
        .collect();

    for mapping in &all_mappings {
        validate_mapping(mapping, profile, &layer_names, result);
    }

    for mapping in profile.mappings.iter().filter(|m| m.enabled) {
        let scope = keys::sort_mods(&mapping.source.mods).join("+");
        let key = (scope, mapping.source.key.clone(), mapping.source.mode);
        if seen.insert(key, mapping).is_some() {
            push_error(
                result,
                "DUPLICATE",
                format!("duplicate mapping for source '{}'", mapping.source.key),
                Some(&mapping.id),
                Some(&profile.id),
            );
        }
    }

    check_dangerous(profile, result);
}

fn validate_mapping(
    mapping: &Mapping,
    profile: &Profile,
    layer_names: &BTreeSet<&str>,
    result: &mut CheckResult,
) {
    if !keys::is_key(&mapping.source.key) {
        push_error(
            result,
            "UNKNOWN_KEY",
            format!("unknown source key '{}'", mapping.source.key),
            Some(&mapping.id),
            Some(&profile.id),
        );
    }
    for m in &mapping.source.mods {
        if !keys::is_mod(m) {
            push_error(
                result,
                "UNKNOWN_MOD",
                format!("unknown modifier '{m}'"),
                Some(&mapping.id),
                Some(&profile.id),
            );
        }
    }
    match mapping.target.kind {
        ActionKind::Key | ActionKind::Combo => {
            match mapping.target.key.as_deref() {
                Some(key) if keys::is_key(key) || keys::is_mod(key) => {}
                Some(key) => push_error(
                    result,
                    "UNKNOWN_KEY",
                    format!("unknown target key '{key}'"),
                    Some(&mapping.id),
                    Some(&profile.id),
                ),
                None => push_error(
                    result,
                    "MISSING_TARGET",
                    "mapping has no target key",
                    Some(&mapping.id),
                    Some(&profile.id),
                ),
            }
            for m in &mapping.target.mods {
                if !keys::is_mod(m) {
                    push_error(
                        result,
                        "UNKNOWN_MOD",
                        format!("unknown modifier '{m}'"),
                        Some(&mapping.id),
                        Some(&profile.id),
                    );
                }
            }
        }
        ActionKind::Layer => match mapping.target.layer.as_deref() {
            Some(layer) if layer_names.contains(layer) || keys::is_mod(layer) => {}
            Some(layer) => push_error(
                result,
                "MISSING_LAYER",
                format!("layer '{layer}' is not defined"),
                Some(&mapping.id),
                Some(&profile.id),
            ),
            None => push_error(
                result,
                "MISSING_TARGET",
                "layer mapping has no layer name",
                Some(&mapping.id),
                Some(&profile.id),
            ),
        },
        ActionKind::Macro => {
            if mapping
                .target
                .macro_text
                .as_deref()
                .unwrap_or("")
                .is_empty()
            {
                push_error(
                    result,
                    "MISSING_TARGET",
                    "macro mapping has no text",
                    Some(&mapping.id),
                    Some(&profile.id),
                );
            }
        }
        ActionKind::Disable => {}
    }

    if mapping.source.mode == InputMode::Hold {
        let hold_ok = match mapping.target.kind {
            ActionKind::Layer => true,
            ActionKind::Key => mapping
                .target
                .key
                .as_deref()
                .map(|k| keys::as_mod_layer(k).is_some())
                .unwrap_or(false),
            _ => false,
        };
        if !hold_ok {
            push_error(
                result,
                "BAD_HOLD",
                "hold targets must be a modifier or a layer",
                Some(&mapping.id),
                Some(&profile.id),
            );
        }
    }

    if mapping.target.kind == ActionKind::Key
        && mapping.source.mods.is_empty()
        && mapping.source.mode == InputMode::Press
        && mapping.target.key.as_deref() == Some(mapping.source.key.as_str())
    {
        result.warnings.push(Issue {
            code: "SELF_MAP".into(),
            message: format!("'{}' is mapped to itself", mapping.source.key),
            mapping_id: Some(mapping.id.clone()),
            profile_id: Some(profile.id.clone()),
        });
    }
}

fn check_dangerous(profile: &Profile, result: &mut CheckResult) {
    let all_devices = profile.devices.is_empty();
    let mut disabled: BTreeSet<&str> = BTreeSet::new();
    let mut remapped: BTreeSet<&str> = BTreeSet::new();

    for mapping in profile.mappings.iter().filter(|m| m.enabled) {
        if !mapping.source.mods.is_empty() || mapping.source.mode != InputMode::Press {
            continue;
        }
        if mapping.target.kind == ActionKind::Disable {
            disabled.insert(&mapping.source.key);
        } else {
            remapped.insert(&mapping.source.key);
        }
    }

    for key in &disabled {
        if ESSENTIAL.contains(key) {
            result.warnings.push(Issue {
                code: "DANGEROUS".into(),
                message: if all_devices {
                    format!("'{key}' is disabled on every keyboard")
                } else {
                    format!("'{key}' is disabled")
                },
                mapping_id: None,
                profile_id: Some(profile.id.clone()),
            });
        }
    }

    let both = |a: &str, b: &str, set: &BTreeSet<&str>| set.contains(a) && set.contains(b);
    let gone = |a: &str, b: &str| {
        both(a, b, &disabled)
            || (disabled.contains(a) && remapped.contains(b))
            || (remapped.contains(a) && disabled.contains(b))
            || both(a, b, &remapped) && disabled.contains(a)
    };
    for (a, b, label) in [
        ("leftcontrol", "rightcontrol", "both Control keys"),
        ("leftalt", "rightalt", "both Alt keys"),
        ("leftshift", "rightshift", "both Shift keys"),
    ] {
        if gone(a, b) || both(a, b, &disabled) {
            result.warnings.push(Issue {
                code: "DANGEROUS".into(),
                message: format!("{label} are remapped or disabled"),
                mapping_id: None,
                profile_id: Some(profile.id.clone()),
            });
        }
    }
}

fn layer_name_ok(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 32
        && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
}

fn push_error(
    result: &mut CheckResult,
    code: &str,
    message: impl Into<String>,
    mapping_id: Option<&str>,
    profile_id: Option<&str>,
) {
    result.errors.push(Issue {
        code: code.into(),
        message: message.into(),
        mapping_id: mapping_id.map(String::from),
        profile_id: profile_id.map(String::from),
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{KeyAction, KeyInput};

    fn config_with(mappings: Vec<Mapping>) -> AppConfig {
        let mut config = AppConfig::empty();
        config.profiles[0].mappings = mappings;
        config
    }

    fn mapping(id: &str, key: &str, target: KeyAction) -> Mapping {
        Mapping {
            id: id.into(),
            source: KeyInput {
                key: key.into(),
                mods: Vec::new(),
                mode: InputMode::Press,
            },
            target,
            enabled: true,
        }
    }

    fn key_target(key: &str) -> KeyAction {
        KeyAction {
            kind: ActionKind::Key,
            key: Some(key.into()),
            mods: Vec::new(),
            layer: None,
            macro_text: None,
        }
    }

    fn disable_target() -> KeyAction {
        KeyAction {
            kind: ActionKind::Disable,
            key: None,
            mods: Vec::new(),
            layer: None,
            macro_text: None,
        }
    }

    #[test]
    fn accepts_valid_config() {
        let config = config_with(vec![mapping("1", "capslock", key_target("esc"))]);
        assert!(validate(&config).ok());
    }

    #[test]
    fn rejects_unknown_keys() {
        let config = config_with(vec![mapping("1", "nokey", key_target("esc"))]);
        let result = validate(&config);
        assert!(result.errors.iter().any(|e| e.code == "UNKNOWN_KEY"));
    }

    #[test]
    fn rejects_duplicates() {
        let config = config_with(vec![
            mapping("1", "capslock", key_target("esc")),
            mapping("2", "capslock", key_target("tab")),
        ]);
        let result = validate(&config);
        assert!(result.errors.iter().any(|e| e.code == "DUPLICATE"));
    }

    #[test]
    fn rejects_missing_layer() {
        let config = config_with(vec![mapping(
            "1",
            "capslock",
            KeyAction {
                kind: ActionKind::Layer,
                key: None,
                mods: Vec::new(),
                layer: Some("nav".into()),
                macro_text: None,
            },
        )]);
        let result = validate(&config);
        assert!(result.errors.iter().any(|e| e.code == "MISSING_LAYER"));
    }

    #[test]
    fn warns_on_disabled_essential_keys() {
        let config = config_with(vec![mapping("1", "enter", disable_target())]);
        let result = validate(&config);
        assert!(result.ok());
        assert!(result.warnings.iter().any(|w| w.code == "DANGEROUS"));
    }

    #[test]
    fn warns_when_both_controls_disabled() {
        let config = config_with(vec![
            mapping("1", "leftcontrol", disable_target()),
            mapping("2", "rightcontrol", disable_target()),
        ]);
        let result = validate(&config);
        assert!(result
            .warnings
            .iter()
            .any(|w| w.message.contains("Control")));
    }

    #[test]
    fn rejects_bad_hold_target() {
        let config = config_with(vec![Mapping {
            id: "1".into(),
            source: KeyInput {
                key: "capslock".into(),
                mods: Vec::new(),
                mode: InputMode::Hold,
            },
            target: key_target("x"),
            enabled: true,
        }]);
        let result = validate(&config);
        assert!(result.errors.iter().any(|e| e.code == "BAD_HOLD"));
    }
}
