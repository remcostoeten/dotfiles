import QtQuick

Item {
    id: root

    property bool current: false
    readonly property bool choosingOutput: NotchState.pickingSubject !== null && Machine.exceptionFor(NotchState.pickingSubject) === null
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

        Text {
            text: "+ Except an app"
            color: NotchState.addingException || root.choosingOutput || addArea.containsMouse ? Theme.accent : Theme.text
            font.family: Theme.fontUi
            font.pixelSize: 13
            font.weight: Font.Medium

            MouseArea {
                id: addArea
                anchors.fill: parent
                anchors.margins: -4
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: {
                    root.focused();
                    if (NotchState.addingException || root.choosingOutput)
                        NotchState.closePicker();
                    else
                        NotchState.openAppPicker();
                }
            }
        }

        Text {
            visible: NotchState.addingException && Machine.exceptionCandidates.length === 0
            text: "No other app has played audio yet"
            color: Theme.textDim
            font.family: Theme.fontUi
            font.pixelSize: 12
        }

        ChoiceList {
            visible: NotchState.addingException
            options: Machine.exceptionCandidates
            labelOf: subject => Machine.subjectLabel(subject)
            onPicked: subject => NotchState.openExceptionPicker(subject)
        }

        Text {
            visible: root.choosingOutput
            text: root.choosingOutput ? `Send ${Machine.subjectLabel(NotchState.pickingSubject)} to` : ""
            color: Theme.textDim
            font.family: Theme.fontUi
            font.pixelSize: 12
        }

        ChoiceList {
            visible: root.choosingOutput
            options: root.choosingOutput ? Machine.outputsFor(NotchState.pickingSubject) : []
            labelOf: node => Machine.label(node)
            onPicked: node => {
                Machine.setException(NotchState.pickingSubject, node);
                NotchState.closePicker();
            }
        }
    }
}
