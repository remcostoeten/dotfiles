# Badges

All badges come from `shieldcn.dev`, always with `?font=jetbrains-mono`, all on one
centered row, each with a real `alt`.

Repo state, only when the repo actually has it:

```
https://shieldcn.dev/github/<owner>/<repo>/release.svg?font=jetbrains-mono   needs a GitHub release
https://shieldcn.dev/github/<owner>/<repo>/ci.svg?font=jetbrains-mono        needs .github/workflows/
https://shieldcn.dev/github/<owner>/<repo>/license.svg?font=jetbrains-mono   needs a LICENSE file
```

Then three to four custom badges that say something true and specific about this
project, in `label-value-black` form, with a `logo` when one fits:

```
https://shieldcn.dev/badge/core-Rust-black.svg?font=jetbrains-mono&logo=rust
https://shieldcn.dev/badge/PDF-hand--written-black.svg?font=jetbrains-mono
```

Hyphens inside a value are doubled (`local--first`), spaces are `%20`. Pick the
badges from what makes this project distinct: its core language, its storage model,
its runtime, its deploy target, its notable constraint. A row of generic ecosystem
logos says nothing. Six or seven badges total is the ceiling.

The custom badges in the example are skriuw's and Papertrail's. Do not copy
`storage-local--first` or `edge-Cloudflare` into a project that is not local-first or
not on Cloudflare.

## Picking from the catalogue

`references/badge-catalogue.md` maps repo evidence to endpoints: release, CI,
license, and downloads for GitHub; npm, crates, PyPI, JSR, Homebrew, Docker for
registries; static badges for everything else. Read it before writing the row.
The order is always repo state, then registry, then custom. A library published to
npm gets `/npm/<package>` right after the license badge; an app that is not
published anywhere gets no registry badge. Never add a badge the catalogue does not
list without checking it in the `shieldcn-badges` skill first.
