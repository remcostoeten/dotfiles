#!/usr/bin/env python3
"""Background alarm with a tray icon that outlives the terminal that started it.

Usage: daemon.py --end EPOCH --label TEXT [--popup TEXT] [--snooze SECONDS] --state-dir DIR
Writes DIR/<pid>.state as key=value lines for viewers. SIGTERM cancels,
SIGUSR1 dismisses a ringing alarm and SIGUSR2 snoozes it.
"""

import argparse
import math
import os
import shutil
import signal
import subprocess
import time

import cairo
import gi

gi.require_version("Gtk", "3.0")
from gi.repository import GLib, Gtk  # noqa: E402

try:
    gi.require_version("GLibUnix", "2.0")
    from gi.repository import GLibUnix  # noqa: E402

    add_signal = GLibUnix.signal_add
except (ValueError, ImportError):
    add_signal = GLib.unix_signal_add

try:
    gi.require_version("AyatanaAppIndicator3", "0.1")
    from gi.repository import AyatanaAppIndicator3 as Indicator  # noqa: E402
except (ValueError, ImportError):
    try:
        gi.require_version("AppIndicator3", "0.1")
        from gi.repository import AppIndicator3 as Indicator  # noqa: E402
    except (ValueError, ImportError):
        Indicator = None

HERE = os.path.dirname(os.path.realpath(__file__))
OVERLAY = os.path.join(HERE, "overlay.py")
SOUNDS = (
    os.path.expanduser("~/Audio/alarm.mp3"),
    os.path.expanduser("~/Music/alarm.mp3"),
    os.path.join(HERE, "alarm.oga"),
    "/usr/share/sounds/freedesktop/stereo/alarm-clock-elapsed.oga",
)
RING_LIMIT = 120
ICON_SIZE = 64
ACCENT = (254 / 255, 81 / 255, 1 / 255)
TRACK = (0.33, 0.33, 0.33)
TEXT = (0.93, 0.93, 0.93)


def clock_text(seconds):
    hours, rest = divmod(max(0, seconds), 3600)
    minutes, secs = divmod(rest, 60)
    if hours:
        return "{}:{:02d}:{:02d}".format(hours, minutes, secs)
    return "{:02d}:{:02d}".format(minutes, secs)


def short_text(seconds):
    if seconds >= 3600:
        return "{}h".format(math.ceil(seconds / 3600))
    if seconds >= 600:
        return str(math.ceil(seconds / 60))
    minutes, secs = divmod(max(0, seconds), 60)
    return "{}:{:02d}".format(minutes, secs)


def duration_text(seconds):
    minutes, secs = divmod(seconds, 60)
    if minutes and secs:
        return "{}m{}s".format(minutes, secs)
    return "{}m".format(minutes) if minutes else "{}s".format(secs)


def stop_process(process):
    if process.poll() is None:
        process.terminate()
    try:
        process.wait(timeout=1)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()


