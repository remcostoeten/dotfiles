#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const USAGE = `usage: bun build-gallery.mjs --registry <icon-registry.ts> --out <gallery.html>
         [--options <icon-options.ts>] [--motion <icon-motion.ts>] [--title "Icon Motion Review"]

  --registry  module exporting ICONS (name to { parts, motion, viewBox?, paint?, strokeWidth? })
  --options   module exporting OPTIONS (name to [{ id, label, note?, motion }]), the extra
              options to review next to the shipped one. Not shipped with the app.
  --motion    module exporting EASINGS, defaults to icon-motion.ts beside the registry`;

const args = process.argv.slice(2);

function flag(name) {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? undefined : args[at + 1];
}

async function load(path) {
  return import(pathToFileURL(resolve(path)).href);
}

async function run() {
  const registryPath = flag("registry");
  const out = flag("out");
  if (!registryPath || !out) throw new Error(USAGE);
  const motionPath = flag("motion") ?? join(dirname(resolve(registryPath)), "icon-motion.ts");
  const title = flag("title") ?? "Icon Motion Review";
  const { ICONS } = await load(registryPath);
  const { EASINGS } = await load(motionPath);
  const optionsPath = flag("options");
  const OPTIONS = optionsPath ? (await load(optionsPath)).OPTIONS : {};

  const icons = Object.entries(ICONS).map(([name, spec]) => {
    const shipped = {
      id: "current",
      label: "Current",
      note: "The motion in the registry today.",
      shipped: true,
      tracks: spec.motion.tracks,
    };
    const extra = (OPTIONS[name] ?? []).map((option) => ({
      id: option.id,
      label: option.label,
      note: option.note ?? "",
      shipped: false,
      tracks: option.motion.tracks,
    }));
    return {
      name,
      label: name,
      viewBox: spec.viewBox ?? "0 0 24 24",
      paint: spec.paint ?? "stroke",
      strokeWidth: spec.strokeWidth ?? 2,
      parts: spec.parts,
      options: [shipped, ...extra],
    };
  });

  const unknown = Object.keys(OPTIONS).filter((name) => !(name in ICONS));
  if (unknown.length > 0) throw new Error(`options for icons not in the registry: ${unknown.join(", ")}`);
  const duplicates = icons.flatMap((icon) => {
    const ids = icon.options.map((option) => option.id);
    return ids.filter((id, index) => ids.indexOf(id) !== index).map((id) => `${icon.name}/${id}`);
  });
  if (duplicates.length > 0) throw new Error(`duplicate option ids: ${duplicates.join(", ")}`);

  const missing = icons.flatMap((icon) => {
    const known = new Set(icon.parts.map((part) => part.id));
    return icon.options.flatMap((option) =>
      option.tracks
        .flatMap((track) => track.parts)
        .filter((part) => !known.has(part))
        .map((part) => `${icon.name}/${option.id} animates unknown part "${part}"`),
    );
  });
  if (missing.length > 0) throw new Error(missing.join("\n"));

  const data = { title, easings: EASINGS, icons };
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const template = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../assets/review-gallery.html"),
    "utf8",
  );
  const html = template.replace("__GALLERY_TITLE__", title).replace("__GALLERY_DATA__", () => json);
  writeFileSync(resolve(out), html);
  const optionCount = icons.reduce((sum, icon) => sum + icon.options.length, 0);
  console.log(`wrote ${resolve(out)} (${icons.length} icons, ${optionCount} options)`);
}

try {
  await run();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
