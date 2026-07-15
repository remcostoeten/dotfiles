#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if let Some(code) = keybind_manager_lib::cli::dispatch(&args) {
        std::process::exit(code);
    }
    keybind_manager_lib::run();
}
