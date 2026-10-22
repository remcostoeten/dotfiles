use notify_rust::{Hint, Notification, Timeout, Urgency};

use crate::applying::ApplyResult;
use keybind_core::StructuredError;

const APP_NAME: &str = "Keybind Manager";
const ICON: &str = "keybind-manager";
const DESKTOP_ENTRY: &str = "keybind-manager";

/// Sends a desktop notification over the freedesktop D-Bus spec without blocking the caller.
/// Works with any compliant daemon (swaync, mako, dunst, Plasma); silently no-ops when none is running.
pub fn send(summary: impl Into<String>, body: impl Into<String>, urgency: Urgency) {
    let summary = summary.into();
    let body = body.into();
    std::thread::spawn(move || {
        let result = Notification::new()
            .appname(APP_NAME)
            .summary(&summary)
            .body(&body)
            .icon(ICON)
            .hint(Hint::DesktopEntry(DESKTOP_ENTRY.into()))
            .hint(Hint::Urgency(urgency))
            .timeout(match urgency {
                Urgency::Critical => Timeout::Never,
                _ => Timeout::Milliseconds(5000),
            })
            .show();
        if let Err(e) = result {
            eprintln!("notification not delivered: {e}");
        }
    });
}

pub fn apply_outcome(outcome: &Result<ApplyResult, StructuredError>) {
    match outcome {
        Ok(r) if r.applied => send("Keybindings applied", &r.message, Urgency::Low),
        Ok(r) => send("Apply rolled back", &r.message, Urgency::Normal),
        Err(e) if e.code == "AUTH_DENIED" => {}
        Err(e) => send("Apply failed", e.message.clone(), Urgency::Critical),
    }
}

pub fn helper_outcome(action: &str, outcome: &Result<String, StructuredError>) {
    let label = match action {
        "restore" => "Previous configuration restored",
        "reload" => "keyd reloaded",
        "enable-service" => "keyd service enabled",
        "disable-service" => "keyd service disabled",
        _ => return,
    };
    match outcome {
        Ok(message) => send(label, message.clone(), Urgency::Low),
        Err(e) if e.code == "AUTH_DENIED" => {}
        Err(e) => send(format!("Failed: {action}"), e.message.clone(), Urgency::Critical),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore = "needs a running notification daemon"]
    fn delivers_to_running_daemon() {
        let handle = Notification::new()
            .appname(APP_NAME)
            .summary("Keybind Manager test")
            .body("If you see this, notifications work.")
            .icon(ICON)
            .hint(Hint::DesktopEntry(DESKTOP_ENTRY.into()))
            .show()
            .expect("daemon reachable");
        assert!(handle.id() > 0);
    }
}
