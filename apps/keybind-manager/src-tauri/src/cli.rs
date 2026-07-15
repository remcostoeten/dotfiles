use keybind_core::export::import_bundle;
use keybind_core::keyd::generate_all;
use keybind_core::model::{AppConfig, SCHEMA_VERSION};
use keybind_core::validation::validate;

use crate::applying;
use crate::dotfiles;
use crate::store;
use crate::system;

pub fn dispatch(args: &[String]) -> Option<i32> {
    match args.first().map(String::as_str) {
        Some("export") => Some(cmd_export(&args[1..])),
        Some("apply") => Some(cmd_apply(&args[1..])),
        Some("validate") => Some(cmd_validate(&args[1..])),
        Some("status") => Some(cmd_status()),
        Some("--help" | "-h" | "help") => Some(usage()),
        _ => None,
    }
}

fn usage() -> i32 {
    println!(
        "keybind-manager {}\n\nUsage:\n  keybind-manager                    launch the GUI\n  keybind-manager export [--profile <id>] [--dir <path>]\n  keybind-manager apply <config.toml> [--force]\n  keybind-manager validate <config.toml>\n  keybind-manager status",
        env!("CARGO_PKG_VERSION")
    );
    0
}

fn flag_value(args: &[String], flag: &str) -> Option<String> {
    args.iter()
        .position(|a| a == flag)
        .and_then(|i| args.get(i + 1))
        .cloned()
}

fn cmd_export(args: &[String]) -> i32 {
    let config = match store::load_config() {
        Ok(c) => c,
        Err(e) => return err_out(&e.message),
    };
    let profile = flag_value(args, "--profile");
    let dir = flag_value(args, "--dir").unwrap_or_else(|| {
        dirs::home_dir()
            .map(|h| h.join("keyboard").to_string_lossy().into_owned())
            .unwrap_or_else(|| "./keyboard".into())
    });
    match dotfiles::export_to(&config, profile.as_deref(), &dir, false) {
        Ok(path) => {
            println!("exported to {path}");
            0
        }
        Err(e) => err_out(&e.message),
    }
}

fn load_bundle_config(path: &str) -> Result<AppConfig, String> {
    let raw = std::fs::read_to_string(path).map_err(|e| format!("cannot read {path}: {e}"))?;
    let bundle = import_bundle(&raw).map_err(|e| e.to_string())?;
    let active = bundle
        .profiles
        .first()
        .map(|p| p.id.clone())
        .ok_or_else(|| "bundle contains no profiles".to_string())?;
    Ok(AppConfig {
        version: SCHEMA_VERSION,
        active,
        profiles: bundle.profiles,
        settings: bundle.settings.unwrap_or_default(),
    })
}

fn cmd_validate(args: &[String]) -> i32 {
    let Some(path) = args.first() else {
        return err_out("usage: keybind-manager validate <config.toml>");
    };
    let config = match load_bundle_config(path) {
        Ok(c) => c,
        Err(e) => return err_out(&e),
    };
    let result = validate(&config);
    for warning in &result.warnings {
        println!("warning: {}", warning.message);
    }
    for error in &result.errors {
        println!("error: {}", error.message);
    }
    if result.ok() {
        match generate_all(&config) {
            Ok(files) => {
                println!(
                    "valid: {} profile(s), {} managed file(s)",
                    config.profiles.len(),
                    files.len()
                );
                0
            }
            Err(e) => err_out(&e.to_string()),
        }
    } else {
        1
    }
}

fn cmd_apply(args: &[String]) -> i32 {
    let Some(path) = args.first() else {
        return err_out("usage: keybind-manager apply <config.toml> [--force]");
    };
    let force = args.iter().any(|a| a == "--force");
    let config = match load_bundle_config(path) {
        Ok(c) => c,
        Err(e) => return err_out(&e),
    };
    match applying::apply(&config, force) {
        Ok(result) => {
            println!("{}", result.message);
            if result.applied {
                let _ = store::save_config(&config);
                0
            } else {
                1
            }
        }
        Err(e) => {
            let mut code = 1;
            if e.code == "AUTH_DENIED" {
                code = 2;
            }
            err_out(&e.message);
            code
        }
    }
}

fn cmd_status() -> i32 {
    let caps = system::capabilities();
    let status = system::keyd_status();
    let state = store::load_state();
    println!("distribution:    {}", caps.distro.name);
    println!("desktop:         {}", caps.desktop);
    println!("session:         {:?}", caps.session);
    println!(
        "keyd:            {}",
        if status.installed {
            status.version.as_deref().unwrap_or("installed").to_string()
        } else {
            "not installed".into()
        }
    );
    println!("service enabled: {}", status.service_enabled);
    println!("service active:  {}", status.service_active);
    if let Some(applied) = &state.last_applied {
        println!("last applied:    {applied} (unix epoch)");
    }
    if let Some(error) = &state.last_error {
        println!("last error:      {error}");
    }
    i32::from(!status.installed || !status.service_active)
}

fn err_out(message: &str) -> i32 {
    eprintln!("error: {message}");
    1
}
