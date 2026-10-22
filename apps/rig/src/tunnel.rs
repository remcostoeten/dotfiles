use crate::sys;
use std::collections::VecDeque;
use std::io::{BufRead, BufReader, Read};
use std::os::unix::process::CommandExt;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

const ROUTE_TIMEOUT: Duration = Duration::from_secs(90);
const EXTEND_BY: Duration = Duration::from_secs(30 * 60);
const TAIL_LINES: usize = 40;

pub enum TunnelEvent {
    Url(String),
    Routed,
    RouteTimeout,
}

enum Runner {
    Cloudflared,
    Docker(String),
}

pub struct Tunnel {
    pub child: Child,
    pub port: u16,
    pub url: Option<String>,
    pub warned: bool,
    deadline: Option<Instant>,
    runner: Runner,
    tail: Arc<Mutex<VecDeque<String>>>,
    stopped: Arc<AtomicBool>,
}

pub fn find_url(line: &str) -> Option<String> {
    let start = line.find("https://")?;
    let rest = &line[start..];
    let end = rest
        .find(|c: char| !(c.is_ascii_alphanumeric() || matches!(c, '-' | '.' | ':' | '/')))
        .unwrap_or(rest.len());
    let candidate = rest[..end].trim_end_matches('/');
    let is_quick_tunnel = candidate.ends_with(".trycloudflare.com");
    (is_quick_tunnel && candidate != "https://api.trycloudflare.com").then(|| candidate.to_string())
}

fn route_ready(url: &str) -> bool {
    let host = url.trim_start_matches("https://");
    let output = Command::new("curl")
        .args([
            "-s",
            "-o",
            "/dev/null",
            "-w",
            "%{http_code}",
            "--max-time",
            "5",
            "--connect-to",
            &format!("{host}:443:api.trycloudflare.com:443"),
            &format!("{url}/favicon.ico"),
        ])
        .output();
    let Ok(output) = output else {
        return false;
    };
    let code = String::from_utf8_lossy(&output.stdout);
    matches!(code.trim().chars().next(), Some('2' | '3' | '4'))
}

fn watch_route(
    url: String,
    stopped: Arc<AtomicBool>,
    notify: Arc<dyn Fn(TunnelEvent) + Send + Sync>,
) {
    if !sys::on_path("curl") {
        return;
    }
    thread::spawn(move || {
        let started = Instant::now();
        while started.elapsed() < ROUTE_TIMEOUT && !stopped.load(Ordering::SeqCst) {
            if route_ready(&url) {
                notify(TunnelEvent::Routed);
                return;
            }
            thread::sleep(Duration::from_secs(1));
        }
        if !stopped.load(Ordering::SeqCst) {
            notify(TunnelEvent::RouteTimeout);
        }
    });
}

fn read_stream(
    stream: impl Read + Send + 'static,
    tail: Arc<Mutex<VecDeque<String>>>,
    found: Arc<AtomicBool>,
    stopped: Arc<AtomicBool>,
    notify: Arc<dyn Fn(TunnelEvent) + Send + Sync>,
) {
    thread::spawn(move || {
        for line in BufReader::new(stream).lines().map_while(Result::ok) {
            if let Ok(mut lines) = tail.lock() {
                if lines.len() == TAIL_LINES {
                    lines.pop_front();
                }
                lines.push_back(line.clone());
            }
            if found.load(Ordering::SeqCst) {
                continue;
            }
            if let Some(url) = find_url(&line) {
                found.store(true, Ordering::SeqCst);
                notify(TunnelEvent::Url(url.clone()));
                watch_route(url, stopped.clone(), notify.clone());
            }
        }
    });
}

impl Tunnel {
    pub fn start(
        port: u16,
        limit: Option<Duration>,
        notify: impl Fn(TunnelEvent) + Send + Sync + 'static,
    ) -> Result<Tunnel, String> {
        let (mut command, runner) = if sys::on_path("cloudflared") {
            let mut command = Command::new("cloudflared");
            command
                .args(["tunnel", "--no-autoupdate", "--grace-period", "1s", "--url"])
                .arg(format!("http://localhost:{port}"));
            (command, Runner::Cloudflared)
        } else if sys::on_path("docker") {
            let name = format!("rig-tunnel-{}-{port}", std::process::id());
            let mut command = Command::new("docker");
            command
                .args(["run", "--rm", "--name", &name])
                .arg("--add-host=host.docker.internal:host-gateway")
                .args(["cloudflare/cloudflared:latest", "tunnel", "--no-autoupdate"])
                .args(["--grace-period", "1s", "--url"])
                .arg(format!("http://host.docker.internal:{port}"));
            (command, Runner::Docker(name))
        } else {
            return Err("install cloudflared or Docker to share the app".to_string());
        };
        let mut child = command
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .process_group(0)
            .spawn()
            .map_err(|error| format!("cannot start the tunnel: {error}"))?;
        let notify: Arc<dyn Fn(TunnelEvent) + Send + Sync> = Arc::new(notify);
        let tail = Arc::new(Mutex::new(VecDeque::new()));
        let found = Arc::new(AtomicBool::new(false));
        let stopped = Arc::new(AtomicBool::new(false));
        if let Some(out) = child.stdout.take() {
            read_stream(
                out,
                tail.clone(),
                found.clone(),
                stopped.clone(),
                notify.clone(),
            );
        }
        if let Some(err) = child.stderr.take() {
            read_stream(
                err,
                tail.clone(),
                found.clone(),
                stopped.clone(),
                notify.clone(),
            );
        }
        Ok(Tunnel {
            child,
            port,
            url: None,
            warned: false,
            deadline: limit.map(|limit| Instant::now() + limit),
            runner,
            tail,
            stopped,
        })
    }

    pub fn remaining(&self) -> Option<Duration> {
        self.deadline
            .map(|deadline| deadline.saturating_duration_since(Instant::now()))
    }

    pub fn extend(&mut self) -> Option<Duration> {
        let deadline = self.deadline.as_mut()?;
        *deadline += EXTEND_BY;
        self.warned = false;
        self.remaining()
    }

    pub fn last_lines(&self, count: usize) -> Vec<String> {
        let Ok(lines) = self.tail.lock() else {
            return Vec::new();
        };
        let skip = lines.len().saturating_sub(count);
        lines.iter().skip(skip).cloned().collect()
    }

    pub fn stop(&mut self) {
        self.stopped.store(true, Ordering::SeqCst);
        sys::terminate(&mut self.child, true);
        if let Runner::Docker(name) = &self.runner {
            Command::new("docker")
                .args(["rm", "-f", name])
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status()
                .ok();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quick_tunnel_url_is_found_in_a_log_box() {
        let line = "2025-01-01T00:00:00Z INF |  https://random-words-here.trycloudflare.com  |";
        assert_eq!(
            find_url(line).as_deref(),
            Some("https://random-words-here.trycloudflare.com")
        );
    }

    #[test]
    fn the_api_host_and_other_urls_are_ignored() {
        assert_eq!(
            find_url("Post \"https://api.trycloudflare.com/tunnel\""),
            None
        );
        assert_eq!(find_url("see https://example.com for docs"), None);
    }
}
