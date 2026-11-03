import QtQuick
import Quickshell.Widgets

Item {
    id: root

    required property var stream
    property bool current: false
    readonly property bool picking: NotchState.pickingStream === stream
    readonly property var target: Machine.outputOf(stream)
    readonly property bool excepted: Machine.routeAll && Machine.isException(stream)
    readonly property bool muted: stream?.audio?.muted ?? false
    readonly property real level: stream?.audio?.volume ?? 0
    signal pickRequested

    implicitHeight: column.implicitHeight

    Rectangle {
        anchors.fill: parent
        anchors.margins: -6
        radius: 10
        color: Qt.rgba(Theme.accent.r, Theme.accent.g, Theme.accent.b, 0.12)
        border.width: 1
        border.color: Qt.rgba(Theme.accent.r, Theme.accent.g, Theme.accent.b, 0.35)
        visible: root.current
    }

    Column {
        id: column
        width: parent.width
        spacing: 8

        Row {
            width: parent.width
            spacing: 10

            IconImage {
                id: icon
                anchors.verticalCenter: parent.verticalCenter
                implicitSize: 22
                source: Machine.appIcon(root.stream)
            }

            Column {
                anchors.verticalCenter: parent.verticalCenter
                width: parent.width - icon.width - chip.width - 2 * parent.spacing

                Text {
                    width: parent.width
                    text: Machine.streamLabel(root.stream)
                    color: Theme.text
                    elide: Text.ElideRight
                    font.family: Theme.fontUi
                    font.pixelSize: 13
                    font.weight: Font.DemiBold
                }

                Text {
                    width: parent.width
                    text: root.stream.properties["media.name"] ?? ""
                    color: Theme.textDim
                    elide: Text.ElideRight
                    font.family: Theme.fontUi
                    font.pixelSize: 11
                }
            }

            Rectangle {
                id: chip
                anchors.verticalCenter: parent.verticalCenter
                width: chipLabel.width + 22
                height: 24
                radius: 12
                color: root.picking || chipArea.containsMouse ? Qt.rgba(Theme.accent.r, Theme.accent.g, Theme.accent.b, 0.22) : Theme.track
                border.width: root.excepted ? 1 : 0
                border.color: Qt.rgba(Theme.accent.r, Theme.accent.g, Theme.accent.b, 0.55)

                Text {
                    id: chipLabel
                    anchors.centerIn: parent
                    width: Math.min(implicitWidth, 150)
                    text: Machine.label(root.target) || "Choose output"
                    color: root.excepted ? Theme.accent : Theme.text
                    elide: Text.ElideRight
                    font.family: Theme.fontUi
                    font.pixelSize: 11
                    font.weight: Font.Medium
                }

                MouseArea {
                    id: chipArea
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: {
                        if (root.picking)
                            NotchState.pickingStream = null;
                        else
                            root.pickRequested();
                    }
                }
            }
        }

        Row {
            x: icon.width + 10
            width: parent.width - x
            spacing: 10

            GlyphButton {
                id: mute
                anchors.verticalCenter: parent.verticalCenter
                text: root.muted ? Theme.glyphMuted : Theme.glyphVolume
                font.pixelSize: 15
                onClicked: Machine.toggleNodeMute(root.stream)
            }

            VolumeSlider {
                anchors.verticalCenter: parent.verticalCenter
                width: parent.width - mute.width - percent.width - 2 * parent.spacing
                level: root.level
                muted: root.muted
                onMoved: value => Machine.setNodeVolume(root.stream, value)
            }

            Text {
                id: percent
                anchors.verticalCenter: parent.verticalCenter
                width: 36
                text: `${Math.round(root.level * 100)}%`
                color: Theme.textDim
                horizontalAlignment: Text.AlignRight
                font.family: Theme.fontUi
                font.pixelSize: 12
            }
        }

        ChoiceList {
            x: icon.width + 10
            visible: root.picking
            options: Machine.sinks
            selected: root.target
            labelOf: node => Machine.label(node)
            onPicked: node => {
                Machine.pickOutput(root.stream, node);
                NotchState.closePicker();
            }
        }
    }
}
