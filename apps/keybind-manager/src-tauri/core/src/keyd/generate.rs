use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::error::CoreError;
use crate::keyd::actions;
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
    let enabled: Vec<&Profile> = config.profiles.iter().filter(|p| p.enabled).collect();
    let globals: Vec<&Profile> = enabled
        .iter()
        .copied()
        .filter(|p| p.devices.is_empty())
        .collect();
    let mut files = Vec::new();
    for profile in &enabled {
        let effective = if profile.devices.is_empty() {
            if !std::ptr::eq(*profile, globals[0]) {
                continue;
            }
            merge_globals(&globals)
        } else {
            with_inherited(profile, &globals)
        };
        files.push(ManagedFile {
            name: managed_filename(profile),
            content: generate_profile(&effective)?,
        });
    }
    Ok(files)
}

/// keyd rejects two `[ids] *` configs, so every device-less profile is folded
/// into the first one's file; earlier profiles win on a shared key.
fn merge_globals(globals: &[&Profile]) -> Profile {
    let mut merged = with_inherited(globals[0], &globals[1..]);
    for global in &globals[1..] {
        for entry in &global.preserved {
            if !merged.preserved.contains(entry) {
                merged.preserved.push(entry.clone());
            }
        }
    }
    merged
}

fn mapping_slot(mapping: &Mapping) -> (String, Vec<String>) {
    (
        mapping.source.key.clone(),
        keys::sort_mods(&mapping.source.mods),
    )
}

