pragma Singleton

import QtQuick
import Quickshell
import Quickshell.Io

Singleton {
    id: root

    readonly property var tabs: ["playing", "output", "apps", "input"]
    property bool open: false
    property bool peeking: false
    property string tab: "playing"
    property int cursor: 0
    property var pickingStream: null
    property var pickingSubject: null
    property bool addingException: false
    property int pickCursor: 0
    readonly property bool picking: pickingStream !== null || pickingSubject !== null || addingException
    readonly property string mode: open ? "open" : Media.active ? "media" : peeking ? "peek" : "idle"

    onTabChanged: {
        root.cursor = 0;
        root.closePicker();
    }

    onOpenChanged: {
        if (!root.open)
            root.closePicker();
    }

    function show(name) {
        if (tabs.includes(name))
            root.tab = name;
        root.open = true;
    }

    function closePicker() {
        root.pickingStream = null;
        root.pickingSubject = null;
        root.addingException = false;
    }

    function openPicker(stream) {
        root.closePicker();
        root.pickCursor = Math.max(0, Machine.sinks.indexOf(Machine.outputOf(stream)));
        root.pickingStream = stream;
    }

    function openAppPicker() {
        root.closePicker();
        root.pickCursor = 0;
        root.addingException = true;
    }

    function openExceptionPicker(subject) {
        const output = Machine.exceptionFor(subject)?.output;
        root.closePicker();
        root.pickCursor = Math.max(0, Machine.outputsFor(subject).findIndex(node => node.name === output));
        root.pickingSubject = subject;
    }

    function stepTab(delta) {
        const index = (tabs.indexOf(root.tab) + delta + tabs.length) % tabs.length;
        root.tab = tabs[index];
    }

    IpcHandler {
        target: "notch"

        function toggle(): void {
            root.open = !root.open;
        }

        function close(): void {
            root.open = false;
        }

        function tab(name: string): void {
            root.show(name);
        }
    }
}
