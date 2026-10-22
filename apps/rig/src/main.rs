mod cli;
mod commands;
mod project;
mod run;
mod sys;
mod term;
mod tunnel;
mod ui;

use cli::{Action, Command};
use std::sync::atomic::Ordering;

fn main() {
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        if info.to_string().contains("Broken pipe") {
            std::process::exit(0);
        }
        default_hook(info);
    }));
    std::process::exit(real_main());
}

fn real_main() -> i32 {
    let parsed = match cli::parse(std::env::args().skip(1).collect()) {
        Ok(parsed) => parsed,
        Err(message) => {
            ui::init(false);
            ui::fatal(&format!("{message}. Run `rig help` for usage."));
            return 2;
        }
    };
    ui::init(parsed.no_color);
    match parsed.action {
        Action::Version => {
            println!("rig {}", env!("CARGO_PKG_VERSION"));
            0
        }
        Action::Help(None) => {
            cli::print_overview();
            0
        }
        Action::Help(Some(command)) => {
            cli::print_command(command);
            0
        }
        Action::Run(command, opts) => {
            ctrlc::set_handler(|| run::STOP.store(true, Ordering::SeqCst)).ok();
            match command {
                Command::Dev => commands::dev(&opts),
                Command::Start => commands::start(&opts),
                Command::Install => commands::install(&opts),
                Command::Build => commands::build(&opts),
                Command::Stop => commands::stop(&opts),
                Command::Info => commands::info(&opts),
            }
        }
    }
}
