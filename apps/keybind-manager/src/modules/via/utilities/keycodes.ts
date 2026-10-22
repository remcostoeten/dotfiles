import type { CustomKeycode } from "@/modules/via/types"

export type KeycodeGroup = "Letters" | "Numbers" | "Editing" | "Function" | "Modifiers" | "Media" | "Special"

export type BasicKeycode = {
  code: number
  label: string
  name: string
  group: KeycodeGroup
}

export type LayerKind = "TO" | "MO" | "DF" | "TG" | "OSL"

type Ranges = Record<LayerKind, number> & { custom: number; gesc: number }

const LEGACY_RANGES: Ranges = { TO: 0x5000, MO: 0x5100, DF: 0x5200, TG: 0x5300, OSL: 0x5400, custom: 0x5f80, gesc: 0x5c16 }
const CURRENT_RANGES: Ranges = { TO: 0x5200, MO: 0x5220, DF: 0x5240, TG: 0x5260, OSL: 0x5280, custom: 0x7e00, gesc: 0x7c16 }
const CURRENT_PROTOCOL = 12
const LAYER_SLOTS = 32

export const layerKinds: LayerKind[] = ["MO", "TG", "TO", "DF", "OSL"]

function entry(code: number, label: string, name: string, group: KeycodeGroup): BasicKeycode {
  return { code, label, name, group }
}

function range(start: number, chars: string, group: KeycodeGroup): BasicKeycode[] {
  return [...chars].map((c, i) => entry(start + i, c.toUpperCase(), c.toUpperCase(), group))
}

function functionKeys(): BasicKeycode[] {
  const keys: BasicKeycode[] = []
  for (let n = 1; n <= 12; n++) {
    keys.push(entry(0x3a + n - 1, `F${n}`, `F${n}`, "Function"))
  }
  for (let n = 13; n <= 24; n++) {
    keys.push(entry(0x68 + n - 13, `F${n}`, `F${n}`, "Function"))
  }
  return keys
}

export const basicKeycodes: BasicKeycode[] = [
  ...range(0x04, "abcdefghijklmnopqrstuvwxyz", "Letters"),
  ...range(0x1e, "1234567890", "Numbers"),
  entry(0x28, "Enter", "ENT", "Editing"),
  entry(0x29, "Esc", "ESC", "Editing"),
  entry(0x2a, "Bksp", "BSPC", "Editing"),
  entry(0x2b, "Tab", "TAB", "Editing"),
  entry(0x2c, "Space", "SPC", "Editing"),
  entry(0x2d, "-", "MINS", "Editing"),
  entry(0x2e, "=", "EQL", "Editing"),
  entry(0x2f, "[", "LBRC", "Editing"),
  entry(0x30, "]", "RBRC", "Editing"),
  entry(0x31, "\\", "BSLS", "Editing"),
  entry(0x33, ";", "SCLN", "Editing"),
  entry(0x34, "'", "QUOT", "Editing"),
  entry(0x35, "`", "GRV", "Editing"),
  entry(0x36, ",", "COMM", "Editing"),
  entry(0x37, ".", "DOT", "Editing"),
  entry(0x38, "/", "SLSH", "Editing"),
  entry(0x39, "Caps", "CAPS", "Editing"),
  entry(0x46, "PrtSc", "PSCR", "Editing"),
  entry(0x47, "ScrLk", "SCRL", "Editing"),
  entry(0x48, "Pause", "PAUS", "Editing"),
  entry(0x49, "Ins", "INS", "Editing"),
  entry(0x4a, "Home", "HOME", "Editing"),
  entry(0x4b, "PgUp", "PGUP", "Editing"),
  entry(0x4c, "Del", "DEL", "Editing"),
  entry(0x4d, "End", "END", "Editing"),
  entry(0x4e, "PgDn", "PGDN", "Editing"),
  entry(0x4f, "→", "RGHT", "Editing"),
  entry(0x50, "←", "LEFT", "Editing"),
  entry(0x51, "↓", "DOWN", "Editing"),
  entry(0x52, "↑", "UP", "Editing"),
  entry(0x65, "Menu", "APP", "Editing"),
  ...functionKeys(),
  entry(0xe0, "Ctrl", "LCTL", "Modifiers"),
  entry(0xe1, "Shift", "LSFT", "Modifiers"),
  entry(0xe2, "Alt", "LALT", "Modifiers"),
  entry(0xe3, "Win", "LGUI", "Modifiers"),
  entry(0xe4, "R Ctrl", "RCTL", "Modifiers"),
  entry(0xe5, "R Shift", "RSFT", "Modifiers"),
  entry(0xe6, "R Alt", "RALT", "Modifiers"),
  entry(0xe7, "R Win", "RGUI", "Modifiers"),
  entry(0xa8, "Mute", "MUTE", "Media"),
  entry(0xa9, "Vol+", "VOLU", "Media"),
  entry(0xaa, "Vol-", "VOLD", "Media"),
  entry(0xab, "Next", "MNXT", "Media"),
  entry(0xac, "Prev", "MPRV", "Media"),
  entry(0xad, "Stop", "MSTP", "Media"),
  entry(0xae, "Play", "MPLY", "Media"),
  entry(0xd9, "Wheel ↑", "MS_WH_UP", "Media"),
  entry(0xda, "Wheel ↓", "MS_WH_DOWN", "Media"),
  entry(0xdb, "Wheel ←", "MS_WH_LEFT", "Media"),
  entry(0xdc, "Wheel →", "MS_WH_RIGHT", "Media"),
  entry(0x00, "", "NO", "Special"),
  entry(0x01, "▽", "TRNS", "Special")
]

