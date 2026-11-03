import QtQuick

Item {
    id: root

    property real level: 0
    property bool muted: false
    readonly property real clamped: Math.max(0, Math.min(1, level))
    signal moved(real value)

    implicitHeight: 18

    function setFromPointer(x) {
        root.moved(Math.max(0, Math.min(1, x / width)));
    }

    Rectangle {
        id: track
        anchors.verticalCenter: parent.verticalCenter
        width: parent.width
        height: 4
        radius: 2
        color: Theme.track

        Rectangle {
            width: parent.width * root.clamped
            height: parent.height
            radius: 2
            color: root.muted ? Theme.textDim : Theme.accent
        }
    }

    Rectangle {
        anchors.verticalCenter: parent.verticalCenter
        x: track.width * root.clamped - width / 2
        width: 12
        height: 12
        radius: 6
        color: Theme.text
    }

    MouseArea {
        anchors.fill: parent
        preventStealing: true
        cursorShape: Qt.PointingHandCursor
        onPressed: mouse => root.setFromPointer(mouse.x)
        onPositionChanged: mouse => root.setFromPointer(mouse.x)
        onWheel: wheel => root.moved(Math.max(0, Math.min(1, root.clamped + ((wheel.angleDelta.y || wheel.angleDelta.x) > 0 ? 0.05 : -0.05))))
    }
}
