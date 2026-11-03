use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use crate::config::{
    MANAGED_KEYS, Settings, apply_setting, managed_values, setting_lines, write_atomic,
};

#[derive(Clone, Debug)]
pub struct Preset {
    pub name: String,
    pub key: String,
    pub description: String,
    entries: Vec<(String, String)>,
}

impl Preset {
    pub fn parse(name: &str, source: &str, assets: &Path) -> Self {
        let description = source
            .lines()
            .next()
            .and_then(|line| line.trim().strip_prefix('#'))
            .map(|text| text.trim().to_string())
            .unwrap_or_default();
        let entries = setting_lines(source)
            .filter(|(key, _)| MANAGED_KEYS.contains(key))
            .map(|(key, value)| {
                let value = value.trim();
                let value = if key == "background-image" {
                    resolve_image(value, assets)
                } else {
                    value.to_string()
                };
                (key.to_string(), value)
            })
            .collect();
        Self {
            name: name.into(),
            key: name.to_lowercase(),
            description,
            entries,
        }
    }

    pub fn apply(&self, base: &Settings) -> Settings {
        let mut out = base.clone();
        for (key, value) in &self.entries {
            apply_setting(&mut out, key, value);
        }
        out
    }

    pub fn matches(&self, cfg: &Settings) -> bool {
        !self.entries.is_empty() && self.apply(cfg) == *cfg
    }

    pub fn get(&self, key: &str) -> Option<&str> {
        self.entries
            .iter()
            .find(|(name, _)| name == key)
            .map(|(_, value)| value.as_str())
    }
}

fn resolve_image(value: &str, assets: &Path) -> String {
    if value.is_empty() || Path::new(value).is_absolute() {
        return value.into();
    }
    assets.join(value).to_string_lossy().into_owned()
}

pub fn discover_presets(dir: &Path, assets: &Path) -> Vec<Preset> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut out: Vec<Preset> = entries
        .flatten()
        .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_file()))
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.starts_with('.') {
                return None;
            }
            let source = fs::read_to_string(entry.path()).ok()?;
            Some(Preset::parse(&name, &source, assets))
        })
        .collect();
    out.sort_by(|a, b| a.key.cmp(&b.key));
    out
}

pub fn find_preset<'a>(list: &'a [Preset], query: &str) -> Option<&'a Preset> {
    list.iter().find(|p| p.name.eq_ignore_ascii_case(query))
}

pub fn preset_slug(name: &str) -> Option<String> {
    let mut slug = String::with_capacity(name.len());
    for c in name.trim().chars() {
        match c {
            'a'..='z' | '0'..='9' | '_' => slug.push(c),
            'A'..='Z' => slug.push(c.to_ascii_lowercase()),
            ' ' | '-' | '.' if !slug.is_empty() && !slug.ends_with('-') => slug.push('-'),
            _ => {}
        }
    }
    let slug = slug.trim_end_matches('-').to_string();
    (!slug.is_empty()).then_some(slug)
}

pub fn render_preset(cfg: &Settings, description: &str, assets: &Path) -> String {
    let mut out = format!("# {description}\n");
    for (key, value) in MANAGED_KEYS.iter().zip(managed_values(cfg)) {
        let value = if *key == "background-image" {
            Path::new(&value)
                .strip_prefix(assets)
                .map_or(value.clone(), |relative| {
                    relative.to_string_lossy().into_owned()
                })
        } else {
            value
        };
        out.push_str(&format!("{key} = {value}\n"));
    }
    out
}

pub fn save_preset(dir: &Path, name: &str, cfg: &Settings, assets: &Path) -> io::Result<PathBuf> {
    let slug = preset_slug(name)
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "preset name is empty"))?;
    let description = format!("{}, {}", cfg.theme, cfg.font);
    let path = dir.join(&slug);
    write_atomic(&path, render_preset(cfg, &description, assets).as_bytes())?;
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::parse_settings;

    #[test]
    fn partial_preset_only_overrides_its_keys() {
        let assets = Path::new("/assets");
        let preset = Preset::parse(
            "calm",
            "# Quiet and dim\ntheme = Nord\nbackground-image = polar.png\nkeybind = ctrl+x=noop\n",
            assets,
        );
        assert_eq!(preset.description, "Quiet and dim");
        let base = Settings {
            font: "Keep Mono".into(),
            ..Settings::default()
        };
        let applied = preset.apply(&base);
        assert_eq!(applied.theme, "Nord");
        assert_eq!(applied.font, "Keep Mono");
        assert_eq!(applied.background, "/assets/polar.png");
        assert!(preset.matches(&applied));
        assert!(!preset.matches(&base));
    }

    #[test]
    fn rendered_preset_round_trips() {
        let assets = Path::new("/assets");
        let cfg = Settings {
            theme: "Rose Pine Moon".into(),
            font: "Iosevka NF".into(),
            letter_spacing: 4,
            background: "/assets/moon.png".into(),
            image_opacity: 12,
            ..Settings::default()
        };
        let text = render_preset(&cfg, "moon", assets);
        assert!(text.contains("background-image = moon.png\n"));
        assert_eq!(parse_settings(&text).font, "Iosevka NF");
        assert_eq!(
            Preset::parse("moon", &text, assets).apply(&Settings::default()),
            cfg
        );
    }

    #[test]
    fn slugs_are_file_safe() {
        assert_eq!(
            preset_slug("  My Night Look ").as_deref(),
            Some("my-night-look")
        );
        assert_eq!(preset_slug("../etc/passwd").as_deref(), Some("etcpasswd"));
        assert_eq!(preset_slug("!!!"), None);
    }
}
