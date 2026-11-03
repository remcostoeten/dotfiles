import QtQuick

Column {
    id: root

    spacing: 16

    function rowAt(index) {
        return null;
    }

    Row {
        visible: Media.player !== null
        width: root.width
        spacing: 16

        CoverArt {
            id: art
            size: 88
        }

        Column {
            width: parent.width - art.width - parent.spacing
            spacing: 6

            Text {
                width: parent.width
                text: Media.player?.trackTitle || "Nothing playing"
                color: Theme.text
                font.family: Theme.fontUi
                font.pixelSize: 14
                font.weight: Font.DemiBold
                elide: Text.ElideRight
            }

            Text {
                width: parent.width
                text: Media.player?.trackArtist || Media.player?.identity || ""
                color: Theme.textDim
                font.family: Theme.fontUi
                font.pixelSize: 12
                elide: Text.ElideRight
            }

            Item {
                width: parent.width
                height: 18
                visible: Media.hasLength

                Rectangle {
                    anchors.verticalCenter: parent.verticalCenter
                    width: parent.width
                    height: 3
                    radius: 1.5
                    color: Theme.track

                    Rectangle {
                        width: parent.width * Media.progress
                        height: parent.height
                        radius: 1.5
                        color: Theme.text
                    }
                }
            }

            Row {
                anchors.horizontalCenter: parent.horizontalCenter
                spacing: 26

                GlyphButton {
                    text: Theme.glyphPrevious
                    enabled: Media.player?.canGoPrevious ?? false
                    onClicked: Media.player.previous()
                }

                GlyphButton {
                    text: Media.playing ? Theme.glyphPause : Theme.glyphPlay
                    font.pixelSize: 22
                    enabled: Media.player?.canTogglePlaying ?? false
                    onClicked: Media.player.togglePlaying()
                }

                GlyphButton {
                    text: Theme.glyphNext
                    enabled: Media.player?.canGoNext ?? false
                    onClicked: Media.player.next()
                }
            }
        }
    }

    Row {
        width: root.width
        spacing: 12

        GlyphButton {
            id: speaker
            anchors.verticalCenter: parent.verticalCenter
            text: Machine.muted ? Theme.glyphMuted : Theme.glyphVolume
            onClicked: Machine.toggleMute()
        }

        VolumeSlider {
            anchors.verticalCenter: parent.verticalCenter
            width: parent.width - speaker.width - percent.width - 2 * parent.spacing
            level: Machine.volume
            muted: Machine.muted
            onMoved: value => Machine.setVolume(value)
        }

        Text {
            id: percent
            anchors.verticalCenter: parent.verticalCenter
            width: 34
            text: `${Math.round(Machine.volume * 100)}%`
            color: Theme.textDim
            font.family: Theme.fontUi
            font.pixelSize: 12
            horizontalAlignment: Text.AlignRight
        }
    }
}
