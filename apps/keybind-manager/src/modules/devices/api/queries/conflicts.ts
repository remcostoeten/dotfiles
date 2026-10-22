import type { KeyboardConflict, NativeError } from "@/shared/types/native"
import { getKeyboardConflicts } from "@/shared/utilities/native"
import { toNativeError } from "@/shared/utilities/guards"

export type ConflictScanResult =
  | { ok: true; conflicts: KeyboardConflict[] }
  | { ok: false; error: NativeError }

export async function fetchKeyboardConflicts(): Promise<ConflictScanResult> {
  try {
    const conflicts = await getKeyboardConflicts()
    return { ok: true, conflicts }
  } catch (raw) {
    return { ok: false, error: toNativeError(raw) }
  }
}
