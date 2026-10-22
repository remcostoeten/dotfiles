use crate::ui;
use std::path::PathBuf;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Command {
    Dev,
    Start,
    Install,
    Build,
    Info,
}

impl Command {
    fn parse(word: &str) -> Option<Command> {
        match word {
            "dev" | "r" => Some(Command::Dev),
            "start" | "rs" => Some(Command::Start),
            "install" | "i" => Some(Command::Install),
            "build" | "b" => Some(Command::Build),
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
            extra,
        },
    )))
}

fn heading(title: &str) {
    println!();
    println!("  {}", ui::accent_bold(title));
}

fn entry(left: &str, right: &str) {
    println!("    {:<26}{}", left, ui::dim(right));
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
    entry("info", "show what was detected without running anything");
    entry(
        "help [command]",
        "show help, also: rig <command> help | -h | --help",
    );
    options_block(&[
        ("-p, --port <n>", "start from this port (dev, start)"),
        ("--skip-build", "start without building first (start)"),
        COMMON_OPTIONS[0],
        COMMON_OPTIONS[1],
        COMMON_OPTIONS[2],
        ("-V, --version", "print the version"),
        COMMON_OPTIONS[3],
    ]);
    heading("KEYS WHILE RUNNING");
    entry("o", "open the app in the browser");
    entry("r", "restart the command");
    entry("q  or  ctrl+c", "stop and exit");
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
                COMMON_OPTIONS[0],
                COMMON_OPTIONS[1],
                COMMON_OPTIONS[2],
                COMMON_OPTIONS[3],
            ]);
            heading("KEYS");
            entry("o", "open in the browser");
            entry("r", "restart");
            entry("q  or  ctrl+c", "stop");
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
                COMMON_OPTIONS[0],
                COMMON_OPTIONS[1],
                COMMON_OPTIONS[2],
                COMMON_OPTIONS[3],
            ]);
            heading("KEYS");
            entry("o", "open in the browser");
            entry("r", "restart");
            entry("q  or  ctrl+c", "stop");
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
