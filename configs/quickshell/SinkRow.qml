import QtQuick

DeviceRow {
    required property var modelData
    property int rowIndex: 0

    node: modelData
    isDefault: modelData === Machine.sink
    current: rowIndex === NotchState.cursor
    routable: true
    routed: Machine.routeAll && modelData === Machine.sink
    onChosen: {
        NotchState.cursor = rowIndex;
        Machine.setDefaultSink(modelData);
    }
    onRouteRequested: {
        NotchState.cursor = rowIndex;
        Machine.toggleRouteAll(modelData);
    }
}
