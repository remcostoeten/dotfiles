use std::collections::BTreeMap;
use std::io::Write;
use std::process::{Command, Stdio};

use keybind_core::keyd::generate_all;
use keybind_core::model::AppConfig;
use keybind_core::validation::validate;
use keybind_core::StructuredError;
use serde::{Deserialize, Serialize};

use crate::store::{load_state, save_state};
use crate::system;

pub const HELPER: &str = "keybind-manager-helper";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplyResult {
    pub applied: bool,
    pub rolled_back: bool,
    pub message: String,
}

#[derive(Debug, Deserialize)]
struct HelperReply {
    ok: bool,
    code: String,
    message: String,
    #[serde(default)]
    hashes: Option<BTreeMap<String, String>>,
    #[serde(default)]
    rolled_back: bool,
}

pub fn apply(config: &AppConfig, force: bool) -> Result<ApplyResult, StructuredError> {
    let check = validate(config);
    if !check.ok() {
        return Err(
            StructuredError::new("VALIDATION", "configuration has blocking errors")
                .detail(serde_json::to_string(&check.errors).unwrap_or_default())
                .action("fix the highlighted mappings and try again"),
        );
    }

    let files = generate_all(config).map_err(StructuredError::from)?;
    let state = load_state();
    let payload = serde_json::json!({
        "files": files.iter().map(|f| serde_json::json!({ "name": f.name, "content": f.content })).collect::<Vec<_>>(),
        "prior": if state.applied_hashes.is_empty() { serde_json::Value::Null } else { serde_json::to_value(&state.applied_hashes).unwrap() },
        "force": force,
    });

    let reply = run_helper("apply", Some(&payload.to_string()))?;
    let mut state = load_state();
    if reply.ok {
        state.applied_hashes = reply.hashes.unwrap_or_default();
        state.last_applied = Some(now());
        state.last_error = None;
        save_state(&state);
        Ok(ApplyResult {
            applied: true,
            rolled_back: false,
            message: reply.message,
        })
    } else {
        state.last_error = Some(format!("{}: {}", reply.code, reply.message));
        save_state(&state);
        if reply.rolled_back {
            Ok(ApplyResult {
                applied: false,
                rolled_back: true,
                message: reply.message,
            })
        } else {
            let mut err = StructuredError::new(&reply.code, reply.message);
            if reply.code == "RELOAD" || reply.code == "IO" {
                err = err.retryable();
            }
            if reply.code == "EXTERNAL_CHANGE" {
                err = err.action("review the on-disk changes, then apply with force to overwrite");
            }
            Err(err)
        }
    }
}

pub fn helper_action(action: &str) -> Result<String, StructuredError> {
    let allowed = ["restore", "reload", "enable-service", "disable-service"];
    if !allowed.contains(&action) {
        return Err(StructuredError::new(
            "BAD_ACTION",
            format!("unknown action '{action}'"),
        ));
    }
    let reply = run_helper(action, None)?;
    if reply.ok {
        Ok(reply.message)
    } else {
        Err(StructuredError::new(&reply.code, reply.message))
    }
}

fn run_helper(action: &str, stdin_payload: Option<&str>) -> Result<HelperReply, StructuredError> {
    if system::which("pkexec").is_none() {
        return Err(StructuredError::new("NO_POLKIT", "pkexec is not available")
            .action("install polkit to authorize privileged actions"));
    }
    let helper = helper_path()?;
    let mut child = Command::new("pkexec")
        .arg(helper)
        .arg(action)
        .stdin(if stdin_payload.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            StructuredError::new("SPAWN", format!("cannot start pkexec: {e}")).retryable()
        })?;

    if let Some(payload) = stdin_payload {
        child
            .stdin
            .take()
            .unwrap()
            .write_all(payload.as_bytes())
            .map_err(|e| StructuredError::new("IO", format!("cannot send payload: {e}")))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| StructuredError::new("IO", format!("helper failed: {e}")))?;

    if output.status.code() == Some(126) || output.status.code() == Some(127) {
        return Err(
            StructuredError::new("AUTH_DENIED", "authorization was cancelled or denied")
                .action("try again and confirm the polkit prompt"),
        );
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let line = stdout
        .lines()
        .rev()
        .find(|l| l.trim_start().starts_with('{'))
        .ok_or_else(|| {
            StructuredError::new("HELPER", "helper returned no result")
                .detail(String::from_utf8_lossy(&output.stderr).to_string())
        })?;
    serde_json::from_str(line)
        .map_err(|e| StructuredError::new("HELPER", format!("invalid helper reply: {e}")))
}

fn helper_path() -> Result<String, StructuredError> {
    for candidate in [
        "/usr/bin/keybind-manager-helper",
        "/usr/local/bin/keybind-manager-helper",
    ] {
        if std::path::Path::new(candidate).is_file() {
            return Ok(candidate.into());
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        let sibling = exe.with_file_name(HELPER);
        if sibling.is_file() {
            return Ok(sibling.to_string_lossy().into_owned());
        }
    }
    Err(
        StructuredError::new("NO_HELPER", "keybind-manager-helper is not installed")
            .action("reinstall the package so the privileged helper and polkit policy are present"),
    )
}

fn now() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{secs}")
}
