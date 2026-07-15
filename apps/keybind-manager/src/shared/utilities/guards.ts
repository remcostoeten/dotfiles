import type { NativeError } from "@/shared/types/native"

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function isNativeError(value: unknown): value is NativeError {
  return (
    isRecord(value) &&
    typeof value.code === "string" &&
    typeof value.message === "string" &&
    typeof value.retryable === "boolean"
  )
}

export function toNativeError(value: unknown): NativeError {
  if (isNativeError(value)) {
    return value
  }
  if (value instanceof Error) {
    return { code: "UNKNOWN", message: value.message, retryable: false }
  }
  return {
    code: "UNKNOWN",
    message: typeof value === "string" ? value : "unexpected error",
    retryable: false
  }
}
