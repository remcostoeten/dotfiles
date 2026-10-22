#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const USAGE = `usage:
  svg-parts.mjs <file.svg>            parts from an SVG file
  svg-parts.mjs -                     parts from SVG markup on stdin
  svg-parts.mjs --lucide <name> [--dir <icons-dir>]
                                      parts from a lucide-react icon
  add --split to cut every path into absolute subpaths with bounds, so a
  single-path glyph can be divided into parts`;

const args = process.argv.slice(2);
const split = args.includes("--split");
const lucideAt = args.indexOf("--lucide");
const dirAt = args.indexOf("--dir");
const flagValues = new Set([lucideAt, dirAt].filter((at) => at !== -1).map((at) => at + 1));
const positional = args.filter((arg, index) => !arg.startsWith("--") && !flagValues.has(index));

function n(value) {
  return String(Math.round(value * 1000) / 1000);
}

function rect(a) {
  const x = Number(a.x ?? 0);
  const y = Number(a.y ?? 0);
  const w = Number(a.width);
  const h = Number(a.height);
  const r = Number(a.rx ?? a.ry ?? 0);
  if (!r) return `M${n(x)} ${n(y)}H${n(x + w)}V${n(y + h)}H${n(x)}z`;
  const arc = `a${n(r)} ${n(r)} 0 0 1`;
  return [
    `M${n(x + r)} ${n(y)}H${n(x + w - r)}${arc} ${n(r)} ${n(r)}`,
    `V${n(y + h - r)}${arc} ${n(-r)} ${n(r)}`,
    `H${n(x + r)}${arc} ${n(-r)} ${n(-r)}`,
    `V${n(y + r)}${arc} ${n(r)} ${n(-r)}z`,
  ].join("");
}

function ellipse(cx, cy, rx, ry) {
  return `M${n(cx - rx)} ${n(cy)}a${n(rx)} ${n(ry)} 0 1 0 ${n(2 * rx)} 0a${n(rx)} ${n(ry)} 0 1 0 ${n(-2 * rx)} 0z`;
}

function points(list, close) {
  const values = String(list).trim().split(/[\s,]+/).map(Number);
  const coords = [];
  for (let i = 0; i < values.length; i += 2) coords.push(`${n(values[i])} ${n(values[i + 1])}`);
  return `M${coords.join("L")}${close ? "z" : ""}`;
}

function toPath(tag, a) {
  if (tag === "path") return a.d;
  if (tag === "rect") return rect(a);
  if (tag === "circle") return ellipse(Number(a.cx), Number(a.cy), Number(a.r), Number(a.r));
  if (tag === "ellipse") return ellipse(Number(a.cx), Number(a.cy), Number(a.rx), Number(a.ry));
  if (tag === "line") {
    return `M${n(Number(a.x1))} ${n(Number(a.y1))}L${n(Number(a.x2))} ${n(Number(a.y2))}`;
  }
  if (tag === "polyline") return points(a.points, false);
  if (tag === "polygon") return points(a.points, true);
  throw new Error(`unsupported element <${tag}>`);
}

const ARITY = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

function parseCommands(d) {
  const commands = [];
  let pos = 0;
  const number = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
  function skip() {
    while (pos < d.length && /[\s,]/.test(d[pos])) pos += 1;
  }
  function read() {
    skip();
    number.lastIndex = pos;
    const match = number.exec(d);
    if (!match) throw new Error(`bad path data near "${d.slice(pos, pos + 12)}"`);
    pos = number.lastIndex;
    return Number(match[0]);
  }
  function flag() {
    skip();
    const char = d[pos];
    if (char !== "0" && char !== "1") throw new Error(`bad arc flag near "${d.slice(pos, pos + 12)}"`);
    pos += 1;
    return Number(char);
  }
  skip();
  while (pos < d.length) {
    let letter = d[pos];
    if (!/[MmLlHhVvCcSsQqTtAaZz]/.test(letter)) throw new Error(`bad command "${letter}"`);
    pos += 1;
    const upper = letter.toUpperCase();
    do {
      const values = [];
      for (let i = 0; i < ARITY[upper]; i += 1) {
        values.push(upper === "A" && (i === 3 || i === 4) ? flag() : read());
      }
      commands.push({ cmd: letter, values });
      if (upper === "M") letter = letter === "M" ? "L" : "l";
      skip();
    } while (ARITY[upper] > 0 && pos < d.length && !/[A-Za-z]/.test(d[pos]));
  }
  return commands;
}

function toSubpaths(d) {
  const subpaths = [];
  let current = null;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  function begin(x, y) {
    current = { segments: [{ cmd: "M", values: [x, y] }], closed: false };
    subpaths.push(current);
    sx = x;
    sy = y;
  }
  for (const { cmd, values } of parseCommands(d)) {
    const relative = cmd === cmd.toLowerCase();
    const upper = cmd.toUpperCase();
    const ox = relative ? cx : 0;
    const oy = relative ? cy : 0;
    if (upper === "M") {
      begin(values[0] + ox, values[1] + oy);
      cx = sx;
      cy = sy;
      continue;
    }
    if (!current || current.closed) begin(cx, cy);
    if (upper === "Z") {
      current.segments.push({ cmd: "Z", values: [] });
      current.closed = true;
      cx = sx;
      cy = sy;
      continue;
    }
    let abs;
    if (upper === "H") abs = [values[0] + ox];
    else if (upper === "V") abs = [values[0] + oy];
    else if (upper === "A") abs = [values[0], values[1], values[2], values[3], values[4], values[5] + ox, values[6] + oy];
    else abs = values.map((value, i) => value + (i % 2 === 0 ? ox : oy));
    current.segments.push({ cmd: upper, values: abs });
    if (upper === "H") cx = abs[0];
    else if (upper === "V") cy = abs[0];
    else {
      cx = abs[abs.length - 2];
      cy = abs[abs.length - 1];
    }
  }
  return subpaths;
}

function arcPoints(x0, y0, [rx, ry, rotation, large, sweep, x, y]) {
  if (rx === 0 || ry === 0) return [[x, y]];
  const phi = (rotation * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x0 - x) / 2;
  const dy = (y0 - y) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  let radiusX = Math.abs(rx);
  let radiusY = Math.abs(ry);
  const lambda = (x1 * x1) / (radiusX * radiusX) + (y1 * y1) / (radiusY * radiusY);
  if (lambda > 1) {
    radiusX *= Math.sqrt(lambda);
    radiusY *= Math.sqrt(lambda);
  }
  const numerator = radiusX ** 2 * radiusY ** 2 - radiusX ** 2 * y1 ** 2 - radiusY ** 2 * x1 ** 2;
  const denominator = radiusX ** 2 * y1 ** 2 + radiusY ** 2 * x1 ** 2;
  const factor = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, numerator / denominator));
  const cxp = (factor * radiusX * y1) / radiusY;
  const cyp = (-factor * radiusY * x1) / radiusX;
  const centerX = cos * cxp - sin * cyp + (x0 + x) / 2;
  const centerY = sin * cxp + cos * cyp + (y0 + y) / 2;
  const angle = (ux, uy, vx, vy) =>
    Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const start = angle(1, 0, (x1 - cxp) / radiusX, (y1 - cyp) / radiusY);
  let sweepAngle = angle(
    (x1 - cxp) / radiusX,
    (y1 - cyp) / radiusY,
    (-x1 - cxp) / radiusX,
    (-y1 - cyp) / radiusY,
  );
  if (!sweep && sweepAngle > 0) sweepAngle -= 2 * Math.PI;
  if (sweep && sweepAngle < 0) sweepAngle += 2 * Math.PI;
  const result = [];
  for (let i = 1; i <= 16; i += 1) {
    const t = start + (sweepAngle * i) / 16;
    result.push([
      centerX + radiusX * Math.cos(t) * cos - radiusY * Math.sin(t) * sin,
      centerY + radiusX * Math.cos(t) * sin + radiusY * Math.sin(t) * cos,
    ]);
  }
  return result;
}

function bezierPoints(from, controls) {
  const result = [];
  for (let i = 1; i <= 8; i += 1) {
    const t = i / 8;
    let pts = [from, ...controls];
    while (pts.length > 1) {
      pts = pts.slice(1).map((point, j) => [
        pts[j][0] + (point[0] - pts[j][0]) * t,
        pts[j][1] + (point[1] - pts[j][1]) * t,
      ]);
    }
    result.push(pts[0]);
  }
  return result;
}

function outline(subpath) {
  const pts = [];
  let cx = 0;
  let cy = 0;
  for (const { cmd, values } of subpath.segments) {
    if (cmd === "M" || cmd === "L" || cmd === "T") {
      cx = values[0];
      cy = values[1];
      pts.push([cx, cy]);
    } else if (cmd === "H") {
      cx = values[0];
      pts.push([cx, cy]);
    } else if (cmd === "V") {
      cy = values[0];
      pts.push([cx, cy]);
    } else if (cmd === "C" || cmd === "S" || cmd === "Q") {
      const controls = [];
      for (let i = 0; i < values.length; i += 2) controls.push([values[i], values[i + 1]]);
      pts.push(...bezierPoints([cx, cy], controls));
      cx = values[values.length - 2];
      cy = values[values.length - 1];
    } else if (cmd === "A") {
      pts.push(...arcPoints(cx, cy, values));
      cx = values[5];
      cy = values[6];
    }
  }
  return pts;
}

function measure(subpath) {
  const pts = outline(subpath);
  const xs = pts.map(([x]) => x);
  const ys = pts.map(([, y]) => y);
  let area = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    area += x0 * y1 - x1 * y0;
  }
  return {
    box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    area: area / 2,
  };
}

function serialize(subpath) {
  return subpath.segments
    .map(({ cmd, values }) => `${cmd}${values.map(n).join(" ")}`)
    .join("");
}

function contains(outer, inner) {
  return (
    outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3]
  );
}

function attributes(source) {
  const found = {};
  for (const match of source.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    found[match[1]] = match[2] ?? match[3];
  }
  return found;
}

function fromMarkup(markup) {
  const root = markup.match(/<svg\b([^>]*)>/i);
  const rootAttrs = root ? attributes(root[1]) : {};
  const warnings = [];
  if (/\btransform\s*=/.test(markup)) warnings.push("transform attributes");
  if (/<(use|mask|clipPath|style|defs)\b/i.test(markup)) warnings.push("use, mask, clipPath, style or defs");
  const elements = [];
  for (const match of markup.matchAll(/<(path|rect|circle|ellipse|line|polyline|polygon)\b([^>]*?)\/?>/gis)) {
    elements.push([match[1].toLowerCase(), attributes(match[2])]);
  }
  const hasStroke = rootAttrs.stroke !== undefined && rootAttrs.stroke !== "none";
  const mode = rootAttrs.fill === "none" || hasStroke ? "stroke" : "fill";
  const viewBox = rootAttrs.viewBox ?? rootAttrs.viewbox ?? "unknown";
  const header =
    mode === "stroke"
      ? `viewBox ${viewBox}, stroke, stroke-width ${rootAttrs["stroke-width"] ?? "?"}, linecap ${rootAttrs["stroke-linecap"] ?? "butt"}, linejoin ${rootAttrs["stroke-linejoin"] ?? "miter"}`
      : `viewBox ${viewBox}, fill`;
  return { header, elements, warnings };
}

async function loadLucide(name, dir) {
  const file = resolve(join(dir, `${name}.mjs`));
  if (!existsSync(file)) throw new Error(`no such icon file: ${file}`);
  const source = readFileSync(file, "utf8");
  const alias = source.match(/export \{ default \} from '\.\/([^']+)\.mjs'/);
  if (alias) return loadLucide(alias[1], dir);
  const data = (await import(pathToFileURL(file).href)).__iconData;
  return {
    header: `${data.name}, viewBox 0 0 ${data.size} ${data.size}, stroke, stroke-width 2, linecap round, linejoin round`,
    elements: data.node.map(([tag, attrs]) => [tag, attrs]),
    warnings: [],
  };
}

function readStdin() {
  return readFileSync(0, "utf8");
}

async function run() {
  let source;
  if (lucideAt !== -1) {
    const name = args[lucideAt + 1];
    if (!name) throw new Error(USAGE);
    const dir = dirAt === -1 ? "node_modules/lucide-react/dist/esm/icons" : args[dirAt + 1];
    source = await loadLucide(name, dir);
  } else if (positional[0] === "-") {
    source = fromMarkup(readStdin());
  } else if (positional[0]) {
    source = fromMarkup(readFileSync(positional[0], "utf8"));
  } else {
    throw new Error(USAGE);
  }
  for (const warning of source.warnings) {
    console.error(`warning: found ${warning}. Flatten the SVG first (SVGO convertShapeToPath and convertTransform), then rerun.`);
  }
  console.log(`// ${source.header}`);
  if (source.elements.length === 0) throw new Error("no drawable elements found");
  source.elements.forEach(([tag, attrs], index) => {
    const id = `${tag}${index + 1}`;
    const d = toPath(tag, attrs);
    const notes = ["fill-rule", "clip-rule", "fill", "stroke", "opacity"]
      .filter((key) => attrs[key] !== undefined)
      .map((key) => `${key}=${attrs[key]}`);
    const suffix = notes.length > 0 ? ` // ${notes.join(" ")}` : "";
    if (!split) {
      console.log(`{ id: "${id}", d: ${JSON.stringify(d)} },${suffix}`);
      return;
    }
    const subpaths = toSubpaths(d).map((subpath) => ({ subpath, ...measure(subpath) }));
    console.log(`// ${id}: ${subpaths.length} subpath(s)${suffix}`);
    subpaths.forEach((entry, i) => {
      const nested = subpaths
        .map((other, j) => (j !== i && contains(other.box, entry.box) ? j : null))
        .filter((j) => j !== null);
      const box = entry.box.map(n).join(", ");
      const info = `box [${box}], area ${n(entry.area)}${nested.length > 0 ? `, inside ${nested.join(",")}` : ""}`;
      console.log(`{ id: "${id}-s${i}", d: ${JSON.stringify(serialize(entry.subpath))} }, // ${info}`);
    });
  });
}

try {
  await run();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
