import { createSignal } from "solid-js"
import type { CheckResult, ManagedFile, NativeError } from "@/shared/types/native"
import { applyConfig, checkConfig, previewConfig } from "@/shared/utilities/native"
import { toNativeError } from "@/shared/utilities/guards"
import { appStore } from "@/app/utilities/store"
import { refetchBackend, refetchLocalState } from "@/modules/status/api/queries/status"

export type ApplyPhase =
  | "idle"
  | "validating"
  | "preview"
  | "authorizing"
  | "writing"
  | "applied"
  | "rolled-back"
  | "failed"

export function useApply() {
  const [phase, setPhase] = createSignal<ApplyPhase>("idle")
  const [check, setCheck] = createSignal<CheckResult | null>(null)
  const [files, setFiles] = createSignal<ManagedFile[]>([])
  const [error, setError] = createSignal<NativeError | null>(null)
  const [message, setMessage] = createSignal("")

  async function start() {
    setError(null)
    setPhase("validating")
    try {
      const config = appStore.snapshot()
      const result = await checkConfig(config)
      setCheck(result)
      if (result.errors.length > 0) {
        setPhase("failed")
        setError({ code: "VALIDATION", message: "fix the errors below before applying", retryable: false })
        return
      }
      setFiles(await previewConfig(config))
      setPhase("preview")
    } catch (raw) {
      setError(toNativeError(raw))
      setPhase("failed")
    }
  }

  async function confirm(force: boolean) {
    setPhase("authorizing")
    try {
      const config = appStore.snapshot()
      setPhase("writing")
      const result = await applyConfig(config, force)
      appStore.setDirty(false)
      setMessage(result.message)
      setPhase(result.applied ? "applied" : "rolled-back")
    } catch (raw) {
      const native = toNativeError(raw)
      setError(native)
      setPhase("failed")
    } finally {
      void refetchBackend()
      void refetchLocalState()
    }
  }

  function reset() {
    setPhase("idle")
    setError(null)
    setCheck(null)
    setFiles([])
    setMessage("")
  }

  return { phase, check, files, error, message, start, confirm, reset }
}
