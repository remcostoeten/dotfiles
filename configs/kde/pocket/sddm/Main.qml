import QtQuick
import QtQuick.Shapes

Rectangle {
    id: root

    readonly property color accent: config.accent || "#ff6b2c"
    readonly property color ink: config.text || "#e6e1d6"
    readonly property color inkDim: config.textDim || "#a8a29a"
    readonly property color failure: config.error || "#ff5f56"
    readonly property string font: "Departure Mono"
    readonly property int band: 32
    readonly property int flare: 13
    property int sessionIndex: sessionModel.lastIndex
    property string userName: userModel.lastUser || (users.count > 0 ? users.itemAt(0).userName : "")
    property bool failed: false
    property date now: new Date()

    width: 1920
    height: 1080
    color: "#000000"

    function login() {
        root.failed = false;
        sddm.login(root.userName, password.text, root.sessionIndex);
    }

    function cycleSession() {
        if (sessions.count > 0)
            root.sessionIndex = (root.sessionIndex + 1) % sessions.count;
    }

    Connections {
        target: sddm

        function onLoginFailed() {
            password.text = "";
            root.failed = true;
            shake.restart();
        }
    }

    Timer {
        interval: 1000
        repeat: true
        running: true
        onTriggered: root.now = new Date()
    }

    Repeater {
        id: users
        model: userModel

        Item {
            required property string name
            readonly property string userName: name
        }
    }

    Repeater {
        id: sessions
        model: sessionModel

        Item {
            required property string name
            readonly property string sessionName: name
        }
    }

    Image {
        anchors.fill: parent
        source: config.background
        fillMode: Image.PreserveAspectCrop
        asynchronous: true
    }

    Rectangle {
        anchors.fill: parent
        color: "#000000"
        opacity: 0.35
    }

    Shape {
        id: notch

        readonly property real bodyWidth: 150
        readonly property real radius: root.band - root.flare

        anchors.horizontalCenter: parent.horizontalCenter
        width: bodyWidth + 2 * root.flare
        height: root.band
        preferredRendererType: Shape.CurveRenderer

        ShapePath {
            fillColor: "#000000"
            strokeWidth: -1
            startX: 0
            startY: 0

            PathLine {
                x: notch.width
                y: 0
            }
            PathArc {
                x: notch.width - root.flare
                y: root.flare
                radiusX: root.flare
                radiusY: root.flare
                direction: PathArc.Counterclockwise
            }
            PathLine {
                x: notch.width - root.flare
                y: notch.height - notch.radius
            }
            PathArc {
                x: notch.width - root.flare - notch.radius
                y: notch.height
                radiusX: notch.radius
                radiusY: notch.radius
            }
            PathLine {
                x: root.flare + notch.radius
                y: notch.height
            }
            PathArc {
                x: root.flare
                y: notch.height - notch.radius
                radiusX: notch.radius
                radiusY: notch.radius
            }
            PathLine {
                x: root.flare
                y: root.flare
            }
            PathArc {
                x: 0
                y: 0
                radiusX: root.flare
                radiusY: root.flare
                direction: PathArc.Counterclockwise
            }
        }

        Text {
            anchors.centerIn: parent
            text: Qt.formatDateTime(root.now, "HH:mm")
            color: root.ink
            font.family: root.font
            font.pixelSize: 22
        }
    }

    Rectangle {
        id: card

        anchors.centerIn: parent
        width: 380
        height: column.implicitHeight + 56
        radius: 24
        color: "#000000"
        opacity: 0.88

        SequentialAnimation {
            id: shake

            NumberAnimation { target: card; property: "anchors.horizontalCenterOffset"; to: -14; duration: 50 }
            NumberAnimation { target: card; property: "anchors.horizontalCenterOffset"; to: 12; duration: 70 }
            NumberAnimation { target: card; property: "anchors.horizontalCenterOffset"; to: -8; duration: 60 }
            NumberAnimation { target: card; property: "anchors.horizontalCenterOffset"; to: 0; duration: 50 }
        }
    }

    Column {
        id: column

        anchors.centerIn: card
        width: card.width - 56
        spacing: 14

        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: Qt.formatDateTime(root.now, "dddd d MMMM")
            color: root.ink
            font.family: root.font
            font.pixelSize: 22
        }

        Item {
            width: 1
            height: 6
        }

        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: root.userName
            color: root.accent
            font.family: root.font
            font.pixelSize: 15
        }

        Rectangle {
            width: parent.width
            height: 44
            radius: 22
            color: Qt.rgba(1, 1, 1, 0.07)
            border.width: 1
            border.color: root.failed ? root.failure : password.activeFocus ? root.accent : Qt.rgba(1, 1, 1, 0.12)

            TextInput {
                id: password

                anchors.fill: parent
                anchors.leftMargin: 20
                anchors.rightMargin: 20
                verticalAlignment: TextInput.AlignVCenter
                echoMode: TextInput.Password
                passwordCharacter: "•"
                color: root.ink
                selectionColor: root.accent
                font.family: root.font
                font.pixelSize: 16
                focus: true
                cursorDelegate: Rectangle {
                    width: 2
                    color: root.accent
                }
                onAccepted: root.login()
                onTextChanged: root.failed = false
                Component.onCompleted: forceActiveFocus()
            }

            Text {
                anchors.fill: parent
                anchors.leftMargin: 20
                verticalAlignment: Text.AlignVCenter
                visible: password.text.length === 0
                text: root.failed ? "Wrong password" : "Password"
                color: root.failed ? root.failure : root.inkDim
                font.family: root.font
                font.pixelSize: 15
            }
        }
    }

    Text {
        anchors.left: parent.left
        anchors.bottom: parent.bottom
        anchors.margins: 28
        text: sessions.count > 0 && sessions.itemAt(root.sessionIndex) ? sessions.itemAt(root.sessionIndex).sessionName : ""
        color: sessionArea.containsMouse ? root.accent : root.inkDim
        font.family: root.font
        font.pixelSize: 14

        MouseArea {
            id: sessionArea
            anchors.fill: parent
            anchors.margins: -8
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: root.cycleSession()
        }
    }

    Row {
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        anchors.margins: 28
        spacing: 26

        Repeater {
            model: [
                { label: "Suspend", allowed: sddm.canSuspend, run: () => sddm.suspend() },
                { label: "Restart", allowed: sddm.canReboot, run: () => sddm.reboot() },
                { label: "Shut down", allowed: sddm.canPowerOff, run: () => sddm.powerOff() }
            ]

            Text {
                required property var modelData

                visible: modelData.allowed
                text: modelData.label
                color: powerArea.containsMouse ? root.accent : root.inkDim
                font.family: root.font
                font.pixelSize: 14

                MouseArea {
                    id: powerArea
                    anchors.fill: parent
                    anchors.margins: -8
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: parent.modelData.run()
                }
            }
        }
    }
}
