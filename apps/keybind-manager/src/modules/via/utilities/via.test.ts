import { describe, expect, it } from "vitest"
import {
  packLayoutOptions,
  parseDefinition,
  parseKeymap,
  parseSavedLayout,
  unpackLayoutOptions,
  visibleKeys
} from "@/modules/via/utilities/definition"
import { bundledDefinitions } from "@/modules/via/utilities/definitions"
import { customKeycode, keycodeLabel, keycodeName, layerKeycode, nameLabel } from "@/modules/via/utilities/keycodes"

describe("parseKeymap", () => {
  it("advances x by width and y by row, honouring offsets", () => {
    const keys = parseKeymap([["0,0", { x: 0.5, w: 2 }, "0,1", "0,2"], [{ y: 0.25 }, "1,0"]])
    expect(keys.map((k) => [k.row, k.col, k.x, k.y, k.w])).toEqual([
      [0, 0, 0, 0, 1],
      [0, 1, 1.5, 0, 2],
      [0, 2, 3.5, 0, 1],
      [1, 0, 0, 1.25, 1]
    ])
  })

  it("reads layout options from the fourth legend line", () => {
    const [key] = parseKeymap([["0,13\n\n\n0,1"]])
    expect(key?.option).toEqual({ index: 0, choice: 1 })
  })
})

describe("visibleKeys", () => {
  it("keeps keys for the selected choice only", () => {
    const keys = parseKeymap([["0,0", "0,1\n\n\n0,0", "0,2\n\n\n0,1"]])
    expect(visibleKeys(keys, [0]).map((k) => k.col)).toEqual([0, 1])
    expect(visibleKeys(keys, [1]).map((k) => k.col)).toEqual([0, 2])
  })
})

describe("bundled definitions", () => {
  it("includes the Zoom65 wireless board", () => {
    const board = bundledDefinitions.find((d) => d.vendor === "1ea7" && d.product === "7777")
    expect(board?.matrix).toEqual({ rows: 5, cols: 16 })
    expect(board?.options).toHaveLength(4)
    expect(board?.customKeycodes.length).toBeGreaterThan(0)
  })
})

describe("parseDefinition", () => {
  it("rejects other JSON", () => {
    expect(() => parseDefinition("{}")).toThrow(/VIA keyboard definition/)
  })
})

describe("parseSavedLayout", () => {
  it("reads layers", () => {
    expect(parseSavedLayout('{"name":"a","layers":[["KC_A"]]}').layers).toEqual([["KC_A"]])
  })
})

describe("keycodes", () => {
  it("labels basic, layer and custom codes for protocol 9", () => {
    const custom = [{ name: "A", title: "", shortName: "Win Mode" }]
    expect(keycodeLabel(0x04, custom, 9)).toBe("A")
    expect(keycodeLabel(layerKeycode("MO", 2, 9), custom, 9)).toBe("MO 2")
    expect(keycodeLabel(customKeycode(0, 9), custom, 9)).toBe("Win Mode")
    expect(keycodeLabel(0x7fff, custom, 9)).toBe("0x7FFF")
  })

  it("uses the current ranges from protocol 12", () => {
    expect(layerKeycode("MO", 1, 12)).toBe(0x5221)
  })

  it("labels saved layout names", () => {
    expect(nameLabel("KC_MINS", [])).toBe("-")
    expect(nameLabel("MO(1)", [])).toBe("MO 1")
    expect(nameLabel("KC_TRNS", [])).toBe("▽")
    expect(nameLabel("CUSTOM(0)", [{ name: "A", title: "", shortName: "Win Mode" }])).toBe("Win Mode")
  })
})

describe("layout options", () => {
  const toggles = ["Split Backspace", "ISO", "Split Left Shift", "Split Space"].map((label) => ({ label, choices: [] }))

  it("packs the last option into the lowest bit", () => {
    expect(packLayoutOptions(toggles, [0, 0, 0, 1])).toBe(1)
    expect(packLayoutOptions(toggles, [1, 0, 0, 0])).toBe(8)
  })

  it("gives multi-choice options enough bits and round-trips", () => {
    const options = [{ label: "Bottom", choices: ["A", "B", "C"] }, ...toggles]
    const selected = [2, 1, 0, 1, 1]
    expect(packLayoutOptions(options, selected)).toBe(0b10_1_0_1_1)
    expect(unpackLayoutOptions(options, packLayoutOptions(options, selected))).toEqual(selected)
  })
})

describe("keycodeName", () => {
  it("names codes the way saved layouts and nameLabel expect", () => {
    expect(keycodeName(0x04, 9)).toBe("KC_A")
    expect(keycodeName(layerKeycode("MO", 1, 12), 12)).toBe("MO(1)")
    expect(keycodeName(customKeycode(3, 9), 9)).toBe("CUSTOM(3)")
    expect(nameLabel(keycodeName(0x2c, 9), [])).toBe("Space")
    expect(keycodeName(0x7fff, 9)).toBe("0x7fff")
  })
})
