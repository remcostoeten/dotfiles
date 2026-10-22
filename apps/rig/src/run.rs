use crate::sys;
use crate::term::{self, Keys};
use crate::ui;
use std::collections::VecDeque;
use std::io::{BufRead, BufReader, Read};
use std::os::unix::process::{CommandExt, ExitStatusExt};
use std::path::PathBuf;
use std::process::{Child, Command, ExitStatus, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::thread;
use std::time::{Duration, Instant};

pub static STOP: AtomicBool = AtomicBool::new(false);

const MAX_PORT_TRIES: u16 = 100;
const EXIT_DRAIN: Duration = Duration::from_millis(250);
const SCAN_EVERY: Duration = Duration::from_millis(400);

#[derive(Clone, Debug)]
pub struct Plan {
    pub program: String,
    pub args: Vec<String>,
    pub cwd: PathBuf,
    pub env: Vec<(String, String)>,
}

impl Plan {
    pub fn shown(&self) -> String {
        let mut parts = vec![self.program.clone()];
        parts.extend(self.args.iter().cloned());
        parts.join(" ")
    }
}

enum Event {
    Line {
        generation: u32,
        text: String,
        stderr: bool,
    },
    Key(u8),
}

struct Tail {
    lines: VecDeque<String>,
    cap: usize,
}

impl Tail {
    fn new(cap: usize) -> Tail {
        Tail {
            lines: VecDeque::new(),
            cap,
        }
    }

    fn push(&mut self, line: &str) {
        let clean = ui::strip_ansi(line);
        if clean.trim().is_empty() {
            return;
        }
        if self.lines.len() == self.cap {
            self.lines.pop_front();
        }
        self.lines.push_back(clean);
    }

    fn last(&self, count: usize) -> Vec<String> {
        let skip = self.lines.len().saturating_sub(count);
        self.lines.iter().skip(skip).cloned().collect()
    }
}

pub enum StepOutcome {
    Done(Duration),
    Failed {
        code: i32,
        elapsed: Duration,
        tail: Vec<String>,
    },
    Interrupted,
    SpawnFailed(String),
}

fn spawn(plan: &Plan, own_group: bool) -> std::io::Result<Child> {
    let mut command = Command::new(&plan.program);
    command
        .args(&plan.args)
        .current_dir(&plan.cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    for (key, value) in &plan.env {
        command.env(key, value);
    }
    if own_group {
        command.process_group(0);
    }
    command.spawn()
}

fn pump(
    reader: impl Read + Send + 'static,
    send: impl Fn(String, bool) -> bool + Send + 'static,
    stderr: bool,
) {
    thread::spawn(move || {
        let mut reader = BufReader::new(reader);
        let mut buffer = Vec::new();
        loop {
            buffer.clear();
            match reader.read_until(b'\n', &mut buffer) {
                Ok(0) | Err(_) => return,
                Ok(_) => {
                    let text = String::from_utf8_lossy(&buffer)
                        .trim_end_matches(['\n', '\r'])
                        .to_string();
                    let last = text
                        .rsplit('\r')
                        .find(|part| !part.is_empty())
                        .unwrap_or("")
                        .to_string();
                    if !send(last, stderr) {
                        return;
                    }
                }
            }
        }
    });
}

fn exit_code(status: &ExitStatus) -> i32 {
    status
        .code()
        .or_else(|| status.signal().map(|signal| 128 + signal))
        .unwrap_or(1)
}

fn missing_program(plan: &Plan) -> Option<String> {
    (!sys::on_path(&plan.program))
        .then(|| format!("`{}` is not installed or not on PATH", plan.program))
}

pub fn run_step(plan: &Plan) -> StepOutcome {
    if let Some(message) = missing_program(plan) {
        return StepOutcome::SpawnFailed(message);
    }
    let started = Instant::now();
    let mut child = match spawn(plan, false) {
        Ok(child) => child,
        Err(error) => return StepOutcome::SpawnFailed(error.to_string()),
    };
    let (tx, rx) = mpsc::channel::<(String, bool)>();
    if let Some(out) = child.stdout.take() {
        let tx = tx.clone();
        pump(
            out,
            move |text, stderr| tx.send((text, stderr)).is_ok(),
            false,
        );
    }
    if let Some(err) = child.stderr.take() {
        let tx = tx.clone();
        pump(
            err,
            move |text, stderr| tx.send((text, stderr)).is_ok(),
            true,
        );
    }
    drop(tx);
    let mut tail = Tail::new(40);
    let mut status: Option<ExitStatus> = None;
    let mut exited_at: Option<Instant> = None;
    loop {
        if STOP.load(Ordering::SeqCst) {
            sys::terminate(&mut child, false);
            return StepOutcome::Interrupted;
        }
        match rx.recv_timeout(Duration::from_millis(50)) {
            Ok((text, stderr)) => {
                ui::gutter(&text, stderr);
                tail.push(&text);
            }
            Err(RecvTimeoutError::Disconnected) => break,
            Err(RecvTimeoutError::Timeout) => {
                if status.is_none() {
                    status = child.try_wait().ok().flatten();
                    if status.is_some() {
                        exited_at = Some(Instant::now());
                    }
                }
                if exited_at.is_some_and(|at| at.elapsed() > EXIT_DRAIN) {
                    break;
                }
            }
        }
    }
    let status = match status {
        Some(status) => status,
        None => match child.wait() {
            Ok(status) => status,
            Err(error) => return StepOutcome::SpawnFailed(error.to_string()),
        },
    };
    let elapsed = started.elapsed();
    if status.success() {
        return StepOutcome::Done(elapsed);
    }
    StepOutcome::Failed {
        code: exit_code(&status),
        elapsed,
        tail: tail.last(18),
    }
}

pub fn hint_for(tail: &[String]) -> Option<&'static str> {
    let text = tail.join("\n").to_lowercase();
    if text.contains("eaddrinuse") || text.contains("address already in use") {
        return Some(
            "Another process holds the port. Free it, or start on another one with `rig -p <port>`.",
        );
    }
    if text.contains("cannot find module")
        || text.contains("module_not_found")
        || text.contains("could not resolve")
    {
        return Some(
            "A dependency may be missing or out of date. Run `rig install` and try again.",
        );
    }
    if text.contains("command not found") || text.contains("not found: ") {
        return Some("The script runs a binary that is not installed. Run `rig install`.");
    }
    None
}

pub struct Serve<'a> {
    pub make_plan: Box<dyn Fn(Option<u16>) -> Plan + 'a>,
    pub base_port: Option<u16>,
}

