panels().forEach((panel) => {
  if (panel.location === "top") panel.remove()
})

var dock = panels().find((panel) => panel.location === "bottom")
if (dock && dock.widgets("org.kde.plasma.kickoff").length === 0) {
  var kickoff = dock.addWidget("org.kde.plasma.kickoff")
  kickoff.currentConfigGroup = ["General"]
  kickoff.writeConfig("icon", "view-app-grid-symbolic")
  kickoff.writeConfig("favoritesPortedToKAstats", true)
}
