"""phonedrop — a persistent wifi drop zone between this PC and your phone.

Runs a small LAN web app (installable on the iPhone home screen) backed by a
shared folder. Files and text go both ways, the UI updates live, and uploads
from the phone raise a desktop notification.

Commands:
    phonedrop              show the pairing QR if the service runs, else serve in the foreground
    phonedrop install      run as a background service (starts at login) + app launcher entry
    phonedrop uninstall    remove the service and launcher entry
    phonedrop qr           print the URL and pairing QR code
    phonedrop open         open the desktop window
    phonedrop cam          open the phone camera viewer
    phonedrop ring [KEY]   ring the phone through the Bark app; KEY (or the URL Bark shows) is saved on first use
    phonedrop logs         follow the service log
    phonedrop serve        run in the foreground

Options for serve/install: [DIR] (default ~/phone-drop), -p/--port (default 8765), --no-tray.
"""
import atexit
import base64
import contextlib
import errno
import hashlib
import json
import mimetypes
import os
import queue
import re
import secrets
import shlex
import shutil
import signal
import socket
import ssl
import struct
import subprocess
import sys
import threading
import time
import urllib.parse
from datetime import datetime
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from phonedrop_dbus import Bus, DBusError

APP_DIR = Path(__file__).resolve().parent
LAUNCHER = APP_DIR / "phonedrop"
PYCACHE_DIR = Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache")) / "phonedrop"
CONFIG_DIR = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config")) / "phonedrop"
TOKEN_FILE = CONFIG_DIR / "token"
STATE_FILE = CONFIG_DIR / "state.json"
BARK_FILE = CONFIG_DIR / "bark_key"
BARK_SERVER = "https://api.day.app"
BARK_TIMEOUT_SECONDS = 10
STREAM_DEAD_AFTER_MS = 30000
UNIT_FILE = Path.home() / ".config/systemd/user/phonedrop.service"
DESKTOP_FILE = Path.home() / ".local/share/applications/phonedrop.desktop"
DEFAULT_DIR = Path.home() / "phone-drop"
DEFAULT_PORT = 8765
COMMANDS = {"", "serve", "install", "uninstall", "qr", "open", "cam", "ring", "logs", "status"}
UNDER_SYSTEMD = "INVOCATION_ID" in os.environ
PORT_ATTEMPTS = 20
MDNS_NAME = "phonedrop.local"
HOLD_REPEAT_SECONDS = 0.1
HOLD_AFTER_SECONDS = 0.5
HOLD_MAX_SECONDS = 600
AVAHI = "org.freedesktop.Avahi"
AVAHI_GROUP = "org.freedesktop.Avahi.EntryGroup"
AVAHI_NO_REVERSE = 16
AVAHI_ESTABLISHED, AVAHI_COLLISION, AVAHI_FAILURE = 2, 3, 4
MAX_NOTES = 300
MAX_LABEL_NAME = 40
HEX_COLOR = re.compile(r"#[0-9a-fA-F]{6}")
COOKIE = "phonedrop"
TLS_DIR = CONFIG_DIR / "tls"
CA_NAME = "phonedrop local CA"
CA_CONSTRAINTS = ("nameConstraints=critical,permitted;DNS:" + MDNS_NAME + ",permitted;DNS:localhost,"
                  "permitted;IP:192.168.0.0/255.255.0.0,permitted;IP:10.0.0.0/255.0.0.0,"
                  "permitted;IP:172.16.0.0/255.240.0.0,permitted;IP:127.0.0.0/255.0.0.0")
WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
MAX_WS_PAYLOAD = 8 << 20
VIDEO_DEVICE_NAME = "phonedrop"
VIDEO_SYSFS = Path("/sys/devices/virtual/video4linux")
CAM_SIGNAL_TARGETS = {"phone", "viewer"}

USE_COLOR = sys.stdout.isatty() and "NO_COLOR" not in os.environ


def paint(text: str, code: str) -> str:
    return f"\033[{code}m{text}\033[0m" if USE_COLOR else text


def bold(text: str) -> str:
    return paint(text, "1")


def dim(text: str) -> str:
    return paint(text, "2")


def human_size(n: float) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.0f} {unit}" if unit == "B" else f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


def log(symbol: str, message: str) -> None:
    print(f"  {dim(datetime.now().strftime('%H:%M:%S'))}  {symbol} {message}", flush=True)


def lan_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"


def own_addresses() -> set[str]:
    addresses = {"127.0.0.1", "::1", lan_ip()}
    try:
        output = subprocess.run(["ip", "-o", "addr", "show"], capture_output=True, text=True).stdout
    except FileNotFoundError:
        return addresses
    addresses.update(re.findall(r"inet6? ([0-9a-f.:]+)/", output))
    return addresses


def load_token() -> str:
    if TOKEN_FILE.exists():
        return TOKEN_FILE.read_text().strip()
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    token = secrets.token_urlsafe(18)
    TOKEN_FILE.write_text(token)
    TOKEN_FILE.chmod(0o600)
    return token


def save_bark_key(raw: str) -> None:
    parsed = urllib.parse.urlsplit(raw.strip())
    server = f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme else BARK_SERVER
    key = parsed.path.strip("/").split("/")[0]
    if not key:
        sys.exit("phonedrop ring: that does not look like a Bark key or URL")
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    BARK_FILE.write_text(f"{server}/{key}\n")
    BARK_FILE.chmod(0o600)


def bark_target() -> tuple[str, str] | None:
    try:
        server, _, key = BARK_FILE.read_text().strip().rpartition("/")
    except FileNotFoundError:
        return None
    return (server, key) if server and key else None


def ring_phone() -> str:
    """Send a critical Bark alert, which rings through silent mode; returns an error message or ""."""
    target = bark_target()
    if not target:
        return "No Bark key saved. Run: phonedrop ring KEY"
    # imported on demand so the idle service never loads the HTTP client
    import urllib.request

    server, key = target
    alert = {"device_key": key, "title": "phonedrop", "body": "Here I am", "level": "critical", "volume": 10,
             "call": "1", "group": "phonedrop"}
    request = urllib.request.Request(f"{server}/push", data=json.dumps(alert).encode(),
                                     headers={"Content-Type": "application/json; charset=utf-8"})
    try:
        with urllib.request.urlopen(request, timeout=BARK_TIMEOUT_SECONDS):
            return ""
    except OSError as error:
        return f"Could not reach Bark: {error}"


def read_json(path: Path, fallback):
    try:
        return json.loads(path.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return fallback


def write_json(path: Path, data) -> None:
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=1))
    tmp.replace(path)


def safe_name(raw: str) -> str:
    name = Path(raw.replace("\\", "/")).name.strip()
    return "" if name in {"", ".", ".."} or name.startswith(".") else name


def safe_folder(raw: str) -> str:
    name = safe_name(raw)
    return "" if name == ".phonedrop" else name


def unique_path(folder: Path, name: str) -> Path:
    target = folder / name
    stem, suffix = target.stem, target.suffix
    counter = 1
    while target.exists():
        target = folder / f"{stem} ({counter}){suffix}"
        counter += 1
    return target


def file_kind(name: str) -> str:
    mime = mimetypes.guess_type(name)[0] or ""
    if mime.startswith("image/") or name.lower().endswith((".heic", ".heif", ".avif")):
        return "image"
    if mime.startswith("video/"):
        return "video"
    if mime.startswith("audio/"):
        return "audio"
    if mime == "application/pdf":
        return "pdf"
    return "file"


