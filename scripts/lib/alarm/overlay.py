#!/usr/bin/env python3
"""Small, non-intrusive alarm toast for X11/Wayland desktops.

Floats a compact rounded card top-center on the primary monitor. Never
steals window focus or keyboard focus — you keep working in whatever
window you're in. Dismiss by clicking it, or externally via `stop_alarm`
(SIGTERM).

Usage: overlay.py [MESSAGE]
Exit code 0 once dismissed. Writes nothing to stdout.
"""

import signal
import sys

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
from gi.repository import Gdk, GLib, Gtk  # noqa: E402

BG_COLOR = "#14161c"
BORDER_COLOR = "#30333d"
ACCENT_COLOR = "#ff5c5c"
ACCENT_DIM = "#7a2e2e"
TEXT_COLOR = "#f5f5f7"
SUBTEXT_COLOR = "#9a9ba3"
PULSE_INTERVAL_MS = 900
PULSE_STEPS = 30
CARD_WIDTH = 360
CARD_MARGIN_TOP = 28

CSS = """
#alarm-card {{
    background-color: {bg};
    border: 1px solid {border};
    border-radius: 16px;
}}
#alarm-icon {{
    background-color: alpha({accent}, 0.12);
    border-radius: 999px;
    min-width: 40px;
    min-height: 40px;
}}
""".format(bg=BG_COLOR, border=BORDER_COLOR, accent=ACCENT_COLOR)


def lerp_hex(c1, c2, t):
    a = Gdk.RGBA()
    a.parse(c1)
    b = Gdk.RGBA()
    b.parse(c2)
    r = a.red + (b.red - a.red) * t
    g = a.green + (b.green - a.green) * t
    bl = a.blue + (b.blue - a.blue) * t
    return "#{:02x}{:02x}{:02x}".format(int(r * 255), int(g * 255), int(bl * 255))


def build_window(monitor_geometry, message, on_dismiss, bell_ref):
    window = Gtk.Window(type=Gtk.WindowType.TOPLEVEL)
    window.set_decorated(False)
    window.set_skip_taskbar_hint(True)
    window.set_skip_pager_hint(True)
    window.set_keep_above(True)
    window.set_accept_focus(False)
    window.set_focus_on_map(False)
    window.set_can_focus(False)
    window.set_type_hint(Gdk.WindowTypeHint.NOTIFICATION)
    window.stick()

    screen = window.get_screen()
    visual = screen.get_rgba_visual()
    if visual is not None:
        window.set_visual(visual)
    window.set_app_paintable(True)

    card = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=14)
    card.set_name("alarm-card")
    card.set_border_width(16)

    icon_wrap = Gtk.Box()
    icon_wrap.set_name("alarm-icon")
    icon_wrap.set_halign(Gtk.Align.CENTER)
    icon_wrap.set_valign(Gtk.Align.CENTER)

    bell = Gtk.Label()
    bell.set_markup('<span font="20" foreground="{}">\U0001f514</span>'.format(ACCENT_COLOR))
    icon_wrap.pack_start(bell, True, True, 0)
    bell_ref["widgets"] = bell_ref.get("widgets", [])
    bell_ref["widgets"].append(bell)

    text_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=3)
    title = Gtk.Label(xalign=0)
    title.set_markup('<span font="14" weight="bold" foreground="{}">Alarm</span>'.format(TEXT_COLOR))
    subtitle = Gtk.Label(xalign=0)
    subtitle.set_line_wrap(True)
    subtitle.set_max_width_chars(34)
    subtitle.set_markup(
        '<span font="11" foreground="{}">{}</span>'.format(
            SUBTEXT_COLOR, GLib.markup_escape_text(message)
        )
    )
    hint = Gtk.Label(xalign=0)
    hint.set_markup('<span font="9" foreground="{}">click to dismiss</span>'.format(SUBTEXT_COLOR))

    text_box.pack_start(title, False, False, 0)
    text_box.pack_start(subtitle, False, False, 0)
    text_box.pack_start(hint, False, False, 4)

    card.pack_start(icon_wrap, False, False, 0)
    card.pack_start(text_box, True, True, 0)

    window.add(card)

    provider = Gtk.CssProvider()
    provider.load_from_data(CSS.encode())
    card.get_style_context().add_provider(provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)
    icon_wrap.get_style_context().add_provider(provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)

    window.set_default_size(CARD_WIDTH, -1)

    def place(*_):
        width, _height = window.get_size()
        x = monitor_geometry.x + (monitor_geometry.width - width) // 2
        y = monitor_geometry.y + CARD_MARGIN_TOP
        window.move(x, y)

    window.connect("size-allocate", place)

    window.set_events(Gdk.EventMask.BUTTON_PRESS_MASK)
    window.connect("button-press-event", lambda *_: on_dismiss())
    window.connect("delete-event", lambda *_: on_dismiss())
    window.set_opacity(0)

    return window


def main():
    message = sys.argv[1] if len(sys.argv) > 1 else "Timer finished"
    message = message.replace("\\n", "\n")

    dismissed = {"done": False}
    bell_ref = {}

    def on_dismiss(*_):
        if not dismissed["done"]:
            dismissed["done"] = True
            Gtk.main_quit()
        return True

    display = Gdk.Display.get_default()
    geometry = display.get_primary_monitor().get_geometry() if display.get_primary_monitor() else display.get_monitor(0).get_geometry()

    window = build_window(geometry, message, on_dismiss, bell_ref)

    state = {"step": 0, "rising": True}

    def breathe():
        t = state["step"] / PULSE_STEPS
        hex_color = lerp_hex(ACCENT_DIM, ACCENT_COLOR, t)
        for bell in bell_ref.get("widgets", []):
            bell.set_markup('<span font="26" foreground="{}">\U0001f514</span>'.format(hex_color))

        if state["rising"]:
            state["step"] += 1
            if state["step"] >= PULSE_STEPS:
                state["rising"] = False
        else:
            state["step"] -= 1
            if state["step"] <= 0:
                state["rising"] = True
        return True

    breathe_interval = max(1, PULSE_INTERVAL_MS // PULSE_STEPS)
    GLib.timeout_add(breathe_interval, breathe)

    def fade_in(step={"n": 0}):
        step["n"] += 1
        window.set_opacity(min(1.0, step["n"] / 10))
        return step["n"] < 10

    window.show_all()
    GLib.timeout_add(16, fade_in)

    GLib.unix_signal_add(GLib.PRIORITY_DEFAULT, signal.SIGTERM, on_dismiss)
    GLib.unix_signal_add(GLib.PRIORITY_DEFAULT, signal.SIGINT, on_dismiss)

    Gtk.main()


if __name__ == "__main__":
    main()
