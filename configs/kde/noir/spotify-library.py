#!/usr/bin/env python3
import base64
import hashlib
import http.server
import json
import os
import secrets
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path

CONFIG = Path.home() / ".config/noir-spotify"
CACHE = Path.home() / ".cache/noir-spotify/library.json"
REDIRECT = "http://127.0.0.1:8898/callback"
SCOPES = "playlist-read-private playlist-read-collaborative user-library-read user-read-private"
CACHE_SECONDS = 1800
FUZZEL = [
    "fuzzel", "--dmenu", "--prompt", "  ", "--width", "60", "--lines", "16",
    "--font", "Maple Mono Normal NF:size=12",
    "--background-color", "151515f2", "--text-color", "e6e1d6ff", "--prompt-color", "ff6b2cff",
    "--input-color", "e6e1d6ff", "--match-color", "ff6b2cff", "--selection-color", "4a2416ff",
    "--selection-text-color", "fffaf0ff", "--selection-match-color", "f5c065ff",
    "--border-color", "ff6b2cff", "--border-width", "1", "--border-radius", "0",
]


def notify(message):
    subprocess.run(["notify-send", "-a", "Spotify library", "Spotify library", message], check=False)


def client_id():
    path = CONFIG / "client_id"
    if path.exists():
        return path.read_text().strip()
    webbrowser.open("https://developer.spotify.com/dashboard")
    answer = subprocess.run(
        [
            "kdialog", "--title", "Spotify library setup", "--inputbox",
            "One-time setup:\n\n1. In the Spotify dashboard that just opened, click Create app.\n"
            f"2. Set the Redirect URI to  {REDIRECT}\n3. Tick Web API, save, and paste the Client ID here.",
        ],
        capture_output=True, text=True, check=False,
    ).stdout.strip()
    if not answer:
        sys.exit(1)
    CONFIG.mkdir(parents=True, exist_ok=True)
    path.write_text(answer)
    return answer


def token_request(params):
    body = urllib.parse.urlencode(params).encode()
    request = urllib.request.Request("https://accounts.spotify.com/api/token", data=body, method="POST")
    with urllib.request.urlopen(request, timeout=15) as response:
        token = json.load(response)
    token["expires_at"] = time.time() + token["expires_in"] - 60
    return token


def save_token(token):
    path = CONFIG / "token.json"
    path.write_text(json.dumps(token))
    path.chmod(0o600)


def login(cid):
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    state = secrets.token_urlsafe(16)
    result = {}

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            if query.get("state", [""])[0] == state:
                result["code"] = query.get("code", [""])[0]
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(b"<body style='background:#151515;color:#e6e1d6;font-family:monospace'>Done, you can close this tab.</body>")

        def log_message(self, *args):
            pass

    server = http.server.HTTPServer(("127.0.0.1", 8898), Handler)
    server.timeout = 180
    webbrowser.open("https://accounts.spotify.com/authorize?" + urllib.parse.urlencode({
        "client_id": cid, "response_type": "code", "redirect_uri": REDIRECT, "scope": SCOPES,
        "code_challenge_method": "S256", "code_challenge": challenge, "state": state,
    }))
    server.handle_request()
    server.server_close()
    if not result.get("code"):
        notify("Login was cancelled or timed out.")
        sys.exit(1)
    token = token_request({
        "grant_type": "authorization_code", "code": result["code"], "redirect_uri": REDIRECT,
        "client_id": cid, "code_verifier": verifier,
    })
    save_token(token)
    return token


def access_token(cid):
    path = CONFIG / "token.json"
    if not path.exists():
        return login(cid)["access_token"]
    token = json.loads(path.read_text())
    if time.time() < token.get("expires_at", 0):
        return token["access_token"]
    try:
        fresh = token_request({"grant_type": "refresh_token", "refresh_token": token["refresh_token"], "client_id": cid})
    except urllib.error.HTTPError:
        return login(cid)["access_token"]
    fresh.setdefault("refresh_token", token["refresh_token"])
    save_token(fresh)
    return fresh["access_token"]


def api(token, url):
    request = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(request, timeout=15) as response:
        return json.load(response)


def paged(token, url):
    while url:
        page = api(token, url)
        yield from page["items"]
        url = page.get("next")


def fetch_library(token):
    me = api(token, "https://api.spotify.com/v1/me")
    entries = [{"label": "󰋑  Liked Songs", "uri": f"spotify:user:{me['id']}:collection"}]
    for playlist in paged(token, "https://api.spotify.com/v1/me/playlists?limit=50"):
        if playlist:
            entries.append({"label": f"󰲸  {playlist['name']}", "uri": playlist["uri"]})
    for saved in paged(token, "https://api.spotify.com/v1/me/albums?limit=50"):
        album = saved["album"]
        artists = ", ".join(artist["name"] for artist in album["artists"])
        entries.append({"label": f"󰀥  {album['name']}  ·  {artists}", "uri": album["uri"]})
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(entries))
    return entries


def library():
    fresh = "--refresh" in sys.argv
    if not fresh and CACHE.exists() and time.time() - CACHE.stat().st_mtime < CACHE_SECONDS:
        return json.loads(CACHE.read_text())
    cid = client_id()
    try:
        return fetch_library(access_token(cid))
    except urllib.error.URLError as error:
        if CACHE.exists():
            return json.loads(CACHE.read_text())
        notify(f"Could not reach Spotify: {error}")
        sys.exit(1)


def play(uri):
    if subprocess.run(["playerctl", "-p", "spotify", "status"], capture_output=True, check=False).returncode != 0:
        subprocess.Popen(["spotify"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        for _ in range(30):
            time.sleep(0.5)
            if subprocess.run(["playerctl", "-p", "spotify", "status"], capture_output=True, check=False).returncode == 0:
                break
    subprocess.run(["playerctl", "-p", "spotify", "open", uri], check=False)


def main():
    entries = library()
    labels = "\n".join(entry["label"] for entry in entries)
    choice = subprocess.run(FUZZEL, input=labels, capture_output=True, text=True, check=False).stdout.strip()
    match = next((entry for entry in entries if entry["label"] == choice), None)
    if match:
        play(match["uri"])


if __name__ == "__main__":
    os.umask(0o077)
    main()