def notify(title: str, body: str) -> None:
    if shutil.which("notify-send"):
        subprocess.Popen(["notify-send", "-a", "phonedrop", "-i", "phone", title, body],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


class Store:
    """Shared folder plus the metadata (origins, text notes) kept in DIR/.phonedrop."""

    def __init__(self, root: Path):
        self.root = root
        self.data_dir = root / ".phonedrop"
        self.incoming = self.data_dir / "incoming"
        self.meta_file = self.data_dir / "meta.json"
        self.notes_file = self.data_dir / "notes.json"
        self.layout_file = self.data_dir / "layout.json"
        self.labels_file = self.data_dir / "labels.json"
        self.incoming.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()
        self.meta: dict = read_json(self.meta_file, {})
        self.notes: list = read_json(self.notes_file, [])
        self.layout: dict = read_json(self.layout_file, {})
        self.labels: list = read_json(self.labels_file, [])

    def folder_dirs(self) -> list[Path]:
        return sorted(p for p in self.root.iterdir() if p.is_dir() and not p.name.startswith("."))

    def folder_path(self, folder: str) -> Path | None:
        if folder == "":
            return self.root
        clean = safe_folder(folder)
        if not clean:
            return None
        target = self.root / clean
        return target if target.is_dir() else None

    def visible_files(self) -> list[tuple[str, Path]]:
        entries = []
        for folder in [self.root, *self.folder_dirs()]:
            prefix = "" if folder == self.root else f"{folder.name}/"
            entries.extend((prefix + p.name, p) for p in folder.iterdir() if p.is_file() and not p.name.startswith("."))
        return entries

    def signature(self) -> tuple:
        entries = [("dir", d.name) for d in self.folder_dirs()]
        for rel, p in self.visible_files():
            try:
                stat = p.stat()
            except FileNotFoundError:
                continue
            entries.append((rel, stat.st_size, stat.st_mtime_ns))
        return tuple(sorted(entries, key=str))

    def files(self) -> list[dict]:
        result = []
        for rel, p in self.visible_files():
            try:
                stat = p.stat()
            except FileNotFoundError:
                continue
            meta = self.meta.get(rel, {})
            folder, _, name = rel.rpartition("/")
            result.append({
                "path": rel,
                "name": name,
                "folder": folder,
                "size": stat.st_size,
                "at": meta.get("at", stat.st_mtime),
                "from": meta.get("from", "PC"),
                "kind": file_kind(name),
                "labels": meta.get("labels", []),
            })
        return sorted(result, key=lambda f: f["at"], reverse=True)

    def folders(self) -> list[dict]:
        counts: dict[str, int] = {}
        for rel, _ in self.visible_files():
            folder = rel.rpartition("/")[0]
            if folder:
                counts[folder] = counts.get(folder, 0) + 1
        for note in self.notes:
            folder = note.get("folder", "")
            if folder:
                counts[folder] = counts.get(folder, 0) + 1
        return [{"name": d.name, "count": counts.get(d.name, 0)} for d in self.folder_dirs()]

    def state(self) -> dict:
        return {"files": self.files(), "notes": self.notes, "folders": self.folders(), "layout": self.layout, "labels": self.labels}

    def resolve(self, rel: str) -> Path | None:
        folder, _, name = rel.replace("\\", "/").strip("/").rpartition("/")
        clean = safe_name(name)
        parent = self.folder_path(folder)
        if not clean or parent is None or "/" in folder:
            return None
        target = (parent / clean).resolve()
        return target if target.parent == parent.resolve() and target.is_file() else None

    def relative(self, path: Path) -> str:
        return str(path.relative_to(self.root))

    def create_folder(self, name: str) -> str | None:
        clean = safe_folder(name)
        if not clean:
            return None
        with self.lock:
            (self.root / clean).mkdir(exist_ok=True)
        return clean

    def delete_folder(self, name: str) -> bool:
        target = self.folder_path(name)
        if target is None or target == self.root:
            return False
        trashed = shutil.which("gio") and subprocess.run(["gio", "trash", str(target)], stderr=subprocess.DEVNULL).returncode == 0
        if not trashed:
            shutil.rmtree(target)
        with self.lock:
            prefix = f"{target.name}/"
            self.meta = {k: v for k, v in self.meta.items() if not k.startswith(prefix)}
            write_json(self.meta_file, self.meta)
            self.notes = [n for n in self.notes if n.get("folder", "") != target.name]
            write_json(self.notes_file, self.notes)
            self.layout.pop(target.name, None)
            write_json(self.layout_file, self.layout)
        return True

    def move_file(self, rel: str, folder: str) -> str | None:
        source = self.resolve(rel)
        parent = self.folder_path(folder)
        if source is None or parent is None:
            return None
        with self.lock:
            target = source if source.parent == parent else unique_path(parent, source.name)
            if target != source:
                source.replace(target)
            new_rel = self.relative(target)
            self.meta[new_rel] = self.meta.pop(rel, {"from": "PC", "at": time.time()})
            write_json(self.meta_file, self.meta)
        return new_rel

    def move_note(self, note_id: str, folder: str) -> bool:
        if self.folder_path(folder) is None:
            return False
        with self.lock:
            for note in self.notes:
                if note["id"] == note_id:
                    note["folder"] = folder
                    write_json(self.notes_file, self.notes)
                    return True
        return False

    def set_order(self, scope: str, items: list[str]) -> None:
        with self.lock:
            self.layout[scope] = [str(i) for i in items][:5000]
            write_json(self.layout_file, self.layout)

    def save_upload(self, name: str, stream, length: int, origin: str, folder: str = "") -> Path:
        parent = self.folder_path(folder) or self.root
        tmp = self.incoming / f"{secrets.token_hex(8)}.part"
        remaining = length
        with tmp.open("wb") as fh:
            while remaining > 0:
                chunk = stream.read(min(remaining, 1 << 20))
                if not chunk:
                    break
                fh.write(chunk)
                remaining -= len(chunk)
        if remaining > 0:
            tmp.unlink(missing_ok=True)
            raise ConnectionError("upload interrupted")
        with self.lock:
            target = unique_path(parent, name)
            tmp.replace(target)
            self.meta[self.relative(target)] = {"from": origin, "at": time.time()}
            write_json(self.meta_file, self.meta)
        return target

    def delete_file(self, path: Path) -> None:
        trashed = shutil.which("gio") and subprocess.run(["gio", "trash", str(path)], stderr=subprocess.DEVNULL).returncode == 0
        if not trashed:
            path.unlink(missing_ok=True)
        with self.lock:
            self.meta.pop(self.relative(path), None)
            write_json(self.meta_file, self.meta)

    def add_note(self, text: str, origin: str, folder: str = "") -> dict:
        if self.folder_path(folder) is None:
            folder = ""
        note = {"id": secrets.token_hex(6), "text": text, "from": origin, "at": time.time(), "folder": folder}
        with self.lock:
            self.notes = [note, *self.notes][:MAX_NOTES]
            write_json(self.notes_file, self.notes)
        return note

    def delete_note(self, note_id: str) -> bool:
        with self.lock:
            remaining = [n for n in self.notes if n["id"] != note_id]
            changed = len(remaining) != len(self.notes)
            self.notes = remaining
            write_json(self.notes_file, self.notes)
        return changed

    def create_label(self, name: str, color: str) -> dict | None:
        clean = " ".join(name.split())[:MAX_LABEL_NAME]
        if not clean or not HEX_COLOR.fullmatch(color):
            return None
        with self.lock:
            for label in self.labels:
                if label["name"].lower() == clean.lower():
                    return label
            label = {"id": secrets.token_hex(4), "name": clean, "color": color.lower()}
            self.labels.append(label)
            write_json(self.labels_file, self.labels)
        return label

    def delete_label(self, label_id: str) -> bool:
        with self.lock:
            remaining = [l for l in self.labels if l["id"] != label_id]
            if len(remaining) == len(self.labels):
                return False
            self.labels = remaining
            write_json(self.labels_file, self.labels)
            for entry in self.meta.values():
                if "labels" in entry:
                    entry["labels"] = [x for x in entry["labels"] if x != label_id]
            write_json(self.meta_file, self.meta)
            for note in self.notes:
                if "labels" in note:
                    note["labels"] = [x for x in note["labels"] if x != label_id]
            write_json(self.notes_file, self.notes)
        return True

    def set_labels(self, items: list, add: list, remove: list) -> list[str]:
        known = {l["id"] for l in self.labels}
        add = [str(x) for x in add if str(x) in known]
        remove = {str(x) for x in remove}
        changed = []

        def apply(current: list) -> list:
            kept = [x for x in current if x not in remove]
            return kept + [x for x in add if x not in kept]

        with self.lock:
            for item in items:
                kind, _, ident = str(item).partition(":")
                if kind == "f":
                    path = self.resolve(ident)
                    if not path:
                        continue
                    rel = self.relative(path)
                    entry = self.meta.setdefault(rel, {"from": "PC", "at": path.stat().st_mtime})
                    entry["labels"] = apply(entry.get("labels", []))
                    changed.append(f"f:{rel}")
                elif kind == "n":
                    for note in self.notes:
                        if note["id"] == ident:
                            note["labels"] = apply(note.get("labels", []))
                            changed.append(item)
                            break
            write_json(self.meta_file, self.meta)
            write_json(self.notes_file, self.notes)
        return changed


class Hub:
    """Fan-out of change events to every open /api/events stream."""

    def __init__(self):
        self.lock = threading.Lock()
        self.subscribers: list[queue.Queue] = []

    def subscribe(self) -> queue.Queue:
        q: queue.Queue = queue.Queue()
        with self.lock:
            self.subscribers.append(q)
        return q

    def unsubscribe(self, q: queue.Queue) -> None:
        with self.lock:
            if q in self.subscribers:
                self.subscribers.remove(q)

    def publish(self, event: str, data: str = "{}") -> None:
        with self.lock:
            for q in self.subscribers:
                q.put((event, data))


class Presence:
    """Tracks which devices other than this PC hold an open live-update stream."""

    def __init__(self):
        self.lock = threading.Lock()
        self.streams: dict[str, int] = {}
        self.last_seen: tuple[str, datetime] | None = None
        self.on_change = None

    def change(self, device: str, step: int) -> None:
        with self.lock:
            before = self.streams.get(device, 0)
            self.streams[device] = before + step
            self.last_seen = (device, datetime.now())
            flipped = (before == 0) != (before + step == 0)
        if not flipped:
            return
        log(paint("●", "32") if step > 0 else dim("○"), f"{device} {'connected' if step > 0 else 'disconnected'}")
        if self.on_change:
            self.on_change()

    def summary(self) -> str:
        with self.lock:
            connected = sorted(device for device, count in self.streams.items() if count)
            if connected:
                return f"{' and '.join(connected)} connected"
            if not self.last_seen:
                return "No phone connected yet"
            device, moment = self.last_seen
        same_day = moment.date() == datetime.now().date()
        return f"{device} last seen {moment.strftime('%H:%M' if same_day else '%a %H:%M')}"


def watch_folder(store: Store, hub: Hub) -> None:
    last = store.signature()
    while True:
        time.sleep(1)
        current = store.signature()
        if current != last:
            last = current
            hub.publish("files")


def run_openssl(*args) -> None:
    subprocess.run(["openssl", *map(str, args)], check=True, capture_output=True)


def ensure_certs(ip: str) -> bool:
    """Keep a name-constrained local CA plus a server cert for this host; the phone trusts the CA once."""
    if not shutil.which("openssl"):
        return False
    TLS_DIR.mkdir(parents=True, exist_ok=True)
    TLS_DIR.chmod(0o700)
    ca_key, ca_crt = TLS_DIR / "ca.key", TLS_DIR / "ca.crt"
    key, crt, sans_file = TLS_DIR / "server.key", TLS_DIR / "server.crt", TLS_DIR / "server.sans"
    sans = f"DNS:{MDNS_NAME},DNS:localhost,IP:{ip},IP:127.0.0.1"
    curve = ("-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes")
    try:
        if not ca_crt.exists():
            run_openssl("req", "-x509", *curve, "-keyout", ca_key, "-out", ca_crt, "-days", "3650",
                        "-subj", f"/CN={CA_NAME}", "-addext", "basicConstraints=critical,CA:TRUE,pathlen:0",
                        "-addext", "keyUsage=critical,keyCertSign,cRLSign", "-addext", CA_CONSTRAINTS)
            crt.unlink(missing_ok=True)
        expiring = crt.exists() and subprocess.run(
            ["openssl", "x509", "-checkend", "2592000", "-noout", "-in", str(crt)], capture_output=True).returncode != 0
        stale = not crt.exists() or not sans_file.exists() or sans_file.read_text() != sans
        if stale or expiring:
            run_openssl("req", "-x509", "-CA", ca_crt, "-CAkey", ca_key, *curve, "-keyout", key, "-out", crt,
                        "-days", "800", "-subj", f"/CN={MDNS_NAME}", "-addext", f"subjectAltName={sans}",
                        "-addext", "extendedKeyUsage=serverAuth", "-addext", "basicConstraints=critical,CA:FALSE",
                        "-addext", "keyUsage=critical,digitalSignature")
            sans_file.write_text(sans)
        for secret in (ca_key, key):
            secret.chmod(0o600)
        return True
    except (subprocess.CalledProcessError, OSError) as error:
        log(paint("!", "31"), f"https disabled: {error}")
        return False


def tls_context() -> ssl.SSLContext:
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(TLS_DIR / "server.crt", TLS_DIR / "server.key")
    return context


def unmask(data: bytes, mask: bytes) -> bytes:
    if not mask:
        return data
    size = len(data)
    key = (mask * (size // 4 + 1))[:size]
    return (int.from_bytes(data, "little") ^ int.from_bytes(key, "little")).to_bytes(size, "little")


class WebSocket:
    """Minimal RFC 6455 server side over a handler's rfile/wfile."""

    def __init__(self, rfile, wfile):
        self.rfile = rfile
        self.wfile = wfile
        self.lock = threading.Lock()

    def read_exact(self, size: int) -> bytes:
        data = self.rfile.read(size)
        if len(data) < size:
            raise ConnectionError("websocket closed")
        return data

    def recv(self) -> tuple[int, bytes] | None:
        opcode, parts = 0, []
        while True:
            head = self.read_exact(2)
            op, size = head[0] & 0x0F, head[1] & 0x7F
            if size == 126:
                size = struct.unpack(">H", self.read_exact(2))[0]
            elif size == 127:
                size = struct.unpack(">Q", self.read_exact(8))[0]
            if size > MAX_WS_PAYLOAD:
                raise ConnectionError("websocket frame too large")
            mask = self.read_exact(4) if head[1] & 0x80 else b""
            payload = unmask(self.read_exact(size), mask)
            if op == 0x8:
                self.send(0x8)
                return None
            if op == 0x9:
                self.send(0xA, payload)
                continue
            if op == 0xA:
                continue
            opcode = op or opcode
            parts.append(payload)
            if head[0] & 0x80:
                return opcode, b"".join(parts)

    def send(self, opcode: int, payload: bytes = b"") -> None:
        size = len(payload)
        if size < 126:
            header = struct.pack(">BB", 0x80 | opcode, size)
        elif size < 1 << 16:
            header = struct.pack(">BBH", 0x80 | opcode, 126, size)
        else:
            header = struct.pack(">BBQ", 0x80 | opcode, 127, size)
        with self.lock:
            self.wfile.write(header + payload)

    def send_json(self, data) -> None:
        self.send(0x1, json.dumps(data).encode())


def video_device() -> str | None:
    try:
        for entry in sorted(VIDEO_SYSFS.iterdir()):
            if (entry / "name").read_text().strip() == VIDEO_DEVICE_NAME:
                return f"/dev/{entry.name}"
    except OSError:
        return None
    return None


class WebcamFeed:
    """Pipes the newest JPEG into ffmpeg, which writes the v4l2loopback device; stale frames are dropped."""

    def __init__(self, device: str, on_exit):
        self.device = device
        self.on_exit = on_exit
        self.error = ""
        self.pending: bytes | None = None
        self.closed = False
        self.ready = threading.Condition()
        self.proc = subprocess.Popen(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-fflags", "nobuffer", "-flags", "low_delay",
             "-probesize", "32", "-analyzeduration", "0", "-f", "mjpeg", "-framerate", "60", "-i", "pipe:0",
             "-fps_mode", "passthrough", "-vf", "format=yuv420p", "-f", "v4l2", device],
            stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=False)
        threading.Thread(target=self.drain_errors, daemon=True).start()
        threading.Thread(target=self.pump, daemon=True).start()

    def drain_errors(self) -> None:
        for line in self.proc.stderr:
            self.error = line.decode(errors="replace").strip() or self.error

    def push(self, jpeg: bytes) -> None:
        with self.ready:
            self.pending = jpeg
            self.ready.notify()

    def pump(self) -> None:
        while True:
            with self.ready:
                while self.pending is None and not self.closed:
                    self.ready.wait()
                if self.closed:
                    break
                frame, self.pending = self.pending, None
            try:
                self.proc.stdin.write(frame)
                self.proc.stdin.flush()
            except (BrokenPipeError, OSError):
                break
        crashed = not self.closed
        self.close()
        if crashed:
            self.on_exit(self)

    def close(self) -> None:
        with self.ready:
            self.closed = True
            self.ready.notify()
        with contextlib.suppress(OSError):
            self.proc.stdin.close()
        try:
            self.proc.wait(timeout=2)
        except subprocess.TimeoutExpired:
            self.proc.kill()


class Camera:
    """Relays phone JPEG frames to viewer sockets and, when the device exists, into a virtual webcam."""

    def __init__(self):
        self.lock = threading.Lock()
        self.viewers: list[queue.Queue] = []
        self.generation = 0
        self.phone = 0
        self.meta: dict = {}
        self.feed: WebcamFeed | None = None
        self.feed_size: tuple | None = None
        self.last_jpeg: bytes | None = None
        self.last_frame_at = 0.0
        self.webcam = "idle"
        self.rtc = False
        self.on_change = None

    @staticmethod
    def offer(q: queue.Queue, item) -> None:
        try:
            q.put_nowait(item)
        except queue.Full:
            with contextlib.suppress(queue.Empty):
                q.get_nowait()
            with contextlib.suppress(queue.Full):
                q.put_nowait(item)

    def add_viewer(self) -> queue.Queue:
        q: queue.Queue = queue.Queue(maxsize=3)
        with self.lock:
            self.viewers.append(q)
        return q

    def remove_viewer(self, q: queue.Queue) -> None:
        with self.lock:
            if q in self.viewers:
                self.viewers.remove(q)

    def broadcast(self, item) -> None:
        with self.lock:
            viewers = list(self.viewers)
        for q in viewers:
            self.offer(q, item)

    def status(self) -> dict:
        return {"type": "status", "phone": bool(self.phone), "rtc": self.rtc, "device": video_device(),
                "webcam": self.webcam, "meta": self.meta}

    def set_rtc(self, live: bool) -> None:
        if self.rtc != live:
            self.rtc = live
            self.publish_status()

    def summary(self) -> tuple[str, bool]:
        if not self.phone and not self.rtc:
            return ("Camera paused, holding last frame", False) if self.feed else ("Camera idle", False)
        width, height = self.meta.get("width"), self.meta.get("height")
        size = f" {width}×{height}" if width else ""
        webcam = f" → {self.webcam.removeprefix('live ')}" if self.webcam.startswith("live") else ""
        return f"Camera live{size}{webcam}", True

    def publish_status(self) -> None:
        self.broadcast(("text", json.dumps(self.status()).encode()))
        if self.on_change:
            self.on_change()

    def stop_feed(self) -> None:
        feed, self.feed = self.feed, None
        self.feed_size = None
        if feed:
            feed.close()

    def hold_last_frame(self, feed: WebcamFeed) -> None:
        """Repeats the last frame while the phone is away so apps keep the webcam open, then releases it."""
        while self.feed is feed:
            time.sleep(HOLD_REPEAT_SECONDS)
            idle = time.time() - self.last_frame_at
            if idle > HOLD_MAX_SECONDS and not self.phone:
                log(paint("◌", "35"), "virtual webcam released after holding the last frame")
                self.stop_feed()
                self.webcam = "idle"
                self.publish_status()
                return
            if idle > HOLD_AFTER_SECONDS and self.last_jpeg:
                feed.push(self.last_jpeg)

    def connect_phone(self) -> int:
        with self.lock:
            self.generation += 1
            self.phone = self.generation
            self.meta = {}
        if self.feed is None:
            self.webcam = "idle"
        self.publish_status()
        return self.phone

    def disconnect_phone(self, generation: int) -> None:
        if self.phone != generation:
            return
        self.phone = 0
        self.meta = {}
        self.publish_status()

    def set_meta(self, generation: int, meta: dict) -> None:
        if self.phone != generation:
            return
        self.meta = {k: meta[k] for k in ("width", "height", "fps", "quality", "facing") if k in meta}
        if self.feed is None:
            self.webcam = "idle"
        elif self.feed_size != (meta.get("width"), meta.get("height")):
            self.stop_feed()
            self.webcam = "idle"
        self.publish_status()

    def feed_ended(self, feed: WebcamFeed) -> None:
        if self.feed is feed:
            self.feed = None
            self.webcam = f"error: {feed.error or 'ffmpeg exited'}"
            log(paint("!", "31"), f"virtual webcam stopped  {dim(self.webcam)}")
            self.publish_status()

    def frame(self, generation: int, captured_ms: float, jpeg: bytes) -> None:
        if self.phone != generation:
            return
        self.broadcast(("bin", struct.pack(">dd", captured_ms, time.time() * 1000) + jpeg))
        self.last_jpeg = jpeg
        self.last_frame_at = time.time()
        if self.feed is None and self.webcam == "idle":
            self.start_feed()
        if self.feed:
            self.feed.push(jpeg)

    def start_feed(self) -> None:
        device = video_device()
        if not device or not shutil.which("ffmpeg"):
            self.webcam = "no-device" if shutil.which("ffmpeg") else "no-ffmpeg"
        else:
            self.feed = WebcamFeed(device, self.feed_ended)
            self.feed_size = (self.meta.get("width"), self.meta.get("height"))
            threading.Thread(target=self.hold_last_frame, args=(self.feed,), daemon=True).start()
            self.webcam = f"live {device}"
            log(paint("◉", "35"), f"virtual webcam {bold(device)}")
        self.publish_status()


class App:
    def __init__(self, store: Store, hub: Hub, token: str, public_url: str):
        self.store = store
        self.hub = hub
        self.token = token
        self.public_url = public_url
        self.https_url = ""
        self.camera = Camera()
        self.presence = Presence()
        self.local_addresses = own_addresses()
        self.page = (APP_DIR / "app.html").read_bytes()
        self.cam_page = (APP_DIR / "cam.html").read_bytes()
        self.cam_build = hashlib.sha1(self.cam_page).hexdigest()[:12]
        self.icon = (APP_DIR / "icon.png").read_bytes()
        self.worker = (APP_DIR / "sw.js").read_bytes()

    @property
    def pair_url(self) -> str:
        return f"{self.public_url}?k={self.token}"


def make_handler(app: App):
    class Handler(BaseHTTPRequestHandler):
        server_version = "phonedrop"
        disable_nagle_algorithm = True

        def setup(self):
            if isinstance(self.request, ssl.SSLSocket):
                self.request.settimeout(10)
                self.request.do_handshake()
                self.request.settimeout(None)
            super().setup()

        def log_message(self, fmt, *args):
            return

        @property
        def is_local(self) -> bool:
            return self.client_address[0] in app.local_addresses

        @property
        def origin(self) -> str:
            if self.is_local:
                return "PC"
            agent = self.headers.get("User-Agent", "")
            for marker, label in (("iPhone", "iPhone"), ("iPad", "iPad"), ("Android", "Android")):
                if marker in agent:
                    return label
            return "Browser"

        @property
        def surface(self) -> str:
            agent = self.headers.get("User-Agent", "")
            if "iPhone" not in agent and "iPad" not in agent:
                return ""
            # an iOS home screen app sends the Safari user agent without the trailing Safari/ token
            return " in Safari" if "Safari/" in agent else " as home screen app"

        def log_locked(self) -> None:
            if self.route() not in ("/", "/cam"):
                return
            reason = "sent a stale cookie" if COOKIE in SimpleCookie(self.headers.get("Cookie", "")) else "sent no cookie"
            log(paint("!", "33"), f"not paired: {bold(self.origin)}{self.surface} {reason} {dim(self.client_address[0])}")

        def query(self) -> dict:
            return urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)

        def route(self) -> str:
            return urllib.parse.unquote(urllib.parse.urlparse(self.path).path)

        def has_cookie(self) -> bool:
            cookie = SimpleCookie(self.headers.get("Cookie", ""))
            return COOKIE in cookie and secrets.compare_digest(cookie[COOKIE].value, app.token)

        def authorized(self) -> bool:
            key = self.query().get("k", [""])[0]
            return self.is_local or self.has_cookie() or secrets.compare_digest(key, app.token)

        def send_bytes(self, status: int, body: bytes, ctype: str, extra: dict | None = None) -> None:
            self.send_response(status)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            for key, value in (extra or {}).items():
                self.send_header(key, value)
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)

        def send_json(self, data, status: int = 200) -> None:
            self.send_bytes(status, json.dumps(data).encode(), "application/json")

        def read_body(self, limit: int = 1 << 20) -> bytes:
            length = int(self.headers.get("Content-Length", 0))
            return self.rfile.read(min(length, limit))

        def do_HEAD(self):
            self.do_GET()

        def do_GET(self):
            route = self.route()
            if route == "/icon.png":
                return self.send_bytes(200, app.icon, "image/png", {"Cache-Control": "max-age=86400"})
            if route == "/manifest.webmanifest":
                return self.send_manifest()
            if route == "/sw.js":
                return self.send_bytes(200, app.worker, "application/javascript; charset=utf-8")
            if route == "/ca.crt":
                return self.send_ca()
            if not self.authorized():
                self.log_locked()
                return self.send_locked()
            if route == "/":
                return self.send_app()
            if route == "/cam":
                return self.send_bytes(200, app.cam_page, "text/html; charset=utf-8", self.pair_headers())
            if route == "/api/cam":
                return self.send_cam_info()
            if route == "/api/cam/ws":
                return self.camera_socket(self.query().get("role", [""])[0])
            if route == "/api/state":
                return self.send_json({**app.store.state(), "local": self.is_local})
            if route == "/api/events":
                return self.stream_events()
            if route == "/api/pair" and self.is_local:
                return self.send_json({"url": app.pair_url, "svg": qr_svg(app.pair_url)})
            if route.startswith("/f/"):
                return self.send_file(route[3:])
            if route == "/api/zip":
                return self.send_zip(self.query().get("name", []))
            self.send_error(404)

        def do_PUT(self):
            if not self.authorized():
                return self.send_error(401)
            if self.route() != "/api/upload":
                return self.send_error(404)
            query = self.query()
            name = safe_name(query.get("name", [""])[0]) or f"upload-{int(time.time())}"
            folder = query.get("folder", [""])[0]
            length = int(self.headers.get("Content-Length", 0))
            try:
                target = app.store.save_upload(name, self.rfile, length, self.origin, folder)
            except ConnectionError:
                return
            size = target.stat().st_size
            log(paint("↑", "35"), f"{bold(target.name)}  {dim(human_size(size) + ' from ' + self.origin)}")
            if not self.is_local:
                notify(f"Received from {self.origin}", f"{target.name} · {human_size(size)}")
            app.hub.publish("files")
            self.send_json({"name": target.name}, 201)

        def do_POST(self):
            if not self.authorized():
                return self.send_error(401)
            route = self.route()
            try:
                body = json.loads(self.read_body() or b"{}")
                if not isinstance(body, dict):
                    raise ValueError
            except (json.JSONDecodeError, ValueError):
                return self.send_error(400)
            if route == "/api/folders":
                name = app.store.create_folder(str(body.get("name", "")))
                if not name:
                    return self.send_error(400)
                log(paint("▤", "33"), f"folder {bold(name)} {dim('by ' + self.origin)}")
                app.hub.publish("files")
                return self.send_json({"name": name}, 201)
            if route == "/api/move":
                folder = str(body.get("folder", ""))
                moved = []
                for item in body.get("items", []):
                    kind, _, ident = str(item).partition(":")
                    if kind == "f" and (new := app.store.move_file(ident, folder)):
                        moved.append(f"f:{new}")
                    elif kind == "n" and app.store.move_note(ident, folder):
                        moved.append(item)
                app.hub.publish("files")
                app.hub.publish("notes")
                return self.send_json({"moved": moved})
            if route == "/api/order":
                items = body.get("items", [])
                if not isinstance(items, list):
                    return self.send_error(400)
                app.store.set_order(str(body.get("scope", "")), items)
                app.hub.publish("layout")
                return self.send_json({"ok": True})
            if route == "/api/labels":
                label = app.store.create_label(str(body.get("name", "")), str(body.get("color", "")))
                if not label:
                    return self.send_error(400)
                log(paint("◆", "33"), f"label {bold(label['name'])} {dim('by ' + self.origin)}")
                app.hub.publish("labels")
                return self.send_json(label, 201)
            if route == "/api/cam/signal":
                if body.get("to") not in CAM_SIGNAL_TARGETS:
                    return self.send_error(400)
                app.hub.publish("cam", json.dumps(body))
                if body.get("type") in ("offer", "bye") and body.get("to") == "viewer":
                    app.camera.set_rtc(body["type"] == "offer")
                return self.send_json({"ok": True})
            if route == "/api/label":
                items, add, remove = body.get("items", []), body.get("add", []), body.get("remove", [])
                if not all(isinstance(x, list) for x in (items, add, remove)):
                    return self.send_error(400)
                changed = app.store.set_labels(items, add, remove)
                app.hub.publish("labels")
                return self.send_json({"changed": changed})
            if route != "/api/notes":
                return self.send_error(404)
            text = str(body.get("text", "")).strip()
            if not text:
                return self.send_error(400)
            note = app.store.add_note(text, self.origin, str(body.get("folder", "")))
            log(paint("✎", "36"), f"text from {self.origin}  {dim(text[:60])}")
            if not self.is_local:
                notify(f"Text from {self.origin}", text[:200])
            app.hub.publish("notes")
            self.send_json(note, 201)

        def do_DELETE(self):
            if not self.authorized():
                return self.send_error(401)
            route = self.route()
            if route.startswith("/api/notes/"):
                if not app.store.delete_note(route.removeprefix("/api/notes/")):
                    return self.send_error(404)
                app.hub.publish("notes")
                return self.send_json({"ok": True})
            if route.startswith("/api/files/"):
                path = app.store.resolve(route.removeprefix("/api/files/"))
                if not path:
                    return self.send_error(404)
                app.store.delete_file(path)
                log(paint("✕", "31"), f"{path.name} {dim('deleted by ' + self.origin)}")
                app.hub.publish("files")
                return self.send_json({"ok": True})
            if route.startswith("/api/folders/"):
                name = route.removeprefix("/api/folders/")
                if not app.store.delete_folder(name):
                    return self.send_error(404)
                log(paint("✕", "31"), f"folder {name} {dim('deleted by ' + self.origin)}")
                app.hub.publish("files")
                app.hub.publish("notes")
                return self.send_json({"ok": True})
            if route.startswith("/api/labels/"):
                if not app.store.delete_label(route.removeprefix("/api/labels/")):
                    return self.send_error(404)
                app.hub.publish("labels")
                return self.send_json({"ok": True})
            self.send_error(404)

        def pair_headers(self) -> dict:
            if not self.query().get("k", [""])[0] or self.has_cookie():
                return {}
            log(paint("●", "32"), f"paired {bold(self.origin)}{self.surface} {dim(self.client_address[0])}")
            return {"Set-Cookie": f"{COOKIE}={app.token}; Max-Age=315360000; Path=/; SameSite=Lax; HttpOnly"}

        def send_app(self):
            self.send_bytes(200, app.page, "text/html; charset=utf-8", self.pair_headers())

        def send_ca(self):
            ca = TLS_DIR / "ca.crt"
            if not app.https_url or not ca.exists():
                return self.send_error(404)
            self.send_bytes(200, ca.read_bytes(), "application/x-x509-ca-cert",
                            {"Content-Disposition": "attachment; filename=phonedrop-ca.crt"})

        def send_cam_info(self):
            secure_url = f"{app.https_url}cam?k={app.token}" if app.https_url else ""
            self.send_json({"local": self.is_local, "secure_url": secure_url, "build": app.cam_build,
                            **app.camera.status()})

        def upgrade_websocket(self) -> WebSocket | None:
            key = self.headers.get("Sec-WebSocket-Key", "")
            if not key or "websocket" not in self.headers.get("Upgrade", "").lower():
                self.send_error(400)
                return None
            accept = base64.b64encode(hashlib.sha1((key + WS_GUID).encode()).digest()).decode()
            self.send_response(101)
            self.send_header("Upgrade", "websocket")
            self.send_header("Connection", "Upgrade")
            self.send_header("Sec-WebSocket-Accept", accept)
            self.end_headers()
            self.close_connection = True
            return WebSocket(self.rfile, self.wfile)

        def camera_socket(self, role: str):
            if role not in CAM_SIGNAL_TARGETS:
                return self.send_error(400)
            ws = self.upgrade_websocket()
            if ws is None:
                return
            if role == "phone":
                return self.camera_phone(ws)
            self.camera_viewer(ws)

        def camera_phone(self, ws: WebSocket):
            generation = app.camera.connect_phone()
            log(paint("◉", "35"), f"camera stream from {bold(self.origin)}")
            try:
                while (message := ws.recv()) is not None:
                    opcode, data = message
                    if opcode == 0x2 and len(data) > 8:
                        app.camera.frame(generation, struct.unpack(">d", data[:8])[0], data[8:])
                        continue
                    if opcode != 0x1:
                        continue
                    command = json.loads(data)
                    if command.get("type") == "ping":
                        ws.send_json({"type": "pong", "t": command.get("t"), "server": time.time() * 1000})
                    elif command.get("type") == "meta":
                        app.camera.set_meta(generation, command)
            except (ConnectionError, OSError, ValueError):
                return
            finally:
                app.camera.disconnect_phone(generation)
                log(paint("◌", "35"), f"camera stream from {self.origin} ended")

        @staticmethod
        def await_close(ws: WebSocket, outbox: queue.Queue):
            with contextlib.suppress(ConnectionError, OSError):
                while ws.recv() is not None:
                    continue
            app.camera.offer(outbox, None)

        def camera_viewer(self, ws: WebSocket):
            outbox = app.camera.add_viewer()
            threading.Thread(target=self.await_close, args=(ws, outbox), daemon=True).start()
            try:
                ws.send_json(app.camera.status())
                while True:
                    try:
                        item = outbox.get(timeout=15)
                    except queue.Empty:
                        ws.send(0x9)
                        continue
                    if item is None:
                        break
                    kind, payload = item
                    ws.send(0x2 if kind == "bin" else 0x1, payload)
            except (ConnectionError, OSError):
                return
            finally:
                app.camera.remove_viewer(outbox)

        def send_manifest(self):
            start = f"/?k={app.token}" if self.authorized() else "/"
            manifest = {
                "name": "phonedrop",
                "short_name": "phonedrop",
                "start_url": start,
                "scope": "/",
                "display": "standalone",
                "id": "/",
                "description": "Wifi drop zone between this PC and your phone",
                "background_color": "#0a0a0a",
                "theme_color": "#0a0a0a",
                "icons": [{"src": "/icon.png", "sizes": "512x512", "type": "image/png"}],
            }
            self.send_bytes(200, json.dumps(manifest).encode(), "application/manifest+json")

        def send_locked(self):
            body = (b"<!doctype html><meta name=viewport content='width=device-width,initial-scale=1'>"
                    b"<title>phonedrop</title><body style='font:17px system-ui;display:grid;place-items:center;"
                    b"min-height:90vh;text-align:center;background:#0a0a0a;color:#ededed;margin:0;padding:24px'>"
                    b"<div><h2>Not paired</h2><p style='color:#8a8a8a'>Run <code>phonedrop qr</code> on your PC"
                    b" and scan the code with your camera.</p></div>")
            self.send_bytes(401, body, "text/html; charset=utf-8")

        def send_zip(self, names: list[str]):
            # imported on demand: zipfile and tempfile add ~0.5 MB to an otherwise idle daemon
            import tempfile
            import zipfile
            paths = [p for p in (app.store.resolve(n) for n in names) if p]
            if not paths:
                return self.send_error(404)
            stamp = datetime.now().strftime("%Y%m%d-%H%M")
            with tempfile.TemporaryFile() as archive:
                with zipfile.ZipFile(archive, "w", zipfile.ZIP_STORED) as bundle:
                    for path in paths:
                        bundle.write(path, app.store.relative(path))
                size = archive.tell()
                archive.seek(0)
                self.send_response(200)
                self.send_header("Content-Type", "application/zip")
                self.send_header("Content-Length", str(size))
                self.send_header("Content-Disposition", f"attachment; filename=phonedrop-{stamp}.zip")
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                if self.command == "HEAD":
                    return
                try:
                    shutil.copyfileobj(archive, self.wfile, 1 << 20)
                except (BrokenPipeError, ConnectionResetError):
                    return
            log(paint("↓", "34"), f"zip of {len(paths)} files {dim('to ' + self.origin)}")

        def send_file(self, name: str):
            path = app.store.resolve(name)
            if not path:
                return self.send_error(404)
            size = path.stat().st_size
            ctype = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
            disposition = "attachment" if "dl" in self.query() else "inline"
            headers = {
                "Accept-Ranges": "bytes",
                "Content-Disposition": f"{disposition}; filename*=UTF-8''{urllib.parse.quote(path.name)}",
                "Cache-Control": "private, max-age=3600",
            }
            start, end = 0, size - 1
            match = re.fullmatch(r"bytes=(\d*)-(\d*)", self.headers.get("Range", ""))
            status = 200
            if match and size and (match.group(1) or match.group(2)):
                if match.group(1):
                    start = int(match.group(1))
                    end = min(int(match.group(2)), size - 1) if match.group(2) else size - 1
                else:
                    start = max(size - int(match.group(2)), 0)
                if start > end:
                    self.send_response(416)
                    self.send_header("Content-Range", f"bytes */{size}")
                    self.end_headers()
                    return
                status = 206
                headers["Content-Range"] = f"bytes {start}-{end}/{size}"
            self.send_response(status)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(end - start + 1 if size else 0))
            for key, value in headers.items():
                self.send_header(key, value)
            self.end_headers()
            if self.command == "HEAD" or not size:
                return
            remaining = end - start + 1
            try:
                with path.open("rb") as fh:
                    fh.seek(start)
                    while remaining > 0:
                        chunk = fh.read(min(remaining, 1 << 20))
                        if not chunk:
                            break
                        self.wfile.write(chunk)
                        remaining -= len(chunk)
            except (BrokenPipeError, ConnectionResetError):
                return
            if status == 200 and disposition == "attachment":
                log(paint("↓", "36"), f"{bold(path.name)}  {dim(human_size(size) + ' to ' + self.origin)}")

        def stream_events(self):
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            events = app.hub.subscribe()
            device = "" if self.is_local else self.origin
            if device:
                # without this a phone that drops off wifi keeps its stream "open" for many minutes
                self.connection.setsockopt(socket.IPPROTO_TCP, socket.TCP_USER_TIMEOUT, STREAM_DEAD_AFTER_MS)
                app.presence.change(device, 1)
            try:
                self.wfile.write(b"retry: 2000\n\n")
                self.wfile.flush()
                while True:
                    try:
                        event, data = events.get(timeout=20)
                        self.wfile.write(f"event: {event}\ndata: {data}\n\n".encode())
                    except queue.Empty:
                        self.wfile.write(b": ping\n\n")
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, OSError):
                return
            finally:
                app.hub.unsubscribe(events)
                if device:
                    app.presence.change(device, -1)

    return Handler


