// Package input turns keys into intents. No component reads a key: components
// declare bindings as data and one resolver owns dispatch, which is what makes
// bindings configurable, conflict-checkable and discoverable.
//
// It is the one L1 package that depends on another — it names command.ID and
// reuses command.Predicate — because the alternative is stringly-typed
// plumbing between two packages that are meaningless apart.
package input

import "strings"

var keyAliases = map[string]string{
	"control":  "ctrl",
	"ctl":      "ctrl",
	"option":   "alt",
	"meta":     "alt",
	"escape":   "esc",
	"return":   "enter",
	"pageup":   "pgup",
	"pagedn":   "pgdown",
	"pagedown": "pgdown",
	"pgdn":     "pgdown",
	"del":      "delete",
	"ins":      "insert",
	"spc":      "space",
	" ":        "space",
	"bs":       "backspace",
}

// Normalize reduces a key to its canonical form. "Ctrl+P", "ctrl-p" and "^p"
// all become "ctrl+p". Doing this once at parse time means the config file,
// the resolver, the help overlay and the status bar share one spelling, so a
// rebinding shows up everywhere with no second source of truth.
//
// Case survives only on an unmodified letter, where vi keymaps need "G" and
// "g" to differ. Under ctrl or alt a terminal reports no meaningful case, so
// the base is folded down and "^K" and "ctrl+k" are the same binding.
func Normalize(key string) string {
	if key == " " {
		return "space"
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return ""
	}
	if key == "+" || key == "-" {
		return key
	}

	if strings.HasPrefix(key, "^") && len(key) > 1 {
		key = "ctrl+" + key[1:]
	}

	parts := strings.FieldsFunc(key, func(r rune) bool { return r == '+' || r == '-' })
	if len(parts) == 0 {
		return ""
	}

	var ctrl, alt, shift bool
	for _, p := range parts[:len(parts)-1] {
		switch canonical(p) {
		case "ctrl":
			ctrl = true
		case "alt":
			alt = true
		case "shift":
			shift = true
		}
	}

	base := canonicalBase(parts[len(parts)-1], ctrl || alt)

	var out strings.Builder
	if ctrl {
		out.WriteString("ctrl+")
	}
	if alt {
		out.WriteString("alt+")
	}
	if shift {
		out.WriteString("shift+")
	}
	out.WriteString(base)
	return out.String()
}

// canonicalBase resolves the key itself, keeping the case of a lone capital
// letter only when no case-erasing modifier is present.
func canonicalBase(token string, fold bool) string {
	if !fold && isCapitalLetter(token) {
		return token
	}
	return canonical(strings.ToLower(token))
}

func isCapitalLetter(token string) bool {
	return len(token) == 1 && token[0] >= 'A' && token[0] <= 'Z'
}

// canonical lowercases a token and resolves its aliases.
func canonical(token string) string {
	lower := strings.ToLower(token)
	if alias, ok := keyAliases[lower]; ok {
		return alias
	}
	return lower
}

// NormalizeAll canonicalises a chord, dropping empty steps.
func NormalizeAll(keys []string) []string {
	out := make([]string, 0, len(keys))
	for _, k := range keys {
		if n := Normalize(k); n != "" {
			out = append(out, n)
		}
	}
	return out
}
