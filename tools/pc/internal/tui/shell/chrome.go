// Package shell is the chrome: the top bar, the sidebar, the status bar and
// the overlays. It knows that routes exist; it never knows which ones.
package shell

import (
	"strconv"
	"strings"

	"pc/internal/tui/core/registry"
	"pc/internal/tui/core/render"
	"pc/internal/tui/kernel"
	"pc/internal/tui/layout"
	navigation "pc/internal/tui/navigation"
	"pc/internal/tui/ui"
)

// Chrome draws the frame around the active view. It satisfies registry.Chrome,
// which is how the runtime composites it without importing this package.
type Chrome struct {
	Name     string
	Version  string
	Subtitle string
}

// TopBar draws the application mark and the nav strip.
func (c Chrome) TopBar(rc render.Context, nav navigation.State, routes []navigation.Route) string {
	st := rc.Styles()
	width := rc.Rect.Width
	if width <= 0 {
		return ""
	}

	left := " " + st.Accent.Render(rc.Glyphs.Chevron) + " " + st.TopBarTitle.Render(c.Name)
	if c.Version != "" {
		left += " " + st.TopBarVersion.Render(c.Version)
	}

	titles := make([]string, len(routes))
	active := 0
	for i, r := range routes {
		titles[i] = r.Title
		if r.ID == nav.Root() {
			active = i
		}
	}
	strip := ui.Tabs{Items: titles, Active: active}.Render(rc)

	right := ""
	if c.Subtitle != "" {
		right = st.TopBarVersion.Render(c.Subtitle) + " "
	}

	gap := width - render.Width(left) - render.Width(strip) - render.Width(right) - 2
	if gap < 1 {
		return render.Fit(left+"  "+strip, width, render.Left, rc.Glyphs.Ellipsis)
	}
	return left + "  " + strip + strings.Repeat(" ", gap) + right
}

// Sidebar lists the routes vertically, collapsing to initials when the
// terminal is too narrow for titles.
func (c Chrome) Sidebar(rc render.Context, nav navigation.State, routes []navigation.Route) string {
	st := rc.Styles()
	area := rc.Rect
	if area.IsEmpty() {
		return ""
	}

	rows := make([]string, 0, len(routes))
	for _, r := range routes {
		label := " " + r.Title
		if rc.Breakpoint == layout.Normal {
			label = " " + initial(r.Title)
		}
		style := st.NavItem
		if r.ID == nav.Root() {
			style = st.NavItemActive
		}
		rows = append(rows, style.Render(render.Fit(label, area.Width, render.Left, "")))
	}
	return render.Clip(strings.Join(rows, "\n"), area.Size())
}

// StatusBar draws the generated bottom line.
func (c Chrome) StatusBar(rc render.Context, status registry.Status) string {
	return ui.StatusBar{
		Hints:  status.Hints,
		Items:  status.Items,
		Pinned: status.Pinned,
	}.Render(rc)
}

// Boot is what shows before the first resize arrives.
func (c Chrome) Boot(rc render.Context) string {
	return ui.EmptyState{Title: c.Name, Hint: "starting…"}.Render(rc)
}

// TooSmall replaces the frame rather than rendering a garbled one.
func (c Chrome) TooSmall(rc render.Context, need kernel.Size) string {
	return ui.EmptyState{
		Title: "Terminal too small",
		Hint:  sizeLabel(need) + " required",
	}.Render(rc)
}

// Fatal is the last thing drawn before the program gives up.
func (c Chrome) Fatal(rc render.Context, err error) string {
	return ui.ErrorState{
		Title:  c.Name + " could not continue",
		Detail: err.Error(),
	}.Render(rc)
}

func initial(title string) string {
	for _, r := range title {
		return strings.ToUpper(string(r))
	}
	return "?"
}

func sizeLabel(s kernel.Size) string {
	return strconv.Itoa(s.Width) + "x" + strconv.Itoa(s.Height)
}
