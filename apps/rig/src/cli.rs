use crate::ui;
use std::path::PathBuf;
use std::time::Duration;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Command {
    Dev,
    Start,
    Install,
    Build,
    Stop,
    Info,
}

impl Command {
    fn parse(word: &str) -> Option<Command> {
        match word {
            "dev" | "r" => Some(Command::Dev),
            "start" | "rs" => Some(Command::Start),
            "install" | "i" => Some(Command::Install),
            "build" | "b" => Some(Command::Build),
            "stop" => Some(Command::Stop),
            "info" => Some(Command::Info),
            _ => None,
        }
    }
}

#[derive(Debug)]
pub struct Opts {
    pub cwd: PathBuf,
    pub workspace: Option<String>,
    pub port: Option<u16>,
    pub skip_build: bool,
    pub auto_restart: bool,
    pub tunnel: bool,
    pub tunnel_for: Option<Duration>,
    pub dry_run: bool,
    pub extra: Vec<String>,
}

pub enum Action {
    Run(Command, Opts),
    Help(Option<Command>),
    Version,
}

pub struct Parsed {
    pub action: Action,
    pub no_color: bool,
}

pub fn parse(args: Vec<String>) -> Result<Parsed, String> {
    let mut positionals: Vec<String> = Vec::new();
    let mut extra: Vec<String> = Vec::new();
    let mut cwd: Option<PathBuf> = None;
    let mut workspace = None;
    let mut port = None;
    let mut skip_build = false;
    let mut auto_restart = false;
    let mut tunnel = false;
    let mut tunnel_for = Some(Duration::from_secs(3600));
    let mut dry_run = false;
    let mut no_color = false;
    let mut help = false;
    let mut version = false;
    let mut iter = args.into_iter();
    while let Some(arg) = iter.next() {
        let (flag, inline) = match arg.split_once('=') {
            Some((flag, value)) if arg.starts_with("--") => {
                (flag.to_string(), Some(value.to_string()))
            }
            _ => (arg.clone(), None),
        };
        let mut value_of = |name: &str| -> Result<String, String> {
            inline
                .clone()
                .or_else(|| iter.next())
                .ok_or_else(|| format!("`{name}` needs a value"))
        };
        match flag.as_str() {
            "--" => {
                extra.extend(iter.by_ref());
                break;
            }
            "-h" | "--help" => help = true,
            "-V" | "--version" => version = true,
            "--no-color" => no_color = true,
            "--skip-build" => skip_build = true,
            "--auto-restart" => auto_restart = true,
            "--tunnel" => tunnel = true,
            "--tunnel-for" => tunnel_for = parse_duration(&value_of("--tunnel-for")?)?,
            "-n" | "--dry-run" => dry_run = true,
            "-C" | "--cwd" => cwd = Some(PathBuf::from(value_of("--cwd")?)),
            "-w" | "--workspace" => workspace = Some(value_of("--workspace")?),
            "-p" | "--port" => {
                let raw = value_of("--port")?;
                port = Some(
                    raw.parse::<u16>()
                        .map_err(|_| format!("`{raw}` is not a valid port"))?,
                );
            }
            other if other.starts_with('-') && other.len() > 1 => {
                return Err(format!("unknown option `{other}`"));
            }
            _ => positionals.push(arg),
        }
    }
    let finish = |action: Action| Parsed { action, no_color };
    if version {
        return Ok(finish(Action::Version));
    }
    let mut words = positionals.into_iter();
    let first = words.next();
    if first.as_deref() == Some("help") {
        let topic = match words.next() {
            Some(word) => {
                Some(Command::parse(&word).ok_or_else(|| format!("no help topic `{word}`"))?)
            }
            None => None,
        };
        return Ok(finish(Action::Help(topic)));
    }
    let command = match &first {
        Some(word) => Command::parse(word).ok_or_else(|| format!("unknown command `{word}`"))?,
        None => Command::Dev,
    };
    let asks_help = help || words.next().as_deref() == Some("help");
    if asks_help {
        return Ok(finish(Action::Help(first.map(|_| command))));
    }
    if let Some(stray) = words.next() {
        return Err(format!("unexpected argument `{stray}`"));
    }
    let cwd = match cwd {
        Some(dir) => dir,
        None => std::env::current_dir()
            .map_err(|error| format!("cannot read the current folder: {error}"))?,
    };
    Ok(finish(Action::Run(
        command,
        Opts {
            cwd,
            workspace,
            port,
            skip_build,
            auto_restart,
            tunnel,
            tunnel_for,
            dry_run,
            extra,
        },
    )))
}