struct Running {
    child: Child,
    plan: Plan,
    started: Instant,
    tail: Tail,
    printed: Vec<u16>,
    primary: Option<u16>,
    predicted: Option<u16>,
    last_scan: Instant,
    exited: Option<(ExitStatus, Instant)>,
}

fn pick_port(base: u16) -> Option<u16> {
    let mut port = base;
    for _ in 0..MAX_PORT_TRIES {
        if sys::port_is_free(port) {
            return Some(port);
        }
        let next = port.checked_add(1)?;
        match sys::owner_of(port) {
            Some(owner) => {
                let place = owner
                    .cwd
                    .as_ref()
                    .map(|dir| format!(" from {}", ui::home_relative(dir)))
                    .unwrap_or_default();
                ui::warning(&format!(
                    "port {port} is in use by {} (pid {}){place}, trying {next}",
                    owner.name, owner.pid
                ));
            }
            None => ui::warning(&format!("port {port} is in use, trying {next}")),
        }
        port = next;
    }
    None
}

fn launch(spec: &Serve, tx: &Sender<Event>, generation: u32) -> Option<Running> {
    let predicted = match spec.base_port {
        Some(base) => match pick_port(base) {
            Some(port) => Some(port),
            None => {
                ui::fatal(&format!("no free port found from {base} upwards"));
                return None;
            }
        },
        None => None,
    };
    let plan = (spec.make_plan)(predicted);
    if let Some(message) = missing_program(&plan) {
        ui::error_panel("cannot start", &[("reason", message)], &[], None);
        return None;
    }
    let on_port = predicted
        .map(|port| format!("  on port {port}"))
        .unwrap_or_default();
    ui::step(&format!("starting  {}{}", ui::dim(&plan.shown()), on_port));
    let mut child = match spawn(&plan, true) {
        Ok(child) => child,
        Err(error) => {
            ui::error_panel(
                "cannot start",
                &[("command", plan.shown()), ("reason", error.to_string())],
                &[],
                None,
            );
            return None;
        }
    };
    if let Some(out) = child.stdout.take() {
        let tx = tx.clone();
        pump(
            out,
            move |text, stderr| {
                tx.send(Event::Line {
                    generation,
                    text,
                    stderr,
                })
                .is_ok()
            },
            false,
        );
    }
    if let Some(err) = child.stderr.take() {
        let tx = tx.clone();
        pump(
            err,
            move |text, stderr| {
                tx.send(Event::Line {
                    generation,
                    text,
                    stderr,
                })
                .is_ok()
            },
            true,
        );
    }
    Some(Running {
        child,
        plan,
        started: Instant::now(),
        tail: Tail::new(60),
        printed: Vec::new(),
        primary: None,
        predicted,
        last_scan: Instant::now(),
        exited: None,
    })
}

