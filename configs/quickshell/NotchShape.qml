import QtQuick
import QtQuick.Shapes

Shape {
    id: root

    property real bodyWidth: Theme.idleWidth
    property real bodyHeight: Theme.band
    property real tint: Theme.glassOpacity
    readonly property real flare: Theme.flare
    readonly property real radius: Math.max(0, Math.min(Theme.roundMax, bodyHeight - flare, bodyWidth / 2))

    width: bodyWidth + 2 * flare
    height: bodyHeight
    preferredRendererType: Shape.CurveRenderer

    function outline(originX, inset = 0) {
        const f = root.flare;
        const r = root.radius;
        const h = root.height;
        const left = originX;
        const right = originX + root.width;
        const flareRadius = f + inset;
        const flareReach = Math.sqrt(flareRadius * flareRadius - f * f);
        const cornerRadius = Math.max(0, r - inset);
        return `M ${right - flareReach} 0 A ${flareRadius} ${flareRadius} 0 0 0 ${right - f - inset} ${f} L ${right - f - inset} ${h - r} A ${cornerRadius} ${cornerRadius} 0 0 1 ${right - f - r} ${h - inset} L ${left + f + r} ${h - inset} A ${cornerRadius} ${cornerRadius} 0 0 1 ${left + f + inset} ${h - r} L ${left + f + inset} ${f} A ${flareRadius} ${flareRadius} 0 0 0 ${left + flareReach} 0`;
    }

    function ring(width) {
        return `${outline(0)} ${outline(0, width)}`;
    }

    ShapePath {
        strokeWidth: -1
        fillGradient: LinearGradient {
            y2: root.height

            GradientStop {
                position: 0
                color: Qt.rgba(Theme.glassTint.r, Theme.glassTint.g, Theme.glassTint.b, root.tint - 0.08)
            }
            GradientStop {
                position: 1
                color: Qt.rgba(Theme.glassTint.r, Theme.glassTint.g, Theme.glassTint.b, root.tint + 0.08)
            }
        }

        PathSvg {
            path: root.outline(0)
        }
    }

    ShapePath {
        strokeWidth: -1
        fillColor: Theme.glassSheen
        fillRule: ShapePath.OddEvenFill

        PathSvg {
            path: root.ring(7)
        }
    }

    ShapePath {
        strokeWidth: -1
        fillColor: Theme.glassSheen
        fillRule: ShapePath.OddEvenFill

        PathSvg {
            path: root.ring(3)
        }
    }

    ShapePath {
        strokeWidth: -1
        fillRule: ShapePath.OddEvenFill
        fillGradient: LinearGradient {
            x2: root.width
            y2: root.height

            GradientStop {
                position: 0
                color: Theme.glassSpecular
            }
            GradientStop {
                position: 0.45
                color: Theme.glassSpecularDim
            }
            GradientStop {
                position: 1
                color: Theme.glassSpecular
            }
        }

        PathSvg {
            path: root.ring(1)
        }
    }
}