fn parse_duration(raw: &str) -> Result<Option<Duration>, String> {
    let bad = || format!("`{raw}` is not a duration, use 30s, 45m, 2h or 0 for no limit");
    let digits = raw.trim_end_matches(['s', 'm', 'h']);
    let amount: u64 = digits.parse().map_err(|_| bad())?;
    let seconds = match &raw[digits.len()..] {
        "s" => amount,
        "m" | "" => amount * 60,
        "h" => amount * 3600,
        _ => return Err(bad()),
    };
    Ok((seconds > 0).then(|| Duration::from_secs(seconds)))
}

fn heading(title: &str) {
    println!();
    println!("  {}", ui::accent_bold(title));
}

fn entry(left: &str, right: &str) {
    println!("    {:<26}{}", left, ui::dim(right));
}

fn key_entry(keys: &[&str], right: &str) {
    let chips: Vec<String> = keys.iter().map(|key| ui::kbd(key)).collect();
    let visible: usize =
        keys.iter().map(|key| ui::kbd_width(key)).sum::<usize>() + 6 * (keys.len() - 1);
    let pad = " ".repeat(26usize.saturating_sub(visible));
    println!("    {}{}{}", chips.join("  or  "), pad, ui::dim(right));
}

fn usage(text: &str) {
    println!("    {}", text);
}

fn options_block(lines: &[(&str, &str)]) {
    heading("OPTIONS");
    for (left, right) in lines {
        entry(left, right);
    }
}

const COMMON_OPTIONS: &[(&str, &str)] = &[
    ("-C, --cwd <dir>", "run against another folder"),
    (
        "-w, --workspace <name>",
        "pick a package in a monorepo by name, folder or path",
    ),
    ("--no-color", "plain output, also set by NO_COLOR"),
    ("-h, --help", "show this help"),
];

pub fn print_overview() {
    ui::banner("help");
    println!("  Runs a JavaScript project the way its folder says it should be run.");
    println!(
        "  {}",
        ui::dim(
            "Picks bun or pnpm from the lockfile, installs first when node_modules is missing."
        )
    );
    heading("USAGE");
    usage("rig [command] [options] [-- args for the script]");
    heading("COMMANDS");
    entry("dev  (r)", "start the dev server, this is the default");
    entry(
        "start  (rs)",
        "install if needed, build, then run the production server",
    );
    entry(
        "install  (i)",
        "install dependencies with the detected package manager",
    );
    entry(
        "build  (b)",
        "install if needed, then run the production build",
    );
    entry(
        "stop",
        "stop the servers running from this project, frees their ports",
    );
    entry("info", "show what was detected without running anything");
    entry(
        "help [command]",
        "show help, also: rig <command> help | -h | --help",
    );
    options_block(&[
        ("-p, --port <n>", "start from this port (dev, start)"),
        ("--skip-build", "start without building first (start)"),
        (
            "--auto-restart",
            "restart after a crash, up to 5 times (dev, start)",
        ),
        (
            "--tunnel",
            "share the app through a Cloudflare tunnel once it is ready",
        ),
        (
            "--tunnel-for <time>",
            "tunnel time limit: 30s, 45m, 2h, 0 for none (default 60m)",
        ),
        ("-n, --dry-run", "show what would stop (stop)"),
        COMMON_OPTIONS[0],
        COMMON_OPTIONS[1],
        COMMON_OPTIONS[2],
        ("-V, --version", "print the version"),
        COMMON_OPTIONS[3],
    ]);
    heading("KEYS WHILE RUNNING");
    key_entry(&["o"], "open the app in the browser");
    key_entry(&["."], "open the folder in the file manager");
    key_entry(&["t"], "menu, then pick with the next key:");
    key_entry(
        &["1", "e"],
        "  terminal in the folder ($TERMINAL, then common ones)",
    );
    key_entry(
        &["2", "u"],
        "  public Cloudflare tunnel, press again to stop it",
    );
    key_entry(&["+"], "add 30 minutes to the tunnel");
    key_entry(&["c"], "copy the URL to the clipboard");
    key_entry(&["h"], "show these keys again, also ? and enter");
    key_entry(&["r"], "restart the command");
    key_entry(&["k"], "stop whatever holds the wanted port and run on it");
    key_entry(&["q", "ctrl+c"], "stop and exit");
    heading("FISH ALIASES");
    entry("r", "rig dev");
    entry("rs", "rig start");
    entry("i", "rig install");
    entry("b", "rig build");
    heading("EXAMPLES");
    usage("rig                        dev server of the project you are in");
    usage("rig start -p 4000          production server, starting at port 4000");
    usage("rig dev -w web             dev server of the package named web");
    usage("rig install -- --frozen-lockfile");
    println!();
}

