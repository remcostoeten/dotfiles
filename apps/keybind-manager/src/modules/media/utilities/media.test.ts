import { describe, expect, it } from "vitest"
import { describeMediaError, mediaOptions, signalLevel } from "@/modules/media/utilities/media"

function device(kind: MediaDeviceKind, deviceId: string, label: string): MediaDeviceInfo {
  return { kind, deviceId, label, groupId: "", toJSON: () => ({}) }
}

describe("mediaOptions", () => {
  it("keeps one kind and numbers unlabeled devices", () => {
    const devices = [
      device("audioinput", "a", ""),
      device("videoinput", "v", "Webcam"),
      device("audioinput", "b", "Headset"),
      device("audioinput", "", "")
    ]
    expect(mediaOptions(devices, "audioinput")).toEqual([
      { value: "a", label: "Microphone 1" },
      { value: "b", label: "Headset" }
    ])
  })
})

describe("describeMediaError", () => {
  it("explains known failures", () => {
    expect(describeMediaError(new DOMException("x", "NotReadableError"))).toMatch(/busy/)
    expect(describeMediaError(new DOMException("x", "NotAllowedError"))).toMatch(/denied/)
  })

  it("falls back for unknown values", () => {
    expect(describeMediaError(42)).toBe("The device could not be opened.")
  })
})

describe("signalLevel", () => {
  it("is zero for silence and one for full scale", () => {
    expect(signalLevel(new Float32Array(128))).toBe(0)
    expect(signalLevel(new Float32Array(128).fill(1))).toBe(1)
  })

  it("places quiet input inside the range", () => {
    const level = signalLevel(new Float32Array(128).fill(0.01))
    expect(level).toBeGreaterThan(0.2)
    expect(level).toBeLessThan(0.5)
  })
})
