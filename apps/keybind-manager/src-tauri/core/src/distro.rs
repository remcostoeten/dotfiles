use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Family {
    Arch,
    Debian,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Distro {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    pub family: Family,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Session {
    X11,
    Wayland,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Capabilities {
    pub distro: Distro,
    pub desktop: String,
    pub session: Session,
    pub package_managers: Vec<String>,
    pub systemd: bool,
    pub pkexec: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageInfo {
    pub manager: String,
    pub installed: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
    pub available: bool,
}

pub fn parse_os_release(content: &str) -> Distro {
    let mut id = String::new();
    let mut id_like = String::new();
    let mut name = String::from("Unknown Linux");
    let mut version = None;

    for line in content.lines() {
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        let value = value.trim().trim_matches('"').to_string();
        match key.trim() {
            "ID" => id = value,
            "ID_LIKE" => id_like = value,
            "PRETTY_NAME" => name = value,
            "VERSION_ID" => version = Some(value),
            _ => {}
        }
    }

    let family = family_of(&id, &id_like);
    Distro {
        id,
        name,
        version,
        family,
    }
}

fn family_of(id: &str, id_like: &str) -> Family {
    let matches = |candidates: &[&str]| {
        candidates.contains(&id)
            || candidates
                .iter()
                .any(|c| id_like.split(' ').any(|l| l == *c))
    };
    if matches(&["arch", "archlinux", "manjaro", "endeavouros", "cachyos"]) {
        Family::Arch
    } else if matches(&["debian", "ubuntu", "neon", "kubuntu", "linuxmint", "pop"]) {
        Family::Debian
    } else {
        Family::Other
    }
}

pub fn parse_session(value: &str) -> Session {
    match value.to_lowercase().as_str() {
        "x11" => Session::X11,
        "wayland" => Session::Wayland,
        _ => Session::Unknown,
    }
}

pub fn install_guidance(distro: &Distro, managers: &[String]) -> Vec<PackageInfo> {
    let mut out = Vec::new();
    match distro.family {
        Family::Arch => {
            if managers.iter().any(|m| m == "pacman") {
                out.push(PackageInfo {
                    manager: "pacman".into(),
                    installed: false,
                    version: None,
                    source: Some("official repository".into()),
                    command: Some("sudo pacman -S keyd".into()),
                    available: true,
                });
            }
            for helper in ["paru", "yay"] {
                if managers.iter().any(|m| m == helper) {
                    out.push(PackageInfo {
                        manager: helper.into(),
                        installed: false,
                        version: None,
                        source: Some("AUR (community repository)".into()),
                        command: Some(format!("{helper} -S keyd")),
                        available: true,
                    });
                }
            }
        }
        Family::Debian => {
            if managers.iter().any(|m| m == "apt" || m == "apt-get") {
                out.push(PackageInfo {
                    manager: "apt".into(),
                    installed: false,
                    version: None,
                    source: Some("configured apt repositories".into()),
                    command: Some("sudo apt install keyd".into()),
                    available: true,
                });
            }
            out.push(PackageInfo {
                manager: "source".into(),
                installed: false,
                version: None,
                source: Some("https://github.com/rvaiya/keyd (build from source)".into()),
                command: Some(
                    "git clone https://github.com/rvaiya/keyd && cd keyd && make && sudo make install"
                        .into(),
                ),
                available: true,
            });
        }
        Family::Other => {
            out.push(PackageInfo {
                manager: "source".into(),
                installed: false,
                version: None,
                source: Some("https://github.com/rvaiya/keyd (build from source)".into()),
                command: Some(
                    "git clone https://github.com/rvaiya/keyd && cd keyd && make && sudo make install"
                        .into(),
                ),
                available: true,
            });
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_arch() {
        let distro = parse_os_release("ID=arch\nPRETTY_NAME=\"Arch Linux\"\n");
        assert_eq!(distro.family, Family::Arch);
        assert_eq!(distro.name, "Arch Linux");
    }

    #[test]
    fn detects_kubuntu_via_id_like() {
        let content =
            "ID=neon\nID_LIKE=\"ubuntu debian\"\nPRETTY_NAME=\"KDE neon\"\nVERSION_ID=\"22.04\"";
        let distro = parse_os_release(content);
        assert_eq!(distro.family, Family::Debian);
        assert_eq!(distro.version.as_deref(), Some("22.04"));
    }

    #[test]
    fn unknown_distro_is_other() {
        let distro = parse_os_release("ID=nixos\nPRETTY_NAME=NixOS");
        assert_eq!(distro.family, Family::Other);
    }

    #[test]
    fn parses_session() {
        assert_eq!(parse_session("wayland"), Session::Wayland);
        assert_eq!(parse_session("X11"), Session::X11);
        assert_eq!(parse_session("tty"), Session::Unknown);
    }

    #[test]
    fn arch_guidance_prefers_official_repo() {
        let distro = parse_os_release("ID=arch");
        let guidance = install_guidance(&distro, &["pacman".into(), "yay".into()]);
        assert_eq!(guidance[0].manager, "pacman");
        assert!(guidance[1].source.as_deref().unwrap().contains("AUR"));
    }
}
