#!/usr/bin/env python3
"""Alarm toast that floats in the center of the screen without stealing focus.

Usage: overlay.py MESSAGE [--meta TEXT] [--snooze SECONDS]
Exits 0 when dismissed and 3 when snoozed, printing the chosen snooze seconds.
"""

import argparse
import math
import re
import signal
import sys
import time

import cairo
import gi

gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
from gi.repository import Gdk, GLib, Gtk  # noqa: E402

try:
    gi.require_version("GLibUnix", "2.0")
    from gi.repository import GLibUnix  # noqa: E402

    add_signal = GLibUnix.signal_add
except (ValueError, ImportError):
    add_signal = GLib.unix_signal_add

try:
    gi.require_version("GtkLayerShell", "0.1")
    from gi.repository import GtkLayerShell  # noqa: E402
except (ValueError, ImportError):
    GtkLayerShell = None

EXIT_DISMISS = 0
EXIT_SNOOZE = 3

TOKENS = {
    "bg": "#0a0a0a",
    "surface": "#111111",
    "fg": "#ededed",
    "muted": "#8a8a8a",
    "line": "#262626",
    "accent": "#fe5101",
}

CARD_WIDTH = 760
SHADOW_PAD = 56
ENTER_OFFSET = 12
ENTER_MS = 180
EXIT_MS = 150
CORNER_MARK = 13
UNITS = {
    "": 60,
    **dict.fromkeys(("s", "sec", "secs", "second", "seconds"), 1),
    **dict.fromkeys(("m", "min", "mins", "minute", "minutes"), 60),
    **dict.fromkeys(("h", "hr", "hrs", "hour", "hours"), 3600),
}
# A number with an optional unit word, e.g. "90s", "10min", "1.5m", ".5h".
DURATION_PART = re.compile(r"(\d+(?:\.\d*)?|\.\d+)([a-z]*)")
HINT_IDLE = "Press any key for shortcuts"
HINT_ARMED = "Type 90s or 1,5m · Enter snooze · Esc dismiss"

CSS = """
window {{ background-color: transparent; }}

#card {{
    background-color: {surface};
    border: 1px solid {line};
    border-left: 6px solid {accent};
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}}

#head {{
    background-image: radial-gradient(circle, {line} 2px, transparent 3px);
    background-size: 32px 32px;
    border-radius: 0 15px 0 0;
    padding: 20px 28px;
}}

#body {{ padding: 28px 28px 32px 28px; }}
#foot {{ padding: 20px 28px; }}

.divider {{
    border-top: 1px dashed {line};
    min-height: 0;
}}

#pill {{
    border: 1px solid {line};
    border-radius: 999px;
    background-color: {surface};
    padding: 4px 16px 4px 12px;
}}

.caps {{
    font-family: "Geist Mono", monospace;
    font-weight: 500;
    font-size: 20px;
    letter-spacing: 0.4px;
    color: {muted};
}}

#pill-label {{ color: {fg}; }}

#hint {{ color: {accent}; }}

#resolved {{ min-width: 160px; }}
#resolved.invalid {{ color: #e5484d; }}

entry {{
    font-family: "Geist Mono", monospace;
    font-weight: 500;
    font-size: 22px;
    min-height: 56px;
    min-width: 160px;
    padding: 0 20px;
    border-radius: 12px;
    border: 1px solid {line};
    background-color: {bg};
    background-image: none;
    box-shadow: none;
    color: {fg};
    caret-color: {accent};
}}

entry:focus {{ border-color: {accent}; }}
entry.invalid {{ border-color: #e5484d; }}
entry selection {{ background-color: alpha({accent}, 0.35); color: {fg}; }}

#title {{
    font-family: "Geist", sans-serif;
    font-weight: 500;
    font-size: 30px;
    color: {fg};
}}

button {{
    font-family: "Geist Mono", monospace;
    font-weight: 500;
    font-size: 22px;
    letter-spacing: 0.4px;
    min-height: 56px;
    padding: 0 24px;
    border-radius: 12px;
    background-image: none;
    box-shadow: none;
    text-shadow: none;
    -gtk-icon-shadow: none;
    outline: none;
    transition: background-color 150ms cubic-bezier(0.23, 1, 0.32, 1),
                color 150ms cubic-bezier(0.23, 1, 0.32, 1),
                border-color 150ms cubic-bezier(0.23, 1, 0.32, 1);
}}

button label {{ color: inherit; }}

button.outline {{
    background-color: {surface};
    border: 1px solid {line};
    color: {muted};
}}

button.outline:hover {{
    background-color: alpha({fg}, 0.07);
    color: {fg};
}}

button.outline:disabled {{
    color: alpha({muted}, 0.35);
}}

button.primary {{
    background-color: {fg};
    border: 1px solid {fg};
    color: {bg};
}}

button.primary:hover {{
    background-color: {accent};
    border-color: {accent};
    color: #ffffff;
}}
""".format(**TOKENS)


