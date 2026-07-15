import { For, Show, Suspense, createMemo, createSignal } from "solid-js"
import { Badge } from "@/shared/components/badge"
import { Button } from "@/shared/components/button"
import {
  backendStatus,
  capabilities,
  installGuidance,
  localState
} from "@/modules/status/api/queries/status"
import { noop } from "@/shared/utilities/noop"

export function DiagnosticsPanel() {
  const [copied, setCopied] = createSignal(false)

  const report = createMemo(function build() {
    const caps = capabilities()
    const status = backendStatus()
    const state = localState()
    const home = "~"
    const lines = [
      `distribution: ${caps?.distro.name ?? "unknown"} (${caps?.distro.id ?? "?"})`,
      `desktop: ${caps?.desktop ?? "unknown"}`,
      `session: ${caps?.session ?? "unknown"}`,
      `systemd: ${caps?.systemd ?? false}`,
      `polkit: ${caps?.pkexec ?? false}`,
      `keyd installed: ${status?.installed ?? false}`,
      `keyd version: ${status?.version ?? "n/a"}`,
      `service exists: ${status?.service_exists ?? false}`,
      `service enabled: ${status?.service_enabled ?? false}`,
      `service active: ${status?.service_active ?? false}`,
      `config dir: ${status?.config_dir ?? "n/a"}`,
      `app config: ${home}/.config/keybind-manager/keybinds.json`,
      `last applied: ${state?.last_applied ?? "never"}`,
      `last error: ${state?.last_error ?? "none"}`
    ]
    return lines.join("\n")
  })

  function copyReport() {
    navigator.clipboard
      .writeText(report())
      .then(function flash() {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      })
      .catch(noop)
  }

  function row(label: string, value: string | undefined, tone?: "ok" | "bad" | "warn") {
    return (
      <div class="flex items-center justify-between border-b border-line py-1.5">
        <span class="text-[12px] text-ink-dim">{label}</span>
        <Show when={tone} fallback={<span class="text-[12px]">{value ?? "…"}</span>}>
          <Badge tone={tone ?? "muted"} text={value ?? "…"} />
        </Show>
      </div>
    )
  }

  return (
    <div class="flex min-h-0 flex-1 flex-col overflow-auto p-3">
      <Suspense fallback={<p class="text-ink-faint">Collecting diagnostics…</p>}>
        <div class="max-w-xl">
          {row("Distribution", capabilities()?.distro.name)}
          {row("Desktop environment", capabilities()?.desktop)}
          {row("Session type", capabilities()?.session)}
          {row(
            "Permission helper (polkit)",
            capabilities()?.pkexec ? "available" : "missing",
            capabilities()?.pkexec ? "ok" : "bad"
          )}
          {row(
            "keyd",
            backendStatus()?.installed ? (backendStatus()?.version ?? "installed") : "not installed",
            backendStatus()?.installed ? "ok" : "bad"
          )}
          {row(
            "keyd service enabled",
            backendStatus()?.service_enabled ? "yes" : "no",
            backendStatus()?.service_enabled ? "ok" : "warn"
          )}
          {row(
            "keyd service running",
            backendStatus()?.service_active ? "yes" : "no",
            backendStatus()?.service_active ? "ok" : "bad"
          )}
          {row("Configuration path", backendStatus()?.config_dir)}
          {row("Last successful apply", localState()?.last_applied ?? "never")}
          {row("Last error", localState()?.last_error ?? "none")}

          <Show when={backendStatus() && !backendStatus()?.installed}>
            <div class="mt-4">
              <h3 class="mb-1 text-[12px] font-semibold">Install keyd</h3>
              <For each={installGuidance() ?? []}>
                {(pkg) => (
                  <div class="mb-2 rounded border border-line bg-surface-1 p-2">
                    <p class="text-[11.5px] text-ink-dim">{pkg.source}</p>
                    <code class="text-[12px] select-text">{pkg.command}</code>
                  </div>
                )}
              </For>
              <p class="text-[11.5px] text-ink-faint">
                Commands are shown for you to run deliberately; nothing is installed
                automatically.
              </p>
            </div>
          </Show>

          <div class="mt-4 flex items-center gap-2">
            <Button onClick={copyReport}>{copied() ? "Copied" : "Copy diagnostics"}</Button>
            <span class="text-[11.5px] text-ink-faint">
              Paths are redacted to your home directory.
            </span>
          </div>
        </div>
      </Suspense>
    </div>
  )
}
