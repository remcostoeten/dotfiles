import { getCurrentWindow } from "@tauri-apps/api/window"
import { noop } from "@/shared/utilities/noop"

function run(action: (win: ReturnType<typeof getCurrentWindow>) => Promise<void>) {
  action(getCurrentWindow()).catch(noop)
}

export function WindowControls() {
  const base =
    "grid h-7 w-7 place-items-center rounded-md text-ink-faint transition-colors duration-150 hover:bg-surface-3 hover:text-ink"
  return (
    <div class="ml-1 flex items-center gap-0.5">
      <button type="button" aria-label="Minimize" class={base} onClick={() => run((w) => w.minimize())}>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M1.5 5h7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
        </svg>
      </button>
      <button type="button" aria-label="Maximize" class={base} onClick={() => run((w) => w.toggleMaximize())}>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <rect x="1.5" y="1.5" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Close"
        class={`${base} hover:!bg-accent hover:!text-surface-0`}
        onClick={() => run((w) => w.close())}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  )
}
