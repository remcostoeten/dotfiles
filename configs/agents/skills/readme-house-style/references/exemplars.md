# Exemplar READMEs

Two shipped READMEs in the house style. Skriuw is the large end (desktop app, install matrix, privacy, two product lines); Papertrail is the compact end (web app, one install path). Note that both of these predate the footer rule in SKILL.md and still carry a `## License` heading, which is wrong: use the sign-off footer instead.

---

## skriuw/README.md

````markdown
<p align="center">
  <img src="app/src-tauri/icons/128x128.png" width="88" alt="Skriuw logo" />
</p>

<h1 align="center">Skriuw</h1>

<p align="center">
  <em><strong>skriuw</strong> · verb · Frisian<br />
  "to write"</em>
</p>


<p align="center">
  A blazing-fast, local-first workspace for writing, journaling, and connected knowledge.<br />
  Runs fully offline on macOS, Windows, and Linux. No account required.<br />
  Sign in to sync your workspace and continue in the browser,<br />
  running the same Rust core compiled to WebAssembly.
</p>

<p align="center">
  <img
    src="https://shieldcn.dev/github/remcostoeten/skriuw/release.svg?font=jetbrains-mono"
    alt="release"
  />
  <img
    src="https://shieldcn.dev/github/remcostoeten/skriuw/ci.svg?font=jetbrains-mono"
    alt="CI"
  />
  <img
    src="https://shieldcn.dev/github/remcostoeten/skriuw/license.svg?font=jetbrains-mono"
    alt="license"
  />
  <img
    src="https://shieldcn.dev/badge/storage-local--first-black.svg?font=jetbrains-mono"
    alt="storage local-first"
  />
  <img
    src="https://shieldcn.dev/badge/core-Rust-black.svg?font=jetbrains-mono&logo=rust"
    alt="core Rust"
  />
  <img
    src="https://shieldcn.dev/badge/web-WebAssembly-black.svg?font=jetbrains-mono&logo=webassembly"
    alt="web WebAssembly"
  />
</p>

<p align="center">
  <img src="docs/assets/demo.gif" width="100%" alt="Creating a note in Skriuw: the slash menu, Markdown shortcuts, a #tag, an @note link, raw Markdown mode, then jumping to the linked note from the command palette" />
</p>
<p align="center">
  <sub>The browser build at <a href="https://skriuw.com/app">skriuw.com/app</a>, driven from the keyboard, captured in real time and uncut. The desktop app is the same renderer on the same Rust core.</sub>
</p>

