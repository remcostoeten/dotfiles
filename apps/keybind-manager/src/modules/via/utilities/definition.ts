import { isRecord } from "@/shared/utilities/guards"
import type {
  CustomKeycode,
  KeyOption,
  LayoutOption,
  Matrix,
  SavedLayout,
  ViaDefinition,
  ViaKey
} from "@/modules/via/types"

const MATRIX_LEGEND = /^(\d+),(\d+)$/

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback
}

function hexId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Definition is missing vendorId or productId.")
  }
  return value.replace(/^0x/i, "").toLowerCase().padStart(4, "0")
}

function parseLegend(legend: string): { row: number; col: number; option: KeyOption | null } | null {
  const lines = legend.split("\n")
  const matrix = MATRIX_LEGEND.exec(lines[0] ?? "")
  if (!matrix) {
    return null
  }
  const option = MATRIX_LEGEND.exec(lines[3] ?? "")
  return {
    row: Number(matrix[1]),
    col: Number(matrix[2]),
    option: option ? { index: Number(option[1]), choice: Number(option[2]) } : null
  }
}

/**
 * @name parseKeymap
 * @description Walks a KLE keymap as used by VIA definitions and returns every key that maps
 * to a matrix position, with its size, offset and the layout option that shows it.
 *
 * @example
 * parseKeymap([["0,0", { w: 2 }, "0,1"]])
 * // [{ row: 0, col: 0, x: 0, y: 0, w: 1, h: 1, option: null }, ...]
 */
export function parseKeymap(rows: unknown[]): ViaKey[] {
  const keys: ViaKey[] = []
  let y = 0
  for (const row of rows) {
    if (!Array.isArray(row)) {
      continue
    }
    let x = 0
    let w = 1
    let h = 1
    for (const item of row) {
      if (isRecord(item)) {
        x += numberOr(item.x, 0)
        y += numberOr(item.y, 0)
        w = numberOr(item.w, w)
        h = numberOr(item.h, h)
        continue
      }
      if (typeof item === "string") {
        const legend = parseLegend(item)
        if (legend) {
          keys.push({ ...legend, x, y, w, h })
        }
        x += w
        w = 1
        h = 1
      }
    }
    y += 1
  }
  return keys
}

function parseOptions(labels: unknown): LayoutOption[] {
  if (!Array.isArray(labels)) {
    return []
  }
  return labels.map((entry) => {
    if (Array.isArray(entry)) {
      const [label, ...choices] = entry.map(String)
      return { label: label ?? "", choices }
    }
    return { label: String(entry), choices: [] }
  })
}

function parseCustomKeycodes(value: unknown): CustomKeycode[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter(isRecord).map((item) => ({
    name: String(item.name ?? ""),
    title: String(item.title ?? ""),
    shortName: String(item.shortName ?? item.name ?? "")
  }))
}

function parseMatrix(value: unknown): Matrix {
  if (!isRecord(value) || typeof value.rows !== "number" || typeof value.cols !== "number") {
    throw new Error("Definition is missing its matrix size.")
  }
  return { rows: value.rows, cols: value.cols }
}

/**
 * @name parseDefinition
 * @description Parses the text of a VIA keyboard definition JSON into a normalized definition
 * and throws an Error with a readable message when a required part is missing.
 *
 * @example
 * const definition = parseDefinition(await file.text())
 * definition.matrix // { rows: 5, cols: 16 }
 */
export function parseDefinition(text: string): ViaDefinition {
  const raw: unknown = JSON.parse(text)
  if (!isRecord(raw) || !isRecord(raw.layouts) || !Array.isArray(raw.layouts.keymap)) {
    throw new Error("This is not a VIA keyboard definition.")
  }
  return {
    name: String(raw.name ?? "Keyboard"),
    vendor: hexId(raw.vendorId),
    product: hexId(raw.productId),
    matrix: parseMatrix(raw.matrix),
    customKeycodes: parseCustomKeycodes(raw.customKeycodes),
    options: parseOptions(raw.layouts.labels),
    keys: parseKeymap(raw.layouts.keymap)
  }
}

/**
 * @name parseSavedLayout
 * @description Parses a VIA saved-layout export (a `layers` array of keycode names) so it can
 * be shown on a definition.
 *
 * @example
 * parseSavedLayout('{"name":"zoom65","layers":[["KC_A"]]}').layers[0] // ["KC_A"]
 */
export function parseSavedLayout(text: string): SavedLayout {
  const raw: unknown = JSON.parse(text)
  if (!isRecord(raw) || !Array.isArray(raw.layers)) {
    throw new Error("This is not a VIA saved layout.")
  }
  return {
    name: String(raw.name ?? "Saved layout"),
    layers: raw.layers.map((layer) => (Array.isArray(layer) ? layer.map(String) : []))
  }
}

/**
 * @name visibleKeys
 * @description Filters a definition's keys down to the ones shown for the selected layout options.
 *
 * @example
 * visibleKeys(definition.keys, [0, 1, 0, 0])
 */
export function visibleKeys(keys: ViaKey[], selected: number[]): ViaKey[] {
  return keys.filter((key) => key.option === null || (selected[key.option.index] ?? 0) === key.option.choice)
}

function optionBits(option: LayoutOption): number {
  return Math.max(1, Math.ceil(Math.log2(Math.max(2, option.choices.length))))
}

/**
 * @name packLayoutOptions
 * @description Packs the selected layout option choices into the 32-bit value VIA stores on the
 * keyboard. The last option takes the lowest bits, each option as many bits as its choices need.
 *
 * @example
 * packLayoutOptions(definition.options, [0, 0, 0, 1]) // 1
 */
export function packLayoutOptions(options: LayoutOption[], selected: number[]): number {
  let packed = 0
  let shift = 0
  for (let i = options.length - 1; i >= 0; i--) {
    const bits = optionBits(options[i]!)
    packed |= ((selected[i] ?? 0) & ((1 << bits) - 1)) << shift
    shift += bits
  }
  return packed >>> 0
}

/**
 * @name unpackLayoutOptions
 * @description Reverses `packLayoutOptions`, turning the keyboard's stored value back into one choice per option.
 *
 * @example
 * unpackLayoutOptions(definition.options, 1) // [0, 0, 0, 1]
 */
export function unpackLayoutOptions(options: LayoutOption[], packed: number): number[] {
  const selected = options.map(() => 0)
  let shift = 0
  for (let i = options.length - 1; i >= 0; i--) {
    const bits = optionBits(options[i]!)
    selected[i] = (packed >>> shift) & ((1 << bits) - 1)
    shift += bits
  }
  return selected
}
