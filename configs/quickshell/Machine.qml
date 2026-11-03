pragma Singleton

import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Networking
import Quickshell.Services.Pipewire

Singleton {
    id: root

    readonly property var sink: Pipewire.defaultAudioSink
    readonly property var source: Pipewire.defaultAudioSource
    readonly property bool muted: sink?.audio?.muted ?? false
    readonly property real volume: sink?.audio?.volume ?? 0
    readonly property var devices: Networking.devices.values
    readonly property bool online: devices.length === 0 || devices.some(device => device.connected)
    property int updates: 0
    property bool stateReady: false

    readonly property var audioNodes: Pipewire.nodes.values.filter(node => node.audio !== null)
    readonly property var sinks: defaultFirst(byClass("Audio/Sink"), sink)
    readonly property var sources: defaultFirst(byClass("Audio/Source"), source)
    readonly property var hiddenApps: ["kiekje"]
    readonly property var appStreams: byClass("Stream/Output/Audio").filter(node => appName(node) !== "" && !hiddenApps.includes(appName(node)))
    readonly property var recorders: byClass("Stream/Input/Audio").filter(node => node.properties["media.name"] !== "Peak detect" && appName(node) !== "" && appName(node) !== "cava")
    readonly property var otherSinks: sinks.filter(node => node !== sink)
    readonly property bool routeAll: routeState.routeAll
    property var appRules: []
    readonly property var windowRuleList: Array.from(JSON.parse(windowRules.rules)).filter(entry => typeof entry?.app === "string" && typeof entry?.serial === "string" && typeof entry?.output === "string")
    readonly property var exceptions: [...appRules, ...windowRuleList]
    readonly property var recentApps: Array.from(routeState.recentApps ?? []).filter(app => !hiddenApps.includes(app))
    readonly property var playingApps: unique(appStreams.filter(node => isPlaying(node)).map(node => appName(node)))
    readonly property var exceptionCandidates: [...playingApps.reduce((list, app) => [...list, ...candidatesFor(app)], []), ...recentApps.filter(app => !playingApps.includes(app) && exceptionFor({ app: app }) === null).map(app => ({ app: app }))]
    property var liveSerials: []
    readonly property var misrouted: routeAll && sink ? byClass("Stream/Output/Audio").filter(stream => !stream.properties["node.link-group"] && targetFor(stream) !== null && outputOf(stream) !== targetFor(stream)) : []

    onMisroutedChanged: {
        if (misrouted.length > 0)
            routeTimer.restart();
    }

    onAppStreamsChanged: {
        rememberApps();
        forgetEndedStreams();
    }

    function rememberApps() {
        if (!stateReady)
            return;
        const recent = unique([...appStreams.map(node => appName(node)), ...recentApps]).slice(0, 12);
        if (recent.join("\n") !== recentApps.join("\n"))
            routeState.recentApps = recent;
    }

    function forgetEndedStreams() {
        const live = appStreams.map(node => serialOf(node));
        const ended = liveSerials.filter(serial => !live.includes(serial));
        liveSerials = live;
        if (windowRuleList.some(entry => ended.includes(entry.serial)))
            windowRules.rules = JSON.stringify(windowRuleList.filter(entry => !ended.includes(entry.serial)));
    }

    function loadAppRules(text) {
        appRules = Array.from(JSON.parse(text || "[]")).filter(entry => typeof entry?.app === "string" && typeof entry?.output === "string");
    }

    function markStateReady() {
        stateReady = true;
        rememberApps();
    }

    function unique(values) {
        return [...new Set(values)];
    }

    function byClass(mediaClass) {
        return audioNodes.filter(node => node.properties["media.class"] === mediaClass);
    }

    function defaultFirst(nodes, current) {
        return nodes.sort((left, right) => (right === current) - (left === current) || label(left).localeCompare(label(right)));
    }

    function outputOf(stream) {
        const link = Pipewire.linkGroups.values.find(group => group.source?.id === stream?.id && group.target?.properties["media.class"] === "Audio/Sink");
        return link?.target ?? null;
    }

    function label(node) {
        return node?.description || node?.nickname || node?.name || "";
    }

    function appName(node) {
        return node?.properties["application.name"] ?? "";
    }

    function serialOf(node) {
        return String(node?.properties["object.serial"] ?? "");
    }

    function isPlaying(node) {
        return String(node?.properties["pulse.corked"] ?? "false") !== "true";
    }

    function streamsOf(app) {
        return appStreams.filter(node => appName(node) === app).sort((left, right) => Number(serialOf(left)) - Number(serialOf(right)));
    }

    function playingStreamsOf(app) {
        return streamsOf(app).filter(node => isPlaying(node));
    }

    function streamLabel(stream) {
        const app = appName(stream);
        if (!isPlaying(stream))
            return `${app} (paused)`;
        const playing = playingStreamsOf(app);
        return playing.length > 1 ? `${app} ${playing.indexOf(stream) + 1}` : app;
    }

    function windowSubject(stream) {
        return {
            app: appName(stream),
            serial: serialOf(stream)
        };
    }

    function subjectOf(stream) {
        return isPlaying(stream) && playingStreamsOf(appName(stream)).length > 1 ? windowSubject(stream) : {
            app: appName(stream)
        };
    }

    function candidatesFor(app) {
        const whole = exceptionFor({
            app: app
        }) === null ? [
            {
                app: app
            }
        ] : [];
        const playing = playingStreamsOf(app);
        if (playing.length < 2)
            return whole;
        return [...whole, ...playing.filter(stream => exceptionFor(windowSubject(stream)) === null).map(stream => windowSubject(stream))];
    }

    function subjectLabel(subject) {
        if (subject?.serial === undefined)
            return playingStreamsOf(subject?.app).length > 1 ? `${subject.app} · all windows` : subject?.app ?? "";
        const stream = appStreams.find(node => serialOf(node) === subject.serial);
        return stream ? streamLabel(stream) : `${subject.app} (gone)`;
    }

    function sameSubject(left, right) {
        return !!left && !!right && left.app === right.app && left.serial === right.serial;
    }

    function appIcon(node) {
        const icon = node?.properties["application.icon-name"] ?? "";
        return icon === "" ? "" : Quickshell.iconPath(icon, true);
    }

    function setVolume(value) {
        setNodeVolume(sink, value);
    }

    function nudgeVolume(delta) {
        setVolume(volume + delta);
    }

    function toggleMute() {
        toggleNodeMute(sink);
    }

    function setNodeVolume(node, value) {
        if (!node?.audio)
            return;
        node.audio.muted = false;
        node.audio.volume = Math.max(0, Math.min(1, value));
    }

    function toggleNodeMute(node) {
        if (node?.audio)
            node.audio.muted = !node.audio.muted;
    }

    function setDefaultSink(node) {
        Pipewire.preferredDefaultAudioSink = node;
    }

    function setDefaultSource(node) {
        Pipewire.preferredDefaultAudioSource = node;
    }

    function moveStream(stream, target) {
        Quickshell.execDetached(["pactl", "move-sink-input", String(stream.properties["object.serial"] ?? stream.id), target.name]);
    }

    function sinkNamed(name) {
        return sinks.find(node => node.name === name) ?? null;
    }

    function exceptionFor(subject) {
        return exceptions.find(entry => sameSubject(entry, subject)) ?? null;
    }

    function ruleFor(stream) {
        return exceptionFor(windowSubject(stream)) ?? exceptionFor({
            app: appName(stream)
        });
    }

    function isException(stream) {
        return ruleFor(stream) !== null;
    }

    function targetFor(stream) {
        const rule = ruleFor(stream);
        return rule === null ? sink : sinkNamed(rule.output);
    }

    function outputsFor(subject) {
        return subject?.serial !== undefined && exceptionFor({
            app: subject.app
        }) !== null ? sinks : otherSinks;
    }

    function setException(subject, output) {
        if (subject.serial === undefined) {
            const kept = output && output !== sink ? [
                {
                    app: subject.app,
                    output: output.name
                }
            ] : [];
            appRules = [...appRules.filter(entry => entry.app !== subject.app), ...kept];
            appRulesFile.setText(JSON.stringify(appRules, null, 4));
            return;
        }
        const overridesApp = exceptionFor({
            app: subject.app
        }) !== null;
        const kept = output && (output !== sink || overridesApp) ? [
            {
                app: subject.app,
                serial: subject.serial,
                output: output.name
            }
        ] : [];
        windowRules.rules = JSON.stringify([...windowRuleList.filter(entry => !sameSubject(entry, subject)), ...kept]);
    }

    function pickOutput(stream, target) {
        if (routeAll && appName(stream) !== "")
            setException(exceptionFor(windowSubject(stream)) === null ? subjectOf(stream) : windowSubject(stream), target);
        moveStream(stream, target);
    }

    function toggleRouteAll(node) {
        if (routeAll && node === sink) {
            routeState.routeAll = false;
            return;
        }
        setDefaultSink(node);
        routeState.routeAll = true;
    }

    PwObjectTracker {
        objects: root.audioNodes
    }

    PersistentProperties {
        id: windowRules
        reloadableId: "notchWindowRules"

        property string rules: "[]"
    }

    FileView {
        path: Quickshell.statePath("audio.json")
        printErrors: false
        onAdapterUpdated: writeAdapter()
        onLoaded: root.markStateReady()
        onLoadFailed: root.markStateReady()

        JsonAdapter {
            id: routeState

            property bool routeAll: false
            property list<string> recentApps: []
        }
    }

    // JsonAdapter var properties read back one write behind, so app rules keep their own file.
    FileView {
        id: appRulesFile
        path: Quickshell.statePath("audio-rules.json")
        printErrors: false
        onLoaded: root.loadAppRules(text())
    }

    Timer {
        id: routeTimer
        interval: 250
        onTriggered: root.misrouted.forEach(stream => root.moveStream(stream, root.targetFor(stream)))
    }

    Process {
        id: updateCheck
        command: ["checkupdates"]
        stdout: StdioCollector {
            onStreamFinished: root.updates = text.split("\n").filter(line => line.trim() !== "").length
        }
    }

    Timer {
        interval: 30 * 60 * 1000
        repeat: true
        running: true
        triggeredOnStart: true
        onTriggered: updateCheck.running = true
    }
}
