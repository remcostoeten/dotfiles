import QtQuick
import Quickshell
import Quickshell.Services.SystemTray
import Quickshell.Widgets

Row {
    id: root

    required property QsWindow window

    height: Theme.band
    spacing: 14

    function handleTrayClick(delegate, button) {
        const tray = delegate.modelData;
        if (button === Qt.MiddleButton) {
            tray.secondaryActivate();
            return;
        }
        if (button === Qt.RightButton || tray.onlyMenu) {
            if (!tray.hasMenu)
                return;
            const anchor = delegate.mapToItem(null, 0, delegate.height);
            tray.display(root.window, anchor.x, anchor.y);
            return;
        }
        tray.activate();
    }

    GlyphButton {
        height: parent.height
        visible: Machine.updates > 0
        text: Theme.glyphUpdates
        font.pixelSize: 16
        outlined: true
        interactive: false
    }

    GlyphButton {
        height: parent.height
        visible: !Machine.online
        text: Theme.glyphOffline
        font.pixelSize: 16
        color: Theme.accent
        outlined: true
        interactive: false
    }

    Item {
        id: volume

        readonly property string glyph: Machine.muted ? Theme.glyphMuted : Machine.volume < 0.34 ? Theme.glyphVolumeLow : Machine.volume < 0.67 ? Theme.glyphVolumeMedium : Theme.glyphVolume
        readonly property color tint: volumeArea.containsMouse ? Theme.accent : Machine.muted ? Theme.textDim : Theme.text

        width: volumeRow.implicitWidth
        height: parent.height

        Row {
            id: volumeRow
            height: parent.height
            spacing: 5

            Text {
                anchors.verticalCenter: parent.verticalCenter
                text: volume.glyph
                color: volume.tint
                font.family: Theme.fontGlyph
                font.pixelSize: 16
                style: Text.Outline
                styleColor: Theme.outline
            }

            Text {
                anchors.verticalCenter: parent.verticalCenter
                text: `${Math.round(Machine.volume * 100)}%`
                color: volume.tint
                font.family: Theme.fontUi
                font.pixelSize: 12
                font.weight: Font.Medium
                style: Text.Outline
                styleColor: Theme.outline
            }
        }

        MouseArea {
            id: volumeArea
            anchors.fill: parent
            anchors.margins: -4
            hoverEnabled: true
            acceptedButtons: Qt.LeftButton | Qt.RightButton | Qt.MiddleButton
            cursorShape: Qt.PointingHandCursor
            onClicked: mouse => {
                if (mouse.button === Qt.MiddleButton) {
                    Machine.toggleMute();
                    return;
                }
                if (mouse.button === Qt.RightButton) {
                    Quickshell.execDetached(["pavucontrol"]);
                    return;
                }
                if (NotchState.open && NotchState.tab === "output") {
                    NotchState.open = false;
                    return;
                }
                NotchState.show("output");
            }
            onWheel: wheel => Machine.nudgeVolume((wheel.angleDelta.y || wheel.angleDelta.x) > 0 ? 0.05 : -0.05)
        }
    }

    Repeater {
        model: SystemTray.items.values.filter(item => item.status !== Status.Passive)

        Item {
            id: trayItem

            required property SystemTrayItem modelData

            width: 18
            height: root.height

            IconImage {
                anchors.centerIn: parent
                implicitSize: 16
                source: trayItem.modelData.icon
            }

            MouseArea {
                anchors.fill: parent
                acceptedButtons: Qt.LeftButton | Qt.RightButton | Qt.MiddleButton
                cursorShape: Qt.PointingHandCursor
                onClicked: mouse => root.handleTrayClick(trayItem, mouse.button)
                onWheel: wheel => {
                    const horizontal = wheel.angleDelta.x !== 0;
                    trayItem.modelData.scroll(horizontal ? wheel.angleDelta.x : wheel.angleDelta.y, horizontal);
                }
            }
        }
    }
}
