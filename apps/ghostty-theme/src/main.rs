mod app;
mod config;
mod data;
mod ghostty;
mod preset;
mod preview;
mod theme;
mod ui;

use std::path::Path;
use std::process::ExitCode;

use config::{load_settings, parse_percent, render_config, theme_image, write_atomic};
use data::{Paths, discover_backgrounds, find_background, record_recent};
use preset::{Preset, discover_presets, find_preset, save_preset};
use theme::discover_themes;

const USAGE: &str = "ghostty-theme: a live Ghostty appearance studio

  ghostty-theme                   open the interactive studio
  ghostty-theme pick              open the interactive studio
  ghostty-theme list              list installed themes
  ghostty-theme preset            list presets (* = active)
  ghostty-theme preset <name>     apply a preset
  ghostty-theme preset next       cycle presets
  ghostty-theme preset save <n>   save the current look as a preset
  ghostty-theme toggle            cycle presets
  ghostty-theme <theme>           apply a theme
  ghostty-theme font <name>       set font family
  ghostty-theme opacity <0..1>    set terminal background opacity (0 = fully transparent)
  ghostty-theme line-height N%    set cell height adjustment
  ghostty-theme letter-spacing N% set cell width adjustment
  ghostty-theme decorations       toggle window decorations
  ghostty-theme bg                list background images (* = active)
  ghostty-theme bg <name>         set background image from configs/ghostty/assets
  ghostty-theme bg toggle         cycle background images
  ghostty-theme bg none           remove background image
  ghostty-theme bg-opacity 0..1   set background-image-opacity
";

fn unit(value: &str, what: &str) -> Result<i32, String> {
    match value.trim().parse::<f64>() {
        Ok(n) if (0.0..=1.0).contains(&n) => Ok((n * 100.0 + 0.5) as i32),
        _ => Err(format!("{what} must be between 0 and 1")),
    }
}

fn apply_one(paths: &Paths, key: &str, value: &str) -> Result<(), String> {
    let (mut cfg, raw) = load_settings(&paths.config).map_err(|err| err.to_string())?;
    match key {
        "theme" => {
            cfg.theme = value.into();
            if let Some(image) = theme_image(value, &paths.assets) {
                cfg.background = image.to_string_lossy().into_owned();
            }
        }
        "bg" => cfg.background = value.into(),
        "image-opacity" => cfg.image_opacity = unit(value, "image opacity")?,
        "font" => cfg.font = value.into(),
        "opacity" => cfg.opacity = unit(value, "opacity")?,
        "letter-spacing" => cfg.letter_spacing = parse_percent(value, cfg.letter_spacing),
        "line-height" => cfg.line_height = parse_percent(value, cfg.line_height),
        "decorations" => cfg.decorations = !cfg.decorations,
        _ => return Err(format!("unknown setting {key:?}")),
    }
    let rendered = render_config(&raw, &cfg);
    write_atomic(&paths.config, rendered.as_bytes()).map_err(|err| err.to_string())?;
    if key == "theme" {
        record_recent(&paths.recents(), value);
    }
    ghostty::reload();
    Ok(())
}

fn apply_preset(paths: &Paths, preset: &Preset) -> Result<(), String> {
    let (cfg, raw) = load_settings(&paths.config).map_err(|err| err.to_string())?;
    let next = preset.apply(&cfg);
    write_atomic(&paths.config, render_config(&raw, &next).as_bytes())
        .map_err(|err| err.to_string())?;
    record_recent(&paths.recents(), &next.theme);
    ghostty::reload();
    Ok(())
}