def rgba(hex_color, alpha=1.0):
    value = hex_color.lstrip("#")
    return tuple(int(value[i : i + 2], 16) / 255 for i in (0, 2, 4)) + (alpha,)


def ease_out(t):
    return 1 - (1 - t) ** 4


def ease_in(t):
    return t**3


def caps(text, name=None):
    label = Gtk.Label(label=text.upper(), xalign=0)
    label.get_style_context().add_class("caps")
    if name:
        label.set_name(name)
    return label


def divider():
    line = Gtk.Box()
    line.get_style_context().add_class("divider")
    return line


def live_dot():
    area = Gtk.DrawingArea()
    area.set_size_request(24, 24)
    area.set_valign(Gtk.Align.CENTER)
    started = time.monotonic()

    def draw(widget, cr):
        phase = (time.monotonic() - started) % 1.0
        alpha = 0.3 + 0.7 * (0.5 + 0.5 * math.cos(phase * 2 * math.pi))
        cx = widget.get_allocated_width() / 2
        cy = widget.get_allocated_height() / 2
        cr.set_source_rgba(*rgba(TOKENS["accent"], 0.25 * alpha))
        cr.arc(cx, cy, 12, 0, 2 * math.pi)
        cr.fill()
        cr.set_source_rgba(*rgba(TOKENS["accent"], alpha))
        cr.arc(cx, cy, 6, 0, 2 * math.pi)
        cr.fill()

    area.connect("draw", draw)
    area.add_tick_callback(lambda widget, _clock: widget.queue_draw() or True)
    return area


def duration_text(seconds):
    minutes, rest = divmod(seconds, 60)
    parts = []
    if minutes:
        parts.append("{}M".format(minutes))
    if rest or not parts:
        parts.append("{}S".format(rest))
    return " ".join(parts)


