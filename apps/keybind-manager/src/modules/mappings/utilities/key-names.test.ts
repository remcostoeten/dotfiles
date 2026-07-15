import { describe, expect, it } from "vitest"
import { codeToKey, keyLabel } from "@/modules/mappings/utilities/key-names"

describe("codeToKey", () => {
  it("maps letters and digits", () => {
    expect(codeToKey("KeyA")).toBe("a")
    expect(codeToKey("Digit9")).toBe("9")
  })

  it("maps special keys to keyd names", () => {
    expect(codeToKey("CapsLock")).toBe("capslock")
    expect(codeToKey("Escape")).toBe("esc")
    expect(codeToKey("ControlLeft")).toBe("leftcontrol")
    expect(codeToKey("AltRight")).toBe("rightalt")
    expect(codeToKey("IntlBackslash")).toBe("102nd")
  })

  it("maps function and numpad keys", () => {
    expect(codeToKey("F12")).toBe("f12")
    expect(codeToKey("Numpad5")).toBe("kp5")
  })

  it("returns null for unknown codes", () => {
    expect(codeToKey("MediaSelect")).toBeNull()
  })
})

describe("keyLabel", () => {
  it("labels well-known keys", () => {
    expect(keyLabel("capslock")).toBe("Caps Lock")
    expect(keyLabel("leftcontrol")).toBe("L Ctrl")
  })

  it("uppercases short keys", () => {
    expect(keyLabel("a")).toBe("A")
    expect(keyLabel("f1")).toBe("F1")
  })
})
