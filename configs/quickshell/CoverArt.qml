import QtQuick

Rectangle {
    id: root

    property int size: 20

    width: size
    height: size
    color: Theme.track

    Image {
        anchors.fill: parent
        source: Media.artUrl
        fillMode: Image.PreserveAspectCrop
        asynchronous: true
        sourceSize.width: root.size * 2
        sourceSize.height: root.size * 2
    }
}
