import QtQuick

Column {
    id: root

    readonly property var pages: ({ playing: playingPage, output: outputPage, apps: appsPage, input: inputPage })
    readonly property var outputRows: Machine.routeAll ? [...Machine.sinks.slice(0, 1), ...Machine.exceptions, "add", ...Machine.sinks.slice(1)] : Machine.sinks
    readonly property var rows: ({ playing: [], output: outputRows, apps: Machine.appStreams, input: Machine.sources })[NotchState.tab]
    readonly property var hints: ({
            playing: "Space play  ·  ←→ track  ·  ↑↓ volume  ·  M mute  ·  Tab next tab  ·  Esc close",
            output: Machine.routeAll ? "↑↓ select  ·  ←→ volume  ·  Enter default or edit  ·  A route all audio here  ·  X drop exception  ·  M mute  ·  Esc close" : "↑↓ select  ·  ←→ volume  ·  Enter default  ·  A route all audio here  ·  M mute  ·  Tab next tab  ·  Esc close",
            apps: "↑↓ select  ·  ←→ volume  ·  Enter output  ·  M mute  ·  Tab next tab  ·  Esc close",
            input: "↑↓ select  ·  ←→ volume  ·  Enter default  ·  M mute  ·  Tab next tab  ·  Esc close",
            picker: "↑↓ choose output  ·  Enter move  ·  Esc back",
            appPicker: "↑↓ choose app  ·  Enter pick its output  ·  Esc back"
        })

    spacing: 14

    function handleKey(event) {
        const key = event.key;
        if (key === Qt.Key_Escape) {
            if (NotchState.picking)
                NotchState.closePicker();
            else
                NotchState.open = false;
            return true;
        }
        if (key === Qt.Key_Tab || key === Qt.Key_Backtab) {
            NotchState.stepTab(key === Qt.Key_Backtab ? -1 : 1);
            return true;
        }
        if (key >= Qt.Key_1 && key <= Qt.Key_4) {
            NotchState.tab = NotchState.tabs[key - Qt.Key_1];
            return true;
        }
        if (NotchState.tab === "playing")
            return handlePlayingKey(key);
        if (NotchState.picking)
            return handlePickerKey(key);
        return handleListKey(key);
    }

    function handlePlayingKey(key) {
        const player = Media.player;
        if ((key === Qt.Key_Space || key === Qt.Key_Return || key === Qt.Key_Enter) && player?.canTogglePlaying)
            player.togglePlaying();
        else if (key === Qt.Key_Left && player?.canGoPrevious)
            player.previous();
        else if (key === Qt.Key_Right && player?.canGoNext)
            player.next();
        else if (key === Qt.Key_Up)
            Machine.nudgeVolume(0.05);
        else if (key === Qt.Key_Down)
            Machine.nudgeVolume(-0.05);
        else if (key === Qt.Key_M)
            Machine.toggleMute();
        else
            return false;
        return true;
    }

    function handleListKey(key) {
        if (root.rows.length === 0)
            return false;
        NotchState.cursor = Math.min(NotchState.cursor, root.rows.length - 1);
        const node = root.rows[NotchState.cursor];
        if (key === Qt.Key_Up || key === Qt.Key_K)
            NotchState.cursor = Math.max(0, NotchState.cursor - 1);
        else if (key === Qt.Key_Down || key === Qt.Key_J)
            NotchState.cursor = Math.min(root.rows.length - 1, NotchState.cursor + 1);
        else if (key === Qt.Key_Left)
            Machine.setNodeVolume(node, (node.audio?.volume ?? 0) - 0.05);
        else if (key === Qt.Key_Right)
            Machine.setNodeVolume(node, (node.audio?.volume ?? 0) + 0.05);
        else if (key === Qt.Key_M)
            Machine.toggleNodeMute(node);
        else if (key === Qt.Key_A && NotchState.tab === "output" && Machine.sinks.includes(node))
            Machine.toggleRouteAll(node);
        else if ((key === Qt.Key_X || key === Qt.Key_Delete || key === Qt.Key_Backspace) && node?.app !== undefined)
            Machine.setException(node, null);
        else if (key === Qt.Key_Return || key === Qt.Key_Enter || key === Qt.Key_Space)
            activate(node);
        else
            return false;
        return true;
    }

    function handlePickerKey(key) {
        const options = NotchState.addingException ? Machine.exceptionCandidates : NotchState.pickingSubject !== null ? Machine.outputsFor(NotchState.pickingSubject) : Machine.sinks;
        const option = options[NotchState.pickCursor];
        if (key === Qt.Key_Up || key === Qt.Key_K)
            NotchState.pickCursor = Math.max(0, NotchState.pickCursor - 1);
        else if (key === Qt.Key_Down || key === Qt.Key_J)
            NotchState.pickCursor = Math.min(options.length - 1, NotchState.pickCursor + 1);
        else if (key !== Qt.Key_Return && key !== Qt.Key_Enter && key !== Qt.Key_Space)
            return false;
        else if (option === undefined)
            return true;
        else if (NotchState.addingException)
            NotchState.openExceptionPicker(option);
        else if (NotchState.pickingSubject !== null) {
            Machine.setException(NotchState.pickingSubject, option);
            NotchState.closePicker();
        } else {
            Machine.pickOutput(NotchState.pickingStream, option);
            NotchState.closePicker();
        }
        return true;
    }

    function activate(node) {
        if (NotchState.tab === "output" && node === "add")
            NotchState.openAppPicker();
        else if (NotchState.tab === "output" && node?.app !== undefined)
            NotchState.openExceptionPicker(node);
        else if (NotchState.tab === "output")
            Machine.setDefaultSink(node);
        else if (NotchState.tab === "input")
            Machine.setDefaultSource(node);
        else
            NotchState.openPicker(node);
    }

    function reveal() {
        const row = page.item ? page.item.rowAt(NotchState.cursor) : null;
        if (!row)
            return;
        const top = row.mapToItem(page, 0, 0).y - 8;
        const bottom = top + row.height + 16;
        if (top < scroller.contentY)
            scroller.contentY = Math.max(0, top);
        else if (bottom > scroller.contentY + scroller.height)
            scroller.contentY = Math.min(scroller.contentHeight - scroller.height, bottom - scroller.height);
    }

    Connections {
        target: NotchState

        function onCursorChanged() {
            root.reveal();
        }

        function onTabChanged() {
            scroller.contentY = 0;
        }
    }

    Component {
        id: playingPage
        PlayingTab {}
    }

    Component {
        id: outputPage
        OutputTab {}
    }

    Component {
        id: appsPage
        AppsTab {}
    }

    Component {
        id: inputPage
        InputTab {}
    }

    PanelTabs {}

    Flickable {
        id: scroller
        width: root.width
        height: Math.min(page.height, Theme.panelMaxContent)
        contentHeight: page.height
        interactive: page.height > height
        boundsBehavior: Flickable.StopAtBounds
        clip: true

        Loader {
            id: page
            width: scroller.width
            sourceComponent: root.pages[NotchState.tab]
        }
    }

    Text {
        width: root.width
        text: root.hints[NotchState.addingException ? "appPicker" : NotchState.picking ? "picker" : NotchState.tab]
        color: Theme.textDim
        wrapMode: Text.WordWrap
        font.family: Theme.fontUi
        font.pixelSize: 10
    }
}
