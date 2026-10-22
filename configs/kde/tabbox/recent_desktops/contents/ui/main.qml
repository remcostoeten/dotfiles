/*
 SPDX-FileCopyrightText: 2024 Antigravity <antigravity@google.com>
 SPDX-License-Identifier: GPL-2.0-or-later
 */

import QtQuick
import QtQuick.Layouts
import org.kde.ksvg as KSvg
import org.kde.plasma.components 3.0 as PlasmaComponents3
import org.kde.kwin as KWin
import org.kde.kirigami as Kirigami

KWin.TabBoxSwitcher {
    id: tabBox

    property var shownRows: []
    property int lastShownRow: 0

    function isOnDesktops(window, desktopIds) {
        if (!window || window.onAllDesktops) {
            return true;
        }
        return Array.from(window.desktops).some((desktop) => desktopIds.includes(desktop.id));
    }

    function rowWindows() {
        const windows = new Map(Array.from(KWin.Workspace.stackingOrder).map((window) => [String(window.internalId), window]));
        const rows = [];
        for (let row = 0; row < repeater.count; row++) {
            const item = repeater.itemAt(row);
            rows.push(item ? windows.get(item.windowKey) : undefined);
        }
        return rows;
    }

    function recentRows() {
        const windows = rowWindows();
        const currentId = KWin.Workspace.currentDesktop.id;
        const lastVisited = windows.find((window) => !isOnDesktops(window, [currentId]));
        const desktopIds = lastVisited ? [currentId].concat(Array.from(lastVisited.desktops).map((desktop) => desktop.id)) : [currentId];
        const rows = [];
        windows.forEach((window, row) => {
            if (isOnDesktops(window, desktopIds)) {
                rows.push(row);
            }
        });
        return rows;
    }

    function refresh() {
        try {
            shownRows = recentRows();
        } catch (error) {
            console.warn("recent_desktops: showing every window,", error);
            shownRows = Array.from({ length: repeater.count }, (_, row) => row);
        }
    }

    function nextShownRow(row, forward) {
        const count = repeater.count;
        for (let step = 1; step < count; step++) {
            const candidate = (row + (forward ? step : count - step)) % count;
            if (shownRows.includes(candidate)) {
                return candidate;
            }
        }
        return row;
    }

    onAboutToShow: {
        refresh();
        if (!shownRows.includes(currentIndex)) {
            const reverseStart = repeater.count > 2 && currentIndex === repeater.count - 1;
            currentIndex = nextShownRow(currentIndex, !reverseStart);
        }
        lastShownRow = currentIndex;
    }

    onCurrentIndexChanged: {
        if (!visible) {
            return;
        }
        if (shownRows.includes(currentIndex)) {
            lastShownRow = currentIndex;
            return;
        }
        currentIndex = nextShownRow(currentIndex, currentIndex === (lastShownRow + 1) % repeater.count);
    }

    Connections {
        target: tabBox.model
        function onModelReset() {
            Qt.callLater(tabBox.refresh);
        }
    }

    Window {
        id: wnd
        visible: tabBox.visible
        flags: Qt.BypassWindowManagerHint | Qt.FramelessWindowHint
        color: "transparent"

        x: tabBox.screenGeometry.x + tabBox.screenGeometry.width * 0.5 - width * 0.5
        y: tabBox.screenGeometry.y + tabBox.screenGeometry.height * 0.5 - height * 0.5

        FocusScope {
            id: dialogMainItem
            focus: true
            anchors.fill: parent

            Rectangle {
                anchors.fill: parent
                radius: 6
                color: Kirigami.Theme.backgroundColor
            }

            KSvg.FrameSvgItem {
                anchors.fill: parent
                imagePath: "dialogs/background"
            }

            readonly property int iconSize: Kirigami.Units.iconSizes.huge
            readonly property int thumbnailWidth: Kirigami.Units.gridUnit * 16
            readonly property real screenFactor: {
                if (tabBox.screenGeometry.height > 0) {
                    return tabBox.screenGeometry.width / tabBox.screenGeometry.height;
                }
                return 1.777;
            }
            readonly property int thumbnailHeight: thumbnailWidth * (1.0/screenFactor)

            readonly property int cellMargin: Kirigami.Units.largeSpacing
            readonly property int cellWidth: thumbnailWidth + cellMargin * 2
            readonly property int cellHeight: thumbnailHeight + iconSize + cellMargin * 2

            property int maxW: tabBox.screenGeometry.width * 0.9
            property int maxH: tabBox.screenGeometry.height * 0.8

            function columnCountRecursion(prevC, prevBestC, prevDiff) {
                const c = prevC - 1;
                if (c < 1) return prevBestC;

                if (prevC * prevC <= itemCount + prevDiff ||
                        maxH < Math.ceil(itemCount / c) * cellHeight) {
                    return prevBestC;
                }
                const residue = itemCount % c;
                if (residue == 0) {
                    return c;
                }
                const diff = c - residue;

                if (diff < prevDiff) {
                    return columnCountRecursion(c, c, diff);
                } else if (diff == prevDiff) {
                    return columnCountRecursion(c, prevBestC, diff);
                }
                return columnCountRecursion(c, prevBestC, diff);
            }

            property int maxGridColumnsByWidth: Math.floor(maxW / cellWidth)
            property int itemCount: tabBox.shownRows.length

            property int columns: {
                if (itemCount === 0) return 1;
                const c = Math.min(itemCount, maxGridColumnsByWidth);
                if (c <= 1) return 1;
                const residue = itemCount % c;
                if (residue == 0) return c;
                return columnCountRecursion(c, c, c - residue);
            }

            property int rows: Math.ceil(itemCount / Math.max(1, columns))

            property int contentWidth: itemCount === 0 ? cellWidth : columns * cellWidth
            property int contentHeight: itemCount === 0 ? cellHeight : rows * cellHeight

            Binding {
                target: wnd
                property: "width"
                value: dialogMainItem.contentWidth
            }
            Binding {
                target: wnd
                property: "height"
                value: dialogMainItem.contentHeight
            }

            function navigate(dir) {
                const shownRows = tabBox.shownRows;
                const current = shownRows.indexOf(tabBox.currentIndex);
                if (current < 0) {
                    return;
                }
                let next = current;
                let cols = Math.min(itemCount, columns);

                if (dir === Qt.Key_Right) {
                    next = (current + 1) % itemCount;
                } else if (dir === Qt.Key_Left) {
                    next = (current - 1 + itemCount) % itemCount;
                } else if (dir === Qt.Key_Down) {
                    next = current + cols;
                    if (next >= itemCount) next = next % cols;
                } else if (dir === Qt.Key_Up) {
                    next = current - cols;
                    if (next < 0) {
                        next = itemCount - (itemCount % cols) + current;
                        if (next >= itemCount) next -= cols;
                    }
                }

                if (next !== current) {
                    tabBox.currentIndex = shownRows[next];
                }
            }

            Keys.onPressed: (event) => {
                if (event.key === Qt.Key_Left || event.key === Qt.Key_Right ||
                    event.key === Qt.Key_Up || event.key === Qt.Key_Down) {
                    navigate(event.key);
                }
            }

            Flow {
                id: flow
                anchors.fill: parent

                Repeater {
                    id: repeater
                    model: tabBox.model
                    delegate: Item {
                        width: dialogMainItem.cellWidth
                        height: dialogMainItem.cellHeight
                        visible: tabBox.shownRows.includes(index)

                        readonly property string windowKey: String(windowId)
                        readonly property bool isCurrent: index === tabBox.currentIndex

                        KSvg.FrameSvgItem {
                            anchors.fill: parent
                            imagePath: "widgets/viewitem"
                            prefix: "hover"
                            visible: isCurrent
                        }

                        MouseArea {
                            anchors.fill: parent
                            onClicked: tabBox.model.activate(index)

                            Accessible.name: model.caption
                            Accessible.role: Accessible.ListItem
                        }

                        ColumnLayout {
                            anchors.fill: parent
                            anchors.margins: dialogMainItem.cellMargin
                            spacing: Kirigami.Units.smallSpacing

                            Item {
                                Layout.fillWidth: true
                                Layout.fillHeight: true

                                KWin.WindowThumbnail {
                                    anchors.fill: parent
                                    wId: windowId
                                }

                                PlasmaComponents3.ToolButton {
                                    id: closeButton
                                    anchors {
                                        right: parent.right
                                        top: parent.top
                                        rightMargin: -dialogMainItem.cellMargin + Kirigami.Units.smallSpacing
                                        topMargin: -dialogMainItem.cellMargin + Kirigami.Units.smallSpacing
                                    }
                                    visible: model.closeable && (isCurrent || hoverHandler.hovered || closeButton.hovered)
                                    icon.name: "window-close-symbolic"
                                    onClicked: tabBox.model.close(index)
                                }

                                HoverHandler {
                                    id: hoverHandler
                                }

                                Kirigami.Icon {
                                    anchors.horizontalCenter: parent.horizontalCenter
                                    anchors.bottom: parent.bottom
                                    anchors.bottomMargin: -height/2
                                    width: dialogMainItem.iconSize
                                    height: width
                                    source: model.icon
                                }
                            }

                            Item {
                                Layout.fillWidth: true
                                Layout.preferredHeight: dialogMainItem.iconSize/2
                            }

                            PlasmaComponents3.Label {
                                Layout.fillWidth: true
                                text: model.caption
                                horizontalAlignment: Text.AlignHCenter
                                elide: Text.ElideMiddle
                                maximumLineCount: 1
                                font.weight: isCurrent ? Font.Bold : Font.Normal
                            }
                        }
                    }
                }
            }

            Kirigami.PlaceholderMessage {
                anchors.centerIn: parent
                width: parent.width - Kirigami.Units.largeSpacing * 2
                icon.source: "edit-none"
                text: "No open windows"
                visible: dialogMainItem.itemCount === 0
            }
        }
    }
}
