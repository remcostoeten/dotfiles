use crate::error::CoreError;
use crate::keys;
use crate::model::{
    ActionKind, InputMode, KeyAction, KeyInput, Layer, Mapping, PreservedEntry, Profile,
};

pub fn parse_profile(id: &str, name: &str, content: &str) -> Result<Profile, CoreError> {
    let mut profile = Profile {
        id: id.into(),
        name: name.into(),
        enabled: true,
        devices: Vec::new(),
        mappings: Vec::new(),
        layers: Vec::new(),
        preserved: Vec::new(),
    };
    let mut section = String::new();
    let mut counter = 0u32;

    for raw_line in content.lines() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some(rest) = line.strip_prefix('[') {
            let Some(name) = rest.strip_suffix(']') else {
                return Err(CoreError::Parse(format!("malformed section: {line}")));
            };
            section = name.trim().to_string();
            continue;
        }
        match section.as_str() {
            "" => return Err(CoreError::Parse(format!("entry outside section: {line}"))),
            "ids" => parse_id_line(line, &mut profile)?,
            _ => parse_entry(line, &section, &mut profile, &mut counter),
        }
    }
    Ok(profile)
}

fn parse_id_line(line: &str, profile: &mut Profile) -> Result<(), CoreError> {
    if line == "*" {
        return Ok(());
    }
    let Some((vendor, product)) = line.split_once(':') else {
        profile.preserved.push(PreservedEntry {
            section: "ids".into(),
            raw: line.to_string(),
        });
        return Ok(());
    };
    let valid = |s: &str| s.len() == 4 && s.chars().all(|c| c.is_ascii_hexdigit());
    if valid(vendor) && valid(product) {
        profile.devices.push(crate::model::DeviceRef {
            vendor: vendor.to_lowercase(),
            product: product.to_lowercase(),
            name: None,
        });
    } else {
        profile.preserved.push(PreservedEntry {
            section: "ids".into(),
            raw: line.to_string(),
        });
    }
    Ok(())
}

fn parse_entry(line: &str, section: &str, profile: &mut Profile, counter: &mut u32) {
    let Some((key, value)) = line.split_once('=') else {
        preserve(profile, section, line);
        return;
    };
    let key = key.trim();
    let value = value.trim();
    if !keys::is_key(key) {
        preserve(profile, section, line);
        return;
    }

    let source_mods = section_mods(section);
    let is_scope = section == "main" || source_mods.is_some();
    let mods = source_mods.unwrap_or_default();

    let Some(parsed) = parse_expr(value) else {
        preserve(profile, section, line);
        return;
    };

    for (mode, target) in parsed {
        *counter += 1;
        let mapping = Mapping {
            id: format!("imported-{counter}"),
            source: KeyInput {
                key: key.to_string(),
                mods: mods.clone(),
                mode,
            },
            target,
            enabled: true,
        };
        if is_scope {
            profile.mappings.push(mapping);
        } else {
            let layer = match profile.layers.iter_mut().find(|l| l.name == section) {
                Some(layer) => layer,
                None => {
                    profile.layers.push(Layer {
                        id: section.to_string(),
                        name: section.to_string(),
                        mappings: Vec::new(),
                    });
                    profile.layers.last_mut().unwrap()
                }
            };
            layer.mappings.push(mapping);
        }
    }
}

fn section_mods(section: &str) -> Option<Vec<String>> {
    if section == "main" || section == "ids" {
        return None;
    }
    let parts: Vec<&str> = section.split('+').collect();
    if parts.iter().all(|p| keys::is_mod(p)) {
        Some(parts.iter().map(|p| p.to_string()).collect())
    } else {
        None
    }
}

fn parse_expr(value: &str) -> Option<Vec<(InputMode, KeyAction)>> {
    if value == "noop" {
        return Some(vec![(
            InputMode::Press,
            KeyAction {
                kind: ActionKind::Disable,
                key: None,
                mods: Vec::new(),
                layer: None,
                macro_text: None,
            },
        )]);
    }
    if let Some(inner) = call_arg(value, "layer") {
        return Some(vec![(InputMode::Hold, layer_or_mod_action(&inner))]);
    }
    if let Some(inner) = call_arg(value, "overload") {
        let (hold, tap) = inner.split_once(',')?;
        let tap_action = parse_simple(tap.trim())?;
        return Some(vec![
            (InputMode::Tap, tap_action),
            (InputMode::Hold, layer_or_mod_action(hold.trim())),
        ]);
    }
    if let Some(inner) = call_arg(value, "macro") {
        return Some(vec![(
            InputMode::Press,
            KeyAction {
                kind: ActionKind::Macro,
                key: None,
                mods: Vec::new(),
                layer: None,
                macro_text: Some(inner),
            },
        )]);
    }
    parse_simple(value).map(|a| vec![(InputMode::Press, a)])
}