def qr_svg(text: str) -> str:
    if not shutil.which("qrencode"):
        return ""
    return subprocess.run(["qrencode", "-t", "SVG", "-m", "1", "--svg-path", "-o", "-", text],
                          capture_output=True, text=True).stdout


def print_qr(text: str) -> None:
    if not shutil.which("qrencode"):
        print(f"  {dim('install qrencode for a QR code:')} sudo pacman -S qrencode\n")
        return
    fmt = "ansiutf8" if USE_COLOR else "utf8"
    qr = subprocess.run(["qrencode", "-t", fmt, "-m", "2", text], capture_output=True, text=True).stdout
    for line in qr.splitlines():
        print(f"  {line}")


def print_banner(state: dict) -> None:
    root = state["dir"].replace(str(Path.home()), "~", 1)
    print()
    print(f"  {bold('phonedrop')}  {dim('files and text between this PC and your phone')}")
    print()
    print(f"  {dim('phone ')}  {bold(paint(state['url'], '36'))}")
    print(f"  {dim('pc    ')}  {state['local_url']}  {dim('(phonedrop open)')}")
    print(f"  {dim('folder')}  {root}")
    if state.get("https_url"):
        print(f"  {dim('camera')}  {state['https_url']}cam  {dim('(phonedrop cam)')}")
    print()
    print_qr(state["pair_url"])
    print(f"  {dim('scan with the iPhone camera, then Share → Add to Home Screen')}")
    print()


