use std::collections::BTreeMap;
use std::fs;
use std::io::{Read, Write};
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
use std::path::{Path, PathBuf};
use std::process::{Command, ExitCode};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

const KEYD_DIR: &str = "/etc/keyd";
const BACKUP_DIR: &str = "/etc/keyd/.keybind-manager-backup";
const MANAGED_PREFIX: &str = "keybind-manager";
const MAX_PAYLOAD: usize = 1024 * 1024;
const MAX_FILES: usize = 32;

#[derive(Deserialize)]
struct ApplyPayload {
    files: Vec<PayloadFile>,
    #[serde(default)]
    prior: Option<BTreeMap<String, String>>,
    #[serde(default)]
    force: bool,
}

#[derive(Deserialize)]
struct PayloadFile {
    name: String,
    content: String,
}

#[derive(Serialize)]
struct Reply {
    ok: bool,
    code: String,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    hashes: Option<BTreeMap<String, String>>,
    rolled_back: bool,
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let reply = match args.first().map(String::as_str) {
        Some("apply") => apply(),
        Some("restore") => restore(),
        Some("reload") => reload_only(),
        Some("enable-service") => service_toggle(true),
        Some("disable-service") => service_toggle(false),
        Some("hashes") => current_hashes(),
        _ => fail("USAGE", "usage: keybind-manager-helper <apply|restore|reload|enable-service|disable-service|hashes>"),
    };
    let ok = reply.ok;
    println!("{}", serde_json::to_string(&reply).unwrap());
    if ok {
        ExitCode::SUCCESS
    } else {
        ExitCode::FAILURE
    }
}

fn fail(code: &str, message: impl Into<String>) -> Reply {
    Reply {
        ok: false,
        code: code.into(),
        message: message.into(),
        hashes: None,
        rolled_back: false,
    }
}

fn success(message: impl Into<String>) -> Reply {
    Reply {
        ok: true,
        code: "OK".into(),
        message: message.into(),
        hashes: None,
        rolled_back: false,
    }
}

fn valid_name(name: &str) -> bool {
    name.starts_with(MANAGED_PREFIX)
        && name.ends_with(".conf")
        && name.len() <= 96
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.')
        && !name.contains("..")
}

fn managed_files() -> std::io::Result<Vec<PathBuf>> {
    let mut out = Vec::new();
    for entry in fs::read_dir(KEYD_DIR)? {
        let entry = entry?;
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if valid_name(&name) && entry.file_type()?.is_file() {
            out.push(entry.path());
        }
    }
    out.sort();
    Ok(out)
}

fn hash_file(path: &Path) -> std::io::Result<String> {
    let content = fs::read(path)?;
    Ok(format!("{:x}", Sha256::digest(&content)))
}

fn current_hashes() -> Reply {
    match managed_files() {
        Ok(files) => {
            let mut hashes = BTreeMap::new();
            for path in files {
                let name = path.file_name().unwrap().to_string_lossy().to_string();
                match hash_file(&path) {
                    Ok(hash) => {
                        hashes.insert(name, hash);
                    }
                    Err(e) => return fail("IO", format!("cannot read {name}: {e}")),
                }
            }
            let mut reply = success("current managed file hashes");
            reply.hashes = Some(hashes);
            reply
        }
        Err(e) => fail("IO", format!("cannot list {KEYD_DIR}: {e}")),
    }
}