def default_entry(seconds):
    return "{}m".format(seconds // 60) if seconds % 60 == 0 else "{}s".format(seconds)


def parse_duration(text):
    text = re.sub(r"\s+", "", text.lower()).replace(",", ".")
    parts = DURATION_PART.findall(text)
    if not parts or DURATION_PART.sub("", text):
        return None
    total = 0.0
    for number, unit in parts:
        if unit not in UNITS:
            return None
        total += float(number) * UNITS[unit]
    return round(total) if total >= 1 else None


def build_card(message, meta, snooze_seconds, on_close, on_snooze):
    card = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
    card.set_name("card")
    card.set_size_request(CARD_WIDTH, -1)

    head = Gtk.Box(spacing=16)
    head.set_name("head")
    pill = Gtk.Box(spacing=10)
    pill.set_name("pill")
    pill.pack_start(live_dot(), False, False, 0)
    pill.pack_start(caps("Alarm", "pill-label"), False, False, 0)
    head.pack_start(pill, False, False, 0)
    elapsed = caps("Ringing 0:00")
    head.pack_end(elapsed, False, False, 0)

    started = time.monotonic()

    def tick():
        seconds = int(time.monotonic() - started)
        elapsed.set_text("RINGING {}:{:02d}".format(seconds // 60, seconds % 60))
        return True

    GLib.timeout_add(500, tick)

    body = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12)
    body.set_name("body")
    title = Gtk.Label(label=message, xalign=0)
    title.set_name("title")
    title.set_line_wrap(True)
    title.set_max_width_chars(36)
    body.pack_start(title, False, False, 0)
    if meta:
        body.pack_start(caps(meta), False, False, 0)
    hint = caps(HINT_IDLE, "hint")
    body.pack_start(hint, False, False, 0)

    foot = Gtk.Box(spacing=16)
    foot.set_name("foot")
    dismiss = Gtk.Button(label="DISMISS")
    dismiss.set_can_focus(False)
    dismiss.get_style_context().add_class("primary")
    dismiss.connect("clicked", lambda *_: on_close(EXIT_DISMISS))
    foot.pack_end(dismiss, False, False, 0)

    entry = Gtk.Entry()
    entry.set_width_chars(6)
    entry.set_text(default_entry(snooze_seconds or 300))
    snooze = Gtk.Button(label="SNOOZE")
    snooze.set_can_focus(False)
    snooze.get_style_context().add_class("outline")
    resolved = caps("", "resolved")
    if snooze_seconds > 0:
        for widget in (entry, snooze, resolved):
            foot.pack_start(widget, False, False, 0)

    def refresh(*_):
        seconds = parse_duration(entry.get_text())
        valid = seconds is not None
        for widget in (entry, resolved):
            context = widget.get_style_context()
            (context.remove_class if valid else context.add_class)("invalid")
        resolved.set_text("= " + duration_text(seconds) if valid else "INVALID")
        snooze.set_sensitive(valid)

    def apply_entry(*_):
        seconds = parse_duration(entry.get_text())
        if seconds is not None:
            on_snooze(seconds)

    entry.connect("changed", refresh)
    entry.connect("activate", apply_entry)
    snooze.connect("clicked", apply_entry)
    refresh()
    keys = {"armed": False}

    def arm():
        if keys["armed"]:
            return
        keys["armed"] = True
        hint.set_text(HINT_ARMED.upper())
        if snooze_seconds > 0:
            entry.grab_focus()

    entry.connect("focus-in-event", lambda *_: arm() and False)

    def handle_key(_window, event):
        name = Gdk.keyval_name(event.keyval) or ""
        if not keys["armed"]:
            arm()
            return True
        if name == "Escape":
            on_close(EXIT_DISMISS)
            return True
        if snooze_seconds <= 0 and name in ("Return", "KP_Enter"):
            on_close(EXIT_DISMISS)
            return True
        return False

    dividers = [divider(), divider()]
    for child in (head, dividers[0], body, dividers[1], foot):
        card.pack_start(child, False, False, 0)

    def draw_corner_marks(widget, cr):
        width = widget.get_allocated_width()
        for line in dividers:
            y = line.translate_coordinates(widget, 0, 0)[1]
            for x in (3, width - 0.5):
                cr.rectangle(
                    round(x - CORNER_MARK / 2) + 0.5,
                    round(y - CORNER_MARK / 2) + 0.5,
                    CORNER_MARK - 1,
                    CORNER_MARK - 1,
                )
                cr.set_source_rgba(*rgba(TOKENS["bg"]))
                cr.fill_preserve()
                cr.set_source_rgba(*rgba(TOKENS["line"]))
                cr.set_line_width(1)
                cr.stroke()

    card.connect_after("draw", draw_corner_marks)
    return card, handle_key


def load_css():
    provider = Gtk.CssProvider()
    provider.load_from_data(CSS.encode())
    Gtk.StyleContext.add_provider_for_screen(
        Gdk.Screen.get_default(), provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
    )


def build_window(card):
    window = Gtk.Window(type=Gtk.WindowType.TOPLEVEL)
    window.set_decorated(False)
    window.set_skip_taskbar_hint(True)
    window.set_skip_pager_hint(True)
    window.set_keep_above(True)
    window.stick()
    window.set_type_hint(Gdk.WindowTypeHint.NOTIFICATION)
    window.set_app_paintable(True)
    visual = window.get_screen().get_rgba_visual()
    if visual is not None:
        window.set_visual(visual)

    card.set_margin_start(SHADOW_PAD)
    card.set_margin_end(SHADOW_PAD)
    card.set_margin_bottom(SHADOW_PAD + ENTER_OFFSET)
    card.set_margin_top(ENTER_OFFSET)
    window.add(card)

    if GtkLayerShell is not None and GtkLayerShell.is_supported():
        GtkLayerShell.init_for_window(window)
        GtkLayerShell.set_namespace(window, "alarm")
        GtkLayerShell.set_layer(window, GtkLayerShell.Layer.OVERLAY)
        GtkLayerShell.set_keyboard_mode(window, GtkLayerShell.KeyboardMode.EXCLUSIVE)
    else:
        def grab(*_):
            seat = Gdk.Display.get_default().get_default_seat()
            seat.grab(window.get_window(), Gdk.SeatCapabilities.KEYBOARD, False, None, None, None)

        window.connect("map-event", grab)

        def place(*_):
            display = Gdk.Display.get_default()
            monitor = display.get_primary_monitor() or display.get_monitor(0)
            geometry = monitor.get_geometry()
            width, height = window.get_size()
            window.move(
                geometry.x + (geometry.width - width) // 2,
                geometry.y + (geometry.height - height) // 2,
            )

        window.connect("size-allocate", place)

    def clip_input(*_):
        allocation = card.get_allocation()
        rect = cairo.RectangleInt(allocation.x, allocation.y, allocation.width, allocation.height)
        gdk_window = window.get_window()
        if gdk_window is not None:
            gdk_window.input_shape_combine_region(cairo.Region(rect), 0, 0)

    card.connect("size-allocate", clip_input)
    return window


def animate(card, duration_ms, easing, forward, done=None):
    started = time.monotonic()

    def step(*_):
        t = min(1.0, (time.monotonic() - started) * 1000 / duration_ms)
        progress = easing(t) if forward else 1 - easing(t)
        offset = round(ENTER_OFFSET * (1 - progress))
        card.set_opacity(progress)
        card.set_margin_top(offset)
        card.set_margin_bottom(SHADOW_PAD + ENTER_OFFSET - offset)
        if t >= 1.0:
            if done:
                done()
            return False
        return True

    GLib.timeout_add(8, step)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("message", nargs="?", default="Timer finished")
    parser.add_argument("--meta", default="")
    parser.add_argument("--snooze", type=int, default=0)
    args = parser.parse_args()

    load_css()
    state = {"code": EXIT_DISMISS, "closing": False}

    def close(code):
        if state["closing"]:
            return True
        state["closing"] = True
        state["code"] = code
        animate(card, EXIT_MS, ease_in, False, Gtk.main_quit)
        return True

    def snooze(seconds):
        if not state["closing"]:
            print(seconds, flush=True)
        return close(EXIT_SNOOZE)

    card, handle_key = build_card(
        args.message.replace("\\n", "\n"), args.meta, args.snooze, close, snooze
    )
    card.set_opacity(0)
    window = build_window(card)
    window.connect("key-press-event", handle_key)
    window.connect("delete-event", lambda *_: close(EXIT_DISMISS))

    add_signal(GLib.PRIORITY_DEFAULT, signal.SIGTERM, lambda: close(EXIT_DISMISS))
    add_signal(GLib.PRIORITY_DEFAULT, signal.SIGINT, lambda: close(EXIT_DISMISS))

    window.show_all()
    animate(card, ENTER_MS, ease_out, True)
    Gtk.main()
    sys.exit(state["code"])


if __name__ == "__main__":
    main()
