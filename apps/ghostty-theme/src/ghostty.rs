use std::fs;
use std::path::PathBuf;
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use rustix::process::{Pid, Signal, kill_process};

use crate::app::Event;
use crate::config::write_atomic;

pub fn reload() {
    let Ok(entries) = fs::read_dir("/proc") else {
        return;
    };
    for entry in entries.flatten() {
        let Some(pid) = entry
            .file_name()
            .to_str()
            .and_then(|name| name.parse::<i32>().ok())
            .and_then(Pid::from_raw)
        else {
            continue;
        };
        if fs::read(entry.path().join("comm")).is_ok_and(|comm| comm == b"ghostty\n") {
            let _ = kill_process(pid, Signal::USR2);
        }
    }
}

enum Job {
    Preview(String),
    Flush(String),
    Finish(String),
}

const THROTTLE: Duration = Duration::from_millis(90);

pub struct Applier {
    tx: Sender<Job>,
    handle: Option<JoinHandle<()>>,
}

impl Applier {
    pub fn spawn(path: PathBuf, on_disk: String, events: Sender<Event>) -> Self {
        let (tx, rx) = mpsc::channel::<Job>();
        let handle = thread::spawn(move || {
            let mut written = on_disk;
            let mut pending: Option<String> = None;
            let mut last = Instant::now() - THROTTLE;
            let mut apply = |content: String, last: &mut Instant| {
                if content == written {
                    return;
                }
                match write_atomic(&path, content.as_bytes()) {
                    Ok(()) => {
                        written = content;
                        reload();
                        *last = Instant::now();
                    }
                    Err(err) => {
                        let _ = events.send(Event::ApplyFailed(err.to_string()));
                    }
                }
            };
            loop {
                let job = if pending.is_some() {
                    match rx
                        .recv_timeout((last + THROTTLE).saturating_duration_since(Instant::now()))
                    {
                        Ok(job) => Some(job),
                        Err(RecvTimeoutError::Timeout) => None,
                        Err(RecvTimeoutError::Disconnected) => break,
                    }
                } else {
                    match rx.recv() {
                        Ok(job) => Some(job),
                        Err(_) => break,
                    }
                };
                match job {
                    Some(Job::Preview(content)) => pending = Some(content),
                    Some(Job::Flush(content)) => {
                        pending = None;
                        apply(content, &mut last);
                        continue;
                    }
                    Some(Job::Finish(content)) => {
                        apply(content, &mut last);
                        break;
                    }
                    None => {}
                }
                if last.elapsed() >= THROTTLE
                    && let Some(content) = pending.take()
                {
                    apply(content, &mut last);
                }
            }
        });
        Self {
            tx,
            handle: Some(handle),
        }
    }

    pub fn preview(&self, content: String) {
        let _ = self.tx.send(Job::Preview(content));
    }

    pub fn flush(&self, content: String) {
        let _ = self.tx.send(Job::Flush(content));
    }

    pub fn finish(&mut self, content: String) {
        let _ = self.tx.send(Job::Finish(content));
        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }
    }
}
