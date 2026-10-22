# Footer

The footer is the last thing in the file: a greeting, the name, the license in
`<small>`, and optionally one PS line.

- `GREETING` defaults to `xxx`. Change it only if the user asks for a different
  sign-off.
- `LICENSE` is the license name from the `LICENSE` file, usually `MIT`, wrapped in
  `<small>` so it reads as a note under the signature rather than a section. If the
  repo has no `LICENSE` file, still write the license the user names for their
  projects (MIT by default) and say in the summary that the file must be added.
- `OPTIONAL PS MESSAGE` is one short line after a blank line, or nothing. A thanks,
  a credit that has nowhere else to go, or a note that a dependency carries its own
  terms (vendored fonts, bundled binaries). Never a second paragraph.

Never write a `## License` or `### License` heading, and never "MIT. See LICENSE for
details". Nothing follows the footer.
