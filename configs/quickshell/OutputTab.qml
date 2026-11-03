import QtQuick

Column {
    id: root

    readonly property int exceptionStart: leading.count
    readonly property int adderIndex: exceptionStart + Machine.exceptions.length

    spacing: 14

    function rowAt(index) {
        if (index < exceptionStart)
            return leading.itemAt(index);
        if (index < adderIndex)
            return exceptionRows.itemAt(index - exceptionStart);
        if (index === adderIndex)
            return adder;
        return trailing.itemAt(index - adderIndex - 1);
    }

    Repeater {
        id: leading
        model: Machine.routeAll ? Machine.sinks.slice(0, 1) : Machine.sinks

        SinkRow {
            required property int index

            width: root.width
            rowIndex: index
        }
    }

    Column {
        visible: Machine.routeAll
        x: 22
        width: root.width - x
        spacing: 14

        Text {
            text: "Except"
            color: Theme.textDim
            font.family: Theme.fontUi
            font.pixelSize: 12
            font.weight: Font.DemiBold
        }

        Repeater {
            id: exceptionRows
            model: Machine.exceptions

            ExceptionRow {
                required property var modelData
                required property int index

                width: parent.width
                entry: modelData
                current: root.exceptionStart + index === NotchState.cursor
                onFocused: NotchState.cursor = root.exceptionStart + index
            }
        }

        ExceptionAdder {
            id: adder
            width: parent.width
            current: root.adderIndex === NotchState.cursor
            onFocused: NotchState.cursor = root.adderIndex
        }
    }

    Repeater {
        id: trailing
        model: Machine.routeAll ? Machine.sinks.slice(1) : []

        SinkRow {
            required property int index

            width: root.width
            rowIndex: root.adderIndex + 1 + index
        }
    }
}
