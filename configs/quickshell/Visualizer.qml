import QtQuick

Row {
    id: root

    property real barWidth: 3
    property real maxHeight: 16

    spacing: 2
    height: maxHeight

    Repeater {
        model: Media.levels.length

        Rectangle {
            required property int index

            anchors.verticalCenter: parent.verticalCenter
            width: root.barWidth
            height: root.barWidth + Media.levels[index] * (root.maxHeight - root.barWidth)
            radius: root.barWidth / 2
            color: Theme.accent
        }
    }
}
