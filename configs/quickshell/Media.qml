pragma Singleton

import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Services.Mpris

Singleton {
    id: root

    readonly property var players: Mpris.players.values
    readonly property MprisPlayer player: players.find(candidate => candidate.isPlaying) ?? players[0] ?? null
    readonly property bool playing: player?.isPlaying ?? false
    readonly property bool active: (player?.trackTitle ?? "") !== ""
    readonly property string trackLine: [player?.trackTitle ?? "", player?.trackArtist ?? ""].filter(part => part !== "").join("  ·  ")
    readonly property string artUrl: player?.trackArtUrl ?? ""
    readonly property bool hasLength: (player?.lengthSupported ?? false) && player.length > 0
    readonly property real progress: hasLength ? Math.min(1, player.position / player.length) : 0
    readonly property var silence: [0, 0, 0, 0, 0, 0, 0, 0]
    property var levels: silence

    function formatTime(seconds) {
        const whole = Math.max(0, Math.floor(seconds));
        return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
    }

    function parseLevels(line) {
        const values = line.split(";").filter(value => value !== "").map(value => Number(value) / 100);
        return values.length === silence.length ? values : levels;
    }

    Process {
        running: root.playing
        command: [Quickshell.shellPath("cava-follow")]
        stdout: SplitParser {
            onRead: line => root.levels = root.parseLevels(line)
        }
        onRunningChanged: {
            if (!running)
                root.levels = root.silence;
        }
    }

    Timer {
        interval: 1000
        repeat: true
        running: root.playing && NotchState.open
        onTriggered: root.player.positionChanged()
    }
}
