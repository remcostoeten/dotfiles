import QtQuick

Item {
    id: root

    required property var entry
    property bool current: false
    readonly property bool picking: Machine.sameSubject(NotchState.pickingSubject, entry)
    readonly property var target: Machine.sinkNamed(entry.output)
    signal focused

    implicitHeight: column.implicitHeight

    Rectangle {
        anchors.fill: parent
        anchors.margins: -6
        radius: 10
        color: Qt.rgba(Theme.accent.r, Theme.accent.g, Theme.accent.b, 0.12)
        border.width: 1
        border.color: Qt.rgba(Theme.accent.r, Theme.accent.g, Theme.accent.b, 0.35)
        visible: root.current
    }

    Column {
        id: column
        width: parent.width
        spacing: 6

        Row {
            width: parent.width
            spacing: 10

            Text {
                anchors.verticalCenter: parent.verticalCenter
                width: parent.width - chip.width - remove.width - 2 * parent.spacing
                text: root.entry.serial === undefined ? root.entry.app : `${Machine.subjectLabel(root.entry)} · this window`
                color: Theme.text
                elide: Text.ElideRight
                font.family: Theme.fontUi
                font.pixelSize: 13
                font.weight: Font.Medium
            }

            Rectangle {
                id: chip
                anchors.verticalCenter: parent.verticalCenter
                width: chipLabel.width + 22
                height: 24
                radius: 12
                color: root.picking || chipArea.containsMouse ? Qt.rgba(Theme.accent.r, Theme.accent.g, Theme.accent.b, 0.22) : Theme.track

                Text {
                    id: chipLabel
                    anchors.centerIn: parent
                    width: Math.min(implicitWidth, 150)
                    text: root.target ? Machine.label(root.target) : `${root.entry.output} (gone)`
                    color: root.target ? Theme.text : Theme.textDim
                    elide: Text.ElideRight
                    font.family: Theme.fontUi
                    font.pixelSize: 11
                    font.weight: Font.Medium
                }

                MouseArea {
                    id: chipArea
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: {
                        root.focused();
                        if (root.picking)
                            NotchState.closePicker();
                        else
                            NotchState.openExceptionPicker(root.entry);
                    }
                }
            }

            GlyphButton {
                id: remove
                anchors.verticalCenter: parent.verticalCenter
                text: Theme.glyphClose
                font.pixelSize: 15
                onClicked: Machine.setException(root.entry, null)
            }
        }

        ChoiceList {
            visible: root.picking
            options: Machine.outputsFor(root.entry)
            selected: root.target
            labelOf: node => Machine.label(node)
            onPicked: node => {
                Machine.setException(root.entry, node);
                NotchState.closePicker();
            }
        }
    }
}
