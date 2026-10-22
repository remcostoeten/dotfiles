function add(panel, type, groups) {
  var widget = panel.addWidget(type)
  Object.keys(groups || {}).forEach((group) => {
    widget.currentConfigGroup = group.split("/")
    Object.keys(groups[group]).forEach((key) => widget.writeConfig(key, groups[group][key]))
  })
  return widget
}

function separator(panel) {
  return add(panel, "zayron.simple.separator")
}

function command(panel, script, interval) {
  return add(panel, "com.github.zren.commandoutput", {
    General: {
      command: script,
      interval: interval,
      fontFamily: "JetBrainsMono Nerd Font",
      fontSize: 10,
      textColor: "#959596",
      showBackground: false,
      waitForCompletion: true,
    },
  })
}

var scripts = "$HOME/.config/dotfiles/configs/kde/lunar-mono/"

panels().forEach((panel) => panel.remove())

var top = new Panel()
top.location = "top"
top.height = 32
top.lengthMode = "fill"
top.hiding = "none"
top.floating = false
top.opacity = "opaque"

add(top, "org.kde.plasma.kickoff", { General: { icon: "search-symbolic", favoritesPortedToKAstats: true } })
add(top, "org.kde.plasma.virtualdesktopbar", {
  General: {
    ShowAddButton: false,
    LabelStyle: 0,
    LabelDimIdle: true,
    IndicatorStyle: 5,
    IndicatorColorCurrent: "#c2c2c0",
    IndicatorColorIdle: "#69696a",
    IndicatorColorOccupied: "#959596",
    ButtonSpacing: 6,
  },
})
separator(top)
add(top, "org.kde.windowtitle.Fork", { General: { showIcon: false, boldFont: false } })
add(top, "org.kde.plasma.panelspacer")
add(top, "luisbocanegra.audio.visualizer", {
  General: {
    visualizerStyle: 2,
    drawInactiveBlocks: true,
    blockHeight: 2,
    blockSpacing: 3,
    barWidth: 2,
    barGap: 4,
    barCount: 32,
    centeredBars: true,
    monstercat: true,
    length: 210,
    hideToolTip: true,
  },
})
add(top, "org.kde.plasma.panelspacer")
add(top, "org.kde.plasma.digitalclock", {
  Appearance: { showDate: false, use24hFormat: 2, autoFontAndSize: true },
})
separator(top)
command(top, scripts + "weather.sh", 900000)
separator(top)
command(top, scripts + "stats.sh", 3000)
separator(top)
add(top, "org.kde.plasma.systemtray")

var dock = new Panel()
dock.location = "bottom"
dock.height = 44
dock.lengthMode = "fit"
dock.alignment = "center"
dock.hiding = "autohide"
dock.floating = true

add(dock, "plasmusic-toolbar", {
  General: {
    useAlbumCoverAsPanelIcon: true,
    albumCoverRadius: 4,
    maxSongWidthInPanel: 180,
    skipBackwardControlInPanel: false,
    playPauseControlInPanel: false,
    skipForwardControlInPanel: false,
  },
})
add(dock, "org.kde.plasma.icontasks", {
  General: {
    launchers:
      "applications:steam.desktop,applications:brave-browser.desktop,applications:spotify.desktop,applications:org.kde.dolphin.desktop,applications:kitty.desktop,applications:discord.desktop,applications:obsidian.desktop,applications:cursor.desktop",
    showOnlyCurrentDesktop: false,
    iconSpacing: 1,
  },
})
