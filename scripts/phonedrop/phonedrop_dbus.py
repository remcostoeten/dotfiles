"""Just enough of the DBus wire protocol for phonedrop, using only the stdlib.

Avoids dbus-python + GLib, which would roughly double the daemon's memory.
"""
import os
import socket
import struct
import threading

ALIGN = {"y": 1, "b": 4, "n": 2, "q": 2, "i": 4, "u": 4, "x": 8, "t": 8, "d": 8, "h": 4,
         "s": 4, "o": 4, "g": 1, "a": 4, "(": 8, "{": 8, "v": 1}
FIXED = {"y": "B", "b": "I", "n": "h", "q": "H", "i": "i", "u": "I", "x": "q", "t": "Q", "d": "d", "h": "I"}
CALL, RETURN, ERROR, SIGNAL = 1, 2, 3, 4
NO_REPLY = 0x1
BUS = ("org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus")


def type_end(sig: str, start: int) -> int:
    code = sig[start]
    if code == "a":
        return type_end(sig, start + 1)
    if code in "({":
        close = ")" if code == "(" else "}"
        cursor = start + 1
        while sig[cursor] != close:
            cursor = type_end(sig, cursor)
        return cursor + 1
    return start + 1


def split_types(sig: str) -> list[str]:
    """Split a DBus signature into its complete top-level types."""
    types, cursor = [], 0
    while cursor < len(sig):
        end = type_end(sig, cursor)
        types.append(sig[cursor:end])
        cursor = end
    return types


def pad(buf: bytearray, size: int) -> None:
    buf.extend(b"\0" * (-len(buf) % size))


def put(buf: bytearray, sig: str, value) -> None:
    """Marshal one value of a complete type; variants are (signature, value) pairs."""
    code = sig[0]
    pad(buf, ALIGN[code])
    if code in FIXED:
        buf.extend(struct.pack("<" + FIXED[code], int(value) if code == "b" else value))
    elif code in "so":
        data = value.encode()
        buf.extend(struct.pack("<I", len(data)) + data + b"\0")
    elif code == "g":
        data = value.encode()
        buf.extend(bytes([len(data)]) + data + b"\0")
    elif code == "v":
        put(buf, "g", value[0])
        put(buf, value[0], value[1])
    elif code == "a":
        length_at = len(buf)
        buf.extend(b"\0\0\0\0")
        element = sig[1:]
        pad(buf, ALIGN[element[0]])
        start = len(buf)
        if element[0] == "{":
            key_sig, value_sig = split_types(element[1:-1])
            for key, item in value.items():
                pad(buf, 8)
                put(buf, key_sig, key)
                put(buf, value_sig, item)
        elif element == "y":
            buf.extend(value)
        else:
            for item in value:
                put(buf, element, item)
        struct.pack_into("<I", buf, length_at, len(buf) - start)
    elif code == "(":
        for field_sig, item in zip(split_types(sig[1:-1]), value):
            put(buf, field_sig, item)


def marshal(sig: str, values: tuple) -> bytes:
    buf = bytearray()
    for field_sig, value in zip(split_types(sig), values):
        put(buf, field_sig, value)
    return bytes(buf)


class Reader:
    """Unmarshals little-endian DBus data; variants come back as bare values."""

    def __init__(self, data: bytes, pos: int = 0):
        self.data = data
        self.pos = pos

    def get(self, sig: str):
        code = sig[0]
        self.pos += -self.pos % ALIGN[code]
        if code in FIXED:
            fmt = "<" + FIXED[code]
            (value,) = struct.unpack_from(fmt, self.data, self.pos)
            self.pos += struct.calcsize(fmt)
            return bool(value) if code == "b" else value
        if code in "sog":
            if code == "g":
                size = self.data[self.pos]
                self.pos += 1
            else:
                (size,) = struct.unpack_from("<I", self.data, self.pos)
                self.pos += 4
            text = self.data[self.pos:self.pos + size].decode()
            self.pos += size + 1
            return text
        if code == "v":
            return self.get(self.get("g"))
        if code == "a":
            (size,) = struct.unpack_from("<I", self.data, self.pos)
            self.pos += 4
            element = sig[1:]
            self.pos += -self.pos % ALIGN[element[0]]
            end = self.pos + size
            items = []
            while self.pos < end:
                items.append(self.get(element))
            return dict(items) if element[0] == "{" else items
        return tuple(self.get(field) for field in split_types(sig[1:-1]))

    def values(self, sig: str) -> list:
        return [self.get(field) for field in split_types(sig)]