pub fn print_command(command: Command) {
    match command {
        Command::Dev => {
            ui::banner("help dev");
            println!("  Starts the dev server. Installs first when node_modules is missing.");
            heading("USAGE");
            usage("rig dev [options] [-- args for the script]");
            usage("rig r");
            heading("DETECTION");
            entry("script", "dev, develop, start:dev, then the framework CLI");
            entry(
                "port",
                "--port, the script, PORT, then the framework default",
            );
            entry(
                "busy port",
                "reports who holds it, then tries the next port",
            );
            options_block(&[
                ("-p, --port <n>", "start from this port"),
                ("--auto-restart", "restart after a crash, up to 5 times"),
                ("--tunnel", "share the app through a Cloudflare tunnel"),
                (
                    "--tunnel-for <time>",
                    "tunnel time limit, default 60m, 0 for none",
                ),
                COMMON_OPTIONS[0],
                COMMON_OPTIONS[1],
                COMMON_OPTIONS[2],
                COMMON_OPTIONS[3],
            ]);
            heading("KEYS");
            key_entry(&["o"], "open in the browser");
            key_entry(&["."], "open the folder in the file manager");
            key_entry(&["t"], "menu: 1 or e for a terminal, 2 or u for a tunnel");
            key_entry(&["+"], "add 30 minutes to the tunnel");
            key_entry(&["c"], "copy the URL");
            key_entry(&["h"], "show the keys again, also ? and enter");
            key_entry(&["r"], "restart");
            key_entry(&["k"], "stop whatever holds the wanted port, run on it");
            key_entry(&["q", "ctrl+c"], "stop");
        }
        Command::Start => {
            ui::banner("help start");
            println!("  Runs the production build: install if needed, build, then start.");
            heading("USAGE");
            usage("rig start [options] [-- args for the script]");
            usage("rig rs");
            heading("DETECTION");
            entry(
                "script",
                "start for Next.js, preview for Vite, Astro, Nuxt, SvelteKit",
            );
            entry("build", "build, build:prod, then the framework CLI");
            options_block(&[
                ("-p, --port <n>", "start from this port"),
                ("--skip-build", "reuse the existing build"),
                ("--auto-restart", "restart after a crash, up to 5 times"),
                ("--tunnel", "share the app through a Cloudflare tunnel"),
                (
                    "--tunnel-for <time>",
                    "tunnel time limit, default 60m, 0 for none",
                ),
                COMMON_OPTIONS[0],
                COMMON_OPTIONS[1],
                COMMON_OPTIONS[2],
                COMMON_OPTIONS[3],
            ]);
            heading("KEYS");
            key_entry(&["o"], "open in the browser");
            key_entry(&["."], "open the folder in the file manager");
            key_entry(&["t"], "menu: 1 or e for a terminal, 2 or u for a tunnel");
            key_entry(&["+"], "add 30 minutes to the tunnel");
            key_entry(&["c"], "copy the URL");
            key_entry(&["h"], "show the keys again, also ? and enter");
            key_entry(&["r"], "restart");
            key_entry(&["k"], "stop whatever holds the wanted port, run on it");
            key_entry(&["q", "ctrl+c"], "stop");
        }
        Command::Install => {
            ui::banner("help install");
            println!("  Installs dependencies at the root of the project or monorepo.");
            heading("USAGE");
            usage("rig install [options] [-- args for the installer]");
            usage("rig i");
            heading("DETECTION");
            entry(
                "manager",
                "pnpm-lock.yaml gives pnpm, otherwise bun; yarn and npm only by lockfile",
            );
            options_block(&[COMMON_OPTIONS[0], COMMON_OPTIONS[2], COMMON_OPTIONS[3]]);
        }
        Command::Build => {
            ui::banner("help build");
            println!("  Runs the production build. Installs first when node_modules is missing.");
            heading("USAGE");
            usage("rig build [options]");
            usage("rig b");
            options_block(&[
                COMMON_OPTIONS[0],
                COMMON_OPTIONS[1],
                COMMON_OPTIONS[2],
                COMMON_OPTIONS[3],
            ]);
        }
        Command::Stop => {
            ui::banner("help stop");
            println!("  Stops servers that listen on a port and run from this project's folder.");
            heading("USAGE");
            usage("rig stop [options]");
            heading("DETECTION");
            entry(
                "scope",
                "the monorepo root, or the package folder, or -w <name>",
            );
            entry(
                "match",
                "processes with a listening port whose folder is inside the scope",
            );
            entry(
                "safe",
                "never touches rig itself, your shell or your terminal",
            );
            options_block(&[
                ("-n, --dry-run", "show what would stop"),
                COMMON_OPTIONS[0],
                COMMON_OPTIONS[1],
                COMMON_OPTIONS[2],
                COMMON_OPTIONS[3],
            ]);
        }
        Command::Info => {
            ui::banner("help info");
            println!(
                "  Shows the package manager, framework, scripts and workspace packages found."
            );
            heading("USAGE");
            usage("rig info [options]");
            options_block(&[
                COMMON_OPTIONS[0],
                COMMON_OPTIONS[1],
                COMMON_OPTIONS[2],
                COMMON_OPTIONS[3],
            ]);
        }
    }
    println!();
}
