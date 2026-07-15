import { describe, expect, it } from "vitest"
import { isNativeError, toNativeError } from "@/shared/utilities/guards"

describe("toNativeError", () => {
  it("passes through structured errors", () => {
    const error = { code: "RELOAD", message: "boom", retryable: true }
    expect(isNativeError(error)).toBe(true)
    expect(toNativeError(error)).toEqual(error)
  })

  it("wraps plain errors", () => {
    const wrapped = toNativeError(new Error("nope"))
    expect(wrapped.code).toBe("UNKNOWN")
    expect(wrapped.message).toBe("nope")
  })

  it("wraps arbitrary values", () => {
    expect(toNativeError("weird").message).toBe("weird")
    expect(toNativeError(42).message).toBe("unexpected error")
  })

  it("rejects malformed shapes", () => {
    expect(isNativeError({ code: "X" })).toBe(false)
    expect(isNativeError(null)).toBe(false)
  })
})
