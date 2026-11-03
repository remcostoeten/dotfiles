import QtQuick

Column {
    id: root

    spacing: 16

    function rowAt(index) {
        return rows.itemAt(index);
    }

    Text {
        visible: Machine.routeAll
        width: root.width
        text: `All audio goes to ${Machine.label(Machine.sink)}. Give an app another output to keep it out, or pick ${Machine.label(Machine.sink)} again to bring it back.`
        color: Theme.textDim
        wrapMode: Text.WordWrap
        font.family: Theme.fontUi
        font.pixelSize: 12
    }

    Text {
        visible: Machine.appStreams.length === 0
        text: "No app is playing audio"
        color: Theme.textDim
        font.family: Theme.fontUi
        font.pixelSize: 13
    }

    Repeater {
        id: rows
        model: Machine.appStreams

        AppStreamRow {
            required property var modelData
            required property int index

            width: root.width
            stream: modelData
            current: index === NotchState.cursor
            onPickRequested: {
                NotchState.cursor = index;
                NotchState.openPicker(modelData);
            }
        }
    }
}
