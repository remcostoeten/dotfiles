import QtQuick

Row {
    id: root

    readonly property var labels: ({ playing: "Playing", output: "Output", apps: "Apps", input: "Input" })

    spacing: 20

    Repeater {
        model: NotchState.tabs

        Item {
            id: tab

            required property string modelData
            required property int index
            readonly property bool active: NotchState.tab === modelData
            readonly property bool lit: active || area.containsMouse

            width: label.implicitWidth
            height: 26

            Row {
                id: label
                anchors.verticalCenter: parent.verticalCenter
                spacing: 7

                Text {
                    id: title
                    anchors.verticalCenter: parent.verticalCenter
                    text: root.labels[tab.modelData]
                    color: tab.lit ? Theme.text : Theme.textDim
                    font.family: Theme.fontUi
                    font.pixelSize: 13
                    font.weight: tab.active ? Font.DemiBold : Font.Medium
                }

                Rectangle {
                    anchors.verticalCenter: parent.verticalCenter
                    width: Math.max(16, key.implicitWidth + 8)
                    height: 16
                    radius: 4
                    color: tab.active ? Qt.rgba(Theme.accent.r, Theme.accent.g, Theme.accent.b, 0.16) : Qt.rgba(1, 1, 1, 0.05)
                    border.width: 1
                    border.color: tab.active ? Qt.rgba(Theme.accent.r, Theme.accent.g, Theme.accent.b, 0.5) : Qt.rgba(Theme.text.r, Theme.text.g, Theme.text.b, tab.lit ? 0.3 : 0.16)

                    Text {
                        id: key
                        anchors.centerIn: parent
                        text: tab.index + 1
                        color: tab.active ? Theme.accent : tab.lit ? Theme.text : Theme.textDim
                        font.family: Theme.fontUi
                        font.pixelSize: 10
                        font.weight: Font.DemiBold
                    }
                }
            }

            Rectangle {
                anchors.bottom: parent.bottom
                width: title.width
                height: 2
                radius: 1
                color: Theme.accent
                opacity: tab.active ? 1 : 0

                Behavior on opacity {
                    NumberAnimation {
                        duration: 140
                    }
                }
            }

            MouseArea {
                id: area
                anchors.fill: parent
                anchors.margins: -6
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: NotchState.tab = tab.modelData
            }
        }
    }
}
