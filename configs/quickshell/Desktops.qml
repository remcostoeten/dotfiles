pragma Singleton

import QtQuick
import Quickshell
import Quickshell.Io

Singleton {
    id: root

    readonly property var manager: ["org.kde.KWin", "/VirtualDesktopManager", "org.kde.KWin.VirtualDesktopManager"]
    property var ids: []
    property string current: ""
    readonly property int currentIndex: ids.indexOf(current)
    property bool stale: false

    function activate(id) {
        if (id === current)
            return;
        current = id;
        Quickshell.execDetached(["busctl", "--user", "set-property", ...manager, "current", "s", id]);
    }

    function step(delta) {
        const target = currentIndex + delta;
        if (target >= 0 && target < ids.length)
            activate(ids[target]);
    }

    function refresh() {
        if (query.running) {
            stale = true;
            return;
        }
        query.running = true;
    }

    function applyState(output) {
        const lines = output.trim().split("\n");
        if (lines.length < 2)
            return;
        const [desktops, active] = lines.map(line => JSON.parse(line).data);
        ids = desktops.slice().sort((left, right) => left[0] - right[0]).map(desktop => desktop[1]);
        current = active;
    }

    Process {
        id: query
        command: ["busctl", "--user", "-j", "get-property", ...root.manager, "desktops", "current"]
        running: true
        stdout: StdioCollector {
            onStreamFinished: root.applyState(text)
        }
        onExited: {
            if (!root.stale)
                return;
            root.stale = false;
            Qt.callLater(root.refresh);
        }
    }

    Process {
        id: monitor
        command: ["gdbus", "monitor", "--session", "--dest", "org.kde.KWin", "--object-path", "/VirtualDesktopManager"]
        running: true
        stdout: SplitParser {
            onRead: debounce.restart()
        }
        onExited: reconnect.start()
    }

    Timer {
        id: debounce
        interval: 30
        onTriggered: root.refresh()
    }

    Timer {
        id: reconnect
        interval: 2000
        onTriggered: {
            monitor.running = true;
            root.refresh();
        }
    }
}