const byCode = new Map(basicKeycodes.map((k) => [k.code, k]))
const byName = new Map(basicKeycodes.map((k) => [k.name, k]))

function rangesFor(protocol: number): Ranges {
  return protocol >= CURRENT_PROTOCOL ? CURRENT_RANGES : LEGACY_RANGES
}

/**
 * @name layerKeycode
 * @description Builds the keycode for a layer action such as MO(2), using the code ranges of the given VIA protocol version.
 *
 * @example
 * layerKeycode("MO", 2, 9) // 0x5102
 */
export function layerKeycode(kind: LayerKind, layer: number, protocol: number): number {
  return rangesFor(protocol)[kind] + layer
}

/**
 * @name customKeycode
 * @description Builds the keycode of the nth custom keycode from a definition's `customKeycodes`.
 *
 * @example
 * customKeycode(4, 9) // 0x5f84
 */
export function customKeycode(index: number, protocol: number): number {
  return rangesFor(protocol).custom + index
}

/**
 * @name keycodeLabel
 * @description Turns a 16-bit VIA keycode into the short legend shown on a key.
 * Unknown codes fall back to their hex value.
 *
 * @example
 * keycodeLabel(0x5102, [], 9) // "MO 2"
 */
export function keycodeLabel(code: number, custom: CustomKeycode[], protocol: number): string {
  const basic = byCode.get(code)
  if (basic) {
    return basic.label
  }
  const ranges = rangesFor(protocol)
  if (code === ranges.gesc) {
    return "Esc `"
  }
  for (const kind of layerKinds) {
    if (code >= ranges[kind] && code < ranges[kind] + LAYER_SLOTS) {
      return `${kind} ${code - ranges[kind]}`
    }
  }
  const customIndex = code - ranges.custom
  if (customIndex >= 0 && customIndex < custom.length) {
    return custom[customIndex]?.shortName ?? ""
  }
  return `0x${code.toString(16).toUpperCase()}`
}

/**
 * @name keycodeName
 * @description Turns a 16-bit VIA keycode into the name used in VIA saved layouts, the inverse of `nameLabel`.
 * Unknown codes fall back to their hex value.
 *
 * @example
 * keycodeName(0x5102, 9) // "MO(2)"
 */
export function keycodeName(code: number, protocol: number): string {
  const basic = byCode.get(code)
  if (basic) {
    return `KC_${basic.name}`
  }
  const ranges = rangesFor(protocol)
  if (code === ranges.gesc) {
    return "KC_GESC"
  }
  for (const kind of layerKinds) {
    if (code >= ranges[kind] && code < ranges[kind] + LAYER_SLOTS) {
      return `${kind}(${code - ranges[kind]})`
    }
  }
  if (code >= ranges.custom && code < ranges.custom + LAYER_SLOTS) {
    return `CUSTOM(${code - ranges.custom})`
  }
  return `0x${code.toString(16).padStart(4, "0")}`
}

const NAME_ALIASES = new Map([["GESC", "Esc `"], ["TRNS", "▽"], ["NO", ""], ["ESC", "Esc"]])
const LAYER_NAME = /^(MO|TG|TO|DF|OSL)\((\d+)\)$/
const CUSTOM_NAME = /^CUSTOM\((\d+)\)$/

/**
 * @name nameLabel
 * @description Turns a keycode name from a VIA saved layout (`KC_A`, `MO(1)`, `CUSTOM(4)`) into the legend shown on a key.
 *
 * @example
 * nameLabel("MO(1)", []) // "MO 1"
 */
export function nameLabel(name: string, custom: CustomKeycode[]): string {
  const layer = LAYER_NAME.exec(name)
  if (layer) {
    return `${layer[1]} ${layer[2]}`
  }
  const customMatch = CUSTOM_NAME.exec(name)
  if (customMatch) {
    return custom[Number(customMatch[1])]?.shortName ?? name
  }
  const plain = name.replace(/^KC_/, "")
  return NAME_ALIASES.get(plain) ?? byName.get(plain)?.label ?? plain
}
