use std::path::PathBuf;
use std::process::Command;

use keybind_core::devices::{parse_proc_devices, InputDevice};
use keybind_core::distro::{parse_os_release, parse_session, Capabilities, Distro, Session};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendStatus {
    pub installed: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    pub service_exists: bool,
    pub service_enabled: bool,
    pub service_active: bool,
    pub config_dir: String,
}

pub fn capabilities() -> Capabilities {
    let os_release = std::fs::read_to_string("/etc/os-release").unwrap_or_default();
    let distro: Distro = parse_os_release(&os_release);
    let session: Session = parse_session(&std::env::var("XDG_SESSION_TYPE").unwrap_or_default());
    let desktop = std::env::var("XDG_CURRENT_DESKTOP").unwrap_or_else(|_| "unknown".into());

    let managers = ["pacman", "paru", "yay", "apt", "apt-get", "dpkg"]
        .iter()
        .filter(|m| which(m).is_some())
        .map(|m| m.to_string())
        .collect();

    Capabilities {
        distro,
        desktop,
        session,
        package_managers: managers,
        systemd: std::path::Path::new("/run/systemd/system").exists(),
        pkexec: which("pkexec").is_some(),
    }
}

pub fn keyd_status() -> BackendStatus {
    let installed = which("keyd").is_some();
    let version = installed
        .then(|| run_trimmed("keyd", &["--version"]))
        .flatten();
    let service_exists = systemctl_check(&["cat", "keyd.service"]);
    BackendStatus {
        installed,
        version,
        service_exists,
        service_enabled: systemctl_check(&["is-enabled", "--quiet", "keyd.service"]),
        service_active: systemctl_check(&["is-active", "--quiet", "keyd.service"]),
        config_dir: "/etc/keyd".into(),
    }
}

pub fn keyboards() -> Vec<InputDevice> {
    let content = std::fs::read_to_string("/proc/bus/input/devices").unwrap_or_default();
    parse_proc_devices(&content)
        .into_iter()
        .filter(|d| d.keyboard)
        .collect()
}

pub fn which(binary: &str) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path) {
        let candidate = dir.join(binary);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

fn run_trimmed(binary: &str, args: &[&str]) -> Option<String> {
    let output = Command::new(binary).args(args).output().ok()?;
    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if text.is_empty() {
        None
    } else {
        Some(text)
    }
}

fn systemctl_check(args: &[&str]) -> bool {
    Command::new("systemctl")
        .args(args)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}
