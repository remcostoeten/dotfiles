use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::config::write_atomic;

pub struct Paths {
    pub config: PathBuf,
    pub custom_themes: PathBuf,
    pub system_themes: PathBuf,
    pub assets: PathBuf,
    pub state: PathBuf,
    pub cache: PathBuf,
}

impl Paths {
    pub fn resolve() -> Self {
        let home = PathBuf::from(std::env::var_os("HOME").unwrap_or_default());
        let root = std::env::var_os("DOTFILES")
            .filter(|value| !value.is_empty())
            .map_or_else(|| home.join(".config/dotfiles"), PathBuf::from);
        let cache = std::env::var_os("XDG_CACHE_HOME")
            .filter(|value| !value.is_empty())
            .map_or_else(|| home.join(".cache"), PathBuf::from);
        Self {
            config: root.join("configs/ghostty/config"),
            custom_themes: root.join("configs/ghostty/themes"),
            system_themes: PathBuf::from("/usr/share/ghostty/themes"),
            assets: root.join("configs/ghostty/assets"),
            state: home.join(".local/state/ghostty-theme"),
            cache: cache.join("ghostty-theme"),
        }
    }

    pub fn favorites(&self) -> PathBuf {
        self.state.join("favorites")
    }

    pub fn recents(&self) -> PathBuf {
        self.state.join("recents")
    }
}

pub fn read_lines(path: &Path) -> Vec<String> {
    fs::read_to_string(path)
        .unwrap_or_default()
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(String::from)
        .collect()
}

fn write_lines(path: &Path, lines: &[String]) {
    let mut data = lines.join("\n");
    data.push('\n');
    let _ = write_atomic(path, data.as_bytes());
}

pub fn toggle_line(path: &Path, value: &str) -> (bool, Vec<String>) {
    let mut lines = read_lines(path);
    let before = lines.len();
    lines.retain(|line| line != value);
    let added = lines.len() == before;
    if added {
        lines.push(value.into());
    }
    lines.sort_by_cached_key(|line| line.to_lowercase());
    write_lines(path, &lines);
    (added, lines)
}

pub fn record_recent(path: &Path, value: &str) -> Vec<String> {
    let mut lines = vec![value.to_string()];
    lines.extend(
        read_lines(path)
            .into_iter()
            .filter(|line| line != value)
            .take(14),
    );
    write_lines(path, &lines);
    lines
}

pub fn discover_fonts() -> Vec<String> {
    let Ok(output) = Command::new("fc-list").args([":", "family"]).output() else {
        return [
            "JetBrainsMono Nerd Font",
            "FiraCode Nerd Font",
            "Hack Nerd Font",
            "CaskaydiaCove Nerd Font",
            "MesloLGS Nerd Font",
            "monospace",
        ]
        .map(String::from)
        .to_vec();
    };
    let text = String::from_utf8_lossy(&output.stdout);
    let unique: HashSet<&str> = text
        .lines()
        .flat_map(|line| line.split(','))
        .map(str::trim)
        .filter(|family| !family.is_empty())
        .collect();
    let mut fonts: Vec<String> = unique.into_iter().map(String::from).collect();
    fonts.sort_by_cached_key(|font| font.to_lowercase());
    fonts
}

#[derive(Clone, Debug)]
pub struct Background {
    pub name: String,
    pub key: String,
    pub path: String,
}

const IMAGE_EXTENSIONS: [&str; 4] = ["png", "jpg", "jpeg", "webp"];

pub fn discover_backgrounds(assets: &Path) -> Vec<Background> {
    let Ok(entries) = fs::read_dir(assets) else {
        return Vec::new();
    };
    let mut out: Vec<Background> = entries
        .flatten()
        .filter(|entry| entry.file_type().is_ok_and(|kind| !kind.is_dir()))
        .map(|entry| entry.path())
        .filter(|path| {
            path.extension()
                .and_then(|ext| ext.to_str())
                .is_some_and(|ext| IMAGE_EXTENSIONS.contains(&ext.to_ascii_lowercase().as_str()))
        })
        .map(|path| {
            let name = background_name(&path.to_string_lossy());
            Background {
                key: name.to_lowercase(),
                name,
                path: path.to_string_lossy().into_owned(),
            }
        })
        .collect();
    out.sort_by(|a, b| a.key.cmp(&b.key));
    out
}

pub fn background_name(file: &str) -> String {
    let stem = Path::new(file)
        .file_stem()
        .map(|stem| stem.to_string_lossy())
        .unwrap_or_default();
    let stem = stem.strip_suffix("-bg").unwrap_or(&stem);
    stem.strip_suffix("-gradient").unwrap_or(stem).to_string()
}

pub fn find_background<'a>(list: &'a [Background], query: &str) -> Option<&'a Background> {
    list.iter().find(|b| {
        b.name.eq_ignore_ascii_case(query)
            || Path::new(&b.path)
                .file_name()
                .is_some_and(|file| file.to_string_lossy().eq_ignore_ascii_case(query))
            || b.path == query
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn discovers_and_finds_backgrounds() {
        let dir = std::env::temp_dir().join(format!("ghostty-theme-bg-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        for name in ["warm-sunset-bg.png", "b.jpg", "notes.txt", "zeta.PNG"] {
            fs::write(dir.join(name), "x").unwrap();
        }
        let found = discover_backgrounds(&dir);
        fs::remove_dir_all(&dir).unwrap();
        let names: Vec<&str> = found.iter().map(|b| b.name.as_str()).collect();
        assert_eq!(names, ["b", "warm-sunset", "zeta"]);
        let hit = find_background(&found, "Warm-Sunset").unwrap();
        assert!(hit.path.ends_with("warm-sunset-bg.png"));
    }
}
