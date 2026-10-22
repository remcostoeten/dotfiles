const apps = [{ name: "Brave", shortcut: "Alt+B", resourceClass: "brave-browser", desktopFile: "brave-browser" }];

function findWindows(resourceClass) {
    return workspace.stackingOrder.filter(
        (window) => window.normalWindow && window.resourceClass === resourceClass,
    );
}

function launch(desktopFile) {
    callDBus(
        "org.freedesktop.systemd1",
        "/org/freedesktop/systemd1",
        "org.freedesktop.systemd1.Manager",
        "StartUnit",
        "runorraise-launch@" + desktopFile + ".service",
        "replace",
    );
}

function runOrRaise(app) {
    const windows = findWindows(app.resourceClass);
    if (windows.length === 0) {
        launch(app.desktopFile);
        return;
    }
    const active = workspace.activeWindow;
    const isFocused = active !== null && active.resourceClass === app.resourceClass;
    const target = isFocused ? windows[0] : windows[windows.length - 1];
    target.minimized = false;
    workspace.activeWindow = target;
}

apps.forEach((app) => {
    registerShortcut("Run or Raise " + app.name, "Run or Raise " + app.name, app.shortcut, () => runOrRaise(app));
});
