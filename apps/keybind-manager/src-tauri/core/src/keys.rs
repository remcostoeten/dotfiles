pub const KEYS: &[&str] = &[
    "0",
    "1",
    "102nd",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "a",
    "again",
    "apostrophe",
    "auto",
    "b",
    "back",
    "backslash",
    "backspace",
    "bassboost",
    "battery",
    "bluetooth",
    "bookmarks",
    "brightnessdown",
    "brightnessup",
    "c",
    "calc",
    "camera",
    "cancel",
    "capslock",
    "chat",
    "close",
    "closecd",
    "coffee",
    "comma",
    "compose",
    "computer",
    "config",
    "connect",
    "copy",
    "cut",
    "cycle",
    "cyclewindows",
    "d",
    "dashboard",
    "delete",
    "deletefile",
    "display",
    "documents",
    "dot",
    "down",
    "e",
    "edit",
    "ejectcd",
    "ejectclosecd",
    "email",
    "end",
    "enter",
    "equal",
    "esc",
    "escape",
    "exit",
    "f",
    "f1",
    "f10",
    "f11",
    "f12",
    "f13",
    "f14",
    "f15",
    "f16",
    "f17",
    "f18",
    "f19",
    "f2",
    "f20",
    "f21",
    "f22",
    "f23",
    "f24",
    "f3",
    "f4",
    "f5",
    "f6",
    "f7",
    "f8",
    "f9",
    "fastforward",
    "favorites",
    "file",
    "finance",
    "find",
    "fn",
    "forward",
    "forwardmail",
    "front",
    "g",
    "grave",
    "h",
    "hangeul",
    "hanja",
    "help",
    "henkan",
    "hiragana",
    "home",
    "homepage",
    "hp",
    "i",
    "insert",
    "iso",
    "iso-level3-shift",
    "j",
    "k",
    "katakana",
    "katakanahiragana",
    "kbdillumdown",
    "kbdillumtoggle",
    "kbdillumup",
    "kp0",
    "kp1",
    "kp2",
    "kp3",
    "kp4",
    "kp5",
    "kp6",
    "kp7",
    "kp8",
    "kp9",
    "kpasterisk",
    "kpcomma",
    "kpdot",
    "kpenter",
    "kpequal",
    "kpjpcomma",
    "kpleftparen",
    "kpminus",
    "kpplus",
    "kpplusminus",
    "kprightparen",
    "kpslash",
    "l",
    "left",
    "leftalt",
    "leftbrace",
    "leftcontrol",
    "leftmeta",
    "leftmouse",
    "leftshift",
    "linefeed",
    "m",
    "mail",
    "media",
    "menu",
    "micmute",
    "middlemouse",
    "minus",
    "mouse1",
    "mouse2",
    "mouseback",
    "mouseforward",
    "move",
    "msdos",
    "muhenkan",
    "mute",
    "n",
    "new",
    "next",
    "nextsong",
    "noop",
    "numlock",
    "o",
    "off",
    "open",
    "p",
    "pagedown",
    "pageup",
    "paste",
    "pause",
    "pausecd",
    "phone",
    "play",
    "playcd",
    "playpause",
    "power",
    "prev",
    "previoussong",
    "print",
    "prog1",
    "prog2",
    "prog3",
    "prog4",
    "props",
    "q",
    "question",
    "r",
    "record",
    "redo",
    "refresh",
    "reply",
    "rewind",
    "rfkill",
    "right",
    "rightalt",
    "rightbrace",
    "rightcontrol",
    "rightmeta",
    "rightmouse",
    "rightshift",
    "ro",
    "s",
    "save",
    "scale",
    "scrolldown",
    "scrollleft",
    "scrolllock",
    "scrollright",
    "scrollup",
    "search",
    "semicolon",
    "send",
    "sendfile",
    "setup",
    "shop",
    "slash",
    "sleep",
    "sound",
    "space",
    "sport",
    "stop",
    "stopcd",
    "suspend",
    "switchvideomode",
    "sysrq",
    "t",
    "tab",
    "u",
    "undo",
    "unknown",
    "up",
    "uwb",
    "v",
    "voicecommand",
    "volumedown",
    "volumeup",
    "w",
    "wakeup",
    "wlan",
    "wwan",
    "www",
    "x",
    "xfer",
    "y",
    "yen",
    "z",
    "zenkakuhankaku",
    "zoom",
];

pub const MODS: &[&str] = &["control", "shift", "alt", "meta", "altgr"];

pub const MOD_KEYS: &[&str] = &[
    "leftcontrol",
    "rightcontrol",
    "leftshift",
    "rightshift",
    "leftalt",
    "rightalt",
    "leftmeta",
    "rightmeta",
];

pub fn is_key(name: &str) -> bool {
    KEYS.binary_search(&name).is_ok()
}

pub fn is_mod(name: &str) -> bool {
    MODS.contains(&name)
}

pub fn mod_prefix(name: &str) -> Option<&'static str> {
    match name {
        "control" => Some("C"),
        "meta" => Some("M"),
        "alt" => Some("A"),
        "shift" => Some("S"),
        "altgr" => Some("G"),
        _ => None,
    }
}

pub fn prefix_mod(prefix: &str) -> Option<&'static str> {
    match prefix {
        "C" => Some("control"),
        "M" => Some("meta"),
        "A" => Some("alt"),
        "S" => Some("shift"),
        "G" => Some("altgr"),
        _ => None,
    }
}

pub fn as_mod_layer(key: &str) -> Option<&'static str> {
    match key {
        "control" | "leftcontrol" | "rightcontrol" => Some("control"),
        "shift" | "leftshift" | "rightshift" => Some("shift"),
        "alt" | "leftalt" => Some("alt"),
        "meta" | "leftmeta" | "rightmeta" => Some("meta"),
        "altgr" | "rightalt" => Some("altgr"),
        _ => None,
    }
}

pub fn sort_mods(mods: &[String]) -> Vec<String> {
    let order = ["control", "meta", "alt", "shift", "altgr"];
    let mut sorted: Vec<String> = mods.to_vec();
    sorted.sort_by_key(|m| order.iter().position(|o| o == m).unwrap_or(usize::MAX));
    sorted.dedup();
    sorted
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keys_are_sorted_for_binary_search() {
        let mut sorted = KEYS.to_vec();
        sorted.sort_unstable();
        assert_eq!(sorted, KEYS);
    }

    #[test]
    fn recognizes_keys() {
        assert!(is_key("capslock"));
        assert!(is_key("esc"));
        assert!(is_key("leftcontrol"));
        assert!(!is_key("notakey"));
    }

    #[test]
    fn mods_round_trip() {
        for m in MODS {
            assert_eq!(prefix_mod(mod_prefix(m).unwrap()), Some(*m));
        }
    }

    #[test]
    fn sorts_mods_deterministically() {
        let mods = vec!["shift".to_string(), "control".to_string()];
        assert_eq!(sort_mods(&mods), vec!["control", "shift"]);
    }
}