fn with_inherited(profile: &Profile, globals: &[&Profile]) -> Profile {
    let mut merged = profile.clone();
    let taken: std::collections::BTreeSet<_> = profile
        .mappings
        .iter()
        .filter(|m| m.enabled)
        .map(mapping_slot)
        .collect();
    for global in globals {
        for mapping in global.mappings.iter().filter(|m| m.enabled) {
            if !taken.contains(&mapping_slot(mapping)) {
                merged.mappings.push(mapping.clone());
            }
        }
        for layer in &global.layers {
            if !merged.layers.iter().any(|l| l.name == layer.name) {
                merged.layers.push(layer.clone());
            }
        }
    }
    merged
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

    if has_multi_tap(profile) && !profile.preserved.iter().any(|e| e.section == "global") {
        sections
            .entry("global".into())
            .or_default()
            .push(("oneshot_timeout".into(), TAP_WINDOW_MS.to_string()));
    }

    let mut names: Vec<&String> = sections.keys().collect();
    names.sort_by_key(|n| (n.as_str() != "global", n.as_str() != "main", n.as_str()));
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

#[derive(Default)]
struct KeySlot {
    press: Option<KeyAction>,
    tap: Option<KeyAction>,
    hold: Option<KeyAction>,
    double: Option<KeyAction>,
    triple: Option<KeyAction>,
}

fn collect_mappings(
    profile: &Profile,
    sections: &mut BTreeMap<String, Vec<(String, String)>>,
) -> Result<(), CoreError> {
    let mut slots: BTreeMap<(String, String), KeySlot> = BTreeMap::new();

    for mapping in profile.mappings.iter().filter(|m| m.enabled) {
        let scope = scope_name(mapping)?;
        let slot = slots
            .entry((scope, mapping.source.key.clone()))
            .or_default();
        let target = Some(mapping.target.clone());
        match mapping.source.mode {
            InputMode::Press => slot.press = target,
            InputMode::Tap => slot.tap = target,
            InputMode::Hold => slot.hold = target,
            InputMode::DoubleTap => slot.double = target,
            InputMode::TripleTap => slot.triple = target,
        }
    }

    for ((scope, key), slot) in slots {
        let multi_tap = slot.double.is_some() || slot.triple.is_some();
        if multi_tap && scope != "main" {
            return Err(CoreError::Generate(format!(
                "double and triple taps on '{key}' cannot use modifiers"
            )));
        }
        let single = slot.tap.as_ref().or(slot.press.as_ref());
        let first = if multi_tap {
            multi_tap_chain(&key, single, slot.double.as_ref(), slot.triple.as_ref(), sections)?
        } else {
            match single {
                Some(action) => target_expr(action)?,
                None => String::new(),
            }
        };
        let expr = match (&slot.hold, first.is_empty()) {
            (Some(hold), false) => format!("overload({}, {first})", hold_ref(hold)?),
            (Some(hold), true) => format!("layer({})", hold_ref(hold)?),
            (None, _) => first,
        };
        sections.entry(scope).or_default().push((key, expr));
    }
    Ok(())
}

pub const TAP_WINDOW_MS: u32 = 300;

pub fn tap_layer(key: &str, count: u8) -> String {
    format!("tap{count}_{key}")
}

/// keyd has no tap dance, so each tap types its own action and arms a
/// short-lived oneshot layer in which the same key performs the next tap count.
fn multi_tap_chain(
    key: &str,
    single: Option<&KeyAction>,
    double: Option<&KeyAction>,
    triple: Option<&KeyAction>,
    sections: &mut BTreeMap<String, Vec<(String, String)>>,
) -> Result<String, CoreError> {
    let first = arm_next(key, single, tap_layer(key, 2))?;
    let second = match triple {
        Some(triple) => {
            let third = tap_layer(key, 3);
            sections
                .entry(third.clone())
                .or_default()
                .push((key.to_string(), target_expr(triple)?));
            arm_next(key, double.or(single), third)?
        }
        None => match double {
            Some(double) => target_expr(double)?,
            None => return Err(CoreError::Generate(format!("'{key}' has no multi-tap action"))),
        },
    };
    sections
        .entry(tap_layer(key, 2))
        .or_default()
        .push((key.to_string(), second));
    Ok(first)
}

fn arm_next(key: &str, action: Option<&KeyAction>, layer: String) -> Result<String, CoreError> {
    let Some(action) = action else {
        return Ok(format!("oneshotm({layer}, macro({key}))"));
    };
    if action.kind == ActionKind::Disable {
        return Ok(format!("oneshot({layer})"));
    }
    let macro_expr = match action.kind {
        ActionKind::Key | ActionKind::Combo | ActionKind::Macro | ActionKind::Text => {
            let expr = target_expr(action)?;
            if expr.starts_with("macro(") {
                expr
            } else {
                format!("macro({expr})")
            }
        }
        _ => {
            return Err(CoreError::Generate(format!(
                "'{key}' is followed by another tap, so its earlier tap can only send keys or text"
            )))
        }
    };
    Ok(format!("oneshotm({layer}, {macro_expr})"))
}

fn has_multi_tap(profile: &Profile) -> bool {
    profile
        .mappings
        .iter()
        .any(|m| m.enabled && m.source.mode.tap_count().is_some())
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
        ActionKind::Text => {
            let text = action
                .text
                .as_deref()
                .filter(|t| !t.is_empty())
                .ok_or_else(|| CoreError::Generate("text action missing text".into()))?;
            Ok(format!("macro({})", actions::encode_text(text)))
        }
        ActionKind::Command => {
            let command = action
                .command
                .as_deref()
                .map(str::trim)
                .filter(|c| !c.is_empty())
                .ok_or_else(|| CoreError::Generate("command action missing command".into()))?;
            if command.contains('\n') {
                return Err(CoreError::Generate(
                    "command may not contain newlines".into(),
                ));
            }
            Ok(format!(
                "command({})",
                actions::wrap_command(command, action.run_as.as_deref())
            ))
        }
        ActionKind::Launch => {
            let app = action
                .app
                .as_deref()
                .filter(|a| !a.is_empty())
                .ok_or_else(|| CoreError::Generate("launch action missing application".into()))?;
            if app.contains('\n') {
                return Err(CoreError::Generate(
                    "application path may not contain newlines".into(),
                ));
            }
            Ok(format!(
                "command({})",
                actions::wrap_launch(app, action.run_as.as_deref())
            ))
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
            ..Default::default()
        }
    }

    #[test]
    fn generates_text_command_and_launch_on_chords() {
        let mut profile = AppConfig::empty().profiles[0].clone();
        let chord = |key: &str, target: KeyAction| Mapping {
            id: key.into(),
            source: KeyInput {
                key: key.into(),
                mods: vec!["shift".into(), "meta".into()],
                mode: InputMode::Press,
            },
            target,
            enabled: true,
        };
        profile.mappings.push(chord(
            "t",
            KeyAction {
                kind: ActionKind::Text,
                text: Some("hi you".into()),
                ..Default::default()
            },
        ));
        profile.mappings.push(chord(
            "y",
            KeyAction {
                kind: ActionKind::Command,
                command: Some("notify-send yo".into()),
                run_as: Some("remco".into()),
                ..Default::default()
            },
        ));
        let out = generate_profile(&profile).unwrap();
        assert!(out.contains("[meta+shift]\n"));
        assert!(out.contains("t = macro(h i space y o u)\n"));
        assert!(out.contains(
            "y = command(systemd-run --user --collect --quiet -M remco@ -- sh -c 'notify-send yo')\n"
        ));
        let parsed = crate::keyd::parse_profile("p", "p", &out).unwrap();
        assert_eq!(parsed.mappings.len(), 2);
        assert!(parsed.mappings.iter().any(
            |m| m.target.kind == ActionKind::Text && m.target.text.as_deref() == Some("hi you")
        ));
        assert!(parsed
            .mappings
            .iter()
            .any(|m| m.target.kind == ActionKind::Command
                && m.target.run_as.as_deref() == Some("remco")));
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
                ..Default::default()
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
    fn device_less_profiles_share_one_wildcard_file() {
        let mut config = AppConfig::empty();
        config.profiles[0]
            .mappings
            .push(mapping("capslock", InputMode::Press, key_action("esc")));
        let mut second = config.profiles[0].clone();
        second.id = "second".into();
        second.mappings = vec![
            mapping("capslock", InputMode::Press, key_action("tab")),
            mapping("a", InputMode::Press, key_action("b")),
        ];
        config.profiles.push(second);
        let files = generate_all(&config).unwrap();
        assert_eq!(files.len(), 1);
        assert!(files[0].content.contains("capslock = esc\n"));
        assert!(files[0].content.contains("a = b\n"));
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
    fn chains_double_and_triple_taps_through_oneshot_layers() {
        let mut profile = AppConfig::empty().profiles[0].clone();
        profile
            .mappings
            .push(mapping("capslock", InputMode::Tap, key_action("esc")));
        profile.mappings.push(mapping(
            "capslock",
            InputMode::Hold,
            key_action("leftcontrol"),
        ));
        profile.mappings.push(mapping(
            "capslock",
            InputMode::DoubleTap,
            key_action("capslock"),
        ));
        profile.mappings.push(mapping(
            "capslock",
            InputMode::TripleTap,
            KeyAction {
                kind: ActionKind::Command,
                command: Some("notify-send yo".into()),
                ..Default::default()
            },
        ));
        let out = generate_profile(&profile).unwrap();
        assert!(out.contains("[global]\noneshot_timeout = 300\n"));
        assert!(out.contains(
            "capslock = overload(control, oneshotm(tap2_capslock, macro(esc)))\n"
        ));
        assert!(out.contains(
            "[tap2_capslock]\ncapslock = oneshotm(tap3_capslock, macro(capslock))\n"
        ));
        assert!(out.contains("[tap3_capslock]\ncapslock = command(notify-send yo)\n"));
    }

    #[test]
    fn double_tap_without_single_keeps_the_key() {
        let mut profile = AppConfig::empty().profiles[0].clone();
        profile.mappings.push(mapping(
            "rightalt",
            InputMode::DoubleTap,
            KeyAction {
                kind: ActionKind::Command,
                command: Some("x".into()),
                ..Default::default()
            },
        ));
        let out = generate_profile(&profile).unwrap();
        assert!(out.contains("rightalt = oneshotm(tap2_rightalt, macro(rightalt))\n"));
        assert!(out.contains("[tap2_rightalt]\nrightalt = command(x)\n"));
    }

    #[test]
    fn rejects_command_before_a_later_tap() {
        let mut profile = AppConfig::empty().profiles[0].clone();
        profile.mappings.push(mapping(
            "f1",
            InputMode::Press,
            KeyAction {
                kind: ActionKind::Command,
                command: Some("x".into()),
                ..Default::default()
            },
        ));
        profile
            .mappings
            .push(mapping("f1", InputMode::DoubleTap, key_action("esc")));
        assert!(generate_profile(&profile).is_err());
    }

    #[test]
    fn rejects_macro_injection() {
        let action = KeyAction {
            kind: ActionKind::Macro,
            key: None,
            mods: Vec::new(),
            layer: None,
            macro_text: Some("hello)\n[ids]".into()),
            ..Default::default()
        };
        assert!(target_expr(&action).is_err());
    }
}
