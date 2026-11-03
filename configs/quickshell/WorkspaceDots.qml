import QtQuick

Item {
    id: root

    implicitWidth: row.implicitWidth
    implicitHeight: Theme.band

    MouseArea {
        anchors.fill: parent
        acceptedButtons: Qt.NoButton
        onWheel: wheel => Desktops.step((wheel.angleDelta.y || wheel.angleDelta.x) > 0 ? -1 : 1)
    }

    Row {
        id: row
        anchors.verticalCenter: parent.verticalCenter
        spacing: Theme.dotGap

        Repeater {
            model: Desktops.ids

            Rectangle {
                id: dot

                required property string modelData
                readonly property bool active: modelData === Desktops.current

                width: active ? Theme.pillWidth : Theme.dotSize
                height: Theme.dotSize
                radius: height / 2
                color: active ? Theme.accent : Theme.dot
                border.width: 1
                border.color: Theme.outline

                Behavior on width {
                    SpringAnimation {
                        spring: 5
                        damping: 0.32
                        epsilon: 0.25
                    }
                }

                Behavior on color {
                    ColorAnimation {
                        duration: 160
                    }
                }

                MouseArea {
                    anchors.fill: parent
                    anchors.margins: -5
                    cursorShape: Qt.PointingHandCursor
                    onClicked: Desktops.activate(dot.modelData)
                }
            }
        }
    }
}