def announce_over_dbus(ip: str) -> Bus | None:
    """Publish MDNS_NAME through avahi's DBus API; the record lives exactly as long as the connection."""
    bus = Bus(system=True)
    (group,) = bus.call_sync(AVAHI, "/", "org.freedesktop.Avahi.Server", "EntryGroupNew")
    bus.call_sync(AVAHI, group, AVAHI_GROUP, "AddAddress", "iiuss", (-1, 0, AVAHI_NO_REVERSE, MDNS_NAME, ip))
    bus.call_sync(AVAHI, group, AVAHI_GROUP, "Commit")
    for _ in range(20):
        (state,) = bus.call_sync(AVAHI, group, AVAHI_GROUP, "GetState")
        if state in (AVAHI_COLLISION, AVAHI_FAILURE):
            return None
        if state == AVAHI_ESTABLISHED:
            break
        time.sleep(0.1)
    return bus


def announce_with_subprocess(ip: str) -> subprocess.Popen | None:
    if not shutil.which("avahi-publish-address"):
        return None
    proc = subprocess.Popen(["avahi-publish-address", "-R", MDNS_NAME, ip],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.4)
    if proc.poll() is not None:
        return None
    atexit.register(proc.terminate)
    return proc


def publish_mdns(ip: str) -> Bus | subprocess.Popen | None:
    if subprocess.run(["systemctl", "is-active", "--quiet", "avahi-daemon"]).returncode != 0:
        return None
    try:
        return announce_over_dbus(ip)
    except (OSError, DBusError, ValueError) as error:
        log(paint("!", "33"), f"mDNS over DBus failed ({error}), falling back to avahi-publish-address")
    return announce_with_subprocess(ip)


