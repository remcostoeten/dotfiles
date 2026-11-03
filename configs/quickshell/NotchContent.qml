import QtQuick
import Quickshell

Item {
    id: root

    readonly property string mode: NotchState.mode
    readonly property bool expanded: mode === "open"
    readonly property bool showDate: mode === "peek" || expanded
    readonly property bool showMedia: Media.active && !expanded
    readonly property real headerBand: showDate ? Theme.peekBand : Theme.band
    readonly property real targetWidth: expanded ? Theme.panelWidth : Math.max(Theme.idleWidth, header.implicitWidth + 2 * Theme.notchPadding)
    readonly property real targetHeight: expanded ? panel.y + panel.implicitHeight + Theme.notchPadding : headerBand

    clip: true
    focus: true
    Keys.onPressed: event => {
        if (root.expanded && panel.handleKey(event))
            event.accepted = true;
    }

    SystemClock {
        id: clock
        precision: SystemClock.Seconds
    }

    MouseArea {
        anchors.fill: parent
        acceptedButtons: Qt.LeftButton | Qt.RightButton
        cursorShape: Qt.PointingHandCursor
        onClicked: mouse => {
            if (mouse.button === Qt.RightButton) {
                Media.player?.togglePlaying();
                return;
            }
            NotchState.open = !NotchState.open;
        }
        onWheel: wheel => {
            if (wheel.angleDelta.x !== 0) {
                Desktops.step(wheel.angleDelta.x < 0 ? 1 : -1);
                return;
            }
            Machine.nudgeVolume(wheel.angleDelta.y > 0 ? 0.05 : -0.05);
        }
    }

    HoverHandler {
        onHoveredChanged: {
            if (hovered) {
                closeTimer.stop();
                peekTimer.restart();
                return;
            }
            peekTimer.stop();
            NotchState.peeking = false;
            if (NotchState.open)
                closeTimer.restart();
        }
    }

    Timer {
        id: peekTimer
        interval: 240
        onTriggered: NotchState.peeking = true
    }

    Timer {
        id: closeTimer
        interval: 450
        onTriggered: NotchState.open = false
    }

    Row {
        id: header
        anchors.horizontalCenter: parent.horizontalCenter
        y: (root.headerBand - height) / 2
        spacing: 12

        Text {
            anchors.verticalCenter: parent.verticalCenter
            text: Qt.formatDateTime(clock.date, "HH:mm:ss")
            color: Theme.text
            font.family: Theme.fontClock
            font.pixelSize: Theme.clockSize
            font.weight: Theme.clockWeight
        }

        Column {
            anchors.verticalCenter: parent.verticalCenter
            visible: root.showDate
            spacing: 1

            Text {
                text: Qt.formatDateTime(clock.date, "dddd")
                color: Theme.textDim
                font.family: Theme.fontUi
                font.pixelSize: 11
            }

            Text {
                text: Qt.formatDateTime(clock.date, "d MMMM yyyy")
                color: Theme.text
                font.family: Theme.fontUi
                font.pixelSize: 11
                font.weight: Font.Medium
            }
        }

        Item {
            visible: root.showMedia
            width: 12
            height: 1
        }

        CoverArt {
            anchors.verticalCenter: parent.verticalCenter
            visible: root.showMedia
            size: 20
        }

        Text {
            anchors.verticalCenter: parent.verticalCenter
            visible: root.showMedia
            width: Math.min(implicitWidth, 260)
            text: Media.trackLine
            color: Theme.text
            elide: Text.ElideRight
            font.family: Theme.fontUi
            font.pixelSize: 13
            font.weight: Font.Medium
        }

        Row {
            anchors.verticalCenter: parent.verticalCenter
            visible: root.showMedia
            spacing: 12

            GlyphButton {
                text: Theme.glyphPrevious
                font.pixelSize: 15
                enabled: Media.player?.canGoPrevious ?? false
                onClicked: Media.player.previous()
            }

            GlyphButton {
                text: Media.playing ? Theme.glyphPause : Theme.glyphPlay
                font.pixelSize: 17
                enabled: Media.player?.canTogglePlaying ?? false
                onClicked: Media.player.togglePlaying()
            }

            GlyphButton {
                text: Theme.glyphNext
                font.pixelSize: 15
                enabled: Media.player?.canGoNext ?? false
                onClicked: Media.player.next()
            }
        }

        Visualizer {
            anchors.verticalCenter: parent.verticalCenter
            visible: root.showMedia
        }
    }

    NotchPanel {
        id: panel
        x: Theme.notchPadding
        y: Theme.peekBand + 6
        width: Theme.panelWidth - 2 * Theme.notchPadding
        enabled: root.expanded
        opacity: root.expanded ? 1 : 0

        Behavior on opacity {
            NumberAnimation {
                duration: root.expanded ? 220 : 90
                easing.type: Easing.OutCubic
            }
        }
    }
}
