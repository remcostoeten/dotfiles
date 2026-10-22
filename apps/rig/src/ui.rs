use std::io::IsTerminal;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

static COLOR: AtomicBool = AtomicBool::new(false);

const ACCENT: u8 = 110;
const OK: u8 = 108;
const WARN: u8 = 179;
const ERR: u8 = 167;
const DIM: u8 = 243;

pub fn init(disable: bool) {
    let on = !disable && std::env::var_os("NO_COLOR").is_none() && std::io::stdout().is_terminal();
    COLOR.store(on, Ordering::Relaxed);
}

pub fn color_on() -> bool {
    COLOR.load(Ordering::Relaxed)
}

fn paint(code: u8, bold: bool, text: &str) -> String {
    if !color_on() {
        return text.to_string();
    }
    let weight = if bold { "1;" } else { "" };
    format!("\x1b[{weight}38;5;{code}m{text}\x1b[0m")
}

pub fn accent(text: &str) -> String {
    paint(ACCENT, false, text)
}

pub fn accent_bold(text: &str) -> String {
    paint(ACCENT, true, text)
}

pub fn ok(text: &str) -> String {
    paint(OK, false, text)
}

pub fn warn(text: &str) -> String {
    paint(WARN, false, text)
}

pub fn err(text: &str) -> String {
    paint(ERR, false, text)
}

pub fn err_bold(text: &str) -> String {
    paint(ERR, true, text)
}

pub fn dim(text: &str) -> String {
    paint(DIM, false, text)
}

pub fn bold(text: &str) -> String {
    if color_on() {
        format!("\x1b[1m{text}\x1b[0m")
    } else {
        text.to_string()
    }
}

pub fn banner(command: &str) {
    println!();
    println!("  {} {} {}", accent_bold("rig"), dim("·"), command);
    println!();
}

pub fn row(label: &str, value: &str) {
    println!("  {}  {}", dim(&format!("{label:<10}")), value);
}

pub fn step(message: &str) {
    println!("  {} {}", accent("◆"), message);
}

pub fn success(message: &str) {
    println!("  {} {}", ok("✓"), message);
}

pub fn warning(message: &str) {
    println!("  {} {}", warn("!"), message);
}

pub fn note(message: &str) {
    println!("  {} {}", dim("·"), dim(message));
}

pub fn rule(title: &str) {
    println!();
    println!("  {} {} {}", dim("──"), title, dim(&"─".repeat(36)));
}

pub fn stopped(message: &str) {
    println!();
    println!("  {} {}", dim("■"), message);
    println!();
}

pub fn kbd(key: &str) -> String {
    if !color_on() {
        return format!("[{key}]");
    }
    format!("\x1b[48;5;238m\x1b[38;5;252m {key} \x1b[0m")
}

pub fn kbd_width(key: &str) -> usize {
    key.chars().count() + 2
}

fn hint_line(items: &[(&str, &str)]) {
    let parts: Vec<String> = items
        .iter()
        .map(|(key, label)| format!("{} {}", kbd(key), dim(label)))
        .collect();
    println!("  {}", parts.join("  "));
}

pub fn keys_hint() {
    hint_line(&[
        ("o", "browser"),
        (".", "folder"),
        ("t", "terminal / tunnel"),
        ("c", "copy"),
        ("r", "restart"),
        ("q", "quit"),
    ]);
}

pub fn kill_hint(port: u16, name: &str, pid: u32) {
    println!(
        "  {} {}",
        kbd("k"),
        dim(&format!(
            "stop {name} (pid {pid}) and run on :{port} instead"
        ))
    );
}

pub fn terminal_menu(tunnel_active: bool) {
    let tunnel = if tunnel_active {
        "stop tunnel"
    } else {
        "tunnel"
    };
    println!(
        "  {} {}/{} {}  {}/{} {}  {}",
        kbd("t"),
        kbd("1"),
        kbd("e"),
        dim("terminal"),
        kbd("2"),
        kbd("u"),
        dim(tunnel),
        dim("any other key cancels")
    );
}

