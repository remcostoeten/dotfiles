use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use rayon::prelude::*;

pub type Rgb = [u8; 3];

#[derive(Clone, Debug)]
pub struct Theme {
    pub name: String,
    pub key: String,
    pub custom: bool,
    pub background: Rgb,
    pub foreground: Rgb,
    pub cursor: Rgb,
    pub selection: Rgb,
    pub palette: [Option<Rgb>; 16],
}

impl Theme {
    pub fn fallback(name: &str) -> Self {
        Self {
            name: name.into(),
            key: name.to_lowercase(),
            custom: false,
            background: [0x11, 0x11, 0x18],
            foreground: [0xe8, 0xe8, 0xf0],
            cursor: [0xa7, 0x8b, 0xfa],
            selection: [0x30, 0x30, 0x40],
            palette: [None; 16],
        }
    }
}

pub fn parse_hex(value: &str) -> Option<Rgb> {
    let hex = value.trim();
    let hex = hex.strip_prefix('#').unwrap_or(hex);
    if hex.len() != 6 || !hex.is_ascii() {
        return None;
    }
    let channel = |i: usize| u8::from_str_radix(&hex[i..i + 2], 16).ok();
    Some([channel(0)?, channel(2)?, channel(4)?])
}

pub fn parse_theme(name: &str, source: &str, custom: bool) -> Theme {
    let mut theme = Theme::fallback(name);
    theme.custom = custom;
    for line in source.lines() {
        let line = line.trim();
        if line.starts_with('#') {
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        let value = value.trim();
        match key.trim() {
            "background" => theme.background = parse_hex(value).unwrap_or(theme.background),
            "foreground" => theme.foreground = parse_hex(value).unwrap_or(theme.foreground),
            "cursor-color" => theme.cursor = parse_hex(value).unwrap_or(theme.cursor),
            "selection-background" => theme.selection = parse_hex(value).unwrap_or(theme.selection),
            "palette" => {
                if let Some((index, color)) = value.split_once('=')
                    && let Ok(i @ 0..16) = index.trim().parse::<usize>()
                {
                    theme.palette[i] = parse_hex(color);
                }
            }
            _ => {}
        }
    }
    theme
}

pub fn discover_themes(custom_dir: &Path, system_dir: &Path) -> Vec<Theme> {
    let mut sources: HashMap<String, (String, PathBuf, bool)> = HashMap::with_capacity(512);
    for (dir, custom) in [(system_dir, false), (custom_dir, true)] {
        let Ok(entries) = fs::read_dir(dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.starts_with('.') || entry.file_type().is_ok_and(|kind| kind.is_dir()) {
                continue;
            }
            sources.insert(name.to_lowercase(), (name, entry.path(), custom));
        }
    }
    let mut themes: Vec<Theme> = sources
        .into_par_iter()
        .map(|(_, (name, path, custom))| {
            let source = fs::read_to_string(&path).unwrap_or_default();
            parse_theme(&name, &source, custom)
        })
        .collect();
    themes.par_sort_unstable_by(|a, b| a.key.cmp(&b.key));
    themes
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_theme_file() {
        let theme = parse_theme(
            "neon",
            "palette = 0=#101018\npalette = 15=#ffffff\nbackground = #111119\nforeground = eeeeff\ncursor-color = #7cf7d4\nselection-background = #303044\n",
            true,
        );
        assert_eq!(theme.background, [0x11, 0x11, 0x19]);
        assert_eq!(theme.foreground, [0xee, 0xee, 0xff]);
        assert_eq!(theme.cursor, [0x7c, 0xf7, 0xd4]);
        assert_eq!(theme.palette[0], Some([0x10, 0x10, 0x18]));
        assert_eq!(theme.palette[15], Some([0xff, 0xff, 0xff]));
        assert!(theme.custom);
    }

    #[test]
    fn custom_theme_overrides_system_theme() {
        let root = std::env::temp_dir().join(format!("ghostty-theme-test-{}", std::process::id()));
        let (system, custom) = (root.join("system"), root.join("custom"));
        fs::create_dir_all(&system).unwrap();
        fs::create_dir_all(&custom).unwrap();
        fs::write(system.join("same"), "background = #000000\n").unwrap();
        fs::write(custom.join("same"), "background = #121212\n").unwrap();
        let themes = discover_themes(&custom, &system);
        fs::remove_dir_all(&root).unwrap();
        assert_eq!(themes.len(), 1);
        assert_eq!(themes[0].background, [0x12, 0x12, 0x12]);
        assert!(themes[0].custom);
    }
}
