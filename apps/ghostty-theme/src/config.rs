use std::fs;
use std::io::{self, Write};
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};

#[derive(Clone, Debug, PartialEq)]
pub struct Settings {
    pub theme: String,
    pub font: String,
    pub font_size: i32,
    pub line_height: i32,
    pub letter_spacing: i32,
    pub opacity: i32,
    pub blur: i32,
    pub padding: i32,
    pub decorations: bool,
    pub background: String,
    pub image_opacity: i32,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: "default".into(),
            font: "monospace".into(),
            font_size: 14,
            line_height: 0,
            letter_spacing: 0,
            opacity: 100,
            blur: 0,
            padding: 0,
            decorations: true,
            background: String::new(),
            image_opacity: 100,
        }
    }
}

pub fn parse_percent(value: &str, fallback: i32) -> i32 {
    let value = value.trim();
    let value = value.strip_suffix('%').unwrap_or(value);
    value.parse().unwrap_or(fallback)
}

fn parse_unit(value: &str) -> Option<i32> {
    value.parse::<f64>().ok().map(|n| (n * 100.0 + 0.5) as i32)
}

pub fn parse_settings(raw: &str) -> Settings {
    let mut s = Settings::default();
    for line in raw.lines() {
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        if line.trim_start().starts_with('#') {
            continue;
        }
        let value = value.trim().trim_matches('"');
        match key.trim() {
            "theme" => s.theme = value.into(),
            "font-family" => s.font = value.into(),
            "font-size" => {
                if let Ok(n) = value.parse::<f64>() {
                    s.font_size = (n + 0.5) as i32;
                }
            }
            "adjust-cell-height" => s.line_height = parse_percent(value, s.line_height),
            "adjust-cell-width" => s.letter_spacing = parse_percent(value, s.letter_spacing),
            "background-opacity" => s.opacity = parse_unit(value).unwrap_or(s.opacity),
            "background-blur" => s.blur = value.parse().unwrap_or(0),
            "window-padding-x" => s.padding = value.parse().unwrap_or(0),
            "window-decoration" => s.decorations = value != "none" && value != "false",
            "background-image" => s.background = value.into(),
            "background-image-opacity" => {
                s.image_opacity = parse_unit(value).unwrap_or(s.image_opacity)
            }
            _ => {}
        }
    }
    s
}

pub fn load_settings(path: &Path) -> io::Result<(Settings, String)> {
    let raw = fs::read_to_string(path)?;
    Ok((parse_settings(&raw), raw))
}

const MANAGED_KEYS: [&str; 11] = [
    "theme",
    "font-family",
    "font-size",
    "adjust-cell-height",
    "adjust-cell-width",
    "background-opacity",
    "background-blur",
    "window-padding-x",
    "window-decoration",
    "background-image",
    "background-image-opacity",
];

fn managed_values(s: &Settings) -> [String; 11] {
    let font = s.font.replace('\\', "\\\\").replace('"', "\\\"");
    [
        s.theme.clone(),
        format!("\"{font}\""),
        s.font_size.to_string(),
        format!("{}%", s.line_height),
        format!("{}%", s.letter_spacing),
        format!("{:.2}", f64::from(s.opacity) / 100.0),
        s.blur.to_string(),
        s.padding.to_string(),
        if s.decorations { "auto" } else { "none" }.into(),
        s.background.clone(),
        format!("{:.2}", f64::from(s.image_opacity) / 100.0),
    ]
}

pub fn render_config(raw: &str, s: &Settings) -> String {
    let values = managed_values(s);
    let mut seen = [false; MANAGED_KEYS.len()];
    let mut out = String::with_capacity(raw.len() + 128);
    for line in raw.trim_end_matches('\n').split('\n') {
        let managed = line.split_once('=').and_then(|(key, _)| {
            MANAGED_KEYS
                .iter()
                .position(|managed| *managed == key.trim())
        });
        match managed {
            Some(i) => {
                seen[i] = true;
                push_setting(&mut out, MANAGED_KEYS[i], &values[i]);
            }
            None => {
                out.push_str(line);
                out.push('\n');
            }
        }
    }
    for (i, key) in MANAGED_KEYS.iter().enumerate() {
        if !seen[i] {
            push_setting(&mut out, key, &values[i]);
        }
    }
    out
}

fn push_setting(out: &mut String, key: &str, value: &str) {
    out.push_str(key);
    out.push_str(" = ");
    out.push_str(value);
    out.push('\n');
}

