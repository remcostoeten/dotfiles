use rustix::process::{Pid, Signal, kill_process, kill_process_group};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::net::TcpListener;
use std::path::PathBuf;
use std::process::Child;
use std::thread;
use std::time::{Duration, Instant};

#[derive(Clone)]
pub struct Owner {
    pub pid: u32,
    pub name: String,
    pub cwd: Option<PathBuf>,
}

fn listening_sockets() -> Vec<(u16, u64, bool)> {
    let mut found = Vec::new();
    for table in ["/proc/net/tcp", "/proc/net/tcp6"] {
        let Ok(text) = fs::read_to_string(table) else {
            continue;
        };
        for line in text.lines().skip(1) {
            let fields: Vec<&str> = line.split_whitespace().collect();
            if fields.len() < 10 || fields[3] != "0A" {
                continue;
            }
            let Some((_, port_hex)) = fields[1].rsplit_once(':') else {
                continue;
            };
            let (Ok(port), Ok(inode)) = (u16::from_str_radix(port_hex, 16), fields[9].parse())
            else {
                continue;
            };
            let exposed = fields[1]
                .split(':')
                .next()
                .is_some_and(|addr| addr.chars().all(|c| c == '0'));
            found.push((port, inode, exposed));
        }
    }
    found
}

pub fn port_is_free(port: u16) -> bool {
    if listening_sockets()
        .iter()
        .any(|(listening, _, _)| *listening == port)
    {
        return false;
    }
    TcpListener::bind(("0.0.0.0", port)).is_ok()
}

fn socket_inode(target: &std::path::Path) -> Option<u64> {
    let text = target.to_str()?;
    text.strip_prefix("socket:[")?
        .strip_suffix(']')?
        .parse()
        .ok()
}

fn pids() -> Vec<u32> {
    let Ok(entries) = fs::read_dir("/proc") else {
        return Vec::new();
    };
    entries
        .filter_map(|entry| entry.ok()?.file_name().to_str()?.parse().ok())
        .collect()
}

fn socket_inodes_of(pid: u32) -> Vec<u64> {
    let Ok(entries) = fs::read_dir(format!("/proc/{pid}/fd")) else {
        return Vec::new();
    };
    entries
        .filter_map(|entry| socket_inode(&fs::read_link(entry.ok()?.path()).ok()?))
        .collect()
}

fn process_name(pid: u32) -> String {
    let comm = || {
        fs::read_to_string(format!("/proc/{pid}/comm"))
            .map(|text| text.trim().to_string())
            .unwrap_or_else(|_| "unknown".to_string())
    };
    let Ok(raw) = fs::read(format!("/proc/{pid}/cmdline")) else {
        return comm();
    };
    let args: Vec<String> = raw
        .split(|byte| *byte == 0)
        .filter(|part| !part.is_empty())
        .map(|part| String::from_utf8_lossy(part).to_string())
        .collect();
    let base = |text: &str| text.rsplit('/').next().unwrap_or(text).to_string();
    let Some(first) = args.first().map(|arg| base(arg)) else {
        return comm();
    };
    let runtime = ["node", "bun", "deno", "python", "python3", "ruby", "php"];
    let script = args.iter().skip(1).find(|arg| !arg.starts_with('-'));
    match script {
        Some(script) if runtime.contains(&first.as_str()) => format!("{first} {}", base(script)),
        _ => first,
    }
}

pub fn owner_of(port: u16) -> Option<Owner> {
    let inodes: HashSet<u64> = listening_sockets()
        .into_iter()
        .filter(|(listening, _, _)| *listening == port)
        .map(|(_, inode, _)| inode)
        .collect();
    if inodes.is_empty() {
        return None;
    }
    for pid in pids() {
        if !socket_inodes_of(pid)
            .iter()
            .any(|inode| inodes.contains(inode))
        {
            continue;
        }
        let name = process_name(pid);
        let cwd = fs::read_link(format!("/proc/{pid}/cwd")).ok();
        return Some(Owner { pid, name, cwd });
    }
    None
}

fn parent_of(pid: u32) -> Option<u32> {
    let text = fs::read_to_string(format!("/proc/{pid}/stat")).ok()?;
    let after = &text[text.rfind(')')? + 1..];
    after.split_whitespace().nth(1)?.parse().ok()
}

pub fn descendants(root: u32) -> Vec<u32> {
    let mut children: HashMap<u32, Vec<u32>> = HashMap::new();
    for pid in pids() {
        if let Some(parent) = parent_of(pid) {
            children.entry(parent).or_default().push(pid);
        }
    }
    let mut found = vec![root];
    let mut index = 0;
    while index < found.len() {
        if let Some(next) = children.get(&found[index]) {
            found.extend(next.iter().copied());
        }
        index += 1;
    }
    found
}

