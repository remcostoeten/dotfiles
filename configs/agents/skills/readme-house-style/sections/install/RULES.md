# Installation

Copy-pasteable blocks per platform or package manager, with a `###` sub-heading
each, and no commentary between them beyond a caveat that actually matters (a stale
AUR package, a paused publication).

Only list channels the project actually publishes to. Check release workflows,
`Formula/`, `bucket/`, `PKGBUILD`, `package.json` `name`, `Cargo.toml` `[package]`
before writing a heading.

A desktop app with GitHub release assets opens with one sentence linking the latest
release and naming the asset formats, then the package-manager blocks.

Use `powershell` as the fence language for Scoop and winget blocks, `bash` for the
rest.

A web app with a single live URL has no Installation section; the body already
points at the URL.