pub fn tunnel_hint(has_limit: bool) {
    let mut items = vec![("t u", "stop tunnel")];
    if has_limit {
        items.push(("+", "30 more minutes"));
    }
    hint_line(&items);
}

pub fn keys_hint_stopped() {
    hint_line(&[
        (".", "folder"),
        ("t", "terminal"),
        ("r", "restart"),
        ("q", "quit"),
    ]);
    println!();
}

pub fn gutter(line: &str, from_stderr: bool) {
    gutter_at(2, line, from_stderr);
}

fn gutter_at(indent: usize, line: &str, from_stderr: bool) {
    let pad = " ".repeat(indent);
    let bar = dim("│");
    if line.contains('\x1b') {
        println!("{pad}{bar} {line}");
        return;
    }
    println!("{pad}{bar} {}", tint(line, from_stderr));
}

fn tint(line: &str, from_stderr: bool) -> String {
    let lower = line.to_lowercase();
    let is_error = lower.contains("error")
        || lower.contains("err!")
        || lower.contains("err_")
        || lower.contains("failed")
        || lower.contains("cannot find")
        || lower.contains("not found");
    if is_error {
        return err(line);
    }
    if lower.contains("warn") || lower.contains("deprecated") {
        return warn(line);
    }
    if from_stderr {
        return dim(line);
    }
    line.to_string()
}

pub fn error_panel(title: &str, rows: &[(&str, String)], tail: &[String], hint: Option<&str>) {
    println!();
    println!("  {} {}", err_bold("✗"), err_bold(title));
    println!();
    for (label, value) in rows {
        println!("    {}  {}", dim(&format!("{label:<8}")), value);
    }
    if !tail.is_empty() {
        println!();
        println!("    {}", dim("last output"));
        for line in tail {
            gutter_at(4, line, false);
        }
    }
    if let Some(text) = hint {
        println!();
        println!("    {} {}", accent("→"), text);
    }
    println!();
}

pub fn fatal(message: &str) {
    eprintln!();
    eprintln!("  {} {}", err_bold("✗"), message);
    eprintln!();
}

pub fn format_duration(duration: Duration) -> String {
    let millis = duration.as_millis();
    if millis < 1000 {
        return format!("{millis}ms");
    }
    let seconds = duration.as_secs_f64();
    if seconds < 60.0 {
        return format!("{seconds:.1}s");
    }
    let total = duration.as_secs();
    if total < 3600 {
        return format!("{}m {}s", total / 60, total % 60);
    }
    format!("{}h {}m", total / 3600, (total % 3600) / 60)
}

pub fn home_relative(path: &Path) -> String {
    let text = path.display().to_string();
    match std::env::var("HOME") {
        Ok(home) if !home.is_empty() && text.starts_with(&home) => {
            format!("~{}", &text[home.len()..])
        }
        _ => text,
    }
}

pub fn strip_ansi(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut chars = text.chars().peekable();
    while let Some(c) = chars.next() {
        if c != '\x1b' {
            out.push(c);
            continue;
        }
        if chars.peek() == Some(&'[') {
            chars.next();
            for next in chars.by_ref() {
                if next.is_ascii_alphabetic() {
                    break;
                }
            }
        }
    }
    out
}

pub fn choose(title: &str, items: &[(String, String)]) -> Option<usize> {
    use std::io::{BufRead, Write};
    step(title);
    for (index, (name, detail)) in items.iter().enumerate() {
        println!(
            "     {}  {:<18} {}",
            accent(&format!("{}", index + 1)),
            name,
            dim(detail)
        );
    }
    if !std::io::stdin().is_terminal() {
        return None;
    }
    print!("  {} ", dim(&format!("choose [1-{}]:", items.len())));
    std::io::stdout().flush().ok();
    let mut line = String::new();
    std::io::stdin().lock().read_line(&mut line).ok()?;
    let picked: usize = line.trim().parse().ok()?;
    (1..=items.len()).contains(&picked).then(|| picked - 1)
}
