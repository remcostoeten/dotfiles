---
name: desktop-screenshots
description: Take screenshots of Remco's real KDE Plasma desktop without anything showing on his screen, using kiekje's headless capture. Use whenever you are asked to show, look at or screenshot a window or app, to prove a visual change, to make a before and after or side-by-side comparison, a pixel diff, or images for a PR, and whenever seeing the actual screen would answer a question faster than reading code.
---

# Desktop screenshots

Kiekje can capture one window or the whole desktop straight into a file from the command line. Nothing appears on screen: no overlay, no flash, no clipboard change, no notification or sound, no gallery entry. A window is rendered on its own by KWin, so it comes out whole even when other windows cover it. Use this instead of driving the kiekje overlay with `ydotool`, which types into whatever window has focus.

Works on KDE Plasma 6 only. Elsewhere `windows` and window capture exit with "need KWin".

## Setup

The scripts use the agent build at `~/.local/lib/kiekje-agent/kiekje`. If it is missing, or `shot` reports that KWin refused ScreenShot2 access, run:

```bash
~/.agents/skills/desktop-screenshots/scripts/install-agent-kiekje
```

It builds `origin/master` of `~/dev/kiekje-next` in release mode (a few minutes the first time). It installs the binary and writes the hidden desktop file `~/.local/share/applications/dev.remcostoeten.Kiekje.agent.desktop`, without which KWin refuses the capture. It never touches `~/.cargo/bin/kiekje` or the running kiekje daemon, which other sessions deploy and restart.

KWin authorizes ScreenShot2 per executable path, through a desktop file whose `Exec` names that path and whose `X-KDE-DBUS-Restricted-Interfaces` lists `org.kde.KWin.ScreenShot2`. KWin keeps its own service cache and only notices a desktop file change when the directory's mtime changes. Write desktop files to a temp name and `mv` them into place. Running `kbuildsycoca6` from a shell is not enough, because it builds a cache for the shell's `XDG_DATA_DIRS`, not KWin's.

## Capture

`S=~/.agents/skills/desktop-screenshots/scripts`

| Command | Result |
| --- | --- |
| `$S/shot --list` | One line per visible window, topmost first: id, `WxH+X+Y` in logical pixels, application, title, tab separated |
| `$S/shot <pattern>` | The topmost window whose title, or else application, contains `pattern` (case-insensitive) |
| `$S/shot --id '{uuid}'` | That exact window, for when several match |
| `$S/shot --screen` | Every monitor stitched into one image |
| `... out.png` | Write there instead of `/tmp/kiekje-agent/<name>-<time>.png`. The file must not exist yet; `.jpg` writes JPEG |
| `... --crop x,y,w,h` | Keep part of the capture, in pixels of the captured image |

Each successful run prints the file path on stdout and exits 0. Errors go to stderr with exit 1.

- Captures are at native resolution. The monitor runs at scale 1.25, so a 960x700 window becomes 1200x875 pixels. Crop coordinates are image pixels, not logical ones.
- Image viewers in agent tools often show large images downscaled; Claude Code's `Read` states the factor ("multiply by 1.92"). Multiply what you see by that factor to get a `--crop` rectangle, then take a cropped capture to read small text or check details.
- Minimized windows are not listed and cannot be captured. Windows on another virtual desktop are untested.
- Opening a window (for example `kiekje settings` or launching an app) does show on Remco's screen. Capturing never does. Prefer capturing what is already open, and say so when you open something.

## Show it

- To show Remco an image, embed it in the reply with its absolute path: `![Settings window](/tmp/kiekje-agent/settings.png)`.
- Look at every capture yourself before describing or sharing it, so a wrong window or a stale state does not slip through.

## Compare

```bash
$S/side-by-side before.png after.png out.png "Before" "After"
$S/pixel-diff before.png after.png diff.png
```

- `side-by-side` puts two images next to each other on a dark background with a label under each, in Geist. The labels default to Before and After. Crop both captures to the region that changed first, so the result stays readable.
- `pixel-diff` needs two images of the same size. It writes a faded copy with the changed pixels in red, and prints `changed pixels: N`. Zero means the two captures are identical, so it doubles as a check that nothing moved.
- For a before and after of a code change in an app, capture the window, rebuild and restart that app, then capture the same window again with the same `--crop`. For kiekje's own windows, prefer `lab/ui-shot` from the kiekje repo, which runs both builds on a private Xvfb display. Restarting the shared daemon interrupts Remco and other sessions.

## Privacy

- A `--screen` capture holds everything visible: other chats, mail, browser tabs. Capture the one window you need, crop to what matters, and delete full-screen captures once they have served their purpose.
- Keep captures in `/tmp/kiekje-agent`, never in `~/Pictures`.
- A screenshot attached to a PR, an issue or any external service is published. Ask before uploading a capture of the desktop. Captures of the app under change are fine when the PR needs them; the `before-and-after` skill covers attaching them.
