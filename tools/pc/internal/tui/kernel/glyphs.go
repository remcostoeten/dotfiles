package kernel

// GlyphSet is the symbolic half of the visual language. Themes carry one so
// that a terminal without unicode support degrades by swapping the set rather
// than by editing every component.
type GlyphSet struct {
	Success  string
	Warning  string
	Error    string
	Info     string
	Bullet   string
	Arrow    string
	Chevron  string
	Ellipsis string
	Check    string
	Cross    string
	Spinner  []string
	Bar      []string
}

// UnicodeGlyphs is the default set for terminals that report unicode support.
func UnicodeGlyphs() GlyphSet {
	return GlyphSet{
		Success:  "✓",
		Warning:  "!",
		Error:    "✗",
		Info:     "•",
		Bullet:   "•",
		Arrow:    "→",
		Chevron:  "▸",
		Ellipsis: "…",
		Check:    "✓",
		Cross:    "✗",
		Spinner:  []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"},
		Bar:      []string{"▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"},
	}
}

// ASCIIGlyphs is the fallback set: every glyph is a single ASCII cell, so it is
// safe for pipes, CI logs and terminals that misreport their capabilities.
func ASCIIGlyphs() GlyphSet {
	return GlyphSet{
		Success:  "+",
		Warning:  "!",
		Error:    "x",
		Info:     "*",
		Bullet:   "*",
		Arrow:    ">",
		Chevron:  ">",
		Ellipsis: "...",
		Check:    "x",
		Cross:    "-",
		Spinner:  []string{"|", "/", "-", "\\"},
		Bar:      []string{".", ":", "-", "=", "+", "*", "#", "@"},
	}
}
