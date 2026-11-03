import QtQuick

Column {
    id: root

    spacing: 14

    function rowAt(index) {
        return rows.itemAt(index);
    }

    Repeater {
        id: rows
        model: Machine.sources

        DeviceRow {
            required property var modelData
            required property int index

            width: root.width
            node: modelData
            isDefault: modelData === Machine.source
            current: index === NotchState.cursor
            onChosen: {
                NotchState.cursor = index;
                Machine.setDefaultSource(modelData);
            }
        }
    }

    Text {
        text: Machine.recorders.length > 0 ? "Recording now" : "Nothing is recording"
        color: Theme.textDim
        font.family: Theme.fontUi
        font.pixelSize: 12
        font.weight: Font.DemiBold
    }

    Repeater {
        model: Machine.recorders

        Row {
            required property var modelData

            spacing: 10

            Rectangle {
                anchors.verticalCenter: parent.verticalCenter
                width: 8
                height: 8
                radius: 4
                color: Theme.accent
            }

            Text {
                text: Machine.appName(modelData)
                color: Theme.text
                font.family: Theme.fontUi
                font.pixelSize: 13
            }

            Text {
                text: modelData.properties["media.name"] ?? ""
                color: Theme.textDim
                font.family: Theme.fontUi
                font.pixelSize: 12
            }
        }
    }
}
