package runtime

import (
	"slices"

	tea "charm.land/bubbletea/v2"

	"pc/internal/tui/core/registry"
	"pc/internal/tui/core/render"
	"pc/internal/tui/kernel"
	"pc/internal/tui/layout"
	"pc/internal/tui/ui"
)

// View is a pure function of the model. It allocates strings and returns one:
// it does not touch the terminal, read the clock or mutate anything. That
// single constraint is what makes the whole frame snapshot-testable.
func (m Model) View() tea.View {
	view := tea.NewView(m.Render())
	if m.cfg.Mouse {
		view.MouseMode = tea.MouseModeCellMotion
	}
	return view
}

// Render draws the frame. It is exported separately from View so that golden
// tests can assert on a frame without a terminal.
func (m Model) Render() string {
	return render.Fill(m.render(), m.core.Size, m.theme.Canvas())
}

func (m Model) render() string {
	rc := render.NewContext(m.theme, m.core.Size.Rect(), m.ui.Breakpoint, m.focus)

	switch {
	case m.core.Fatal != nil:
		return m.chrome.Fatal(rc, m.core.Fatal)
	case !m.core.Ready || m.core.Size.IsZero():
		return m.chrome.Boot(rc)
	case m.frame.TooSmall:
		return m.chrome.TooSmall(rc, layout.MinSize)
	}

	base := render.Compose(m.core.Size.Rect(), m.chromeBlocks(rc)...)
	for _, o := range m.ui.Overlays {
		base = m.composite(rc, base, o)
	}
	return m.withToasts(rc, base)
}

// composite draws one overlay over the frame. An overlay that reports several
// disjoint blocks gets each drawn separately, so what lies between them stays
// visible rather than being covered by a full-frame rectangle of blanks.
func (m Model) composite(rc render.Context, base string, o registry.Overlay) string {
	if multi, ok := o.(registry.Multi); ok {
		for _, b := range multi.Blocks(rc, m.frame) {
			base = render.Overlay(base, b.Content, b.Rect)
		}
		return base
	}
	at := o.Placement(m.frame)
	return render.Overlay(base, o.Render(rc.For(at)), at)
}

// chromeBlocks positions the top bar, the sidebar, the workspace and the
// status bar. Each fills a rectangle the frame already solved.
func (m Model) chromeBlocks(rc render.Context) []render.Block {
	routes := m.reg.NavRoutes()

	blocks := []render.Block{
		render.At(m.frame.TopBar, m.chrome.TopBar(rc.For(m.frame.TopBar), m.nav, routes)),
		render.At(m.frame.Workspace, m.workspaceContent(rc)),
		render.At(m.frame.StatusBar, m.chrome.StatusBar(rc.For(m.frame.StatusBar), m.status(rc))),
	}
	if !m.frame.Sidebar.IsEmpty() {
		blocks = append(blocks, render.At(m.frame.Sidebar,
			m.chrome.Sidebar(rc.For(m.frame.Sidebar), m.nav, routes)))
	}
	return blocks
}

// workspaceContent is the active view, or the error panel that replaced it
// after a module panicked.
func (m Model) workspaceContent(rc render.Context) string {
	area := rc.For(m.frame.Workspace)

	if m.core.Recovered != nil {
		return ui.ErrorState{
			Title:  "This screen stopped responding",
			Detail: m.core.Recovered.Error(),
			Retry:  ui.Hint{Key: "ctrl+k", Label: "open the palette"},
		}.Render(area)
	}
	view := m.ActiveView()
	if view == nil {
		return ui.EmptyState{
			Title: "No screens are registered",
			Hint:  "add a module in app/register.go",
		}.Render(area)
	}
	return view.Render(area)
}

// status resolves the bindings that are currently available into hints, so the
// bottom bar is generated rather than written.
func (m Model) status(rc render.Context) registry.Status {
	hints := make([]ui.Hint, 0, 6)
	for _, b := range m.reg.Keymap().Hints(m.inputContext()) {
		hints = append(hints, ui.Hint{Key: keyLabel(b.Keys), Label: b.Hint})
	}

	items := make([]string, 0, len(m.reg.Status()))
	for _, item := range m.reg.Status() {
		if item.Slot == registry.SlotRight {
			items = append(items, item.Render(rc))
		}
	}

	pinned := ui.Hint{}
	if len(hints) > 0 {
		pinned = hints[0]
		hints = slices.Delete(hints, 0, 1)
	}
	if len(m.core.Pending) > 0 {
		hints = append([]ui.Hint{{Key: keyLabel(m.core.Pending), Label: "…"}}, hints...)
	}
	return registry.Status{Hints: hints, Items: items, Pinned: pinned}
}

// withToasts stacks notifications in the bottom right, above everything else.
func (m Model) withToasts(rc render.Context, base string) string {
	if len(m.ui.Toasts) == 0 {
		return base
	}

	width := min(48, max(0, m.core.Size.Width-4))
	if width <= 0 {
		return base
	}
	bottom := m.frame.StatusBar.Y - 1
	if bottom <= 0 {
		bottom = m.core.Size.Height - 1
	}

	for i := len(m.ui.Toasts) - 1; i >= 0; i-- {
		row := bottom - (len(m.ui.Toasts) - 1 - i)
		if row < 0 {
			break
		}
		at := kernel.Rect{X: max(0, m.core.Size.Width-width-2), Y: row, Width: width, Height: 1}
		base = render.Overlay(base, m.ui.Toasts[i].toast.Render(rc.For(at)), at)
	}
	return base
}

// keyLabel renders a chord the way the user types it.
func keyLabel(keys []string) string {
	out := ""
	for i, k := range keys {
		if i > 0 {
			out += " "
		}
		out += k
	}
	return out
}
