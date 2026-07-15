import { describe, expect, it } from "vitest"
import { render } from "@solidjs/testing-library"
import { KeyCap } from "@/shared/components/key-cap"

describe("KeyCap", () => {
  it("renders the key label", () => {
    const { getByText } = render(() => <KeyCap name="capslock" />)
    expect(getByText("Caps Lock")).toBeTruthy()
  })

  it("renders modifiers before the key", () => {
    const { getByText } = render(() => <KeyCap name="c" mods={["control", "shift"]} />)
    expect(getByText("Control")).toBeTruthy()
    expect(getByText("Shift")).toBeTruthy()
    expect(getByText("C")).toBeTruthy()
  })
})
