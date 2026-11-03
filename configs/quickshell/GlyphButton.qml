import QtQuick

Text {
    id: root

    property bool interactive: true
    property bool outlined: false
    signal clicked

    font.family: Theme.fontGlyph
    font.pixelSize: 18
    color: interactive && area.containsMouse ? Theme.accent : Theme.text
    opacity: enabled ? 1 : 0.35
    style: outlined ? Text.Outline : Text.Normal
    styleColor: Theme.outline
    verticalAlignment: Text.AlignVCenter
    horizontalAlignment: Text.AlignHCenter

    Behavior on color {
        ColorAnimation {
            duration: 120
        }
    }

    MouseArea {
        id: area
        anchors.fill: parent
        anchors.margins: -6
        enabled: root.interactive
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onClicked: root.clicked()
    }
}