class Server(ThreadingHTTPServer):
    """Threaded server; with `secure` it speaks TLS, building the context on the first connection."""

    daemon_threads = True

    def __init__(self, address, handler, secure: bool = False):
        super().__init__(address, handler)
        self.secure = secure
        self.tls: ssl.SSLContext | None = None

    def get_request(self):
        sock, address = super().get_request()
        if not self.secure:
            return sock, address
        if self.tls is None:
            self.tls = tls_context()
        return self.tls.wrap_socket(sock, server_side=True, do_handshake_on_connect=False), address

    def handle_error(self, request, client_address):
        if isinstance(sys.exc_info()[1], OSError):
            return
        super().handle_error(request, client_address)


def bind_server(handler, start_port: int, secure: bool = False) -> Server:
    for port in range(start_port, start_port + PORT_ATTEMPTS):
        try:
            return Server(("0.0.0.0", port), handler, secure)
        except OSError as error:
            if error.errno != errno.EADDRINUSE:
                raise
    sys.exit(f"No free port in {start_port}-{start_port + PORT_ATTEMPTS - 1}")


def running_state() -> dict | None:
    state = read_json(STATE_FILE, None)
    if not state:
        return None
    try:
        os.kill(state["pid"], 0)
    except (ProcessLookupError, KeyError, PermissionError):
        return None
    return state


