# shieldcn badge catalogue, house-style subset

Every URL is `https://shieldcn.dev/<endpoint>.svg?font=jetbrains-mono`. The full
catalogue is in the `shieldcn-badges` skill; this file holds the endpoints a README
in the house style can use and the evidence in the repo that earns each one.

## Repo state (GitHub)

| Evidence in the repo | Endpoint | alt |
|---|---|---|
| a GitHub release exists | `/github/<owner>/<repo>/release` | `release` |
| `.github/workflows/*.yml` runs on push | `/github/<owner>/<repo>/ci` | `CI` |
| `LICENSE` file | `/github/<owner>/<repo>/license` | `license` |
| a public download count worth showing | `/github/<owner>/<repo>/dt` | `downloads` |
| Dependabot config | `/github/<owner>/<repo>/dependabot` | `dependabot` |

CI takes `?workflow=<name>&branch=<branch>` when the default workflow is not the one
that matters. Never use stars, forks, watchers, issues, open PRs, contributors, or
last-commit badges; they are vanity or noise.

## Registries

Only when the project is published there. Check the manifest name and that the
package resolves before writing the URL.

| Evidence | Endpoint | alt |
|---|---|---|
| `package.json` `name`, not `private`, published | `/npm/<package>` (scoped: `/npm/v/@scope/name`) | `npm` |
| same, and downloads are a real signal | `/npm/dm/<package>` | `downloads` |
| `types` or `.d.ts` shipped | `/npm/types/<package>` | `types` |
| a small library where size is the pitch | `/bundlephobia/minzip/<package>` | `minzip` |
| `Cargo.toml` `[package]`, on crates.io | `/crates/<crate>` | `crates.io` |
| `pyproject.toml`, on PyPI | `/pypi/<package>` | `PyPI` |
| `jsr.json` / `deno.json` published | `/jsr/@scope/name` | `JSR` |
| `Formula/` or a tap | `/homebrew/<formula>` | `Homebrew` |
| a Docker Hub image | `/docker/pulls/<image>` | `pulls` |
| Go module | none; use a static `go-<version>` badge | |

## Custom (static)

`/badge/<label>-<value>-black`, optionally `&logo=<simple-icons slug>`. Hyphens in
label or value are doubled (`local--first`), spaces are `%20`. Three or four per
row, each saying something true and specific: core language, storage model,
runtime, deploy target, notable constraint. `logo` accepts a SimpleIcons slug
(`rust`, `react`, `cloudflare`, `tauri`, `typescript`, `bun`, `sqlite`, `go`,
`python`, `webassembly`, `docker`); `logo=false` suppresses the auto icon.

Examples that have shipped:

```
/badge/core-Rust-black&logo=rust
/badge/shell-Tauri-black&logo=tauri
/badge/storage-local--first-black
/badge/web-WebAssembly-black&logo=webassembly
/badge/PDF-hand--written-black
/badge/UI-no%20framework-black&logo=typescript
/badge/edge-Cloudflare-black&logo=cloudflare
/badge/engines-8-black
```

## Group

`/group/<a>+<b>+<c>.svg` joins several badges into one image. Use it only when a
row would otherwise exceed seven badges and the joined ones share a link; the
default is separate `<img>` tags.

## Styling

The house style fixes `font=jetbrains-mono` and the black custom color and uses
the default variant, size, and mode. Do not add `variant`, `theme`, `gradient`,
`animate`, `split`, `statusDot`, or size overrides. If a badge needs to read on
both GitHub themes, the default already does; `<picture>` with `mode=` is for
headers, which the house style does not use.
