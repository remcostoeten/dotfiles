// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;
use std::fs;
use std::process::{Command, Stdio};
use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct PackageArray {
    name: String,
    packages: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Alias {
    name: String,
    path: String,
    content: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct FileInfo {
    path: String,
    name: String,
    #[serde(rename = "type")]
    file_type: String,
}

fn get_dotfiles_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "~".to_string());
    PathBuf::from(home).join(".config").join("dotfiles")
}

fn parse_setup_sh() -> Vec<PackageArray> {
    let dotfiles_path = get_dotfiles_path();
    let setup_sh_path = dotfiles_path.join("setup.sh");
    
    if !setup_sh_path.exists() {
        return vec![];
    }

    let content = fs::read_to_string(&setup_sh_path).unwrap_or_default();
    let mut arrays = Vec::new();

    // Regex to match array declarations
    let array_regex = Regex::new(r#"declare\s+-a\s+(\w+)=\(([^)]+)\)"#).unwrap();
    let array_assoc_regex = Regex::new(r#"declare\s+-A\s+(\w+)=\(([^)]+)\)"#).unwrap();

    for cap in array_regex.captures_iter(&content) {
        let name = cap.get(1).unwrap().as_str().to_string();
        let packages_str = cap.get(2).unwrap().as_str();
        
        let packages: Vec<String> = packages_str
            .lines()
            .map(|line| line.trim().trim_matches('"').to_string())
            .filter(|line| !line.is_empty() && !line.starts_with('#'))
            .collect();

        arrays.push(PackageArray { name, packages });
    }

    for cap in array_assoc_regex.captures_iter(&content) {
        let name = cap.get(1).unwrap().as_str().to_string();
        let packages_str = cap.get(2).unwrap().as_str();
        
        let packages: Vec<String> = packages_str
            .lines()
            .map(|line| line.trim().trim_matches('"').to_string())
            .filter(|line| !line.is_empty() && !line.starts_with('#'))
            .collect();

        arrays.push(PackageArray { name, packages });
    }

    arrays
}

#[tauri::command]
fn get_package_arrays() -> Result<Vec<PackageArray>, String> {
    Ok(parse_setup_sh())
}

#[tauri::command]
fn add_package_to_array(
    array_name: String,
    package_name: String,
    install_command: String,
) -> Result<(), String> {
    let dotfiles_path = get_dotfiles_path();
    let setup_sh_path = dotfiles_path.join("setup.sh");
    
    if !setup_sh_path.exists() {
        return Err("setup.sh not found".to_string());
    }

    let content = fs::read_to_string(&setup_sh_path)
        .map_err(|e| format!("Failed to read setup.sh: {}", e))?;

    // Format: package_name:Display Name
    let entry = format!("\"{}\"", package_name);
    
    // Find the array declaration and add the package
    let array_pattern = format!(r#"declare\s+-a\s+{}=\(([^)]+)\)"#, array_name);
    let re = Regex::new(&array_pattern).map_err(|e| format!("Regex error: {}", e))?;
    
    let new_content = re.replace(&content, |caps: &regex::Captures| {
        let existing = caps.get(1).unwrap().as_str();
        let new_packages = if existing.trim().is_empty() {
            format!("    {}", entry)
        } else {
            format!("{},\n    {}", existing.trim_end(), entry)
        };
        format!("declare -a {}={}(\n{}\n)", array_name, "{", new_packages)
    }).to_string();

    fs::write(&setup_sh_path, new_content)
        .map_err(|e| format!("Failed to write setup.sh: {}", e))?;

    Ok(())
}

#[tauri::command]
fn remove_package_from_array(array_name: String, package_index: usize) -> Result<(), String> {
    let dotfiles_path = get_dotfiles_path();
    let setup_sh_path = dotfiles_path.join("setup.sh");
    
    if !setup_sh_path.exists() {
        return Err("setup.sh not found".to_string());
    }

    let content = fs::read_to_string(&setup_sh_path)
        .map_err(|e| format!("Failed to read setup.sh: {}", e))?;

    let array_pattern = format!(r#"declare\s+-a\s+{}=\(([^)]+)\)"#, array_name);
    let re = Regex::new(&array_pattern).map_err(|e| format!("Regex error: {}", e))?;
    
    let new_content = re.replace(&content, |caps: &regex::Captures| {
        let existing = caps.get(1).unwrap().as_str();
        let lines: Vec<&str> = existing
            .lines()
            .map(|l| l.trim())
            .filter(|l| !l.is_empty())
            .collect();
        
        if package_index >= lines.len() {
            return format!("declare -a {}={}(\n{}\n)", array_name, "{", existing);
        }

        let mut new_lines = lines.clone();
        new_lines.remove(package_index);
        
        let new_packages = new_lines
            .iter()
            .map(|l| format!("    {}", l))
            .collect::<Vec<_>>()
            .join("\n");

        format!("declare -a {}={}(\n{}\n)", array_name, "{", new_packages)
    }).to_string();

    fs::write(&setup_sh_path, new_content)
        .map_err(|e| format!("Failed to write setup.sh: {}", e))?;

    Ok(())
}

#[tauri::command]
fn get_aliases() -> Result<Vec<Alias>, String> {
    let dotfiles_path = get_dotfiles_path();
    let aliases_dir = dotfiles_path.join("configs").join("fish").join("aliases");
    
    if !aliases_dir.exists() {
        return Ok(vec![]);
    }

    let mut aliases = Vec::new();
    
    if let Ok(entries) = fs::read_dir(&aliases_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("fish") {
                let name = path.file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("unknown")
                    .to_string();
                let path_str = path.to_string_lossy().to_string();
                
                aliases.push(Alias {
                    name,
                    path: path_str,
                    content: String::new(),
                });
            }
        }
    }

    Ok(aliases)
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
fn list_files(path: String) -> Result<Vec<FileInfo>, String> {
    let path_buf = PathBuf::from(&path);
    
    if !path_buf.exists() {
        return Err("Path does not exist".to_string());
    }

    let mut files = Vec::new();
    
    if path_buf.is_dir() {
        if let Ok(entries) = fs::read_dir(&path_buf) {
            for entry in entries.flatten() {
                let entry_path = entry.path();
                let file_type = if entry_path.is_dir() {
                    "directory"
                } else {
                    "file"
                };
                
                files.push(FileInfo {
                    path: entry_path.to_string_lossy().to_string(),
                    name: entry_path.file_name()
                        .and_then(|s| s.to_str())
                        .unwrap_or("unknown")
                        .to_string(),
                    file_type: file_type.to_string(),
                });
            }
        }
    } else {
        files.push(FileInfo {
            path: path_buf.to_string_lossy().to_string(),
            name: path_buf.file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("unknown")
                .to_string(),
            file_type: "file".to_string(),
        });
    }

    Ok(files)
}

#[tauri::command]
fn get_dotfiles_path() -> Result<String, String> {
    Ok(get_dotfiles_path().to_string_lossy().to_string())
}

#[tauri::command]
fn open_in_github(path: String) -> Result<(), String> {
    let dotfiles_path = get_dotfiles_path();
    let relative_path = PathBuf::from(&path)
        .strip_prefix(&dotfiles_path)
        .ok()
        .and_then(|p| p.to_str())
        .map(|s| s.to_string());
    
    if let Some(rel_path) = relative_path {
        // Assuming GitHub repo URL - you may want to fetch this from git config
        let url = format!("https://github.com/remcostoeten/dotfiles/blob/master/{}", rel_path);
        Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to open: {}", e))?;
    }
    
    Ok(())
}

#[tauri::command]
fn open_in_system_file_manager(path: String) -> Result<(), String> {
    let path_buf = PathBuf::from(&path);
    let dir = if path_buf.is_dir() {
        path_buf
    } else {
        path_buf.parent().unwrap_or(&PathBuf::from(".")).to_path_buf()
    };

    #[cfg(target_os = "linux")]
    Command::new("xdg-open")
        .arg(&dir)
        .spawn()
        .map_err(|e| format!("Failed to open: {}", e))?;

    #[cfg(target_os = "macos")]
    Command::new("open")
        .arg(&dir)
        .spawn()
        .map_err(|e| format!("Failed to open: {}", e))?;

    #[cfg(target_os = "windows")]
    Command::new("explorer")
        .arg(&dir)
        .spawn()
        .map_err(|e| format!("Failed to open: {}", e))?;

    Ok(())
}

#[tauri::command]
fn run_setup() -> Result<(), String> {
    let dotfiles_path = get_dotfiles_path();
    let setup_sh = dotfiles_path.join("setup.sh");
    
    Command::new("bash")
        .arg(&setup_sh)
        .spawn()
        .map_err(|e| format!("Failed to run setup: {}", e))?;
    
    Ok(())
}

#[tauri::command]
fn run_setup_dry_run() -> Result<(), String> {
    let dotfiles_path = get_dotfiles_path();
    let setup_sh = dotfiles_path.join("setup.sh");
    
    Command::new("bash")
        .arg(&setup_sh)
        .arg("--dry-run")
        .spawn()
        .map_err(|e| format!("Failed to run dry run: {}", e))?;
    
    Ok(())
}

#[tauri::command]
fn run_setup_section(section: String) -> Result<(), String> {
    let dotfiles_path = get_dotfiles_path();
    let setup_sh = dotfiles_path.join("setup.sh");
    
    Command::new("bash")
        .arg(&setup_sh)
        .arg("--dry-run-section")
        .arg(&section)
        .spawn()
        .map_err(|e| format!("Failed to run section: {}", e))?;
    
    Ok(())
}

#[tauri::command]
fn run_setup_dry_run_section(section: String) -> Result<(), String> {
    let dotfiles_path = get_dotfiles_path();
    let setup_sh = dotfiles_path.join("setup.sh");
    
    Command::new("bash")
        .arg(&setup_sh)
        .arg("--dry-run")
        .arg("--dry-run-section")
        .arg(&section)
        .spawn()
        .map_err(|e| format!("Failed to run dry run section: {}", e))?;
    
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_package_arrays,
            add_package_to_array,
            remove_package_from_array,
            get_aliases,
            read_file,
            list_files,
            get_dotfiles_path,
            open_in_github,
            open_in_system_file_manager,
            run_setup,
            run_setup_dry_run,
            run_setup_section,
            run_setup_dry_run_section,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

