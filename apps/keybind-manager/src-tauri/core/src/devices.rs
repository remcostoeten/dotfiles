use serde::{Deserialize, Serialize};

use crate::model::Profile;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct InputDevice {
    pub name: String,
    pub vendor: String,
    pub product: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phys: Option<String>,
    pub keyboard: bool,
    pub virtual_keyd: bool,
}

pub fn parse_proc_devices(content: &str) -> Vec<InputDevice> {
    let mut devices = Vec::new();
    for block in content.split("\n\n") {
        if let Some(device) = parse_block(block) {
            devices.push(device);
        }
    }
    devices
}

fn parse_block(block: &str) -> Option<InputDevice> {
    let mut name = String::new();
    let mut vendor = String::new();
    let mut product = String::new();
    let mut phys = None;
    let mut handlers = String::new();
    let mut ev = String::new();

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
        }
    }

    if name.is_empty() {
        return None;
    }
    let ev_mask = u64::from_str_radix(&ev, 16).unwrap_or(0);
    let keyboard = handlers.contains("kbd") && ev_mask & 0x2 != 0 && ev_mask & 0x10 != 0;
    let virtual_keyd = name.starts_with("keyd ");
    Some(InputDevice {
        name,
        vendor,
        product,
        phys,
        keyboard,
        virtual_keyd,
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
}