const THEME_IMAGES: &[(&str, &str)] = &[
    ("pastel-dark", "pastel-dark-bg.png"),
    ("warm-sunset", "warm-sunset-bg.png"),
    ("Catppuccin Mocha", "catppuccin-mocha-gradient.png"),
    ("Duskfox", "duskfox-plum.png"),
    ("Gruvbox Dark", "rice-gruvbox-mountains.png"),
    ("Gruvbox Dark Hard", "rice-gruvbox-mountains.png"),
    ("Gruvbox Material", "rice-gruvbox-lowpoly.png"),
    ("Gruvbox Material Dark", "rice-gruvbox-lowpoly.png"),
    ("Nord", "rice-nord-polar.png"),
    ("Nord Wave", "rice-nord-polar.png"),
    ("Nordfox", "rice-nord-polar.png"),
    ("TokyoNight", "rice-tokyonight-outrun.png"),
    ("TokyoNight Night", "rice-tokyonight-outrun.png"),
    ("TokyoNight Moon", "rice-tokyonight-outrun.png"),
    ("TokyoNight Storm", "rice-tokyonight-outrun.png"),
    ("Catppuccin Macchiato", "rice-catppuccin-waves.png"),
    ("Catppuccin Frappe", "rice-catppuccin-waves.png"),
    ("Rose Pine", "rice-rosepine-moon.png"),
    ("Rose Pine Moon", "rice-rosepine-moon.png"),
    ("Rosé Pine", "rice-rosepine-moon.png"),
    ("Rosé Pine Moon", "rice-rosepine-moon.png"),
    ("Dracula", "rice-dracula-blobs.png"),
    ("Dracula+", "rice-dracula-blobs.png"),
    ("Everforest Dark Hard", "rice-everforest-pines.png"),
    ("Kanagawa Wave", "rice-kanagawa-wave.png"),
    ("Kanagawa Dragon", "rice-kanagawa-wave.png"),
    ("Ayu Mirage", "rice-ayu-skyline.png"),
    ("Ayu", "rice-ayu-skyline.png"),
];

pub fn theme_image(theme: &str, assets: &Path) -> Option<PathBuf> {
    THEME_IMAGES
        .iter()
        .find(|(name, _)| *name == theme)
        .map(|(_, file)| assets.join(file))
}

pub fn write_atomic(path: &Path, data: &[u8]) -> io::Result<()> {
    static COUNTER: AtomicU32 = AtomicU32::new(0);
    let dir = path.parent().unwrap_or(Path::new("."));
    fs::create_dir_all(dir)?;
    let tmp = dir.join(format!(
        ".ghostty-config-{}-{}",
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    let result = (|| {
        let mut file = fs::File::create(&tmp)?;
        file.write_all(data)?;
        file.set_permissions(fs::Permissions::from_mode(0o644))?;
        drop(file);
        fs::rename(&tmp, path)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn load_and_render_preserves_unrelated_lines() {
        let original = "# keep this comment\ntheme = old-theme\nfont-family = \"Old Mono\"\nfont-size = 12.5\nadjust-cell-height = 5%\nadjust-cell-width = -2%\nbackground-opacity = 0.80\nwindow-decoration = none\nkeybind = ctrl+h=new_split:right\n";
        let mut cfg = parse_settings(original);
        assert_eq!(cfg.theme, "old-theme");
        assert_eq!(cfg.font, "Old Mono");
        assert_eq!(cfg.font_size, 13);
        assert_eq!(cfg.line_height, 5);
        assert_eq!(cfg.letter_spacing, -2);
        assert_eq!(cfg.opacity, 80);
        assert!(!cfg.decorations);

        cfg.theme = "new-theme".into();
        cfg.font = "New Mono".into();
        cfg.line_height = 20;
        let rendered = render_config(original, &cfg);
        for want in [
            "# keep this comment",
            "theme = new-theme",
            "font-family = \"New Mono\"",
            "adjust-cell-height = 20%",
            "keybind = ctrl+h=new_split:right",
        ] {
            assert!(rendered.contains(want), "missing {want:?} in\n{rendered}");
        }
        assert_eq!(rendered.matches("theme = ").count(), 1);
    }

    #[test]
    fn render_adds_missing_managed_settings() {
        let rendered = render_config("theme = demo\n", &Settings::default());
        for key in [
            "font-family =",
            "font-size =",
            "adjust-cell-height =",
            "background-opacity =",
            "window-decoration =",
        ] {
            assert!(rendered.contains(key), "missing {key:?}");
        }
        assert!(!rendered.contains("\n\n"));
    }

    #[test]
    fn empty_background_clears_image_even_for_mapped_theme() {
        let cfg = Settings {
            theme: "pastel-dark".into(),
            ..Settings::default()
        };
        let rendered = render_config("background-image = /old/image.png\n", &cfg);
        assert!(rendered.contains("background-image = \n"));
        assert!(!rendered.contains("pastel-dark-bg.png"));
    }

    #[test]
    fn explicit_background_wins_over_theme_image() {
        let cfg = Settings {
            theme: "pastel-dark".into(),
            background: "/themes/assets/graphite.png".into(),
            image_opacity: 70,
            ..Settings::default()
        };
        let rendered = render_config(
            "background-image = /old.png\nbackground-image-opacity = 0.5\n",
            &cfg,
        );
        assert!(rendered.contains("background-image = /themes/assets/graphite.png"));
        assert!(rendered.contains("background-image-opacity = 0.70"));
        assert!(!rendered.contains("pastel-dark-bg.png"));
        assert_eq!(rendered.matches("background-image =").count(), 1);
    }

    #[test]
    fn parse_reads_background() {
        let cfg = parse_settings("background-image = /x/y.png\nbackground-image-opacity = 0.35\n");
        assert_eq!(cfg.background, "/x/y.png");
        assert_eq!(cfg.image_opacity, 35);
    }
}