fn read_payload() -> Result<ApplyPayload, Reply> {
    let mut raw = String::new();
    std::io::stdin()
        .take(MAX_PAYLOAD as u64 + 1)
        .read_to_string(&mut raw)
        .map_err(|e| fail("IO", format!("cannot read payload: {e}")))?;
    if raw.len() > MAX_PAYLOAD {
        return Err(fail("PAYLOAD", "payload exceeds size limit"));
    }
    let payload: ApplyPayload =
        serde_json::from_str(&raw).map_err(|e| fail("PAYLOAD", format!("invalid payload: {e}")))?;
    if payload.files.len() > MAX_FILES {
        return Err(fail("PAYLOAD", "too many files"));
    }
    for file in &payload.files {
        if !valid_name(&file.name) {
            return Err(fail(
                "PAYLOAD",
                format!("invalid file name '{}'", file.name),
            ));
        }
        if file.content.len() > MAX_PAYLOAD {
            return Err(fail("PAYLOAD", "file content exceeds size limit"));
        }
        if file.content.contains('\0') {
            return Err(fail("PAYLOAD", "file content contains null bytes"));
        }
    }
    Ok(payload)
}

fn apply() -> Reply {
    let payload = match read_payload() {
        Ok(p) => p,
        Err(reply) => return reply,
    };

    if !Path::new(KEYD_DIR).is_dir() {
        return fail(
            "NO_KEYD_DIR",
            format!("{KEYD_DIR} does not exist; is keyd installed?"),
        );
    }

    let existing = match managed_files() {
        Ok(files) => files,
        Err(e) => return fail("IO", format!("cannot list managed files: {e}")),
    };

    if let Some(prior) = &payload.prior {
        if !payload.force {
            for path in &existing {
                let name = path.file_name().unwrap().to_string_lossy().to_string();
                let actual = match hash_file(path) {
                    Ok(h) => h,
                    Err(e) => return fail("IO", format!("cannot hash {name}: {e}")),
                };
                if prior.get(&name).map(String::as_str) != Some(actual.as_str()) {
                    return fail(
                        "EXTERNAL_CHANGE",
                        format!(
                            "{name} was modified outside Keybind Manager; re-sync or force apply"
                        ),
                    );
                }
            }
        }
    }

    if let Err(e) = backup(&existing) {
        return fail("BACKUP", format!("backup failed, nothing was changed: {e}"));
    }

    if let Err(reply) = write_files(&payload, &existing) {
        let rolled_back = restore_backup().is_ok();
        let mut reply = reply;
        reply.rolled_back = rolled_back;
        return reply;
    }

    match reload_and_verify() {
        Ok(()) => {
            let mut reply = success("configuration applied and keyd reloaded");
            reply.hashes = hash_map(&payload);
            reply
        }
        Err(message) => {
            let rolled_back = restore_backup().is_ok() && reload_and_verify().is_ok();
            let mut reply = fail("RELOAD", message);
            reply.rolled_back = rolled_back;
            if rolled_back {
                reply
                    .message
                    .push_str("; previous configuration was restored");
            } else {
                reply
                    .message
                    .push_str("; automatic rollback failed, restore manually from ");
                reply.message.push_str(BACKUP_DIR);
            }
            reply
        }
    }
}

fn hash_map(payload: &ApplyPayload) -> Option<BTreeMap<String, String>> {
    let mut hashes = BTreeMap::new();
    for file in &payload.files {
        hashes.insert(
            file.name.clone(),
            format!("{:x}", Sha256::digest(file.content.as_bytes())),
        );
    }
    Some(hashes)
}

fn backup(existing: &[PathBuf]) -> std::io::Result<()> {
    if Path::new(BACKUP_DIR).exists() {
        fs::remove_dir_all(BACKUP_DIR)?;
    }
    fs::create_dir_all(BACKUP_DIR)?;
    fs::set_permissions(BACKUP_DIR, fs::Permissions::from_mode(0o700))?;
    for path in existing {
        let name = path.file_name().unwrap();
        fs::copy(path, Path::new(BACKUP_DIR).join(name))?;
    }
    Ok(())
}

