pub mod applying;
pub mod cli;
pub mod commands;
pub mod dotfiles;
pub mod launchers;
pub mod media;
pub mod store;
pub mod notify;
pub mod system;
pub mod via;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            media::enable_capture(app);
            Ok(())
        })
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
            commands::scan_keyd_configs,
            commands::get_keyboard_conflicts,
            commands::import_keyd_config,
            commands::get_keyboard_ownership,
            commands::get_local_state,
            commands::get_session_user,
            commands::get_desktop_apps,
            commands::export_profiles,
            commands::import_bundle,
            commands::via_detect,
            commands::via_read_keymap,
            commands::via_set_keycode,
            commands::via_get_layout_options,
            commands::via_set_layout_options,
            commands::via_save_layout,
        ])
        .run(tauri::generate_context!())
        .expect("error while running keybind-manager");
}