def draw_icon(path, progress, text, ringing, pulse):
    surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, ICON_SIZE, ICON_SIZE)
    cr = cairo.Context(surface)
    center = ICON_SIZE / 2
    radius = center - 5

    if ringing:
        cr.set_source_rgba(*ACCENT, 1.0 if pulse else 0.55)
        cr.arc(center, center, radius + 3, 0, 2 * math.pi)
        cr.fill()
    else:
        cr.set_line_width(6)
        cr.set_source_rgb(*TRACK)
        cr.arc(center, center, radius, 0, 2 * math.pi)
        cr.stroke()
        if progress > 0:
            cr.set_source_rgb(*ACCENT)
            start = -math.pi / 2
            cr.arc(center, center, radius, start, start + 2 * math.pi * min(1.0, progress))
            cr.stroke()

    cr.select_font_face("Geist Mono", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
    cr.set_font_size({1: 34, 2: 30, 3: 22}.get(len(text), 17))
    extents = cr.text_extents(text)
    cr.set_source_rgb(*TEXT)
    cr.move_to(center - extents.width / 2 - extents.x_bearing, center - extents.height / 2 - extents.y_bearing)
    cr.show_text(text)
    surface.write_to_png(path)


class Alarm:
    def __init__(self, args):
        self.label = args.label
        self.popup = args.popup or args.label
        self.snooze = args.snooze
        self.start = int(time.time())
        self.end = args.end
        self.phase = "waiting"
        self.rang_at = ""
        self.ring_started = 0.0
        self.sound = None
        self.overlay = None
        self.icon_key = None
        self.icon_serial = 0
        self.icon_path = None
        self.state_path = os.path.join(args.state_dir, "{}.state".format(os.getpid()))
        self.icon_dir = os.path.join(args.state_dir, "icons-{}".format(os.getpid()))
        os.makedirs(self.icon_dir, exist_ok=True)
        self.indicator = None
        self.build_tray()
        self.write_state()
        GLib.timeout_add(250, self.tick)
        self.tick()

    def build_tray(self):
        if Indicator is None:
            return
        self.indicator = Indicator.Indicator.new(
            "current-time-alarm-{}".format(os.getpid()),
            "alarm-clock",
            Indicator.IndicatorCategory.APPLICATION_STATUS,
        )
        self.indicator.set_status(Indicator.IndicatorStatus.ACTIVE)
        menu = Gtk.Menu()
        self.title_item = Gtk.MenuItem(label=self.label)
        self.title_item.set_sensitive(False)
        self.left_item = Gtk.MenuItem(label="")
        self.left_item.set_sensitive(False)
        self.snooze_item = Gtk.MenuItem(label="Snooze {}".format(duration_text(self.snooze)))
        self.snooze_item.connect("activate", lambda *_: self.snooze_now(self.snooze))
        self.stop_item = Gtk.MenuItem(label="Cancel alarm")
        self.stop_item.connect("activate", lambda *_: self.finish("cancelled"))
        for item in (self.title_item, self.left_item, Gtk.SeparatorMenuItem(), self.snooze_item, self.stop_item):
            menu.append(item)
        menu.show_all()
        self.snooze_item.hide()
        self.indicator.set_menu(menu)

    def at_text(self):
        return time.strftime("%H:%M", time.localtime(self.end))

    def write_state(self, reason=""):
        lines = {
            "pid": os.getpid(),
            "phase": self.phase,
            "label": self.label,
            "start": self.start,
            "end": self.end,
            "snooze": self.snooze,
            "reason": reason,
        }
        temp = self.state_path + ".tmp"
        with open(temp, "w") as handle:
            for key, value in lines.items():
                handle.write("{}={}\n".format(key, str(value).replace("\n", " ")))
        os.replace(temp, self.state_path)

    def set_icon(self, progress, text, ringing, pulse=False):
        key = (round(progress, 2), text, ringing, pulse)
        if self.indicator is None or key == self.icon_key:
            return
        self.icon_key = key
        self.icon_serial += 1
        # Plasma caches tray icons by path, so every frame needs a fresh file name
        path = os.path.join(self.icon_dir, "icon-{}.png".format(self.icon_serial))
        draw_icon(path, progress, text, ringing, pulse)
        self.indicator.set_icon_full(path, text)
        if self.icon_path is not None:
            GLib.timeout_add(2000, self.remove_icon, self.icon_path)
        self.icon_path = path

    def remove_icon(self, path):
        if os.path.exists(path):
            os.remove(path)
        return False

    def tick(self):
        now = time.time()
        if self.phase == "waiting":
            left = int(math.ceil(self.end - now))
            if left <= 0:
                self.ring()
                return True
            total = max(1, self.end - self.start)
            self.set_icon((total - left) / total, short_text(left), False)
            if self.indicator is not None:
                self.indicator.set_title("{} · {} left".format(self.label, clock_text(left)))
                self.title_item.set_label("{} · rings at {}".format(self.label, self.at_text()))
                self.left_item.set_label("{} left".format(clock_text(left)))
        elif self.phase == "ringing":
            elapsed = now - self.ring_started
            self.set_icon(1, "!", True, int(elapsed * 2) % 2 == 0)
            self.keep_sound()
            self.check_overlay()
            if self.phase == "ringing" and elapsed >= RING_LIMIT:
                self.finish("timeout")
        return True

    def ring(self):
        self.phase = "ringing"
        self.ring_started = time.time()
        self.rang_at = time.strftime("%H:%M · %a %-d %b")
        if self.indicator is not None:
            self.indicator.set_status(Indicator.IndicatorStatus.ATTENTION)
            self.indicator.set_title("{} · ringing".format(self.label))
            self.left_item.set_label("Rang at {}".format(self.rang_at))
            self.snooze_item.show()
            self.stop_item.set_label("Stop alarm")
        self.start_sound()
        self.start_overlay()
        self.write_state()

    def start_sound(self):
        sound = next((path for path in SOUNDS if os.path.isfile(path)), None)
        if sound is None:
            return
        if shutil.which("mpv"):
            command = ["mpv", "--no-terminal", "--really-quiet", "--loop=inf", sound]
        else:
            player = shutil.which("pw-play") or shutil.which("paplay")
            if player is None:
                return
            command = [player, sound]
        self.sound = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.sound_command = command

    def keep_sound(self):
        if self.sound is not None and self.sound.poll() is not None:
            self.sound = subprocess.Popen(
                self.sound_command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            )

    def stop_sound(self):
        if self.sound is not None:
            stop_process(self.sound)
            self.sound = None

    def start_overlay(self):
        if not os.path.isfile(OVERLAY):
            if shutil.which("notify-send"):
                subprocess.Popen(["notify-send", "-u", "critical", "-a", "Alarm", "Alarm", self.popup])
            return
        self.overlay = subprocess.Popen(
            ["python3", OVERLAY, self.popup, "--meta", "Rang at " + self.rang_at, "--snooze", str(self.snooze)],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
        )

    def stop_overlay(self):
        if self.overlay is not None:
            stop_process(self.overlay)
        self.overlay = None

    def check_overlay(self):
        if self.overlay is None or self.overlay.poll() is None:
            return
        code = self.overlay.returncode
        output = self.overlay.stdout.read().strip()
        self.overlay = None
        if code == 3:
            seconds = int(output) if output.isdigit() and int(output) > 0 else self.snooze
            self.snooze_now(seconds)
        else:
            self.finish("dismissed")

    def snooze_now(self, seconds):
        if self.phase != "ringing":
            return
        self.stop_sound()
        self.stop_overlay()
        self.snooze = seconds
        self.start = int(time.time())
        self.end = self.start + seconds
        self.phase = "waiting"
        if self.indicator is not None:
            self.indicator.set_status(Indicator.IndicatorStatus.ACTIVE)
            self.snooze_item.set_label("Snooze {}".format(duration_text(self.snooze)))
            self.snooze_item.hide()
            self.stop_item.set_label("Cancel alarm")
        self.write_state()
        self.tick()

    def finish(self, reason):
        if self.phase == "ended":
            return True
        self.phase = "ended"
        self.stop_sound()
        self.stop_overlay()
        if self.indicator is not None:
            self.indicator.set_status(Indicator.IndicatorStatus.PASSIVE)
        self.write_state(reason)
        GLib.timeout_add(2000, self.quit)
        return True

    def quit(self):
        for path in (self.state_path, self.state_path + ".tmp"):
            if os.path.exists(path):
                os.remove(path)
        shutil.rmtree(self.icon_dir, ignore_errors=True)
        Gtk.main_quit()
        return False

    def on_term(self):
        return self.finish("cancelled")

    def on_dismiss(self):
        if self.phase == "ringing":
            return self.finish("dismissed")
        return True

    def on_snooze(self):
        self.snooze_now(self.snooze)
        return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--end", type=int, required=True)
    parser.add_argument("--label", default="Alarm")
    parser.add_argument("--popup", default="")
    parser.add_argument("--snooze", type=int, default=300)
    parser.add_argument("--state-dir", required=True)
    args = parser.parse_args()

    os.makedirs(args.state_dir, exist_ok=True)
    alarm = Alarm(args)
    add_signal(GLib.PRIORITY_DEFAULT, signal.SIGTERM, alarm.on_term)
    add_signal(GLib.PRIORITY_DEFAULT, signal.SIGINT, alarm.on_term)
    add_signal(GLib.PRIORITY_DEFAULT, signal.SIGHUP, lambda: True)
    add_signal(GLib.PRIORITY_DEFAULT, signal.SIGUSR1, alarm.on_dismiss)
    add_signal(GLib.PRIORITY_DEFAULT, signal.SIGUSR2, alarm.on_snooze)
    Gtk.main()


if __name__ == "__main__":
    main()