def launch(args: list[str]) -> None:
    """Start a detached program; under systemd it gets its own scope so stopping phonedrop never kills it."""
    if UNDER_SYSTEMD and shutil.which("systemd-run"):
        args = ["systemd-run", "--user", "--scope", "--collect", "--quiet", "--", *args]
    subprocess.Popen(args, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                     start_new_session=True)


def open_url(url: str) -> None:
    for browser in ("brave", "google-chrome-stable", "chromium"):
        if shutil.which(browser):
            return launch([browser, f"--app={url}"])
    launch(["xdg-open", url])


def stop_self() -> None:
    if UNDER_SYSTEMD:
        subprocess.Popen(["systemctl", "--user", "stop", "phonedrop.service"])
    else:
        os.kill(os.getpid(), signal.SIGINT)


def start_tray(app: App, root: Path, local_url: str) -> None:
    # imported on demand so --no-tray pays nothing for the DBus code
    from phonedrop_tray import MenuItem, Tray

    def describe() -> tuple[str, bool]:
        text, live = app.camera.summary()
        return f"{app.presence.summary()}\n{text}\nPhone: {app.public_url}", live

    def ring() -> None:
        notify("phonedrop", ring_phone() or "Ringing the phone")

    def menu() -> list:
        text, live = app.camera.summary()
        items = [
            MenuItem("Open phonedrop", lambda: open_url(local_url)),
            MenuItem("Camera viewer" + (" · live" if live else ""), lambda: open_url(local_url + "cam")),
            MenuItem("Open folder", lambda: launch(["xdg-open", str(root)])),
        ]
        if BARK_FILE.exists():
            items.append(MenuItem("Ring phone", lambda: threading.Thread(target=ring, daemon=True).start()))
        if shutil.which("wl-copy"):
            items.append(MenuItem("Copy phone link", lambda: launch(["wl-copy", app.pair_url])))
        return [*items, MenuItem(separator=True), MenuItem(app.presence.summary()), MenuItem(text),
                MenuItem(separator=True),
                MenuItem("Stop phonedrop", stop_self)]

    tray = Tray(str(APP_DIR / "tray.png"), "phonedrop", describe, menu, lambda: open_url(local_url))
    app.camera.on_change = tray.refresh
    app.presence.on_change = tray.refresh
    tray.start(lambda error: log(paint("!", "31"), f"tray unavailable: {error}"))