pub struct Listen {
    pub port: u16,
    pub exposed: bool,
}

pub fn ports_of(group: &[u32]) -> Vec<Listen> {
    let sockets = listening_sockets();
    if sockets.is_empty() {
        return Vec::new();
    }
    let by_inode: HashMap<u64, (u16, bool)> = sockets
        .into_iter()
        .map(|(port, inode, exposed)| (inode, (port, exposed)))
        .collect();
    let mut found: Vec<Listen> = Vec::new();
    for inode in group.iter().flat_map(|pid| socket_inodes_of(*pid)) {
        let Some((port, exposed)) = by_inode.get(&inode).copied() else {
            continue;
        };
        match found.iter_mut().find(|listen| listen.port == port) {
            Some(existing) => existing.exposed |= exposed,
            None => found.push(Listen { port, exposed }),
        }
    }
    found.sort_by_key(|listen| listen.port);
    found
}

pub fn lan_ip() -> Option<std::net::IpAddr> {
    let socket = std::net::UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("192.0.2.1:9").ok()?;
    let ip = socket.local_addr().ok()?.ip();
    (!ip.is_loopback() && !ip.is_unspecified()).then_some(ip)
}

pub struct Listener {
    pub pid: u32,
    pub name: String,
    pub cwd: PathBuf,
    pub ports: Vec<u16>,
}

fn ancestry() -> Vec<u32> {
    let mut chain = vec![std::process::id()];
    while let Some(parent) = chain.last().and_then(|pid| parent_of(*pid)) {
        if parent == 0 || chain.contains(&parent) {
            break;
        }
        chain.push(parent);
    }
    chain
}

pub fn listeners_in(scope: &std::path::Path) -> Vec<Listener> {
    let sockets = listening_sockets();
    let by_inode: HashMap<u64, u16> = sockets
        .into_iter()
        .map(|(port, inode, _)| (inode, port))
        .collect();
    let skip = ancestry();
    let mut found = Vec::new();
    for pid in pids() {
        if skip.contains(&pid) {
            continue;
        }
        let Ok(cwd) = fs::read_link(format!("/proc/{pid}/cwd")) else {
            continue;
        };
        if !cwd.starts_with(scope) {
            continue;
        }
        let mut ports: Vec<u16> = socket_inodes_of(pid)
            .iter()
            .filter_map(|inode| by_inode.get(inode).copied())
            .collect();
        if ports.is_empty() {
            continue;
        }
        ports.sort_unstable();
        ports.dedup();
        found.push(Listener {
            pid,
            name: process_name(pid),
            cwd,
            ports,
        });
    }
    found.sort_by_key(|listener| listener.pid);
    found
}

fn alive(pid: u32) -> bool {
    let Ok(text) = fs::read_to_string(format!("/proc/{pid}/stat")) else {
        return false;
    };
    let Some(index) = text.rfind(')') else {
        return false;
    };
    !text[index + 1..].trim_start().starts_with('Z')
}

fn pid_of(raw: u32) -> Option<Pid> {
    Pid::from_raw(i32::try_from(raw).ok()?)
}

fn send(pid: u32, signal: Signal) {
    if let Some(target) = pid_of(pid) {
        kill_process(target, signal).ok();
    }
}

fn send_group(pid: u32, signal: Signal) {
    if let Some(target) = pid_of(pid) {
        kill_process_group(target, signal).ok();
    }
}

pub fn terminate(child: &mut Child, own_group: bool) {
    let root = child.id();
    let tree = descendants(root);
    if own_group {
        send_group(root, Signal::TERM);
    }
    for pid in &tree {
        send(*pid, Signal::TERM);
    }
    let deadline = Instant::now() + Duration::from_secs(3);
    loop {
        child.try_wait().ok();
        if tree.iter().all(|pid| !alive(*pid)) {
            return;
        }
        if Instant::now() >= deadline {
            break;
        }
        thread::sleep(Duration::from_millis(50));
    }
    if own_group {
        send_group(root, Signal::KILL);
    }
    for pid in &tree {
        send(*pid, Signal::KILL);
    }
    child.wait().ok();
}

pub fn on_path(program: &str) -> bool {
    let Some(path) = std::env::var_os("PATH") else {
        return false;
    };
    std::env::split_paths(&path).any(|dir| dir.join(program).is_file())
}

pub fn kill_tree(root: u32) {
    if root == std::process::id() {
        return;
    }
    let tree = descendants(root);
    for pid in &tree {
        send(*pid, Signal::TERM);
    }
    let deadline = Instant::now() + Duration::from_secs(3);
    while Instant::now() < deadline {
        if tree.iter().all(|pid| !alive(*pid)) {
            return;
        }
        thread::sleep(Duration::from_millis(50));
    }
    for pid in &tree {
        send(*pid, Signal::KILL);
    }
}
