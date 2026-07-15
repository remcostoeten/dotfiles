pub mod applying;
pub mod cli;
pub mod commands;
pub mod dotfiles;
pub mod store;
pub mod system;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_capabilities,
            commands::get_backend_status,
            commands::get_devices,
            commands::get_install_guidance,
            commands::get_config,
            commands::put_config,
            commands::check_config,
            commands::preview_config,
            commands::apply_config,
            commands::helper_action,
            commands::get_local_state,
            commands::export_profiles,
            commands::import_bundle,
        ])
        .run(tauri::generate_context!())
        .expect("error while running keybind-manager");
}