def serve(folder: str, port: int, tray: bool = True) -> None:
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    root = Path(folder).expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    store = Store(root)
    hub = Hub()
    token = load_token()
    ip = lan_ip()

    placeholder = App(store, hub, token, "")
    server = bind_server(make_handler(placeholder), port)
    bound_port = server.server_address[1]
    mdns = publish_mdns(ip)
    host = MDNS_NAME if mdns else ip
    placeholder.public_url = f"http://{host}:{bound_port}/"
    secure = bind_server(make_handler(placeholder), bound_port + 1, secure=True) if ensure_certs(ip) else None
    if secure:
        placeholder.https_url = f"https://{host}:{secure.server_address[1]}/"
        threading.Thread(target=secure.serve_forever, daemon=True).start()

    state = {
        "pid": os.getpid(),
        "port": bound_port,
        "dir": str(root),
        "url": placeholder.public_url,
        "ip_url": f"http://{ip}:{bound_port}/",
        "local_url": f"http://localhost:{bound_port}/",
        "pair_url": placeholder.pair_url,
        "https_url": placeholder.https_url,
    }
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    write_json(STATE_FILE, state)
    atexit.register(lambda: STATE_FILE.unlink(missing_ok=True))

    threading.Thread(target=watch_folder, args=(store, hub), daemon=True).start()
    if tray:
        start_tray(placeholder, root, state["local_url"])
    print_banner(state)
    if host == ip:
        print(f"  {dim('tip: sudo systemctl enable --now avahi-daemon  →  stable http://' + MDNS_NAME + ' address')}\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print(f"\n  {dim('stopped')}\n")
    finally:
        server.server_close()
        if secure:
            secure.server_close()


def systemctl(*args: str) -> int:
    return subprocess.run(["systemctl", "--user", *args]).returncode


def install(folder: str, port: int, tray: bool = True) -> None:
    root = Path(folder).expanduser().resolve()
    command = [sys.executable, "-S", str(LAUNCHER), "serve", str(root), "--port", str(port), *([] if tray else ["--no-tray"])]
    UNIT_FILE.parent.mkdir(parents=True, exist_ok=True)
    UNIT_FILE.write_text(
        "[Unit]\n"
        "Description=phonedrop — wifi drop zone for your phone\n"
        "After=network-online.target\n\n"
        "[Service]\n"
        f"ExecStart={shlex.join(command)}\n"
        "Restart=on-failure\n"
        "RestartSec=3\n"
        "Environment=PYTHONUNBUFFERED=1\n"
        "Environment=MALLOC_ARENA_MAX=2\n"
        "UnsetEnvironment=PYTHONDONTWRITEBYTECODE\n"
        f"Environment=PYTHONPYCACHEPREFIX={PYCACHE_DIR}\n\n"
        "[Install]\n"
        "WantedBy=default.target\n"
    )
    DESKTOP_FILE.parent.mkdir(parents=True, exist_ok=True)
    DESKTOP_FILE.write_text(
        "[Desktop Entry]\n"
        "Type=Application\n"
        "Name=phonedrop\n"
        "Comment=Send files and text to your phone over wifi\n"
        f"Exec={LAUNCHER} open\n"
        f"Icon={APP_DIR / 'icon.png'}\n"
        "Categories=Network;FileTransfer;\n"
        "Keywords=phone;iphone;share;transfer;airdrop;\n"
    )
    systemctl("daemon-reload")
    systemctl("enable", "phonedrop.service")
    systemctl("restart", "phonedrop.service")
    for _ in range(30):
        time.sleep(0.2)
        state = running_state()
        if state:
            print_banner(state)
            print(f"  {dim('service enabled — starts at login · app launcher entry: phonedrop')}\n")
            return
    sys.exit("Service did not start — check: phonedrop logs")


def uninstall() -> None:
    systemctl("disable", "--now", "phonedrop.service")
    UNIT_FILE.unlink(missing_ok=True)
    DESKTOP_FILE.unlink(missing_ok=True)
    systemctl("daemon-reload")
    print("  phonedrop service and launcher entry removed (shared folder left untouched)")


def open_window(path: str = "") -> None:
    state = running_state()
    if not state:
        sys.exit("phonedrop is not running — start it with: phonedrop install")
    open_url(state["local_url"] + path)


def parse_args(argv: list[str]) -> tuple[str, dict]:
    if "-h" in argv or "--help" in argv:
        print(__doc__.strip())
        sys.exit(0)
    command = argv[0] if argv else ""
    if command not in COMMANDS:
        sys.exit(f"phonedrop: unknown command '{command}' (try phonedrop --help)")
    options = {"dir": str(DEFAULT_DIR), "port": DEFAULT_PORT, "tray": True}
    rest = iter(argv[1:])
    for arg in rest:
        if command == "ring" and "key" not in options and not arg.startswith("-"):
            options["key"] = arg
            continue
        if command not in ("serve", "install"):
            sys.exit(f"phonedrop {command}: unexpected argument '{arg}'")
        if arg in ("-p", "--port"):
            options["port"] = parse_port(next(rest, ""))
        elif arg.startswith("--port="):
            options["port"] = parse_port(arg.partition("=")[2])
        elif arg == "--no-tray":
            options["tray"] = False
        elif arg.startswith("-"):
            sys.exit(f"phonedrop {command}: unknown option '{arg}'")
        else:
            options["dir"] = arg
    return command, options


def parse_port(raw: str) -> int:
    if not raw.isdigit() or not 0 < int(raw) < 65536:
        sys.exit(f"phonedrop: invalid port '{raw}'")
    return int(raw)


def main() -> None:
    command, options = parse_args(sys.argv[1:])

    if command == "serve":
        serve(options["dir"], options["port"], options["tray"])
    elif command == "install":
        install(options["dir"], options["port"], options["tray"])
    elif command == "uninstall":
        uninstall()
    elif command == "open":
        open_window()
    elif command == "cam":
        open_window("cam")
    elif command == "ring":
        if "key" in options:
            save_bark_key(options["key"])
        error = ring_phone()
        if error:
            sys.exit(f"phonedrop ring: {error}")
        print("  ringing the phone")
    elif command == "logs":
        os.execvp("journalctl", ["journalctl", "--user", "-u", "phonedrop", "-f", "-o", "cat"])
    elif command == "status":
        os.execvp("systemctl", ["systemctl", "--user", "status", "phonedrop"])
    elif command == "qr" or running_state():
        state = running_state()
        if not state:
            sys.exit("phonedrop is not running — start it with: phonedrop install (or phonedrop serve)")
        print_banner(state)
    else:
        serve(str(DEFAULT_DIR), DEFAULT_PORT)


if __name__ == "__main__":
    main()
