import QtQuick
import QtQuick.Shapes
import Quickshell
import Quickshell.Wayland

PanelWindow {
    id: window

    anchors {
        top: true
        left: true
        right: true
    }
    implicitHeight: Theme.windowHeight
    exclusionMode: ExclusionMode.Normal
    exclusiveZone: Theme.band
    color: "transparent"
    WlrLayershell.namespace: "quickshell-bar"
    WlrLayershell.layer: WlrLayer.Top
    WlrLayershell.keyboardFocus: NotchState.open ? WlrKeyboardFocus.Exclusive : WlrKeyboardFocus.None
    mask: Region {
        Region {
            item: band
        }
        Region {
            item: notch
        }
    }

    BackgroundEffect.blurRegion: Region {
        Region {
            x: notch.x + Theme.flare
            width: notch.bodyWidth
            height: notch.bodyHeight
            bottomLeftRadius: notch.radius
            bottomRightRadius: notch.radius
        }
        Region {
            x: notch.x
            width: Theme.flare
            height: Theme.flare

            Region {
                shape: RegionShape.Ellipse
                intersection: Intersection.Subtract
                x: notch.x - Theme.flare
                width: 2 * Theme.flare
                height: 2 * Theme.flare
            }
        }
        Region {
            x: notch.x + notch.width - Theme.flare
            width: Theme.flare
            height: Theme.flare

            Region {
                shape: RegionShape.Ellipse
                intersection: Intersection.Subtract
                x: notch.x + notch.width - Theme.flare
                width: 2 * Theme.flare
                height: 2 * Theme.flare
            }
        }
    }

    Item {
        id: band
        width: parent.width
        height: Theme.band

        Shape {
            anchors.fill: parent
            clip: true
            preferredRendererType: Shape.CurveRenderer

            ShapePath {
                fillColor: Theme.bar
                fillRule: ShapePath.OddEvenFill
                strokeWidth: -1

                PathRectangle {
                    width: band.width
                    height: band.height
                }
                PathSvg {
                    path: notch.outline(notch.x)
                }
            }
        }

        WorkspaceDots {
            anchors.left: parent.left
            anchors.leftMargin: Theme.sideMargin
            height: Theme.band
        }

        StatusItems {
            window: window
            anchors.right: parent.right
            anchors.rightMargin: Theme.sideMargin
            height: Theme.band
        }
    }

    NotchShape {
        id: notch
        anchors.horizontalCenter: parent.horizontalCenter
        bodyWidth: content.targetWidth
        bodyHeight: content.targetHeight
        tint: content.expanded ? Theme.glassOpacityOpen : Theme.glassOpacity

        Behavior on tint {
            NumberAnimation {
                duration: 220
                easing.type: Easing.OutCubic
            }
        }

        Behavior on bodyWidth {
            SpringAnimation {
                spring: Theme.spring
                damping: Theme.damping
                epsilon: 0.25
            }
        }

        Behavior on bodyHeight {
            SpringAnimation {
                spring: Theme.spring
                damping: Theme.damping
                epsilon: 0.25
            }
        }

        NotchContent {
            id: content
            x: Theme.flare
            width: notch.bodyWidth
            height: notch.bodyHeight
        }
    }
}
