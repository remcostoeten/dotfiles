use std::collections::BTreeMap;
use std::path::PathBuf;

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct DesktopApp {
    pub name: String,
    pub path: String,
}

pub fn session_user() -> Option<String> {
    std::env::var("USER").ok().filter(|u| !u.is_empty() && u != "root")
}

fn application_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Ok(home) = std::env::var("HOME") {
        dirs.push(PathBuf::from(home).join(".local/share/applications"));
    }
    let data_dirs = std::env::var("XDG_DATA_DIRS")
        .unwrap_or_else(|_| "/usr/local/share:/usr/share".into());
    dirs.extend(
        data_dirs
            .split(':')
            .filter(|d| !d.is_empty())
            .map(|d| PathBuf::from(d).join("applications")),
    );
    dirs
}

fn parse_entry(content: &str) -> Option<String> {
    let mut in_entry = false;
    let mut name = None;
    for line in content.lines() {
        let line = line.trim();
        if line.starts_with('[') {
            in_entry = line == "[Desktop Entry]";
            continue;
        }
        if !in_entry {
            continue;
        }
        match line.split_once('=') {
            Some(("Name", value)) if name.is_none() => name = Some(value.trim().to_string()),
            Some(("NoDisplay" | "Hidden", "true")) => return None,
            Some(("Type", value)) if value.trim() != "Application" => return None,
            _ => {}
        }
    }
    name
}

/// Lists launchable `.desktop` applications; user entries shadow system ones by file id.
pub fn desktop_apps() -> Vec<DesktopApp> {
    let mut by_id: BTreeMap<String, DesktopApp> = BTreeMap::new();
    for dir in application_dirs() {
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("desktop") {
                continue;
            }
            let id = entry.file_name().to_string_lossy().to_string();
            if by_id.contains_key(&id) {
                continue;
            }
            let Some(name) = std::fs::read_to_string(&path).ok().as_deref().and_then(parse_entry)
            else {
                continue;
            };
            by_id.insert(
                id,
                DesktopApp {
                    name,
                    path: path.to_string_lossy().to_string(),
                },
            );
        }
    }
    let mut apps: Vec<DesktopApp> = by_id.into_values().collect();
    apps.sort_by_key(|a| a.name.to_lowercase());
    apps
}
