---
name: readme-house-style
description: DEPRECATED, do not use. README rules now live in the generic-program-rules skill (references/readme.md). Load that skill instead for any README work.
---

# README house style (deprecated)

> Deprecated on 2026-09-27. Use the `generic-program-rules` skill and its `references/readme.md`. This folder is kept for history only.

The README is a landing page, not documentation. Someone lands on the repo, sees a
logo, reads three lines, watches a GIF, and knows whether to keep going. Depth lives
in `docs/`, linked from the README.

The skill is modular. Every section of the README has its own directory under
`sections/` with three files:

- `TEMPLATE.md`: the block with ALL-CAPS placeholders, ready to fill in
- `RULES.md`: what the block must and must not do
- `example.md`: the block as it shipped in skriuw or Papertrail

`profiles/` lists which sections a given kind of project earns, in order.
`references/voice.md` applies to every section. `references/badge-catalogue.md`
maps repo evidence to shieldcn endpoints. `references/exemplars.md` holds the two
full reference READMEs for when the overall shape matters more than one block.

## Procedure

1. Read the repo rather than guessing: `package.json` / `Cargo.toml` / lockfiles for
   the stack, `.github/workflows/` for CI, `LICENSE`, the git remote for the
   `owner/repo` slug, and existing docs so the README can link to them instead of
   restating them. Look for an existing logo (`icons/`, `public/`,
   `src/assets/brand/`) and existing media (`docs/assets/`, `docs/media/`).
2. Pick the profile: `profiles/library.md`, `profiles/cli.md`, or `profiles/app.md`.
   When unsure, pick the smaller one. A section the project has not earned is left
   out, never left half-filled.
3. Read `references/voice.md` once.
4. For each section the profile lists, read its `RULES.md`, then fill its
   `TEMPLATE.md` using `example.md` as the register to match. Emit the sections in
   profile order with nothing between them.
5. When only one section is being touched, load only that section directory and
   `references/voice.md`, and leave the rest of the README alone.

## Hard rules that cut across sections

- Never invent a path to an image or a doc that does not exist. Every relative link
  in the output must resolve in the repo. If no demo recording exists, there is no
  demo section.
- Never include a Contributing section, a Security section, a table of contents, a
  roadmap, a "Why this exists", a comparison table, or a Star History chart.
  `CONTRIBUTING.md` and `SECURITY.md` are linked from one sentence at the end of
  Development.
- Never write a `## License` heading. The license lives in the footer sign-off.
- Keep it short. Skriuw is a large project across two product lines and its README
  is under 200 lines. Anything longer means a section belongs in `docs/`.