class Message:
    __slots__ = ("kind", "serial", "fields", "body")

    def __init__(self, kind: int, serial: int, fields: dict, body: bytes):
        self.kind = kind
        self.serial = serial
        self.fields = fields
        self.body = body

    @property
    def member(self) -> str:
        return self.fields.get(3, "")

    @property
    def args(self) -> list:
        return Reader(self.body).values(self.fields.get(8, ""))


def bus_address(system: bool = False) -> str | bytes:
    variable = "DBUS_SYSTEM_BUS_ADDRESS" if system else "DBUS_SESSION_BUS_ADDRESS"
    fallback = "/run/dbus/system_bus_socket" if system else f"/run/user/{os.getuid()}/bus"
    for entry in os.environ.get(variable, "").split(";"):
        transport, _, options = entry.partition(":")
        if transport != "unix":
            continue
        pairs = dict(option.split("=", 1) for option in options.split(",") if "=" in option)
        if "path" in pairs:
            return pairs["path"]
        if "abstract" in pairs:
            return b"\0" + pairs["abstract"].encode()
    return fallback


class DBusError(Exception):
    pass


class Bus:
    def __init__(self, system: bool = False):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.connect(bus_address(system))
        self.sock.sendall(b"\0AUTH EXTERNAL " + str(os.getuid()).encode().hex().encode() + b"\r\n")
        if not self.sock.recv(4096).startswith(b"OK"):
            raise ConnectionError("dbus auth refused")
        self.sock.sendall(b"BEGIN\r\n")
        self.file = self.sock.makefile("rb")
        self.lock = threading.Lock()
        self.serial = 0
        self.call(*BUS, "Hello")

    def send(self, kind: int, fields: dict, sig: str = "", args: tuple = (), flags: int = 0) -> int:
        body = marshal(sig, args) if sig else b""
        if sig:
            fields[8] = ("g", sig)
        with self.lock:
            self.serial += 1
            header = bytearray(marshal("yyyyuua(yv)", (ord("l"), kind, flags, 1, len(body), self.serial,
                                                     list(fields.items()))))
            pad(header, 8)
            self.sock.sendall(bytes(header) + body)
            return self.serial

    def call(self, dest: str, path: str, iface: str, member: str, sig: str = "", args: tuple = ()) -> int:
        fields = {1: ("o", path), 2: ("s", iface), 3: ("s", member), 6: ("s", dest)}
        return self.send(CALL, fields, sig, args)

    def call_sync(self, dest: str, path: str, iface: str, member: str, sig: str = "", args: tuple = ()) -> list:
        """Call and wait for the reply; only safe before a receive loop owns the connection."""
        serial = self.call(dest, path, iface, member, sig, args)
        while True:
            message = self.receive()
            if message.kind in (RETURN, ERROR) and message.fields.get(5) == serial:
                if message.kind == ERROR:
                    raise DBusError(f"{message.fields.get(4)}: {message.args}")
                return message.args

    def signal(self, path: str, iface: str, member: str, sig: str = "", args: tuple = ()) -> None:
        self.send(SIGNAL, {1: ("o", path), 2: ("s", iface), 3: ("s", member)}, sig, args, NO_REPLY)

    def reply(self, message: Message, sig: str = "", args: tuple = ()) -> None:
        fields = {5: ("u", message.serial)}
        if 7 in message.fields:
            fields[6] = ("s", message.fields[7])
        self.send(RETURN, fields, sig, args, NO_REPLY)

    def error(self, message: Message, name: str, text: str) -> None:
        fields = {4: ("s", name), 5: ("u", message.serial)}
        if 7 in message.fields:
            fields[6] = ("s", message.fields[7])
        self.send(ERROR, fields, "s", (text,), NO_REPLY)

    def receive(self) -> Message:
        fixed = self.file.read(16)
        if len(fixed) < 16:
            raise ConnectionError("dbus closed")
        if fixed[:1] != b"l":
            raise ConnectionError("big-endian dbus messages are not supported")
        body_size, serial, fields_size = struct.unpack_from("<III", fixed, 4)
        rest = self.file.read(fields_size + (-(16 + fields_size) % 8) + body_size)
        data = fixed + rest
        fields = dict(Reader(data, 12).get("a(yv)"))
        header_size = 16 + fields_size + (-(16 + fields_size) % 8)
        return Message(fixed[1], serial, fields, data[header_size:])
