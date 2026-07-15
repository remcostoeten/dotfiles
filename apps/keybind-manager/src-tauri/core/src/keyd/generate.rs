use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::error::CoreError;
use crate::keys;
use crate::model::{
    managed_filename, ActionKind, AppConfig, InputMode, KeyAction, Mapping, Profile,
};

pub const HEADER: &str = "# Managed by Keybind Manager. Do not edit by hand.\n# Manual changes are detected and will block the next apply.";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ManagedFile {
    pub name: String,
    pub content: String,
}

pub fn generate_all(config: &AppConfig) -> Result<Vec<ManagedFile>, CoreError> {
    let mut files = Vec::new();
    for profile in config.profiles.iter().filter(|p| p.enabled) {
        files.push(ManagedFile {
            name: managed_filename(profile),
            content: generate_profile(profile)?,
        });
    }
    Ok(files)
}

pub fn generate_profile(profile: &Profile) -> Result<String, CoreError> {
    let mut sections: BTreeMap<String, Vec<(String, String)>> = BTreeMap::new();
    collect_mappings(profile, &mut sections)?;

    for layer in &profile.layers {
        let entries = sections.entry(layer.name.clone()).or_default();
        for mapping in layer.mappings.iter().filter(|m| m.enabled) {
            if mapping.source.mode != InputMode::Press || !mapping.source.mods.is_empty() {
                return Err(CoreError::Generate(format!(
                    "layer '{}' mappings must be plain key mappings",
                    layer.name
                )));
            }
            entries.push((mapping.source.key.clone(), target_expr(&mapping.target)?));
        }
    }

    for entry in &profile.preserved {
        sections
            .entry(entry.section.clone())
            .or_default()
            .push(("".into(), entry.raw.clone()));
    }

    let mut out = String::new();
    out.push_str(HEADER);
    out.push_str("\n\n[ids]\n");
    if profile.devices.is_empty() {
        out.push_str("*\n");
    } else {
        let mut ids: Vec<String> = profile
            .devices
            .iter()
            .map(|d| format!("{}:{}", d.vendor.to_lowercase(), d.product.to_lowercase()))
            .collect();
        ids.sort();
        ids.dedup();
        for id in ids {
            out.push_str(&id);
            out.push('\n');
        }
    }

    let mut names: Vec<&String> = sections.keys().collect();
    names.sort_by_key(|n| (n.as_str() != "main", n.as_str()));
    for name in names {
        out.push('\n');
        out.push_str(&format!("[{name}]\n"));
        let mut entries = sections[name].clone();
        entries.sort();
        for (key, value) in entries {
            if key.is_empty() {
                out.push_str(&value);
                out.push('\n');
            } else {
                out.push_str(&format!("{key} = {value}\n"));
            }
        }
    }
    Ok(out)
}

fn collect_mappings(
    profile: &Profile,
    sections: &mut BTreeMap<String, Vec<(String, String)>>,
) -> Result<(), CoreError> {
    let mut pending: BTreeMap<(String, String), (Option<KeyAction>, Option<KeyAction>)> =
        BTreeMap::new();

    for mapping in profile.mappings.iter().filter(|m| m.enabled) {
        let scope = scope_name(mapping)?;
        match mapping.source.mode {
            InputMode::Press => {
                sections
                    .entry(scope)
                    .or_default()
                    .push((mapping.source.key.clone(), target_expr(&mapping.target)?));
            }
            InputMode::Tap => {
                pending
                    .entry((scope, mapping.source.key.clone()))
                    .or_default()
                    .0 = Some(mapping.target.clone());
            }
            InputMode::Hold => {
                pending
                    .entry((scope, mapping.source.key.clone()))
                    .or_default()
                    .1 = Some(mapping.target.clone());
            }
        }
    }

    for ((scope, key), (tap, hold)) in pending {
        let expr = match (tap, hold) {
            (Some(tap), Some(hold)) => {
                format!("overload({}, {})", hold_ref(&hold)?, target_expr(&tap)?)
            }
            (None, Some(hold)) => format!("layer({})", hold_ref(&hold)?),
            (Some(tap), None) => target_expr(&tap)?,
            (None, None) => unreachable!(),
        };
        sections.entry(scope).or_default().push((key, expr));
    }
    Ok(())
}

fn scope_name(mapping: &Mapping) -> Result<String, CoreError> {
    if mapping.source.mods.is_empty() {
        return Ok("main".into());
    }
    let mods = keys::sort_mods(&mapping.source.mods);
    for m in &mods {
        if !keys::is_mod(m) {
            return Err(CoreError::Generate(format!("unknown modifier '{m}'")));
        }
    }
    Ok(mods.join("+"))
}

fn hold_ref(action: &KeyAction) -> Result<String, CoreError> {
    match action.kind {
        ActionKind::Layer => action
            .layer
            .clone()
            .ok_or_else(|| CoreError::Generate("layer action missing layer name".into())),
        ActionKind::Key => {
            let key = action
                .key
                .as_deref()
                .ok_or_else(|| CoreError::Generate("key action missing key".into()))?;
            keys::as_mod_layer(key).map(String::from).ok_or_else(|| {
                CoreError::Generate(format!("hold target '{key}' must be a modifier or a layer"))
            })
        }
        _ => Err(CoreError::Generate(
            "hold target must be a modifier or a layer".into(),
        )),
    }
}

