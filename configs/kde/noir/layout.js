function add(panel, type, groups) {
  var widget = panel.addWidget(type)
  Object.keys(groups || {}).forEach((group) => {
    widget.currentConfigGroup = group.split("/")
    Object.keys(groups[group]).forEach((key) => widget.writeConfig(key, groups[group][key]))
  })
  return widget
}

function command(panel, script, interval, color, extra) {
  var general = {
    command: script,
    interval: interval,
    fontFamily: "Maple Mono Normal NF",
    fontSize: 9,
    textColor: color || "#8f897f",
    showBackground: false,
    waitForCompletion: true,
  }
  Object.keys(extra || {}).forEach((key) => (general[key] = extra[key]))
  return add(panel, "com.github.zren.commandoutput", { General: general })
}

function music(panel, mode, color, extra) {
  return command(panel, scripts + "music.sh " + mode, 2000, color, extra)
}

var scripts = "$HOME/.config/dotfiles/configs/kde/noir/"

panels().forEach((panel) => panel.remove())

var top = new Panel()
top.location = "top"
top.height = 28
top.lengthMode = "fill"
top.hiding = "none"
top.floating = false
top.opacity = "opaque"

add(top, "org.kde.plasma.kickoff", { General: { icon: "view-app-grid-symbolic", favoritesPortedToKAstats: true } })
add(top, "org.kde.plasma.virtualdesktopbar", {
  General: {
    ShowAddButton: false,
    LabelStyle: 1,
    LabelFont: "Maple Mono Normal NF",
    LabelFontSize: 9,
    LabelColor: "#e6e1d6",
    LabelDimIdle: false,
    LabelBoldCurrent: true,
    IndicatorStyle: 2,
    IndicatorBlockRadius: 0,
    IndicatorColorCurrent: "#ff6b2c",
    IndicatorColorIdle: "#00000000",
    IndicatorColorOccupied: "#3a3a3a",
    IndicatorDistinctOccupied: true,
    ButtonSpacing: 2,
    ButtonMarginHorizontal: 6,
  },
})
command(top, scripts + "stats.sh cpu", 3000, "#ff6b2c")
command(top, scripts + "stats.sh ram", 3000, "#f5c065")
add(top, "org.kde.plasma.panelspacer")
command(top, scripts + "clock.sh", 10000, "#6fcfbf")
add(top, "org.kde.plasma.panelspacer")
command(top, "printf '󰲸'", 3600000, "#ff6b2c", {
  fontSize: 11,
  clickCommand: scripts + "spotify-library.py",
  tooltipCommand: "echo Spotify library",
})
music(top, "shuffle", "#9ccf8f", { fontSize: 11, clickCommand: scripts + "music.sh shuffle toggle" })
music(top, "loop", "#6fcfbf", { fontSize: 11, clickCommand: scripts + "music.sh loop toggle" })
add(top, "plasmusic-toolbar", {
  General: {
    useAlbumCoverAsPanelIcon: true,
    albumCoverRadius: 0,
    maxSongWidthInPanel: 260,
    skipBackwardControlInPanel: true,
    playPauseControlInPanel: true,
    choosePlayerAutomatically: false,
    preferredPlayerIdentity: "Spotify",
    spaceBetweenControlsInPanel: 4,
    skipForwardControlInPanel: true,
    showWhenNoMedia: true,
    useCustomFont: true,
    customFont: "Maple Mono Normal NF,9,-1,5,400,0,0,0,0,0,0,0,0,0,0,1",
    colorsFromAlbumCover: false,
    pauseTextScrollingWhileMediaIsNotPlaying: true,
    mediaProgressInPanel: true,
  },
})
music(top, "volume", "#f5c065", {
  mousewheelUpCommand: scripts + "music.sh volume up",
  mousewheelDownCommand: scripts + "music.sh volume down",
  tooltipCommand: "echo Scroll to change Spotify volume",
})
add(top, "org.kde.plasma.systemtray")

var dock = new Panel()
dock.location = "bottom"
dock.height = 44
dock.lengthMode = "fit"
dock.alignment = "center"
dock.hiding = "autohide"
dock.floating = true

add(dock, "org.kde.plasma.icontasks", {
  General: {
    launchers:
      "applications:steam.desktop,applications:brave-browser.desktop,applications:spotify.desktop,applications:org.kde.dolphin.desktop,applications:kitty.desktop,applications:discord.desktop,applications:obsidian.desktop,applications:cursor.desktop",
    showOnlyCurrentDesktop: false,
    iconSpacing: 1,
  },
})
