import QtQuick

Column {
    id: root

    property var options: []
    property var selected: null
    property var labelOf: option => option
    signal picked(var option)

    spacing: 2

    Repeater {
        model: root.options

        Text {
            required property var modelData
            required property int index
            readonly property bool chosen: modelData === root.selected
            readonly property bool highlighted: NotchState.pickCursor === index

            leftPadding: 8
            topPadding: 4
            bottomPadding: 4
            text: `${highlighted ? "›" : " "} ${root.labelOf(modelData)}`
            color: chosen || highlighted || area.containsMouse ? Theme.accent : Theme.text
            font.family: Theme.fontUi
            font.pixelSize: 12
            font.weight: chosen ? Font.DemiBold : Font.Normal

            MouseArea {
                id: area
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: root.picked(parent.modelData)
            }
        }
    }
}