fn restore_backup() -> std::io::Result<()> {
    let existing = managed_files()?;
    for path in existing {
        fs::remove_file(path)?;
    }
    if !Path::new(BACKUP_DIR).is_dir() {
        return Ok(());
    }
    for entry in fs::read_dir(BACKUP_DIR)? {
        let entry = entry?;
        let name = entry.file_name();
        if valid_name(&name.to_string_lossy()) {
            fs::copy(entry.path(), Path::new(KEYD_DIR).join(&name))?;
        }
    }
    Ok(())
}

fn write_files(payload: &ApplyPayload, existing: &[PathBuf]) -> Result<(), Reply> {
    let wanted: Vec<&str> = payload.files.iter().map(|f| f.name.as_str()).collect();
    for path in existing {
        let name = path.file_name().unwrap().to_string_lossy().to_string();
        if !wanted.contains(&name.as_str()) {
            if let Ok(meta) = fs::symlink_metadata(path) {
                if meta.file_type().is_symlink() {
                    return Err(fail(
                        "SYMLINK",
                        format!("{name} is a symlink; refusing to touch it"),
                    ));
                }
            }
            fs::remove_file(path).map_err(|e| fail("IO", format!("cannot remove {name}: {e}")))?;
        }
    }
    for file in &payload.files {
        atomic_write(&file.name, &file.content)
            .map_err(|e| fail("IO", format!("cannot write {}: {e}", file.name)))?;
    }
    Ok(())
}

fn atomic_write(name: &str, content: &str) -> std::io::Result<()> {
    let target = Path::new(KEYD_DIR).join(name);
    if let Ok(meta) = fs::symlink_metadata(&target) {
        if meta.file_type().is_symlink() {
            return Err(std::io::Error::other("target is a symlink"));
        }
    }
    let tmp = Path::new(KEYD_DIR).join(format!(".{name}.tmp"));
    {
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o600)
            .open(&tmp)?;
        file.write_all(content.as_bytes())?;
        file.sync_all()?;
    }
    fs::rename(&tmp, &target)?;
    if let Ok(dir) = fs::File::open(KEYD_DIR) {
        let _ = dir.sync_all();
    }
    Ok(())
}

fn reload_and_verify() -> Result<(), String> {
    let reload = Command::new("systemctl")
        .args(["reload-or-restart", "keyd.service"])
        .output()
        .map_err(|e| format!("cannot run systemctl: {e}"))?;
    if !reload.status.success() {
        return Err(format!(
            "systemctl reload-or-restart keyd failed: {}",
            String::from_utf8_lossy(&reload.stderr).trim()
        ));
    }
    for _ in 0..10 {
        let active = Command::new("systemctl")
            .args(["is-active", "--quiet", "keyd.service"])
            .status()
            .map_err(|e| format!("cannot run systemctl: {e}"))?;
        if active.success() {
            return Ok(());
        }
        std::thread::sleep(std::time::Duration::from_millis(200));
    }
    Err("keyd.service is not active after reload".into())
}

fn reload_only() -> Reply {
    match reload_and_verify() {
        Ok(()) => success("keyd reloaded"),
        Err(message) => fail("RELOAD", message),
    }
}

fn restore() -> Reply {
    match restore_backup() {
        Ok(()) => match reload_and_verify() {
            Ok(()) => success("backup restored and keyd reloaded"),
            Err(message) => fail(
                "RELOAD",
                format!("backup restored but reload failed: {message}"),
            ),
        },
        Err(e) => fail("IO", format!("restore failed: {e}")),
    }
}

fn service_toggle(enable: bool) -> Reply {
    let action = if enable { "enable" } else { "disable" };
    let output = Command::new("systemctl")
        .args([action, "--now", "keyd.service"])
        .output();
    match output {
        Ok(out) if out.status.success() => success(format!("keyd.service {action}d")),
        Ok(out) => fail(
            "SERVICE",
            format!(
                "systemctl {action} keyd failed: {}",
                String::from_utf8_lossy(&out.stderr).trim()
            ),
        ),
        Err(e) => fail("SERVICE", format!("cannot run systemctl: {e}")),
    }
}