pub fn target_expr(action: &KeyAction) -> Result<String, CoreError> {
    match action.kind {
        ActionKind::Disable => Ok("noop".into()),
        ActionKind::Layer => action
            .layer
            .clone()
            .map(|l| format!("layer({l})"))
            .ok_or_else(|| CoreError::Generate("layer action missing layer name".into())),
        ActionKind::Key => {
            let key = action
                .key
                .as_deref()
                .ok_or_else(|| CoreError::Generate("key action missing key".into()))?;
            Ok(key.to_string())
        }
        ActionKind::Combo => {
            let key = action
                .key
                .as_deref()
                .ok_or_else(|| CoreError::Generate("combo action missing key".into()))?;
            let mods = keys::sort_mods(&action.mods);
            if mods.is_empty() {
                return Err(CoreError::Generate("combo action missing modifiers".into()));
            }
            let mut expr = String::new();
            for m in &mods {
                let prefix = keys::mod_prefix(m)
                    .ok_or_else(|| CoreError::Generate(format!("unknown modifier '{m}'")))?;
                expr.push_str(prefix);
                expr.push('-');
            }
            expr.push_str(key);
            Ok(expr)
        }
        ActionKind::Macro => {
            let text = action
                .macro_text
                .as_deref()
                .ok_or_else(|| CoreError::Generate("macro action missing text".into()))?;
            if text.contains(['\n', ')']) {
                return Err(CoreError::Generate(
                    "macro text may not contain newlines or ')'".into(),
                ));
            }
            Ok(format!("macro({text})"))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{DeviceRef, KeyInput, Layer};

    fn mapping(key: &str, mode: InputMode, target: KeyAction) -> Mapping {
        Mapping {
            id: format!("{key}-{mode:?}"),
            source: KeyInput {
                key: key.into(),
                mods: Vec::new(),
                mode,
            },
            target,
            enabled: true,
        }
    }

    fn key_action(key: &str) -> KeyAction {
        KeyAction {
            kind: ActionKind::Key,
            key: Some(key.into()),
            mods: Vec::new(),
            layer: None,
            macro_text: None,
        }
    }

    #[test]
    fn generates_key_to_key() {
        let mut profile = AppConfig::empty().profiles[0].clone();
        profile
            .mappings
            .push(mapping("capslock", InputMode::Press, key_action("esc")));
        let out = generate_profile(&profile).unwrap();
        assert!(out.contains("[ids]\n*\n"));
        assert!(out.contains("[main]\ncapslock = esc\n"));
    }

    #[test]
    fn merges_tap_hold_into_overload() {
        let mut profile = AppConfig::empty().profiles[0].clone();
        profile
            .mappings
            .push(mapping("capslock", InputMode::Tap, key_action("esc")));
        profile.mappings.push(mapping(
            "capslock",
            InputMode::Hold,
            key_action("leftcontrol"),
        ));
        let out = generate_profile(&profile).unwrap();
        assert!(out.contains("capslock = overload(control, esc)"));
    }

    #[test]
    fn hold_only_becomes_layer() {
        let mut profile = AppConfig::empty().profiles[0].clone();
        profile
            .mappings
            .push(mapping("capslock", InputMode::Hold, key_action("leftmeta")));
        let out = generate_profile(&profile).unwrap();
        assert!(out.contains("capslock = layer(meta)"));
    }

    #[test]
    fn generates_combo_with_sorted_prefixes() {
        let mut profile = AppConfig::empty().profiles[0].clone();
        profile.mappings.push(mapping(
            "f1",
            InputMode::Press,
            KeyAction {
                kind: ActionKind::Combo,
                key: Some("c".into()),
                mods: vec!["shift".into(), "control".into()],
                layer: None,
                macro_text: None,
            },
        ));
        let out = generate_profile(&profile).unwrap();
        assert!(out.contains("f1 = C-S-c"));
    }

    #[test]
    fn source_mods_create_modifier_section() {
        let mut profile = AppConfig::empty().profiles[0].clone();
        profile.mappings.push(Mapping {
            id: "m".into(),
            source: KeyInput {
                key: "h".into(),
                mods: vec!["alt".into(), "control".into()],
                mode: InputMode::Press,
            },
            target: key_action("left"),
            enabled: true,
        });
        let out = generate_profile(&profile).unwrap();
        assert!(out.contains("[control+alt]\nh = left"));
    }

    #[test]
    fn generates_layers_and_device_ids() {
        let mut profile = AppConfig::empty().profiles[0].clone();
        profile.devices.push(DeviceRef {
            vendor: "04D9".into(),
            product: "0141".into(),
            name: None,
        });
        profile.layers.push(Layer {
            id: "nav".into(),
            name: "nav".into(),
            mappings: vec![mapping("h", InputMode::Press, key_action("left"))],
        });
        let out = generate_profile(&profile).unwrap();
        assert!(out.contains("[ids]\n04d9:0141\n"));
        assert!(out.contains("[nav]\nh = left\n"));
    }

    #[test]
    fn output_is_deterministic() {
        let mut profile = AppConfig::empty().profiles[0].clone();
        profile
            .mappings
            .push(mapping("b", InputMode::Press, key_action("a")));
        profile
            .mappings
            .push(mapping("a", InputMode::Press, key_action("b")));
        let first = generate_profile(&profile).unwrap();
        profile.mappings.reverse();
        assert_eq!(first, generate_profile(&profile).unwrap());
    }

    #[test]
    fn disabled_mappings_are_skipped() {
        let mut profile = AppConfig::empty().profiles[0].clone();
        let mut m = mapping("capslock", InputMode::Press, key_action("esc"));
        m.enabled = false;
        profile.mappings.push(m);
        let out = generate_profile(&profile).unwrap();
        assert!(!out.contains("capslock"));
    }

    #[test]
    fn rejects_macro_injection() {
        let action = KeyAction {
            kind: ActionKind::Macro,
            key: None,
            mods: Vec::new(),
            layer: None,
            macro_text: Some("hello)\n[ids]".into()),
        };
        assert!(target_expr(&action).is_err());
    }
}