fn call_arg(value: &str, name: &str) -> Option<String> {
    value
        .strip_prefix(name)?
        .strip_prefix('(')?
        .strip_suffix(')')
        .map(|s| s.to_string())
}

fn layer_or_mod_action(name: &str) -> KeyAction {
    if keys::is_mod(name) {
        KeyAction {
            kind: ActionKind::Key,
            key: Some(name.to_string()),
            mods: Vec::new(),
            layer: None,
            macro_text: None,
        }
    } else {
        KeyAction {
            kind: ActionKind::Layer,
            key: None,
            mods: Vec::new(),
            layer: Some(name.to_string()),
            macro_text: None,
        }
    }
}

fn parse_simple(value: &str) -> Option<KeyAction> {
    if keys::is_key(value) {
        return Some(KeyAction {
            kind: ActionKind::Key,
            key: Some(value.to_string()),
            mods: Vec::new(),
            layer: None,
            macro_text: None,
        });
    }
    let parts: Vec<&str> = value.split('-').collect();
    if parts.len() < 2 {
        return None;
    }
    let key = parts.last()?;
    if !keys::is_key(key) {
        return None;
    }
    let mut mods = Vec::new();
    for prefix in &parts[..parts.len() - 1] {
        mods.push(keys::prefix_mod(prefix)?.to_string());
    }
    Some(KeyAction {
        kind: ActionKind::Combo,
        key: Some(key.to_string()),
        mods,
        layer: None,
        macro_text: None,
    })
}

fn preserve(profile: &mut Profile, section: &str, line: &str) {
    profile.preserved.push(PreservedEntry {
        section: section.to_string(),
        raw: line.to_string(),
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::keyd::generate::generate_profile;
    use crate::model::{AppConfig, DeviceRef};

    #[test]
    fn parses_basic_config() {
        let content = "[ids]\n*\n\n[main]\ncapslock = overload(control, esc)\nf1 = C-S-c\n";
        let profile = parse_profile("p", "P", content).unwrap();
        assert_eq!(profile.mappings.len(), 3);
        assert!(profile
            .mappings
            .iter()
            .any(|m| m.source.mode == InputMode::Tap));
    }

    #[test]
    fn preserves_unknown_entries() {
        let content = "[ids]\n*\n\n[main]\ncapslock = swap(weird)\n";
        let profile = parse_profile("p", "P", content).unwrap();
        assert_eq!(profile.preserved.len(), 1);
        assert_eq!(profile.preserved[0].raw, "capslock = swap(weird)");
    }

    #[test]
    fn round_trips_generated_config() {
        let mut profile = AppConfig::empty().profiles[0].clone();
        profile.devices.push(DeviceRef {
            vendor: "04d9".into(),
            product: "0141".into(),
            name: None,
        });
        profile.mappings = vec![
            Mapping {
                id: "1".into(),
                source: KeyInput {
                    key: "capslock".into(),
                    mods: Vec::new(),
                    mode: InputMode::Tap,
                },
                target: KeyAction {
                    kind: ActionKind::Key,
                    key: Some("esc".into()),
                    mods: Vec::new(),
                    layer: None,
                    macro_text: None,
                },
                enabled: true,
            },
            Mapping {
                id: "2".into(),
                source: KeyInput {
                    key: "capslock".into(),
                    mods: Vec::new(),
                    mode: InputMode::Hold,
                },
                target: KeyAction {
                    kind: ActionKind::Key,
                    key: Some("control".into()),
                    mods: Vec::new(),
                    layer: None,
                    macro_text: None,
                },
                enabled: true,
            },
        ];
        let generated = generate_profile(&profile).unwrap();
        let parsed = parse_profile("default", "Default", &generated).unwrap();
        let regenerated = generate_profile(&parsed).unwrap();
        assert_eq!(generated, regenerated);
    }
}
