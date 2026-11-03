import QtQuick

Item {
    id: root

    required property var node
    property bool isDefault: false
    property bool current: false
    property bool routable: false
    property bool routed: false
    readonly property bool muted: node?.audio?.muted ?? false
    readonly property real level: node?.audio?.volume ?? 0
    readonly property real chipSpace: routable ? routeChip.width + heading.spacing : 0
    signal chosen
    signal routeRequested

    implicitHeight: 52

    HoverHandler {
        id: hover
    }

    Rectangle {
        anchors.fill: parent
        anchors.margins: -6
        radius: 10
        color: Qt.rgba(Theme.accent.r, Theme.accent.g, Theme.accent.b, 0.12)
        border.width: 1
        border.color: Qt.rgba(Theme.accent.r, Theme.accent.g, Theme.accent.b, 0.35)
        visible: root.current
    }

    Row {
        id: heading
        width: parent.width
        spacing: 10

        Rectangle {
            anchors.verticalCenter: parent.verticalCenter
            width: 12
            height: 12
            radius: 6
            color: root.isDefault ? Theme.accent : "transparent"
            border.width: 1.5
            border.color: root.isDefault ? Theme.accent : Theme.textDim
        }

        Text {
            width: parent.width - 22 - root.chipSpace
            text: Machine.label(root.node)
            color: root.isDefault || nameArea.containsMouse ? Theme.text : Theme.textDim
            elide: Text.ElideRight
            font.family: Theme.fontUi
            font.pixelSize: 13
            font.weight: root.isDefault ? Font.DemiBold : Font.Medium
        }

        Rectangle {
            id: routeChip
            anchors.verticalCenter: parent.verticalCenter
            visible: root.routable
            width: routeLabel.implicitWidth + 18
            height: 20
            radius: 10
            opacity: root.routed || root.current || hover.hovered ? 1 : 0
            color: root.routed ? Qt.rgba(Theme.accent.r, Theme.accent.g, Theme.accent.b, 0.22) : routeArea.containsMouse ? Theme.track : "transparent"
            border.width: 1
            border.color: root.routed ? Qt.rgba(Theme.accent.r, Theme.accent.g, Theme.accent.b, 0.45) : Theme.track

            Behavior on opacity {
                NumberAnimation {
                    duration: 140
                }
            }

            Text {
                id: routeLabel
                anchors.centerIn: parent
                text: root.routed ? "All audio" : "Route all here"
                color: root.routed ? Theme.accent : Theme.text
                font.family: Theme.fontUi
                font.pixelSize: 11
                font.weight: Font.Medium
            }

            MouseArea {
                id: routeArea
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: root.routeRequested()
            }
        }
    }

    MouseArea {
        id: nameArea
        width: heading.width - root.chipSpace
        height: heading.height
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onClicked: root.chosen()
    }

    Row {
        anchors.bottom: parent.bottom
        x: 22
        width: parent.width - 22
        spacing: 10

        GlyphButton {
            id: mute
            anchors.verticalCenter: parent.verticalCenter
            text: root.muted ? Theme.glyphMuted : Theme.glyphVolume
            font.pixelSize: 15
            onClicked: Machine.toggleNodeMute(root.node)
        }

        VolumeSlider {
            anchors.verticalCenter: parent.verticalCenter
            width: parent.width - mute.width - percent.width - 2 * parent.spacing
            level: root.level
            muted: root.muted
            onMoved: value => Machine.setNodeVolume(root.node, value)
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
}
