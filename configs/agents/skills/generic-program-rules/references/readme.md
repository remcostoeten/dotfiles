# README layout

Read this whenever a README is created, rewritten or restructured. When only one section is touched, apply that section's rules and leave the rest alone. The README rules and writing voice in `SKILL.md` apply throughout.

## Before writing

Read the repo: `package.json` / `Cargo.toml` / `go.mod` and lockfiles for the stack, `.github/workflows/` for CI, `LICENSE`, the git remote for `owner/repo`, existing docs to link instead of restating. Look for a logo (`icons/`, `public/`, `docs/assets/`, `src/assets/brand/`, `app/src-tauri/icons/`) and media (`docs/assets/`, `docs/media/`). Every relative path in the output must resolve in the repo.

## Section order

Leave out any section the project has not earned; never leave one half-filled.

| App (desktop, web, mobile) | CLI / TUI | Library |
|---|---|---|
| header | header | header |
| pitch | pitch | pitch |
| badges | badges | badges |
| demo | demo | body |
| body | body | install |
| usage (if the app has a flow) | install | development (if contributors are expected) |
| install (desktop or self-hosted only) | development | footer |
| privacy (only with a checkable data claim) | footer | |
| development | | |
| footer | | |

## Header

Centered logo at `width="88"` if one exists, then the name as a centered `<h1>`. If the project has light and dark wordmarks, use `<picture>` with a `prefers-color-scheme: dark` source at `width="300"` and drop the `<h1>`.

```html
<p align="center">
  <img src="PATH/TO/LOGO.png" width="88" alt="PROJECT logo" />
</p>

<h1 align="center">PROJECT</h1>
```

## Pitch

If the name is a real word whose meaning fits, use the dictionary entry from `readme-pitches.md`: word, part of speech, pronunciation, language and meaning, then one plain paragraph. Otherwise one line saying what the project is and does, like "A free, open-source database client for working with local and remote data." Add a line only when it carries a fact the reader needs.

## Badges

All from `shieldcn.dev` with `?font=jetbrains-mono`, one centered row, each with a real `alt`. Order: repo state (release, CI, license, only when the repo has them), then registry (npm, crates, etc., only when published), then three or four custom `label-value-black` badges naming what is distinct about this project (core language, storage model, runtime, deploy target). Seven at most. No download or star counts. Endpoints are in `badge-catalogue.md`; check anything not listed there against the `shieldcn-badges` skill. In static badges, double hyphens inside a value (`local--first`) and use `%20` for spaces.

## Demo

A GIF, `.webp` animation, screenshot or other graphic, committed in the repo and referenced relatively (GitHub does not autoplay relative `.mp4`). The `alt` describes what the image shows in sequence. For a recording, a `<sub>` caption says where it was recorded (a URL, or the terminal and shell for a CLI). No graphic in the repo means no demo section; mention in the summary that one would help.

```html
<p align="center">
  <img src="docs/assets/demo.gif" width="100%" alt="WHAT HAPPENS, IN ORDER" />
</p>
<p align="center">
  <sub>WHERE IT WAS RECORDED.</sub>
</p>
```

## Body

One or two short paragraphs saying what the product is, then one-line bullets describing behavior a user would notice (seven at most, five for a library). Bold at most one phrase per bullet. Point at a live URL or the latest release if one exists. Close with one line linking deeper docs that exist, by filename.

## Usage

Apps with a flow only (setup, repeated use, a close or export). Three to five short paragraphs in the order a user meets them, each naming a concrete control or artefact. No sub-headings, no numbered list. Only steps verified in the code.

## Install

One `###` per channel the project actually publishes to (check release workflows, `Formula/`, `bucket/`, `PKGBUILD`, package names), each with a copy-pasteable block. `powershell` fences for Scoop and winget, `bash` for the rest. A desktop app with release assets opens with one sentence linking the latest release. A web app with one live URL has no Install section.

## Privacy

Only when the project makes a real, checkable claim about data. Lead with the claim in bold, say what happens by default, where data lives and what a fresh install sends over the network. State where the guarantee stops and link the file that proves it. If analytics exist, say what they collect, what they never collect, and how to turn them off.

## Development

Required versions in one sentence (from `.tool-versions`, `.nvmrc`, `rust-toolchain.toml`, `engines` or CI). Then the three or four commands that matter, each with a trailing comment saying what it does. Then one sentence linking the development doc, `CONTRIBUTING.md` and `SECURITY.md`, naming only files that exist.

## Footer

The last thing in the file. `xxx` is the default greeting; change it only when asked. The license comes from `LICENSE` (MIT by default; if the file is missing, say so in the summary). The PS line is optional: a thanks, a credit, or a note that a dependency has its own terms.

```html
<br/>

xxx,<br/>
[Remco Stoeten](https://remcostoeten.com)<br/>
<small>MIT</small>
```
