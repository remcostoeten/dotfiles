import { For, Show, createSignal } from "solid-js"
import { appStore } from "@/app/utilities/store"
import { Badge } from "@/shared/components/badge"
import { Button } from "@/shared/components/button"
import { Dialog } from "@/shared/components/dialog"
import { helperAction } from "@/shared/utilities/native"
import { toNativeError } from "@/shared/utilities/guards"
import { backendStatus, capabilities, refetchBackend } from "@/modules/status/api/queries/status"
import { useApply } from "@/modules/status/hooks/use-apply"
import { WindowControls } from "@/app/components/window-controls"
import { ConfigFilePreview } from "@/modules/status/components/config-file-preview"

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
    <header data-tauri-drag-region class="flex items-center gap-3 border-b border-line px-4 py-2.5">
      <div data-tauri-drag-region class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <span class="flex items-center gap-2 font-pixel text-[15px] tracking-tight">
          <span class="h-2.5 w-2.5 rounded-[3px] bg-accent" aria-hidden="true" />
          keybind manager
        </span>
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
        <span
          class="max-w-56 truncate rounded-sm border border-bad/40 bg-bad/10 px-1.5 py-px text-[11px] text-bad"
          title={serviceError()}
        >
          {serviceError()}
        </span>
      </Show>
      <Button onClick={() => void toggleService()} loading={serviceBusy()} disabled={!backendStatus()?.installed}>
        {backendStatus()?.service_active ? "Suspend" : "Enable"}
      </Button>
      <Button
        variant="primary"
        onClick={() => void apply.start()}
        loading={apply.phase() === "validating" || apply.phase() === "writing"}
      >
        Apply
      </Button>
      <WindowControls />

      <Dialog
        open={apply.phase() === "preview"}
        onClose={apply.reset}
        title="Review configuration"
        description={`${apply.files().length} ${apply.files().length === 1 ? "file" : "files"} will be written to /etc/keyd`}
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
        <div class="flex flex-col gap-3">
          <Show when={dangerous()}>
            <p class="rounded-lg border border-warn/30 bg-warn/[0.06] px-3 py-2 text-[12px] leading-5 text-warn">
              This profile remaps or disables essential keys. Make sure you can still type your
              password before rebooting.
            </p>
          </Show>
          <For each={apply.files()}>
            {(file) => <ConfigFilePreview name={file.name} content={file.content} />}
          </For>
        </div>
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
