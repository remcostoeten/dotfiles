import { createSignal } from "solid-js"
import type { KeyboardConflict, NativeError } from "@/shared/types/native"
import { fetchKeyboardConflicts } from "@/modules/devices/api/queries/conflicts"

export type ScanPhase = "idle" | "scanning" | "done" | "failed"

export function useKeyboardConflicts() {
  const [phase, setPhase] = createSignal<ScanPhase>("idle")
  const [conflicts, setConflicts] = createSignal<KeyboardConflict[]>([])
  const [error, setError] = createSignal<NativeError | null>(null)

  async function scan() {
    setPhase("scanning")
    setError(null)
    const result = await fetchKeyboardConflicts()
    if (result.ok) {
      setConflicts(result.conflicts)
      setPhase("done")
    } else {
      setError(result.error)
      setPhase("failed")
    }
  }

  return { phase, conflicts, error, scan }
}
