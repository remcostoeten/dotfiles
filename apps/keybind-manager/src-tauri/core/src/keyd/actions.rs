const SPECIAL_TOKENS: [(char, &str); 5] = [
    (' ', "space"),
    ('\n', "enter"),
    ('\t', "tab"),
    ('(', "S-9"),
    (')', "S-0"),
];

const RUN_PREFIX: &str = "systemd-run --user --collect --quiet -M ";
const LAUNCH_PREFIX: &str = "gio launch ";

/// Encodes literal text as a keyd `macro()` body typing one character per token,
/// so spaces, newlines and parentheses survive keyd's tokenizer.
pub fn encode_text(text: &str) -> String {
    text.chars()
        .map(|c| match SPECIAL_TOKENS.iter().find(|(ch, _)| *ch == c) {
            Some((_, token)) => token.to_string(),
            None => c.to_string(),
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Inverse of [`encode_text`]; `None` when the macro body is not a plain typed string.
pub fn decode_text(body: &str) -> Option<String> {
    let tokens: Vec<&str> = body.split(' ').collect();
    if tokens.len() < 2 {
        return None;
    }
    tokens
        .iter()
        .map(|token| {
            if let Some((c, _)) = SPECIAL_TOKENS.iter().find(|(_, t)| t == token) {
                return Some(*c);
            }
            let mut chars = token.chars();
            match (chars.next(), chars.next()) {
                (Some(c), None) => Some(c),
                _ => None,
            }
        })
        .collect()
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', r"'\''"))
}

fn shell_unquote(value: &str) -> Option<String> {
    let inner = value.strip_prefix('\'')?.strip_suffix('\'')?;
    Some(inner.replace(r"'\''", "'"))
}

/// Wraps a shell command so keyd (running as root) executes it inside the given
/// user's systemd session, inheriting their display and D-Bus environment.
pub fn wrap_command(command: &str, run_as: Option<&str>) -> String {
    match run_as {
        Some(user) => format!("{RUN_PREFIX}{user}@ -- sh -c {}", shell_quote(command)),
        None => command.to_string(),
    }
}

pub fn wrap_launch(desktop_file: &str, run_as: Option<&str>) -> String {
    let launch = format!("{LAUNCH_PREFIX}{}", shell_quote(desktop_file));
    match run_as {
        Some(user) => format!("{RUN_PREFIX}{user}@ -- {launch}"),
        None => launch,
    }
}

pub enum Unwrapped {
    Command {
        command: String,
        run_as: Option<String>,
    },
    Launch {
        app: String,
        run_as: Option<String>,
    },
}

/// Inverse of [`wrap_command`] / [`wrap_launch`] for a keyd `command()` body.
pub fn unwrap_command(body: &str) -> Unwrapped {
    let (run_as, rest) = match body
        .strip_prefix(RUN_PREFIX)
        .and_then(|r| r.split_once("@ -- "))
    {
        Some((user, rest)) => (Some(user.to_string()), rest),
        None => (None, body),
    };
    if let Some(app) = rest.strip_prefix(LAUNCH_PREFIX).and_then(shell_unquote) {
        return Unwrapped::Launch { app, run_as };
    }
    if run_as.is_some() {
        if let Some(command) = rest.strip_prefix("sh -c ").and_then(shell_unquote) {
            return Unwrapped::Command { command, run_as };
        }
    }
    Unwrapped::Command {
        command: body.to_string(),
        run_as: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_round_trips() {
        let text = "Hi (there), it's me\nbye";
        assert_eq!(decode_text(&encode_text(text)).as_deref(), Some(text));
    }

    #[test]
    fn command_round_trips() {
        let wrapped = wrap_command("notify-send 'a b' && echo $(date)", Some("remco"));
        match unwrap_command(&wrapped) {
            Unwrapped::Command { command, run_as } => {
                assert_eq!(command, "notify-send 'a b' && echo $(date)");
                assert_eq!(run_as.as_deref(), Some("remco"));
            }
            Unwrapped::Launch { .. } => panic!("expected command"),
        }
    }

    #[test]
    fn launch_round_trips() {
        let wrapped = wrap_launch("/usr/share/applications/firefox.desktop", Some("remco"));
        assert!(matches!(
            unwrap_command(&wrapped),
            Unwrapped::Launch { app, .. } if app == "/usr/share/applications/firefox.desktop"
        ));
    }
}
