"""StatusNotifierItem tray icon plus com.canonical.dbusmenu menu for phonedrop.

Works with Plasma, waybar and other SNI hosts on top of phonedrop_dbus.
"""
import os
import struct
import threading
import zlib
from collections.abc import Callable

from phonedrop_dbus import BUS, CALL, SIGNAL, Bus, Message

WATCHER = ("org.kde.StatusNotifierWatcher", "/StatusNotifierWatcher", "org.kde.StatusNotifierWatcher")
ITEM_PATH, MENU_PATH = "/StatusNotifierItem", "/MenuBar"
SNI, MENU, PROPS = "org.kde.StatusNotifierItem", "com.canonical.dbusmenu", "org.freedesktop.DBus.Properties"
LAYOUT = "(ia{sv}av)"
PIXMAPS = "a(iiay)"


def read_png(path: str) -> tuple[int, int, bytes]:
    """Decode an 8-bit RGBA non-interlaced PNG into (width, height, rgba bytes)."""
    data = open(path, "rb").read()
    cursor, idat, width, height = 8, bytearray(), 0, 0
    while cursor < len(data):
        (size,) = struct.unpack_from(">I", data, cursor)
        kind = data[cursor + 4:cursor + 8]
        chunk = data[cursor + 8:cursor + 8 + size]
        if kind == b"IHDR":
            width, height, depth, color, _, _, interlace = struct.unpack(">IIBBBBB", chunk)
            if (depth, color, interlace) != (8, 6, 0):
                raise ValueError("tray icon must be 8-bit RGBA, non-interlaced")
        elif kind == b"IDAT":
            idat.extend(chunk)
        cursor += size + 12
    raw = zlib.decompress(bytes(idat))
    stride = width * 4
    pixels = bytearray(height * stride)
    for row in range(height):
        kind = raw[row * (stride + 1)]
        line = raw[row * (stride + 1) + 1:(row + 1) * (stride + 1)]
        out = row * stride
        for i in range(stride):
            left = pixels[out + i - 4] if i >= 4 else 0
            up = pixels[out + i - stride] if row else 0
            corner = pixels[out + i - stride - 4] if row and i >= 4 else 0
            if kind == 1:
                base = left
            elif kind == 2:
                base = up
            elif kind == 3:
                base = (left + up) // 2
            elif kind == 4:
                guess = left + up - corner
                pa, pb, pc = abs(guess - left), abs(guess - up), abs(guess - corner)
                base = left if pa <= pb and pa <= pc else up if pb <= pc else corner
            else:
                base = 0
            pixels[out + i] = (line[i] + base) & 0xFF
    return width, height, bytes(pixels)


def to_argb(width: int, rgba: bytes) -> bytes:
    argb = bytearray(len(rgba))
    argb[0::4], argb[1::4], argb[2::4], argb[3::4] = rgba[3::4], rgba[0::4], rgba[1::4], rgba[2::4]
    return bytes(argb)


def with_dot(width: int, height: int, rgba: bytes, color: tuple[int, int, int]) -> bytes:
    """Stamp a status dot with a dark ring into the bottom-right corner."""
    pixels = bytearray(rgba)
    radius = width * 0.2
    ring = radius + width * 0.06
    cx, cy = width - ring, height - ring
    for y in range(height):
        for x in range(width):
            distance = ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) ** 0.5
            if distance > ring:
                continue
            fill = color if distance <= radius else (10, 10, 10)
            pixels[(y * width + x) * 4:(y * width + x) * 4 + 4] = bytes((*fill, 255))
    return bytes(pixels)


class MenuItem:
    __slots__ = ("label", "action", "separator")

    def __init__(self, label: str = "", action: Callable[[], None] | None = None, separator: bool = False):
        self.label = label
        self.action = action
        self.separator = separator


