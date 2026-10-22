use std::fs::{self, File, OpenOptions};
use std::io::{ErrorKind, Read, Write};
use std::os::unix::fs::OpenOptionsExt;
use std::path::PathBuf;
use std::thread::sleep;
use std::time::{Duration, Instant};

use keybind_core::StructuredError;
use serde::Serialize;

const REPORT_LEN: usize = 32;
const RAW_HID_DESCRIPTOR: [u8; 5] = [0x06, 0x60, 0xFF, 0x09, 0x61];
const O_NONBLOCK: i32 = 0o4000;
const REPLY_TIMEOUT: Duration = Duration::from_millis(600);
const BUFFER_CHUNK: usize = 28;

const CMD_PROTOCOL_VERSION: u8 = 0x01;
const CMD_GET_KEYBOARD_VALUE: u8 = 0x02;
const CMD_SET_KEYBOARD_VALUE: u8 = 0x03;
const CMD_SET_KEYCODE: u8 = 0x05;
const CMD_LAYER_COUNT: u8 = 0x11;
const CMD_GET_BUFFER: u8 = 0x12;
const CMD_UNHANDLED: u8 = 0xFF;
const VALUE_LAYOUT_OPTIONS: u8 = 0x02;

#[derive(Serialize)]
pub struct ViaKeyboard {
    pub path: String,
    pub protocol: u16,
    pub layers: u8,
}

fn failure(message: impl Into<String>) -> StructuredError {
    StructuredError {
        code: "via".into(),
        message: message.into(),
        detail: None,
        retryable: true,
        action: None,
    }
}

fn hex_id(vendor: &str, product: &str) -> String {
    format!(
        "{:0>4}:{:0>4}",
        vendor.trim_start_matches("0x").to_lowercase(),
        product.trim_start_matches("0x").to_lowercase()
    )
}

fn node_ids(node: &fs::DirEntry) -> Option<String> {
    let uevent = fs::read_to_string(node.path().join("device/uevent")).ok()?;
    let line = uevent.lines().find_map(|l| l.strip_prefix("HID_ID="))?;
    let mut parts = line.split(':').skip(1);
    let vendor = u32::from_str_radix(parts.next()?, 16).ok()?;
    let product = u32::from_str_radix(parts.next()?, 16).ok()?;
    Some(format!("{vendor:04x}:{product:04x}"))
}

fn has_raw_interface(node: &fs::DirEntry) -> bool {
    let Ok(descriptor) = fs::read(node.path().join("device/report_descriptor")) else {
        return false;
    };
    descriptor
        .windows(RAW_HID_DESCRIPTOR.len())
        .any(|w| w == RAW_HID_DESCRIPTOR)
}

fn find_node(vendor: &str, product: &str) -> Result<PathBuf, StructuredError> {
    let wanted = hex_id(vendor, product);
    let entries = fs::read_dir("/sys/class/hidraw").map_err(|e| failure(format!("cannot list hidraw devices: {e}")))?;
    for node in entries.flatten() {
        if node_ids(&node).as_deref() == Some(wanted.as_str()) && has_raw_interface(&node) {
            return Ok(PathBuf::from("/dev").join(node.file_name()));
        }
    }
    Err(failure(format!("no VIA raw HID interface found for {wanted}")))
}

fn open(path: &PathBuf) -> Result<File, StructuredError> {
    OpenOptions::new()
        .read(true)
        .write(true)
        .custom_flags(O_NONBLOCK)
        .open(path)
        .map_err(|e| failure(format!("cannot open {}: {e}", path.display())))
}

fn exchange(file: &mut File, request: &[u8]) -> Result<[u8; REPORT_LEN], StructuredError> {
    let mut report = [0u8; REPORT_LEN + 1];
    report[1..1 + request.len()].copy_from_slice(request);
    file.write_all(&report)
        .map_err(|e| failure(format!("write failed: {e}")))?;

    let deadline = Instant::now() + REPLY_TIMEOUT;
    let mut reply = [0u8; REPORT_LEN];
    while Instant::now() < deadline {
        match file.read(&mut reply) {
            Ok(n) if n >= REPORT_LEN && reply[0] == request[0] => return Ok(reply),
            Ok(n) if n >= REPORT_LEN && reply[0] == CMD_UNHANDLED && reply[1..request.len()] == request[1..] => {
                return Err(failure(format!("keyboard does not support VIA command 0x{:02x}", request[0])));
            }
            Ok(_) => {}
            Err(e) if e.kind() == ErrorKind::WouldBlock => sleep(Duration::from_millis(2)),
            Err(e) => return Err(failure(format!("read failed: {e}"))),
        }
    }
    Err(failure("keyboard did not answer"))
}

pub fn detect(vendor: &str, product: &str) -> Result<ViaKeyboard, StructuredError> {
    let path = find_node(vendor, product)?;
    let mut file = open(&path)?;
    let version = exchange(&mut file, &[CMD_PROTOCOL_VERSION])?;
    let layers = exchange(&mut file, &[CMD_LAYER_COUNT])?;
    Ok(ViaKeyboard {
        path: path.display().to_string(),
        protocol: u16::from_be_bytes([version[1], version[2]]),
        layers: layers[1],
    })
}

pub fn read_keymap(vendor: &str, product: &str, layers: u8, rows: u8, cols: u8) -> Result<Vec<u16>, StructuredError> {
    let path = find_node(vendor, product)?;
    let mut file = open(&path)?;
    let total = layers as usize * rows as usize * cols as usize * 2;
    let mut bytes = Vec::with_capacity(total);
    while bytes.len() < total {
        let offset = bytes.len() as u16;
        let size = BUFFER_CHUNK.min(total - bytes.len());
        let offset_bytes = offset.to_be_bytes();
        let reply = exchange(&mut file, &[CMD_GET_BUFFER, offset_bytes[0], offset_bytes[1], size as u8])?;
        bytes.extend_from_slice(&reply[4..4 + size]);
    }
    Ok(bytes
        .chunks_exact(2)
        .map(|pair| u16::from_be_bytes([pair[0], pair[1]]))
        .collect())
}

pub fn set_keycode(vendor: &str, product: &str, layer: u8, row: u8, col: u8, keycode: u16) -> Result<(), StructuredError> {
    let path = find_node(vendor, product)?;
    let mut file = open(&path)?;
    let code = keycode.to_be_bytes();
    exchange(&mut file, &[CMD_SET_KEYCODE, layer, row, col, code[0], code[1]])?;
    Ok(())
}

pub fn get_layout_options(vendor: &str, product: &str) -> Result<u32, StructuredError> {
    let path = find_node(vendor, product)?;
    let mut file = open(&path)?;
    let reply = exchange(&mut file, &[CMD_GET_KEYBOARD_VALUE, VALUE_LAYOUT_OPTIONS])?;
    Ok(u32::from_be_bytes([reply[2], reply[3], reply[4], reply[5]]))
}

pub fn set_layout_options(vendor: &str, product: &str, options: u32) -> Result<(), StructuredError> {
    let path = find_node(vendor, product)?;
    let mut file = open(&path)?;
    let bytes = options.to_be_bytes();
    exchange(
        &mut file,
        &[CMD_SET_KEYBOARD_VALUE, VALUE_LAYOUT_OPTIONS, bytes[0], bytes[1], bytes[2], bytes[3]],
    )?;
    Ok(())
}

pub fn write_file(path: &str, contents: &str) -> Result<(), StructuredError> {
    fs::write(path, contents).map_err(|e| failure(format!("cannot write {path}: {e}")))
}
