pragma Singleton

import QtQuick
import Quickshell
import Quickshell.Io

Singleton {
    id: root

    property color accent: "#ff6b2c"
    property color text: "#e6e1d6"
    property color bar: "#1c1c1c"
    readonly property color glassTint: "#0a0a0c"
    readonly property real glassOpacity: 0.3
    readonly property real glassOpacityOpen: 0.5
    readonly property color glassSheen: Qt.rgba(1, 1, 1, 0.035)
    readonly property color glassSpecular: Qt.rgba(1, 1, 1, 0.5)
    readonly property color glassSpecularDim: Qt.rgba(1, 1, 1, 0.06)
    readonly property color textDim: Qt.rgba(text.r, text.g, text.b, 0.55)
    readonly property color dot: Qt.rgba(text.r, text.g, text.b, 0.6)
    readonly property color outline: Qt.rgba(0, 0, 0, 0.35)
    readonly property color track: Qt.rgba(1, 1, 1, 0.12)

    readonly property int band: 32
    readonly property int peekBand: 44
    readonly property int flare: 13
    readonly property int roundMax: 30
    readonly property int sideMargin: 16
    readonly property int notchPadding: 18
    readonly property int idleWidth: 140
    readonly property int panelWidth: 480
    readonly property int panelMaxContent: 380
    readonly property int windowHeight: 600

    readonly property int dotSize: 8
    readonly property int dotGap: 12
    readonly property int pillWidth: 20

    readonly property real spring: 4.2
    readonly property real damping: 0.3

    readonly property string fontUi: pickFont(["Geist", "Adwaita Sans"])
    readonly property string fontClock: pickFont(["Departure Mono", "Monocraft", "Silkscreen", "Geist Mono"])
    readonly property string fontGlyph: pickFont(["GeistMono Nerd Font", "CommitMono Nerd Font", "AdwaitaMono Nerd Font"])
    readonly property bool pixelClock: fontClock !== "Geist Mono"
    readonly property int clockSize: pixelClock ? 22 : 16
    readonly property int clockWeight: pixelClock ? Font.Normal : Font.DemiBold

    readonly property string glyphPlay: String.fromCodePoint(0xf040a)
    readonly property string glyphPause: String.fromCodePoint(0xf03e4)
    readonly property string glyphPrevious: String.fromCodePoint(0xf04ae)
    readonly property string glyphNext: String.fromCodePoint(0xf04ad)
    readonly property string glyphVolume: String.fromCodePoint(0xf057e)
    readonly property string glyphVolumeMedium: String.fromCodePoint(0xf0580)
    readonly property string glyphVolumeLow: String.fromCodePoint(0xf057f)
    readonly property string glyphMuted: String.fromCodePoint(0xf0581)
    readonly property string glyphUpdates: String.fromCodePoint(0xf0162)
    readonly property string glyphOffline: String.fromCodePoint(0xf0319)
    readonly property string glyphClose: String.fromCodePoint(0xf0156)

    function pickFont(candidates) {
        const installed = Qt.fontFamilies();
        return candidates.find(family => installed.includes(family)) ?? candidates[candidates.length - 1];
    }

    function applyPalette(json) {
        const palette = JSON.parse(json);
        root.accent = palette.accent ?? root.accent;
        root.text = palette.text ?? root.text;
        root.bar = palette.bar ?? root.bar;
    }

    FileView {
        path: Quickshell.env("HOME") + "/.cache/pocket/quickshell.json"
        watchChanges: true
        printErrors: false
        onFileChanged: reload()
        onLoaded: root.applyPalette(text())
    }
}
