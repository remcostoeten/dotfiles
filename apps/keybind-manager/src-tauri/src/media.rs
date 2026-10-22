use tauri::{App, Manager};

/// Lets the main webview open microphones and cameras for the Media tester.
/// WebKitGTK ships with capture disabled and rejects every `getUserMedia` request no host handles.
#[cfg(target_os = "linux")]
pub fn enable_capture(app: &App) {
    use webkit2gtk::glib::prelude::ObjectExt;
    use webkit2gtk::{
        DeviceInfoPermissionRequest, PermissionRequestExt, SettingsExt, UserMediaPermissionRequest,
        WebViewExt,
    };

    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let result = window.with_webview(|webview| {
        let view = webview.inner();
        if let Some(settings) = WebViewExt::settings(&view) {
            settings.set_enable_media_stream(true);
        }
        view.connect_permission_request(|_, request| {
            if request.is::<UserMediaPermissionRequest>() || request.is::<DeviceInfoPermissionRequest>() {
                request.allow();
                return true;
            }
            false
        });
    });
    if let Err(e) = result {
        eprintln!("media capture not enabled: {e}");
    }
}

#[cfg(not(target_os = "linux"))]
pub fn enable_capture(_app: &App) {}