class Tray:
    """A StatusNotifierItem whose tooltip, dot and menu are rebuilt on refresh()."""

    def __init__(self, icon_path: str, title: str, describe: Callable[[], tuple[str, bool]],
                 menu: Callable[[], list[MenuItem]], activate: Callable[[], None]):
        self.title = title
        self.describe = describe
        self.menu = menu
        self.activate = activate
        width, height, rgba = read_png(icon_path)
        self.icons = {
            False: [(width, height, to_argb(width, rgba))],
            True: [(width, height, to_argb(width, with_dot(width, height, rgba, (254, 81, 1))))],
        }
        self.name = f"org.kde.StatusNotifierItem-{os.getpid()}-1"
        self.revision = 1
        self.items: list[MenuItem] = []
        self.bus: Bus | None = None

    def start(self, on_error: Callable[[Exception], None]) -> None:
        threading.Thread(target=self.run, args=(on_error,), name="tray", daemon=True).start()

    def run(self, on_error: Callable[[Exception], None]) -> None:
        try:
            self.serve()
        except (OSError, ConnectionError) as error:
            self.bus = None
            on_error(error)

    def serve(self) -> None:
        self.bus = Bus()
        self.bus.call(*BUS, "RequestName", "su", (self.name, 4))
        self.bus.call(*BUS, "AddMatch", "s", (
            "type='signal',sender='org.freedesktop.DBus',member='NameOwnerChanged',arg0='org.kde.StatusNotifierWatcher'",))
        self.register()
        while True:
            message = self.bus.receive()
            if message.kind == SIGNAL and message.member == "NameOwnerChanged":
                if message.args[2]:
                    self.register()
            elif message.kind == CALL:
                self.dispatch(message)

    def register(self) -> None:
        self.bus.call(*WATCHER, "RegisterStatusNotifierItem", "s", (self.name,))

    def refresh(self) -> None:
        if not self.bus:
            return
        self.revision += 1
        self.bus.signal(ITEM_PATH, SNI, "NewIcon")
        self.bus.signal(ITEM_PATH, SNI, "NewToolTip")
        self.bus.signal(MENU_PATH, MENU, "LayoutUpdated", "ui", (self.revision, 0))

    def item_properties(self) -> dict:
        text, live = self.describe()
        return {
            "Category": ("s", "Communications"),
            "Id": ("s", "phonedrop"),
            "Title": ("s", self.title),
            "Status": ("s", "Active"),
            "WindowId": ("i", 0),
            "IconName": ("s", ""),
            "IconThemePath": ("s", ""),
            "IconPixmap": (PIXMAPS, self.icons[live]),
            "OverlayIconName": ("s", ""),
            "OverlayIconPixmap": (PIXMAPS, []),
            "AttentionIconName": ("s", ""),
            "AttentionIconPixmap": (PIXMAPS, []),
            "AttentionMovieName": ("s", ""),
            "ToolTip": ("(sa(iiay)ss)", ("", [], self.title, text)),
            "ItemIsMenu": ("b", False),
            "Menu": ("o", MENU_PATH),
        }

    @staticmethod
    def menu_properties() -> dict:
        return {
            "Version": ("u", 3),
            "TextDirection": ("s", "ltr"),
            "Status": ("s", "normal"),
            "IconThemePath": ("as", []),
        }

    @staticmethod
    def entry_properties(item: MenuItem) -> dict:
        if item.separator:
            return {"type": ("s", "separator")}
        return {"label": ("s", item.label), "enabled": ("b", item.action is not None)}

    def layout(self) -> tuple:
        self.items = self.menu()
        children = [(LAYOUT, (index + 1, self.entry_properties(item), []))
                    for index, item in enumerate(self.items)]
        return 0, {"children-display": ("s", "submenu")}, children

    def dispatch(self, message: Message) -> None:
        path, iface, member = message.fields.get(1), message.fields.get(2), message.member
        try:
            if iface == PROPS:
                return self.properties(message, path, member)
            if iface == "org.freedesktop.DBus.Introspectable":
                return self.bus.reply(message, "s", ("<node><node name=\"StatusNotifierItem\"/><node name=\"MenuBar\"/></node>",))
            if iface == "org.freedesktop.DBus.Peer" and member == "Ping":
                return self.bus.reply(message)
            if path == ITEM_PATH:
                return self.item_call(message, member)
            if path == MENU_PATH:
                return self.menu_call(message, member)
            self.bus.error(message, "org.freedesktop.DBus.Error.UnknownObject", str(path))
        except (ValueError, IndexError, struct.error, UnicodeDecodeError) as error:
            self.bus.error(message, "org.freedesktop.DBus.Error.InvalidArgs", str(error))

    def properties(self, message: Message, path: str, member: str) -> None:
        props = self.item_properties() if path == ITEM_PATH else self.menu_properties()
        if member == "GetAll":
            return self.bus.reply(message, "a{sv}", (props,))
        if member == "Get" and message.args[1] in props:
            return self.bus.reply(message, "v", (props[message.args[1]],))
        self.bus.error(message, "org.freedesktop.DBus.Error.UnknownProperty", str(message.args))

    def item_call(self, message: Message, member: str) -> None:
        if member in ("Activate", "SecondaryActivate"):
            self.bus.reply(message)
            return self.run_action(self.activate)
        if member in ("ContextMenu", "Scroll", "ProvideXdgActivationToken"):
            return self.bus.reply(message)
        self.bus.error(message, "org.freedesktop.DBus.Error.UnknownMethod", member)

    def menu_call(self, message: Message, member: str) -> None:
        if member == "GetLayout":
            return self.bus.reply(message, "u" + LAYOUT, (self.revision, self.layout()))
        if member == "GetGroupProperties":
            if not self.items:
                self.layout()
            wanted = set(message.args[0])
            groups = [(index + 1, self.entry_properties(item)) for index, item in enumerate(self.items)
                      if not wanted or index + 1 in wanted]
            return self.bus.reply(message, "a(ia{sv})", (groups,))
        if member == "GetProperty":
            item_id, name = message.args
            props = self.entry_properties(self.items[item_id - 1])
            return self.bus.reply(message, "v", (props.get(name, ("s", "")),))
        if member == "Event":
            self.bus.reply(message)
            item_id, event = message.args[0], message.args[1]
            if event == "clicked" and 0 < item_id <= len(self.items):
                self.run_action(self.items[item_id - 1].action)
            return None
        if member == "EventGroup":
            for item_id, event, _, _ in message.args[0]:
                if event == "clicked" and 0 < item_id <= len(self.items):
                    self.run_action(self.items[item_id - 1].action)
            return self.bus.reply(message, "ai", ([],))
        if member == "AboutToShow":
            return self.bus.reply(message, "b", (False,))
        if member == "AboutToShowGroup":
            return self.bus.reply(message, "aiai", ([], []))
        self.bus.error(message, "org.freedesktop.DBus.Error.UnknownMethod", member)

    @staticmethod
    def run_action(action: Callable[[], None] | None) -> None:
        if action:
            threading.Thread(target=action, daemon=True).start()
