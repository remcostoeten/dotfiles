# Demo asset

GitHub only autoplays video from its own upload URLs, so a relative `.mp4` in the
repo will not play. Commit a GIF and reference it relatively. `docs/assets/demo.gif`
is the default path; reuse an existing one under `docs/assets/` or `docs/media/` if
the repo already has it.

The `alt` narrates the actual sequence in the recording, so it reads as a description
of the product to anyone who cannot see it. The `<sub>` caption says where it was
recorded, links it, and states that it is real time and uncut, which is the point of
showing a recording at all. One further clause may tell the viewer what they are
looking at if it is not obvious.

If no recording exists in the repo, omit the section entirely. Do not leave a block
pointing at a path that does not exist, and do not substitute a screenshot. Mention
in the summary that a demo would earn its place once recorded. A `.webp` animation
committed in the repo counts the same as a GIF (dora uses one).

For a CLI, the caption names the terminal and shell instead of a URL.