fn run_preset(paths: &Paths, args: &[String]) -> Result<(), String> {
    let presets = discover_presets(&paths.presets, &paths.assets);
    let (cfg, _) = load_settings(&paths.config).map_err(|err| err.to_string())?;
    match args.first().map(String::as_str) {
        None | Some("list") => {
            for p in &presets {
                let marker = if p.matches(&cfg) { "* " } else { "  " };
                println!("{marker}{:<16} {}", p.name, p.description);
            }
            Ok(())
        }
        Some("save") => {
            let name = args[1..].join(" ");
            let path = save_preset(&paths.presets, &name, &cfg, &paths.assets)
                .map_err(|err| err.to_string())?;
            println!("{}", path.display());
            Ok(())
        }
        Some("toggle" | "next") => {
            let current = presets.iter().position(|p| p.matches(&cfg));
            let next = presets
                .get(current.map_or(0, |i| (i + 1) % presets.len()))
                .ok_or_else(|| format!("no presets in {}", paths.presets.display()))?;
            apply_preset(paths, next)?;
            println!("{}", next.name);
            Ok(())
        }
        Some(_) => {
            let query = args.join(" ");
            let preset = find_preset(&presets, &query)
                .ok_or_else(|| format!("unknown preset {query:?} (see: ghostty-theme preset)"))?;
            apply_preset(paths, preset)
        }
    }
}

fn run_background(paths: &Paths, args: &[String]) -> Result<(), String> {
    let backgrounds = discover_backgrounds(&paths.assets);
    let (cfg, _) = load_settings(&paths.config).map_err(|err| err.to_string())?;
    match args.first().map(String::as_str) {
        None | Some("list") => {
            for b in &backgrounds {
                let marker = if b.path == cfg.background { "* " } else { "  " };
                println!("{marker}{}", b.name);
            }
            return Ok(());
        }
        Some("none" | "off" | "clear") => return apply_one(paths, "bg", ""),
        Some("toggle" | "next") => {
            let current = backgrounds.iter().position(|b| b.path == cfg.background);
            let next = backgrounds
                .get(current.map_or(0, |i| (i + 1) % backgrounds.len()))
                .ok_or_else(|| format!("no images in {}", paths.assets.display()))?;
            apply_one(paths, "bg", &next.path)?;
            println!("{}", next.name);
            return Ok(());
        }
        Some(_) => {}
    }
    let query = args.join(" ");
    if let Some(b) = find_background(&backgrounds, &query) {
        return apply_one(paths, "bg", &b.path);
    }
    let path = Path::new(&query);
    if path.exists() {
        let absolute = std::path::absolute(path).map_err(|err| err.to_string())?;
        return apply_one(paths, "bg", &absolute.to_string_lossy());
    }
    Err(format!(
        "unknown background {query:?} (see: ghostty-theme bg)"
    ))
}

fn run(paths: &Paths, args: &[String]) -> Result<(), String> {
    let needs_value = |name: &str| format!("{name} needs a value");
    match args[0].as_str() {
        "help" | "-h" | "--help" => print!("{USAGE}"),
        "list" => {
            for theme in discover_themes(&paths.custom_themes, &paths.system_themes) {
                println!("{}", theme.name);
            }
        }
        "toggle" => run_preset(paths, &["next".into()])?,
        "preset" | "presets" => run_preset(paths, &args[1..])?,
        name @ ("font" | "opacity" | "line-height" | "letter-spacing") => {
            if args.len() < 2 {
                return Err(needs_value(name));
            }
            apply_one(paths, name, &args[1..].join(" "))?;
        }
        "decorations" => apply_one(paths, "decorations", "")?,
        "bg" | "background" => run_background(paths, &args[1..])?,
        name @ ("bg-opacity" | "image-opacity") => {
            let value = args.get(1).ok_or_else(|| needs_value(name))?;
            apply_one(paths, "image-opacity", value)?;
        }
        name => {
            let themes = discover_themes(&paths.custom_themes, &paths.system_themes);
            let theme = themes
                .iter()
                .find(|t| t.name.eq_ignore_ascii_case(name))
                .ok_or_else(|| format!("unknown theme or command {name:?}"))?;
            apply_one(paths, "theme", &theme.name)?;
        }
    }
    Ok(())
}

fn main() -> ExitCode {
    let paths = Paths::resolve();
    let args: Vec<String> = std::env::args().skip(1).collect();
    let result = if args.is_empty() || args[0] == "pick" {
        app::run(paths).map_err(|err| err.to_string())
    } else {
        run(&paths, &args)
    };
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(err) => {
            eprintln!("ghostty-theme: {err}");
            ExitCode::FAILURE
        }
    }
}
