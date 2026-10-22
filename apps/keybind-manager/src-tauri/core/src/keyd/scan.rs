use serde::{Deserialize, Serialize};

use crate::devices::InputDevice;
use crate::keyd::generate::ManagedFile;
use crate::model::MANAGED_PREFIX;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum IdPattern {
    Wildcard,
    Explicit,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct IdEntry {
    pub raw: String,
    pub excluded: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub device_class: Option<String>,
    pub pattern: IdPattern,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vendor: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub product: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ScannedConfig {
    pub filename: String,
    pub managed: bool,
    pub ids: Vec<IdEntry>,
}

pub fn is_hex_id(s: &str) -> bool {
    s.len() == 4 && s.chars().all(|c| c.is_ascii_hexdigit())
}

pub fn is_managed_scan_name(name: &str) -> bool {
    name.starts_with(MANAGED_PREFIX)
}

pub fn parse_id_entry(line: &str) -> IdEntry {
    let raw = line.to_string();
    let mut rest = line;

    let excluded = rest.starts_with('-');
    if excluded {
        rest = &rest[1..];
    }

    let mut device_class = None;
    if let Some((prefix, tail)) = rest.split_once(':') {
        if prefix == "k" || prefix == "m" {
            device_class = Some(prefix.to_string());
            rest = tail;
        }
    }

    if rest == "*" {
        return IdEntry {
            raw,
            excluded,
            device_class,
            pattern: IdPattern::Wildcard,
            vendor: None,
            product: None,
        };
    }

    if let Some((vendor, product)) = rest.split_once(':') {
        let vendor = vendor.to_lowercase();
        let product = product.to_lowercase();
        if is_hex_id(&vendor) && is_hex_id(&product) {
            return IdEntry {
                raw,
                excluded,
                device_class,
                pattern: IdPattern::Explicit,
                vendor: Some(vendor),
                product: Some(product),
            };
        }
    }

    IdEntry {
        raw,
        excluded,
        device_class,
        pattern: IdPattern::Unknown,
        vendor: None,
        product: None,
    }
}

pub fn parse_ids_section(content: &str) -> Vec<IdEntry> {
    let mut in_ids = false;
    let mut ids = Vec::new();
    for raw_line in content.lines() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some(rest) = line.strip_prefix('[') {
            if let Some(name) = rest.strip_suffix(']') {
                in_ids = name.trim() == "ids";
                continue;
            }
        }
        if in_ids {
            ids.push(parse_id_entry(line));
        }
    }
    ids
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MatchRank {
    Wildcard,
    Explicit,
}

fn id_targets_device(id: &IdEntry, device: &InputDevice) -> bool {
    if let Some(class) = &id.device_class {
        if class == "m" {
            return false;
        }
    }
    match id.pattern {
        IdPattern::Wildcard => true,
        IdPattern::Explicit => {
            id.vendor
                .as_deref()
                .is_some_and(|v| v.eq_ignore_ascii_case(&device.vendor))
                && id
                    .product
                    .as_deref()
                    .is_some_and(|p| p.eq_ignore_ascii_case(&device.product))
        }
        IdPattern::Unknown => false,
    }
}

pub fn config_rank_for_device(config: &ScannedConfig, device: &InputDevice) -> Option<MatchRank> {
    let mut best: Option<MatchRank> = None;
    for id in &config.ids {
        if !id_targets_device(id, device) {
            continue;
        }
        if id.excluded {
            return None;
        }
        let rank = match id.pattern {
            IdPattern::Wildcard => MatchRank::Wildcard,
            IdPattern::Explicit => MatchRank::Explicit,
            IdPattern::Unknown => continue,
        };
        best = Some(match best {
            Some(current) => current.max(rank),
            None => rank,
        });
    }
    best
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigMatch {
    pub filename: String,
    pub managed: bool,
    pub rank: MatchRank,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyboardConflict {
    pub device_name: String,
    pub vendor: String,
    pub product: String,
    pub matches: Vec<ConfigMatch>,
    pub conflict: bool,
    #[serde(default)]
    pub shadowed: bool,
}

pub fn compute_conflicts(
    configs: &[ScannedConfig],
    devices: &[InputDevice],
) -> Vec<KeyboardConflict> {
    let mut seen = std::collections::BTreeSet::new();
    devices
        .iter()
        .filter(|d| d.keyboard && !d.virtual_keyd)
        .filter(|d| seen.insert((d.name.clone(), d.vendor.clone(), d.product.clone())))
        .map(|device| {
            let mut matches: Vec<ConfigMatch> = configs
                .iter()
                .filter_map(|config| {
                    config_rank_for_device(config, device).map(|rank| ConfigMatch {
                        filename: config.filename.clone(),
                        managed: config.managed,
                        rank,
                    })
                })
                .collect();
            matches.sort_by(|a, b| b.rank.cmp(&a.rank).then(a.filename.cmp(&b.filename)));

            let best_rank = matches.first().map(|m| m.rank);
            let conflict = best_rank
                .map(|rank| matches.iter().filter(|m| m.rank == rank).count() > 1)
                .unwrap_or(false);
            let shadowed = best_rank.is_some_and(|rank| {
                matches.iter().any(|m| m.managed && m.rank < rank)
                    && !matches.iter().any(|m| m.managed && m.rank == rank)
            });

            KeyboardConflict {
                device_name: device.name.clone(),
                vendor: device.vendor.clone(),
                product: device.product.clone(),
                matches,
                conflict,
                shadowed,
            }
        })
        .collect()
}

/// Replaces the currently-managed configs in `scanned` with the given
/// about-to-be-written `files` and drops the `retired` foreign configs, so conflict detection can be run against the
/// post-apply state before anything touches disk.
pub fn simulate_managed_configs(
    scanned: Vec<ScannedConfig>,
    files: &[ManagedFile],
    retired: &[String],
) -> Vec<ScannedConfig> {
    let mut out: Vec<ScannedConfig> = scanned
        .into_iter()
        .filter(|c| !c.managed && !retired.contains(&c.filename))
        .collect();
    for file in files {
        out.push(ScannedConfig {
            filename: file.name.clone(),
            managed: true,
            ids: parse_ids_section(&file.content),
        });
    }
    out
}

/// Conflicts that should block an apply: a keyboard where one of our managed
/// configs shares top priority with another config.
pub fn conflicts_blocking_apply(
    configs: &[ScannedConfig],
    devices: &[InputDevice],
) -> Vec<KeyboardConflict> {
    compute_conflicts(configs, devices)
        .into_iter()
        .filter(|c| c.shadowed || (c.conflict && c.matches.iter().any(|m| m.managed)))
        .collect()
}

/// Human-readable, actionable description of blocking conflicts, naming the
/// conflicting files and keyboards.
pub fn describe_conflicts(conflicts: &[KeyboardConflict]) -> String {
    conflicts
        .iter()
        .map(|c| {
            let names: Vec<&str> = c.matches.iter().map(|m| m.filename.as_str()).collect();
            let winner = c.matches.first().map(|m| m.filename.as_str()).unwrap_or("");
            if c.shadowed {
                format!(
                    "{} ({}:{}) uses {winner}, which overrides Keybind Manager for this keyboard",
                    c.device_name, c.vendor, c.product
                )
            } else {
                format!(
                    "{} ({}:{}): {}",
                    c.device_name,
                    c.vendor,
                    c.product,
                    names.join(", ")
                )
            }
        })
        .collect::<Vec<_>>()
        .join("; ")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn device(vendor: &str, product: &str) -> InputDevice {
        InputDevice {
            name: "Test Keyboard".into(),
            vendor: vendor.into(),
            product: product.into(),
            phys: None,
            keyboard: true,
            virtual_keyd: false,
            kind: crate::devices::DeviceKind::Keyboard,
        }
    }

    #[test]
    fn parses_wildcard() {
        let id = parse_id_entry("*");
        assert_eq!(id.pattern, IdPattern::Wildcard);
        assert!(!id.excluded);
        assert!(id.device_class.is_none());
    }

    #[test]
    fn parses_explicit_id() {
        let id = parse_id_entry("04d9:0141");
        assert_eq!(id.pattern, IdPattern::Explicit);
        assert_eq!(id.vendor.as_deref(), Some("04d9"));
        assert_eq!(id.product.as_deref(), Some("0141"));
    }

    #[test]
    fn parses_exclusion() {
        let id = parse_id_entry("-04d9:0141");
        assert!(id.excluded);
        assert_eq!(id.pattern, IdPattern::Explicit);
    }

    #[test]
    fn parses_device_class_prefix() {
        let id = parse_id_entry("k:04d9:0141");
        assert_eq!(id.device_class.as_deref(), Some("k"));
        assert_eq!(id.pattern, IdPattern::Explicit);

        let mouse = parse_id_entry("m:*");
        assert_eq!(mouse.device_class.as_deref(), Some("m"));
        assert_eq!(mouse.pattern, IdPattern::Wildcard);
    }

    #[test]
    fn parses_excluded_wildcard_with_class() {
        let id = parse_id_entry("-k:04d9:0141");
        assert!(id.excluded);
        assert_eq!(id.device_class.as_deref(), Some("k"));
    }

    #[test]
    fn unknown_pattern_is_preserved() {
        let id = parse_id_entry("garbage");
        assert_eq!(id.pattern, IdPattern::Unknown);
    }

    #[test]
    fn parses_ids_section_only() {
        let content = "[ids]\n*\n-046d:c52b\n\n[main]\ncapslock = esc\n";
        let ids = parse_ids_section(content);
        assert_eq!(ids.len(), 2);
        assert_eq!(ids[0].pattern, IdPattern::Wildcard);
        assert!(ids[1].excluded);
    }

    #[test]
    fn explicit_beats_wildcard_rank() {
        let wildcard = ScannedConfig {
            filename: "keybind-manager-default.conf".into(),
            managed: true,
            ids: vec![parse_id_entry("*")],
        };
        let explicit = ScannedConfig {
            filename: "laptop.conf".into(),
            managed: false,
            ids: vec![parse_id_entry("04d9:0141")],
        };
        let dev = device("04d9", "0141");
        assert_eq!(
            config_rank_for_device(&wildcard, &dev),
            Some(MatchRank::Wildcard)
        );
        assert_eq!(
            config_rank_for_device(&explicit, &dev),
            Some(MatchRank::Explicit)
        );
    }

    #[test]
    fn exclusion_removes_match() {
        let config = ScannedConfig {
            filename: "default.conf".into(),
            managed: false,
            ids: vec![parse_id_entry("*"), parse_id_entry("-04d9:0141")],
        };
        let dev = device("04d9", "0141");
        assert_eq!(config_rank_for_device(&config, &dev), None);
    }

    #[test]
    fn detects_conflict_between_two_wildcards() {
        let ours = ScannedConfig {
            filename: "keybind-manager-default.conf".into(),
            managed: true,
            ids: vec![parse_id_entry("*")],
        };
        let theirs = ScannedConfig {
            filename: "default.conf".into(),
            managed: false,
            ids: vec![parse_id_entry("*")],
        };
        let dev = device("04d9", "0141");
        let conflicts = compute_conflicts(&[ours, theirs], &[dev]);
        assert_eq!(conflicts.len(), 1);
        assert!(conflicts[0].conflict);
        assert_eq!(conflicts[0].matches.len(), 2);
    }

    #[test]
    fn managed_wildcard_is_shadowed_by_foreign_explicit() {
        let dev = device("1ea7", "7777");
        let configs = vec![
            ScannedConfig {
                filename: "keybind-manager-default.conf".into(),
                managed: true,
                ids: parse_ids_section("[ids]\n*\n"),
            },
            ScannedConfig {
                filename: "zoom65.conf".into(),
                managed: false,
                ids: parse_ids_section("[ids]\n1ea7:7777\n"),
            },
        ];
        let result = compute_conflicts(&configs, std::slice::from_ref(&dev));
        assert!(result[0].shadowed);
        assert!(!result[0].conflict);
        assert_eq!(conflicts_blocking_apply(&configs, &[dev]).len(), 1);
    }

    #[test]
    fn no_conflict_when_explicit_outranks_wildcard() {
        let catch_all = ScannedConfig {
            filename: "default.conf".into(),
            managed: false,
            ids: vec![parse_id_entry("*")],
        };
        let scoped = ScannedConfig {
            filename: "keybind-manager-laptop.conf".into(),
            managed: true,
            ids: vec![parse_id_entry("04d9:0141")],
        };
        let dev = device("04d9", "0141");
        let conflicts = compute_conflicts(&[catch_all, scoped], &[dev]);
        assert_eq!(conflicts.len(), 1);
        assert!(!conflicts[0].conflict);
        assert_eq!(
            conflicts[0].matches[0].filename,
            "keybind-manager-laptop.conf"
        );
    }

    #[test]
    fn no_match_skips_device() {
        let scoped = ScannedConfig {
            filename: "other.conf".into(),
            managed: false,
            ids: vec![parse_id_entry("aaaa:bbbb")],
        };
        let dev = device("04d9", "0141");
        let conflicts = compute_conflicts(&[scoped], &[dev]);
        assert_eq!(conflicts.len(), 1);
        assert!(conflicts[0].matches.is_empty());
        assert!(!conflicts[0].conflict);
    }

    #[test]
    fn simulate_replaces_managed_configs_only() {
        let scanned = vec![
            ScannedConfig {
                filename: "keybind-manager-default.conf".into(),
                managed: true,
                ids: vec![parse_id_entry("*")],
            },
            ScannedConfig {
                filename: "other.conf".into(),
                managed: false,
                ids: vec![parse_id_entry("04d9:0141")],
            },
        ];
        let files = vec![ManagedFile {
            name: "keybind-manager-laptop.conf".into(),
            content: "[ids]\n04d9:0141\n".into(),
        }];
        let simulated = simulate_managed_configs(scanned, &files, &[]);
        assert_eq!(simulated.len(), 2);
        assert!(simulated
            .iter()
            .any(|c| c.filename == "keybind-manager-laptop.conf" && c.managed));
        assert!(!simulated
            .iter()
            .any(|c| c.filename == "keybind-manager-default.conf"));
        assert!(simulated
            .iter()
            .any(|c| c.filename == "other.conf" && !c.managed));
    }

    #[test]
    fn simulate_drops_retired_foreign_configs() {
        let dev = device("1ea7", "7777");
        let scanned = vec![ScannedConfig {
            filename: "zoom65.conf".into(),
            managed: false,
            ids: parse_ids_section("[ids]\n1ea7:7777\n"),
        }];
        let files = vec![
            ManagedFile {
                name: "keybind-manager-default.conf".into(),
                content: "[ids]\n*\n".into(),
            },
            ManagedFile {
                name: "keybind-manager-zoom65.conf".into(),
                content: "[ids]\n1ea7:7777\n".into(),
            },
        ];
        let simulated = simulate_managed_configs(scanned, &files, &["zoom65.conf".into()]);
        assert!(conflicts_blocking_apply(&simulated, &[dev]).is_empty());
    }

    #[test]
    fn conflicts_blocking_apply_requires_our_config_involved() {
        let ours = ScannedConfig {
            filename: "keybind-manager-default.conf".into(),
            managed: true,
            ids: vec![parse_id_entry("*")],
        };
        let theirs = ScannedConfig {
            filename: "default.conf".into(),
            managed: false,
            ids: vec![parse_id_entry("*")],
        };
        let dev = device("04d9", "0141");
        let blocking = conflicts_blocking_apply(&[ours, theirs], &[dev]);
        assert_eq!(blocking.len(), 1);

        let a = ScannedConfig {
            filename: "a.conf".into(),
            managed: false,
            ids: vec![parse_id_entry("*")],
        };
        let b = ScannedConfig {
            filename: "b.conf".into(),
            managed: false,
            ids: vec![parse_id_entry("*")],
        };
        let dev2 = device("04d9", "0141");
        let none_blocking = conflicts_blocking_apply(&[a, b], &[dev2]);
        assert!(none_blocking.is_empty());
    }

    #[test]
    fn describe_conflicts_names_files_and_keyboard() {
        let dev = device("04d9", "0141");
        let conflicts = compute_conflicts(
            &[
                ScannedConfig {
                    filename: "keybind-manager-default.conf".into(),
                    managed: true,
                    ids: vec![parse_id_entry("*")],
                },
                ScannedConfig {
                    filename: "default.conf".into(),
                    managed: false,
                    ids: vec![parse_id_entry("*")],
                },
            ],
            &[dev],
        );
        let blocking: Vec<KeyboardConflict> =
            conflicts.into_iter().filter(|c| c.conflict).collect();
        let description = describe_conflicts(&blocking);
        assert!(description.contains("Test Keyboard"));
        assert!(description.contains("keybind-manager-default.conf"));
        assert!(description.contains("default.conf"));
    }
}
