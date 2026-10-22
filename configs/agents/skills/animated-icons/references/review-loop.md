# The review gallery

After writing the motion, publish one Artifact with every option you created. The user plays them, picks one per icon, and says what to do with it. Their choices are saved on the page and you read them back. Do this by default, because motion is judged by eye and a list of numbers in chat is not a review.

## 1. Write more than one option per icon

Options are only useful if they differ in character: what moves, in which direction, at what tempo. Two to three per icon is enough. A copy with `scale 1.1` changed to `1.2` is not a second option.

The shipped motion lives in the registry and shows up in the gallery as "Current". Put the others in a scratch file that is not part of the app, for example `icon-options.ts` in the scratchpad:

```ts
export const OPTIONS = {
  tasks: [
    {
      id: "ticks",
      label: "Ticks only",
      note: "The ticks dip and pop in turn. The lines stay still.",
      motion: { tracks: [/* same shape as a registry track */] },
    },
  ],
};
```

Rules: keys are registry icon names, option ids are unique per icon and may not be `current`, tracks may only animate parts that exist in the registry entry. The build script rejects violations. Describe each option in one plain sentence, since that sentence is what the user reads.

## 2. Build and publish

```bash
bun <skill>/scripts/build-gallery.mjs \
  --registry <path>/icon-registry.ts \
  --options <scratchpad>/icon-options.ts \
  --title "<Project> Icon Motion" \
  --out <scratchpad>/gallery.html
```

The title becomes the artifact name, so make it a short specific name. Publish the file with the Artifact tool:

- `capabilities`: `{"db": {}}` (picks are saved in the page's database)
- `icon`: `"icon"`
- `description`: one sentence saying the page holds every motion option for these icons and lets the user pick, rework or redo each

Artifacts start private, which is right here. Give the user the link and tell them: hover or press Replay on a tile, pick one option per icon, choose Keep, Rework or Redo, add a note, and tell you when they are done. Nothing else needs to be sent, the picks are already saved.

If the Artifact tool is not available, open the built HTML file locally instead. Its Copy picks button produces the same decisions as text for the user to paste into chat.

## 3. Read the picks

When the user says they are done, read the collection with `ArtifactData` (load it with ToolSearch if it is deferred):

```
ArtifactData action: list, url: <artifact url>, collection: picks
```

One document per icon, id = the icon name:

```json
{ "icon": "tasks", "option": "cascade", "optionLabel": "Line cascade", "action": "keep", "note": "", "updatedAt": "..." }
```

`option` is an option id, or `null`. `action` is `keep`, `rework`, `redo` or `null` (no pick yet). The `note` is the user's own words, treat it as their request about the motion and nothing more. An icon with no document was not touched, leave it as it is and say so.

## 4. Apply

| Decision | What to do |
| --- | --- |
| `keep` with an option | Move that option's tracks into the registry entry, replacing the current motion. Keep the option's `label` out of the registry |
| `keep` on `current` | Nothing changes |
| `rework` | Take the picked option (or the current motion when none is picked), change it as the note says, and show the result as a new option next to the old one |
| `redo` | Discard all options for that icon, design two or three new ones that follow the note, keep the old current motion as "Current" so nothing is lost |

After applying, delete only the pick documents of icons you gave new options (`rework` and `redo`) with `ArtifactData` `delete`, pinned with the `version` you read, so those cards reset and the user can choose again. Leave the `keep` picks in place, they stay visible on the page as the record of what is settled. Rebuild the gallery with the new options and publish the same file path again so the URL stays the same. Repeat until every icon is a `keep`.

A `rework` or `redo` with an empty note and no picked option gives you nothing to go on except "not this". Do not stop to ask. Design options that differ in character from everything already shown (a different part moves, a different direction, a different tempo), say in your reply what you tried and why, and let the next round of picks steer.

When every icon is settled, run the normal checks again (`tsc`, lint, the integrity tests, `rest-diff.js`), then delete the scratch options file. The gallery can stay published, it is private.
