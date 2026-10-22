import { describe, expect, it, vi } from "vitest"
import { fireEvent, render } from "@solidjs/testing-library"
import { KeyboardConflictsPanel } from "@/modules/devices/components/keyboard-conflicts-panel"
import { getKeyboardConflicts } from "@/shared/utilities/native"
import type { KeyboardConflict } from "@/shared/types/native"

vi.mock("@/shared/utilities/native", () => ({
  getKeyboardConflicts: vi.fn()
}))

function noConflictEntry(): KeyboardConflict {
  return {
    device_name: "USB Keyboard",
    vendor: "04d9",
    product: "0141",
    matches: [{ filename: "keybind-manager-default.conf", managed: true, rank: "explicit" }],
    conflict: false,
    shadowed: false,
  }
}

function conflictEntry(): KeyboardConflict {
  return {
    device_name: "USB Keyboard",
    vendor: "04d9",
    product: "0141",
    matches: [
      { filename: "keybind-manager-default.conf", managed: true, rank: "wildcard" },
      { filename: "other.conf", managed: false, rank: "wildcard" }
    ],
    conflict: true,
    shadowed: false,
  }
}

describe("KeyboardConflictsPanel", () => {
  it("renders without warnings when scan finds no conflicts", async () => {
    vi.mocked(getKeyboardConflicts).mockResolvedValueOnce([noConflictEntry()])

    const { getByText, findByText } = render(() => <KeyboardConflictsPanel />)
    fireEvent.click(getByText("Scan /etc/keyd"))

    expect(await findByText("USB Keyboard")).toBeTruthy()
    expect(() => getByText(/keyd will only use one of these/)).toThrow()
  })

  it("renders a conflict warning when a keyboard matches two configs", async () => {
    vi.mocked(getKeyboardConflicts).mockResolvedValueOnce([conflictEntry()])

    const { getByText, findByText } = render(() => <KeyboardConflictsPanel />)
    fireEvent.click(getByText("Scan /etc/keyd"))

    expect(await findByText("conflict")).toBeTruthy()
    expect(getByText("keybind-manager-default.conf")).toBeTruthy()
    expect(getByText("other.conf")).toBeTruthy()
    expect(getByText(/keyd will only use one of these/)).toBeTruthy()
  })
})
