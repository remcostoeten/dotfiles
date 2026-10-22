use serde::{Deserialize, Serialize};

use crate::model::Profile;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DeviceKind {
    Keyboard,
    Mouse,
    #[default]
    Other,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct InputDevice {
    pub name: String,
    pub vendor: String,
    pub product: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phys: Option<String>,
    pub keyboard: bool,
    pub virtual_keyd: bool,
    #[serde(default)]
    pub kind: DeviceKind,
}

struct Parsed {
    device: InputDevice,
    typing: bool,
    pointer: bool,
}

const TYPING_KEYS: [usize; 5] = [16, 28, 30, 44, 57];

/// Parses `/proc/bus/input/devices`. `keyboard` mirrors what keyd would grab;
/// `kind` classifies the physical device every interface belongs to, so a
/// mouse's macro interface or a headset's media keys are not called keyboards.
pub fn parse_proc_devices(content: &str) -> Vec<InputDevice> {
    let parsed: Vec<Parsed> = content.split("\n\n").filter_map(parse_block).collect();
    let kinds: Vec<DeviceKind> = parsed.iter().map(|p| classify(p, &parsed)).collect();
    parsed
        .into_iter()
        .zip(kinds)
        .map(|(p, kind)| InputDevice { kind, ..p.device })
        .collect()
}

fn classify(target: &Parsed, all: &[Parsed]) -> DeviceKind {
    let device = &target.device;
    let siblings: Vec<&Parsed> = if device.vendor.is_empty() || device.vendor == "0000" {
        vec![target]
    } else {
        all.iter()
            .filter(|p| p.device.vendor == device.vendor && p.device.product == device.product)
            .collect()
    };
    let base_len = siblings
        .iter()
        .map(|p| p.device.name.len())
        .min()
        .unwrap_or(0);
    if siblings
        .iter()
        .any(|p| p.pointer && p.device.name.len() == base_len)
    {
        DeviceKind::Mouse
    } else if siblings.iter().any(|p| p.typing) {
        DeviceKind::Keyboard
    } else {
        DeviceKind::Other
    }
}

fn has_bit(mask: &str, bit: usize) -> bool {
    let words: Vec<&str> = mask.split_whitespace().collect();
    let index = bit / 64;
    if index >= words.len() {
        return false;
    }
    let word = u64::from_str_radix(words[words.len() - 1 - index], 16).unwrap_or(0);
    word & (1 << (bit % 64)) != 0
}

fn parse_block(block: &str) -> Option<Parsed> {
    let mut name = String::new();
    let mut vendor = String::new();
    let mut product = String::new();
    let mut phys = None;
    let mut handlers = String::new();
    let mut ev = String::new();
    let mut keys = String::new();
    let mut rel = String::new();

    for line in block.lines() {
        if let Some(rest) = line.strip_prefix("I: ") {
            for part in rest.split_whitespace() {
                if let Some(v) = part.strip_prefix("Vendor=") {
                    vendor = v.to_lowercase();
                } else if let Some(p) = part.strip_prefix("Product=") {
                    product = p.to_lowercase();
                }
            }
        } else if let Some(rest) = line.strip_prefix("N: Name=") {
            name = rest.trim_matches('"').to_string();
        } else if let Some(rest) = line.strip_prefix("P: Phys=") {
            let value = rest.trim().to_string();
            if !value.is_empty() {
                phys = Some(value);
            }
        } else if let Some(rest) = line.strip_prefix("H: Handlers=") {
            handlers = rest.to_string();
        } else if let Some(rest) = line.strip_prefix("B: EV=") {
            ev = rest.trim().to_string();
        } else if let Some(rest) = line.strip_prefix("B: KEY=") {
            keys = rest.trim().to_string();
        } else if let Some(rest) = line.strip_prefix("B: REL=") {
            rel = rest.trim().to_string();
        }
    }

    if name.is_empty() {
        return None;
    }
    let ev_mask = u64::from_str_radix(&ev, 16).unwrap_or(0);
    let keyboard = handlers.contains("kbd") && ev_mask & 0x2 != 0 && ev_mask & 0x10 != 0;
    let virtual_keyd = name.starts_with("keyd ");
    let typing = keyboard && TYPING_KEYS.iter().all(|&k| has_bit(&keys, k));
    let pointer = handlers.split_whitespace().any(|h| h.starts_with("mouse"))
        || (has_bit(&rel, 0) && has_bit(&rel, 1));
    Some(Parsed {
        device: InputDevice {
            name,
            vendor,
            product,
            phys,
            keyboard,
            virtual_keyd,
            kind: DeviceKind::Other,
        },
        typing,
        pointer,
    })
}

pub fn profile_matches(profile: &Profile, device: &InputDevice) -> bool {
    if profile.devices.is_empty() {
        return true;
    }
    profile.devices.iter().any(|d| {
        d.vendor.eq_ignore_ascii_case(&device.vendor)
            && d.product.eq_ignore_ascii_case(&device.product)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{AppConfig, DeviceRef};

    const SAMPLE: &str = "I: Bus=0003 Vendor=04d9 Product=0141 Version=0110\nN: Name=\"USB Keyboard\"\nP: Phys=usb-0000:00:14.0-2/input0\nH: Handlers=sysrq kbd event3 leds\nB: EV=120013\n\nI: Bus=0003 Vendor=046d Product=c52b Version=0111\nN: Name=\"Logitech Mouse\"\nP: Phys=usb-0000:00:14.0-1/input1\nH: Handlers=mouse0 event4\nB: EV=17\n\nI: Bus=0006 Vendor=0fac Product=0ade Version=0001\nN: Name=\"keyd virtual keyboard\"\nP: Phys=\nH: Handlers=sysrq kbd event10\nB: EV=120013\n";

    #[test]
    fn parses_keyboards_only() {
        let devices = parse_proc_devices(SAMPLE);
        assert_eq!(devices.len(), 3);
        let keyboard = &devices[0];
        assert_eq!(keyboard.name, "USB Keyboard");
        assert_eq!(keyboard.vendor, "04d9");
        assert_eq!(keyboard.product, "0141");
        assert!(keyboard.keyboard);
        assert!(!devices[1].keyboard);
        assert!(devices[2].virtual_keyd);
    }

    #[test]
    fn wildcard_profile_matches_all() {
        let profile = AppConfig::empty().profiles[0].clone();
        let devices = parse_proc_devices(SAMPLE);
        assert!(profile_matches(&profile, &devices[0]));
    }

    #[test]
    fn scoped_profile_matches_by_id() {
        let mut profile = AppConfig::empty().profiles[0].clone();
        profile.devices.push(DeviceRef {
            vendor: "04D9".into(),
            product: "0141".into(),
            name: None,
        });
        let devices = parse_proc_devices(SAMPLE);
        assert!(profile_matches(&profile, &devices[0]));
        assert!(!profile_matches(&profile, &devices[1]));
    }

    #[test]
    fn classifies_physical_devices() {
        let devices = parse_proc_devices(include_str!("../tests/fixtures/proc_devices.txt"));
        let kind_of = |name: &str| {
            devices
                .iter()
                .filter(|d| d.name == name)
                .map(|d| d.kind)
                .collect::<Vec<_>>()
        };
        assert_eq!(kind_of("NZXT NZXT USB MIC"), vec![DeviceKind::Other]);
        assert_eq!(
            kind_of("SteelSeries  SteelSeries Arctis 7 Consumer Control"),
            vec![DeviceKind::Other]
        );
        assert!(kind_of("Razer Basilisk Ultimate")
            .iter()
            .all(|k| *k == DeviceKind::Mouse));
        assert_eq!(kind_of("Logitech MX Master 3S"), vec![DeviceKind::Mouse]);
        assert_eq!(kind_of("UBEST zoom65 wireless"), vec![DeviceKind::Keyboard]);
        assert_eq!(
            kind_of("UBEST zoom65 wireless Mouse"),
            vec![DeviceKind::Keyboard]
        );
    }

    #[test]
    fn keeps_keyd_keyboard_flag_independent_of_kind() {
        let devices = parse_proc_devices(include_str!("../tests/fixtures/proc_devices.txt"));
        assert!(devices
            .iter()
            .any(|d| d.name == "Razer Basilisk Ultimate" && d.keyboard));
    }
}
