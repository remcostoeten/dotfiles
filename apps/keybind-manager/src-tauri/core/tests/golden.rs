use keybind_core::keyd::{generate_all, parse_profile};
use keybind_core::model::{
    migrate, ActionKind, AppConfig, DeviceRef, InputMode, KeyAction, KeyInput, Layer, Mapping,
    Profile,
};
use keybind_core::validation::validate;

fn fixture_config() -> AppConfig {
    let key = |k: &str| KeyAction {
        kind: ActionKind::Key,
        key: Some(k.into()),
        mods: Vec::new(),
        layer: None,
        macro_text: None,
    };
    let press = |id: &str, source: &str, target: KeyAction| Mapping {
        id: id.into(),
        source: KeyInput {
            key: source.into(),
            mods: Vec::new(),
            mode: InputMode::Press,
        },
        target,
        enabled: true,
    };

    let laptop = Profile {
        id: "laptop".into(),
        name: "Laptop".into(),
        enabled: true,
        devices: Vec::new(),
        mappings: vec![
            Mapping {
                id: "caps-tap".into(),
                source: KeyInput {
                    key: "capslock".into(),
                    mods: Vec::new(),
                    mode: InputMode::Tap,
                },
                target: key("esc"),
                enabled: true,
            },
            Mapping {
                id: "caps-hold".into(),
                source: KeyInput {
                    key: "capslock".into(),
                    mods: Vec::new(),
                    mode: InputMode::Hold,
                },
                target: key("leftcontrol"),
                enabled: true,
            },
            press("swap-a", "esc", key("capslock")),
            press(
                "nav-trigger",
                "rightalt",
                KeyAction {
                    kind: ActionKind::Layer,
                    key: None,
                    mods: Vec::new(),
                    layer: Some("nav".into()),
                    macro_text: None,
                },
            ),
            press(
                "combo",
                "f1",
                KeyAction {
                    kind: ActionKind::Combo,
                    key: Some("t".into()),
                    mods: vec!["control".into(), "shift".into()],
                    layer: None,
                    macro_text: None,
                },
            ),
            press(
                "disable",
                "insert",
                KeyAction {
                    kind: ActionKind::Disable,
                    key: None,
                    mods: Vec::new(),
                    layer: None,
                    macro_text: None,
                },
            ),
        ],
        layers: vec![Layer {
            id: "nav".into(),
            name: "nav".into(),
            mappings: vec![
                press("nav-h", "h", key("left")),
                press("nav-j", "j", key("down")),
                press("nav-k", "k", key("up")),
                press("nav-l", "l", key("right")),
            ],
        }],
        preserved: Vec::new(),
    };

    let external = Profile {
        id: "external".into(),
        name: "External".into(),
        enabled: true,
        devices: vec![DeviceRef {
            vendor: "04d9".into(),
            product: "0141".into(),
            name: Some("USB Keyboard".into()),
        }],
        mappings: vec![press("swap-caps", "capslock", key("leftmeta"))],
        layers: Vec::new(),
        preserved: Vec::new(),
    };

    AppConfig {
        version: 1,
        active: "laptop".into(),
        profiles: vec![laptop, external],
        settings: Default::default(),
    }
}

#[test]
fn golden_generation() {
    let config = fixture_config();
    assert!(validate(&config).ok());
    let files = generate_all(&config).unwrap();
    assert_eq!(files.len(), 2);
    let bless = std::env::var("KEYBIND_BLESS").is_ok();
    for file in &files {
        let golden_path = format!("tests/golden/{}", file.name);
        if bless {
            std::fs::write(&golden_path, &file.content).unwrap();
        }
        let expected = std::fs::read_to_string(&golden_path).unwrap_or_else(|_| {
            panic!(
                "missing golden file {golden_path}; generated:\n{}",
                file.content
            )
        });
        assert_eq!(
            file.content, expected,
            "generated config for {} differs from golden file",
            file.name
        );
    }
}

#[test]
fn golden_round_trip() {
    let config = fixture_config();
    let files = generate_all(&config).unwrap();
    for (file, profile) in files.iter().zip(&config.profiles) {
        let parsed = parse_profile(&profile.id, &profile.name, &file.content).unwrap();
        assert!(
            parsed.preserved.is_empty(),
            "round trip lost entries: {:?}",
            parsed.preserved
        );
        let regenerated = keybind_core::keyd::generate_profile(&parsed).unwrap();
        assert_eq!(file.content, regenerated);
    }
}

#[test]
fn json_schema_round_trip_and_migration() {
    let config = fixture_config();
    let json = serde_json::to_value(&config).unwrap();
    let migrated = migrate(json).unwrap();
    assert_eq!(config, migrated);
}
