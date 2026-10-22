# Header

Centered logo at `width="88"`, then the name as a centered `<h1>`, then the noun
block.

The logo path must exist in the repo. Look in `icons/`, `public/`, `docs/assets/`,
`app/src-tauri/icons/`, `src/assets/brand/`. If there is no logo, drop the `<img>`
block and keep the `<h1>`.

## The noun block

If the project name is a word, or plays on one, say so directly under the `<h1>` in
a centered `<em>` block. Two shapes are in use:

Dictionary entry, when the name is a real word in some language (skriuw):

```html
<p align="center">
  <em><strong>skriuw</strong> · verb · Frisian<br />
  "to write"</em>
</p>
```

Tagline, when the name is a coinage or a pun and a one-line gloss says it (dora):

```html
<p align="center">
  <em>the database explorah</em>
</p>
```

Use the dictionary shape whenever the word exists; it carries more. A Dutch or
Frisian name gets the language named. If the name means nothing, drop the block
rather than invent a gloss.

## Wordmark variant

If the project has a light and a dark wordmark, use `<picture>` with a
`prefers-color-scheme: dark` source and the light file as the `<img>` fallback, at
`width="300"`, and drop the separate `<h1>` since the wordmark already carries the
name. The noun block still follows it.

```html
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="src/assets/brand/wordmark.png" />
    <img src="src/assets/brand/wordmark-light.png" width="300" alt="PROJECT" />
  </picture>
</p>
```