fn scan(run: &mut Running) {
    run.last_scan = Instant::now();
    let tree = sys::descendants(run.child.id());
    let mut ports = sys::ports_of(&tree);
    ports.sort_by_key(|port| Some(*port) != run.predicted);
    for port in ports {
        if run.printed.contains(&port) {
            continue;
        }
        run.printed.push(port);
        let url = format!("http://localhost:{port}");
        if run.primary.is_none() {
            run.primary = Some(port);
            ui::success(&format!(
                "ready  {}  {}",
                ui::accent(&url),
                ui::dim(&format!(
                    "in {}",
                    ui::format_duration(run.started.elapsed())
                ))
            ));
            println!();
            ui::keys_hint();
            println!();
        } else {
            ui::note(&format!("also listening on {url}"));
        }
    }
}

fn open_url(url: &str) {
    match Command::new("xdg-open")
        .arg(url)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
    {
        Ok(mut child) => {
            thread::spawn(move || child.wait().ok());
            ui::note(&format!("opening {url}"));
        }
        Err(_) => ui::warning("xdg-open is not available"),
    }
}

fn report_exit(run: &Running, status: &ExitStatus) -> i32 {
    let code = exit_code(status);
    let uptime = ui::format_duration(run.started.elapsed());
    if code == 0 {
        ui::note(&format!("process exited cleanly after {uptime}"));
        return 0;
    }
    let tail = run.tail.last(18);
    let rows = [
        ("exit", format!("code {code}")),
        ("ran for", uptime),
        ("command", run.plan.shown()),
        ("folder", ui::home_relative(&run.plan.cwd)),
    ];
    ui::error_panel("the process crashed", &rows, &tail, hint_for(&tail));
    code
}

fn handle_key(byte: u8, run: &mut Option<Running>) -> KeyAction {
    match byte.to_ascii_lowercase() {
        b'q' => KeyAction::Quit,
        b'r' => KeyAction::Restart,
        b'o' => {
            if let Some(running) = run.as_ref() {
                match running.primary {
                    Some(port) => open_url(&format!("http://localhost:{port}")),
                    None => ui::warning("no listening port detected yet"),
                }
            }
            KeyAction::None
        }
        _ => KeyAction::None,
    }
}

enum KeyAction {
    Quit,
    Restart,
    None,
}

fn shut_down(run: Option<Running>) -> Option<Duration> {
    let mut run = run?;
    let uptime = run.started.elapsed();
    if run.exited.is_none() {
        sys::terminate(&mut run.child, true);
    }
    Some(uptime)
}

pub fn serve(spec: &Serve) -> i32 {
    let keys = Keys::enable();
    let interactive = keys.is_some();
    let (tx, rx) = mpsc::channel::<Event>();
    if interactive {
        let key_tx = tx.clone();
        term::read_keys(move |byte| key_tx.send(Event::Key(byte)).is_ok());
    }
    let mut generation = 0u32;
    let mut run = launch(spec, &tx, generation);
    if run.is_none() {
        return 1;
    }
    let mut last_code = 0;
    loop {
        if STOP.load(Ordering::SeqCst) {
            return finish(run, last_code, true);
        }
        let action = match rx.recv_timeout(Duration::from_millis(100)) {
            Ok(Event::Line {
                generation: from,
                text,
                stderr,
            }) => {
                if from == generation {
                    ui::gutter(&text, stderr);
                    if let Some(running) = run.as_mut() {
                        running.tail.push(&text);
                    }
                }
                KeyAction::None
            }
            Ok(Event::Key(byte)) => handle_key(byte, &mut run),
            Err(_) => KeyAction::None,
        };
        match action {
            KeyAction::Quit => return finish(run, last_code, false),
            KeyAction::Restart => {
                println!();
                ui::step("restarting");
                shut_down(run.take());
                generation += 1;
                run = launch(spec, &tx, generation);
                if run.is_none() && !interactive {
                    return 1;
                }
                continue;
            }
            KeyAction::None => {}
        }
        let Some(running) = run.as_mut() else {
            continue;
        };
        if running.exited.is_none() {
            if let Ok(Some(status)) = running.child.try_wait() {
                running.exited = Some((status, Instant::now()));
            } else if running.last_scan.elapsed() >= SCAN_EVERY {
                scan(running);
            }
        }
        let settled = running
            .exited
            .as_ref()
            .is_some_and(|(_, at)| at.elapsed() > EXIT_DRAIN);
        if settled {
            let status = running.exited.take().map(|(status, _)| status);
            if let Some(status) = status {
                last_code = report_exit(running, &status);
            }
            run = None;
            if !interactive {
                return last_code;
            }
            println!(
                "  {} restart  {}  {} quit",
                ui::accent("r"),
                ui::dim("·"),
                ui::accent("q")
            );
            println!();
        }
    }
}

fn finish(run: Option<Running>, last_code: i32, from_signal: bool) -> i32 {
    match shut_down(run) {
        Some(uptime) => ui::stopped(&format!(
            "stopped  {}",
            ui::dim(&format!("ran for {}", ui::format_duration(uptime)))
        )),
        None if from_signal => ui::stopped("stopped"),
        None => return last_code,
    }
    0
}