Your workspace is a SQLite database on your machine. Open the app, type, and
every keystroke paints in the same frame: no spinners, no server round-trips,
no account. Try it without installing anything: the **full app runs in your
browser** at [skriuw.com/app](https://skriuw.com/app).

- A real rich-text editor that speaks Markdown
- `#` tags, `$` people, and `@` note links; renames propagate, backlinks everywhere
- Automatic Git history and verified backups, in the background
- Imports from Obsidian, Notion, Bear, Apple Notes, and plain Markdown
- Keyboard-first, fast at thousands of notes, sync strictly opt-in
- Nine themes (Skriuw, Paper, Embers, Catppuccin, Rosé Pine, Gruvbox, Tokyo
  Night) and sans, serif, or mono editor type
- Optional AI writing tools: invisible until enabled, local-first via Ollama,
  or bring your own Gemini/Groq key

Everything else (journal, tabs, split view, flowcharts, properties, trash)
is in [FEATURES.md](docs/FEATURES.md). How it is built is in
[ARCHITECTURE.md](docs/ARCHITECTURE.md), and the speed budgets it is held to
are in [docs/performance-contract.md](docs/performance-contract.md).

## Installation

The [latest GitHub release](https://github.com/remcostoeten/skriuw/releases/latest)
has installers for macOS, Windows, and Linux (`.dmg`, `.exe`/`.msi`, `.deb`,
`.rpm`, AppImage).

### Debian / Ubuntu (APT)

```bash
curl -fsSL https://remcostoeten.github.io/skriuw/apt/key.gpg \
  | sudo gpg --dearmor -o /usr/share/keyrings/skriuw.gpg
echo "deb [signed-by=/usr/share/keyrings/skriuw.gpg] https://remcostoeten.github.io/skriuw/apt stable main" \
  | sudo tee /etc/apt/sources.list.d/skriuw.list
sudo apt update && sudo apt install skriuw
```

### Fedora / RHEL / openSUSE (dnf)

```bash
sudo dnf config-manager addrepo --from-repofile=https://remcostoeten.github.io/skriuw/rpm/skriuw.repo
sudo dnf install skriuw
```

### macOS (Homebrew)

```bash
brew tap remcostoeten/skriuw https://github.com/remcostoeten/skriuw
brew install --cask skriuw
```

### Windows (Scoop)

```powershell
scoop bucket add skriuw https://github.com/remcostoeten/skriuw
scoop install skriuw
```

### Arch Linux (AUR)

```bash
yay -S skriuw-bin
```

AUR publication is currently paused upstream, so that package can lag behind
the latest release. Winget and Snap are wired into release automation but
have no current publication; use a release asset or one of the channels above.

## Privacy

**Nothing syncs unless you sign in.** Sync is off until you create an account
and turn it on, on desktop and in the browser alike. Until then your notes
never leave the machine they were written on: the desktop app keeps them in
local SQLite, and the browser app keeps them in your browser's own storage.

A fresh install performs no network requests, and there is no analytics or
telemetry of any kind. The only network code in the app is the sync Worker,
which runs only while you are signed in, and the updater's version check.

The AI features follow the same rule. They are **off and invisible until you
enable them in settings**, and default to a local Ollama model, so prompts
never leave your machine. Remote providers (Gemini, Groq) run only with your
own API key — stored in the OS keychain, never in the database or exports —
and only after a per-provider consent that shows exactly what text is sent.

Sync is encrypted in transit but not yet end-to-end
([details](docs/specs/cloud-sync-master.md)), so the server can read what it
stores for you. If that boundary matters, stay local-only.

## Development

Rust 1.95, Bun 1.3, Node.js 24, and the platform dependencies required by
Tauri.

```bash
./scripts/bootstrap.sh   # one-time setup
./scripts/check.sh       # full gate: contracts, lint, all tests
./scripts/build.sh       # build (also: web | desktop | ci)
```

The repository layout, web deployment, and cloud development reference is in
[docs/development.md](docs/development.md). Contributions start at
[CONTRIBUTING.md](CONTRIBUTING.md); report security issues through
[SECURITY.md](SECURITY.md) instead of a public issue.

## Using the previous generation

The previous generation of Skriuw (web, mobile, collaboration, self-hosting)
lives in [`v1/`](v1) and is frozen at `0.25.0`. It is still installable:

```bash
# source as it shipped, before the move into v1/
git clone --branch v0.25.0 --single-branch \
    https://github.com/remcostoeten/skriuw.git skriuw-v1

# self-host image, pinned to the last v1 version
docker pull ghcr.io/remcostoeten/skriuw:0.25.0
```

Desktop installers for macOS, Windows, and Linux are attached to the
[`desktop-v0.25.0` release](https://github.com/remcostoeten/skriuw/releases/tag/desktop-v0.25.0).
The `:latest` container tag still builds from the v1 tree but is rebuilt on
every v2 release, so pin `0.25.0` if you want the frozen version.

To work on v1 in this repository instead, use `v1/` on the current branch, or
`f74af74f` for the last commit that touched it before the freeze. Setup lives
in [`v1/README.md`](v1/README.md).

### Thanks

- Anthropic for sponsoring six months of Claude Max through their [Claude for Open Source](https://claude.com/contact-sales/claude-for-oss) program.
- An abandoned Svelte Markdown project that originally inspired Skriuw's UI. I can no longer find it, so if you recognize it, please get in touch so I can give proper credit.

- ## License

[MIT](LICENSE)



xxx,<br/>
[Remco Stoeten](https://remcostoeten.com)
````

---

## papertrail/README.md

(`~/sandbox/papertrail`, published as `remcostoeten/Papertrail-online-resume-editor`)

````markdown
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="src/assets/brand/wordmark.png" />
    <img src="src/assets/brand/wordmark-light.png" width="300" alt="Papertrail" />
  </picture>
</p>

<p align="center">
  A free, local-first resume builder that writes a real PDF in your browser.<br />
  Import the resume you already have, edit it on the page itself,<br />
  and hand out a read-only link a recruiter opens without signing up.<br />
  No account required, no watermark, no export limit.
</p>

<p align="center">
  <img src="https://shieldcn.dev/github/remcostoeten/Papertrail-online-resume-editor/ci.svg?font=jetbrains-mono" alt="CI" />
  <img src="https://shieldcn.dev/github/remcostoeten/Papertrail-online-resume-editor/license.svg?font=jetbrains-mono" alt="license" />
  <img src="https://shieldcn.dev/badge/storage-local--first-black.svg?font=jetbrains-mono" alt="storage local-first" />
  <img src="https://shieldcn.dev/badge/UI-no%20framework-black.svg?font=jetbrains-mono&logo=typescript" alt="UI no framework" />
  <img src="https://shieldcn.dev/badge/PDF-hand--written-black.svg?font=jetbrains-mono" alt="PDF hand-written" />
  <img src="https://shieldcn.dev/badge/edge-Cloudflare-black.svg?font=jetbrains-mono&logo=cloudflare" alt="edge Cloudflare" />
</p>

<p align="center">
  <img src="docs/media/inline-edit.gif" width="100%" alt="Double-clicking a job title on the resume sheet and typing a new one, with the page reflowing live" />
</p>
<p align="center">
  <sub>The editor at <a href="https://papertrail.cv/app">papertrail.cv/app</a>, captured in real time and uncut. The sheet is the document, not a preview of it: double-click any value and you are typing into the resume.</sub>
</p>

Most resume editors get this backwards. They hand you sidebars, colour blocks and decorative
flourishes, exactly the things a resume does not need. A resume should be plain, readable and out
of its own way. Try it without installing anything at
[papertrail.cv](https://papertrail.cv).

- Import the resume you already have (PDF, `.docx` or JSON Resume) and edit it immediately
- Double-click any value **on the sheet** to type into the resume, with a live page count
- **Download PDF** writes a real vector PDF: tagged for screen readers, fonts embedded, no print dialog
- Read-only share links at `/s/<token>`, snapshot not live view, with an anonymous open log
- Six templates, switched instantly and losslessly; nothing about the content changes
- Sign in with Google, GitHub or a mailed link (there is no password) and your drafts follow you
- Every keystroke saved, up to 30 checkpoints per draft, deletes recoverable

Everything the app does is in [FEATURES.md](docs/FEATURES.md). How it is built, from the PDF
writer to the font subsetter, is in [ARCHITECTURE.md](docs/ARCHITECTURE.md), and running your
own instance is in [deployment.md](docs/deployment.md).

## Privacy

Papertrail is usable without an account, and **nothing leaves your browser until you sign in**.
Drafts live in `localStorage` behind a storage seam; signing in syncs them to Cloudflare D1, merged
by timestamp so a guest draft is never lost by signing in. The PDF is written in the page, so your
resume is never uploaded to export it.

The one runtime dependency is a cookie-free analytics tracker, loaded lazily and absent from the
portable build entirely. It reports pageviews, web vitals and named product events. **No resume
content is ever sent**, and the share viewer reports its path as `/s` rather than `/s/<token>`, so
a share token never reaches the analytics database. [Privacy](https://papertrail.cv/privacy) lists
what is collected and carries a switch to turn it off; `Do Not Track` turns it off with no action.

## Development

Node.js 22 and pnpm. The Worker needs `wrangler`.

```bash
pnpm install
pnpm dev            # Vite on 5173, /api proxied to the Worker on 8787
pnpm test           # Vitest, including byte-for-byte golden PDF comparisons
pnpm build          # tsc --noEmit, then production build to dist/
```

CI runs typecheck (app and Worker), lint, format check, tests (app and Worker) and build on every
push and pull request. The full command list is in [ARCHITECTURE.md](docs/ARCHITECTURE.md);
deploying your own copy (OAuth clients, D1, Resend, secrets) is in
[deployment.md](docs/deployment.md).

## License

[MIT](./LICENSE). The vendored fonts are not covered by it; see
[the font notices](./src/assets/fonts/licenses/NOTICE.md).

<br/>

xxx,<br/>
[Remco Stoeten](https://remcostoeten.com)
````
