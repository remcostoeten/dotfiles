import { For, Show, createSignal } from "solid-js"
import { appStore } from "@/app/utilities/store"
import { Badge } from "@/shared/components/badge"
import { Button } from "@/shared/components/button"
import { Dialog } from "@/shared/components/dialog"
import { helperAction } from "@/shared/utilities/native"
import { toNativeError } from "@/shared/utilities/guards"
import { backendStatus, capabilities, refetchBackend } from "@/modules/status/api/queries/status"
import { useApply } from "@/modules/status/hooks/use-apply"

const phaseLabels: Record<string, string> = {
  validating: "Validating…",
  authorizing: "Requesting authorization…",
  writing: "Writing configuration…",
  applied: "Applied",
  "rolled-back": "Rolled back",
  failed: "Failed"
}

export function StatusHeader() {
  const apply = useApply()
  const [serviceBusy, setServiceBusy] = createSignal(false)
  const [serviceError, setServiceError] = createSignal("")

  async function toggleService() {
    const status = backendStatus()
    if (!status) {
      return
    }
    setServiceBusy(true)
    setServiceError("")
    try {
      await helperAction(status.service_active ? "disable-service" : "enable-service")
    } catch (raw) {
      setServiceError(toNativeError(raw).message)
    } finally {
      setServiceBusy(false)
      void refetchBackend()
    }
  }

  const dangerous = () => (apply.check()?.warnings ?? []).some((w) => w.code === "DANGEROUS")

  return (
    <header class="flex items-center gap-3 border-b border-line bg-surface-1 px-3 py-2">
      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <span class="font-semibold">Keybind Manager</span>
        <Show when={capabilities()} fallback={<Badge tone="muted" text="detecting…" />}>
          {(caps) => (
            <>
              <Badge tone="muted" text={caps().distro.name} />
              <Badge tone="muted" text={`${caps().desktop} · ${caps().session}`} />
            </>
          )}
        </Show>
        <Show when={backendStatus()}>
          {(status) => (
            <Show
              when={status().installed}
              fallback={<Badge tone="bad" text="keyd not installed" />}
            >
              <Badge
                tone={status().service_active ? "ok" : "bad"}
                text={status().service_active ? "keyd active" : "keyd stopped"}
              />
            </Show>
          )}
        </Show>
        <Show when={appStore.dirty()}>
          <Badge tone="warn" text="unsaved changes" />
        </Show>
        <Show when={apply.phase() !== "idle" && apply.phase() !== "preview"}>
          <span
            class={`text-[12px] ${apply.phase() === "failed" ? "text-bad" : apply.phase() === "applied" ? "text-ok" : "text-ink-dim"}`}
            role="status"
          >
            {phaseLabels[apply.phase()] ?? ""}
          </span>
        </Show>
      </div>
      <Show when={serviceError()}>
        <span class="max-w-56 truncate text-[11px] text-bad" title={serviceError()}>
          {serviceError()}
        </span>
      </Show>
      <Button onClick={() => void toggleService()} disabled={serviceBusy() || !backendStatus()?.installed}>
        {backendStatus()?.service_active ? "Suspend" : "Enable"}
      </Button>
      <Button
        variant="primary"
        onClick={() => void apply.start()}
        disabled={apply.phase() === "validating" || apply.phase() === "writing"}
      >
        Apply
      </Button>

      <Dialog
        open={apply.phase() === "preview"}
        onClose={apply.reset}
        title="Preview generated configuration"
        wide
        footer={
          <>
            <Button variant="ghost" onClick={apply.reset}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void apply.confirm(false)}>
              Apply
            </Button>
          </>
        }
      >
        <Show when={dangerous()}>
          <p class="mb-2 rounded border border-warn/40 bg-warn/10 px-2 py-1.5 text-[12px] text-warn">
            This profile remaps or disables essential keys. Make sure you can still type your
            password before rebooting.
          </p>
        </Show>
        <For each={apply.files()}>
          {(file) => (
            <div class="mb-3">
              <p class="mb-1 text-[11px] text-ink-faint">/etc/keyd/{file.name}</p>
              <pre class="overflow-auto rounded border border-line bg-surface-0 p-2 text-[11px] leading-4 text-ink-dim select-text">
                {file.content}
              </pre>
            </div>
          )}
        </For>
      </Dialog>

      <Dialog
        open={apply.phase() === "failed" && apply.error()?.code === "EXTERNAL_CHANGE"}
        onClose={apply.reset}
        title="Configuration changed on disk"
        footer={
          <>
            <Button variant="ghost" onClick={apply.reset}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void apply.confirm(true)}>
              Overwrite anyway
            </Button>
          </>
        }
      >
        <p class="text-[12.5px] text-ink-dim">{apply.error()?.message}</p>
      </Dialog>

      <Dialog
        open={apply.phase() === "failed" && apply.error()?.code !== "EXTERNAL_CHANGE"}
        onClose={apply.reset}
        title="Apply failed"
        footer={<Button onClick={apply.reset}>Close</Button>}
      >
        <p class="text-[12.5px]">{apply.error()?.message}</p>
        <Show when={apply.error()?.action}>
          <p class="mt-1 text-[12px] text-ink-dim">{apply.error()?.action}</p>
        </Show>
        <Show when={(apply.check()?.errors ?? []).length > 0}>
          <ul class="mt-2 list-disc pl-4 text-[12px] text-bad">
            <For each={apply.check()?.errors}>{(issue) => <li>{issue.message}</li>}</For>
          </ul>
        </Show>
      </Dialog>

      <Dialog
        open={apply.phase() === "rolled-back"}
        onClose={apply.reset}
        title="Rolled back"
        footer={<Button onClick={apply.reset}>Close</Button>}
      >
        <p class="text-[12.5px]">{apply.message()}</p>
        <p class="mt-1 text-[12px] text-ink-dim">
          The previous working configuration was restored automatically.
        </p>
      </Dialog>
    </header>
  )
}
