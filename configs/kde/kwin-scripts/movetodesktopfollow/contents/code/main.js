// On a US layout KWin stores Shift+digit shortcuts as the shifted symbol, like the stock Meta+! bindings
const shiftedDigits = ["!", "@", "#", "$", "%", "^", "&", "*", "("];

function moveActiveWindowToDesktop(index) {
    const desktops = workspace.desktops;
    if (index >= desktops.length) {
        return;
    }
    const target = desktops[index];
    const window = workspace.activeWindow;
    if (window && !window.onAllDesktops) {
        window.desktops = [target];
    }
    workspace.currentDesktop = target;
}

shiftedDigits.forEach((symbol, index) => {
    const number = index + 1;
    registerShortcut(
        "Move Window to Desktop " + number + " and Follow",
        "Move Window to Desktop " + number + " and Follow",
        "Alt+" + symbol,
        () => moveActiveWindowToDesktop(index),
    );
});
