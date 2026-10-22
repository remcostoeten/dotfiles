import { For, Show, createMemo, createSignal } from "solid-js"
import { Popover } from "@kobalte/core/popover"
import { keyGroups, keyLabel } from "@/modules/mappings/utilities/key-names"

type Extra = { value: string; label: string }

type KeyPickerProps = {
  value?: string
  extras?: Extra[]
  autofocus?: boolean
  onPick: (key: string) => void
}

const aliases: Record<string, string[]> = {
  leftcontrol: ["ctrl", "control"],
  rightcontrol: ["ctrl", "control"],
  leftmeta: ["super", "win", "cmd", "meta"],
  rightmeta: ["super", "win", "cmd", "meta"],
  leftalt: ["alt", "option"],
  rightalt: ["alt", "altgr", "option"],
  esc: ["escape"],
  enter: ["return"],
  backspace: ["bksp"],
  delete: ["del"],
  pageup: ["pgup"],
  pagedown: ["pgdn"],
  print: ["printscreen", "prtsc", "screenshot"],
  grave: ["backtick", "tilde"],
  apostrophe: ["quote"],
  dot: ["period"],
  minus: ["dash", "hyphen"],
  leftbrace: ["bracket", "["],
  rightbrace: ["bracket", "]"],
  mute: ["volume", "audio"],
  fn: ["function"]
}

function matches(key: string, query: string): boolean {
  if (!query) {
    return true
  }
  return (
    key.includes(query) ||
    keyLabel(key).toLowerCase().includes(query) ||
    (aliases[key] ?? []).some((alias) => alias.includes(query))
  )
}

export function KeyPicker(props: KeyPickerProps) {
  const [query, setQuery] = createSignal("")
  const needle = () => query().trim().toLowerCase()

  const groups = createMemo(() =>
    keyGroups
      .map((group) => ({ name: group.name, keys: group.keys.filter((key) => matches(key, needle())) }))
      .filter((group) => group.keys.length > 0)
  )
  const extras = createMemo(() =>
    (props.extras ?? []).filter((extra) => !needle() || extra.label.toLowerCase().includes(needle()))
  )
  const first = () => extras()[0]?.value ?? groups()[0]?.keys[0]

  function chipClass(active: boolean) {
    return `rounded border px-1.5 py-0.5 text-[11.5px] transition-colors duration-100 ${
      active
        ? "border-accent bg-accent/15 text-ink"
        : "border-line-strong bg-surface-3 text-ink-dim hover:border-ink-faint hover:text-ink"
    }`
  }

  return (
    <div class="flex flex-col gap-2">
      <input
        ref={(el) => props.autofocus && queueMicrotask(() => el.focus())}
        class="w-full rounded border border-line bg-surface-2 px-2 py-1 text-[12.5px] transition-colors duration-100"
        placeholder="Search keys (e.g. fn, volume, super, f13)…"
        aria-label="Search keys"
        value={query()}
        onInput={(event) => setQuery(event.currentTarget.value)}
        onKeyDown={(event) => {
          const pick = first()
          if (event.key === "Enter" && pick) {
            event.preventDefault()
            props.onPick(pick)
          }
        }}
      />
      <div class="flex max-h-72 flex-col gap-2.5 overflow-y-auto pr-1">
        <Show when={extras().length > 0}>
          <div class="flex flex-wrap gap-1">
            <For each={extras()}>
              {(extra) => (
                <button
                  type="button"
                  class={chipClass(props.value === extra.value)}
                  onClick={() => props.onPick(extra.value)}
                >
                  {extra.label}
                </button>
              )}
            </For>
          </div>
        </Show>
        <For each={groups()}>
          {(group) => (
            <section>
              <h4 class="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-ink-faint">
                {group.name}
              </h4>
              <div class="flex flex-wrap gap-1">
                <For each={group.keys}>
                  {(key) => (
                    <button
                      type="button"
                      class={chipClass(props.value === key)}
                      title={key}
                      onClick={() => props.onPick(key)}
                    >
                      {keyLabel(key)}
                    </button>
                  )}
                </For>
              </div>
            </section>
          )}
        </For>
        <Show when={groups().length === 0 && extras().length === 0}>
          <p class="py-3 text-center text-[12px] text-ink-faint">No key matches “{query()}”.</p>
        </Show>
      </div>
    </div>
  )
}

type KeyPickerButtonProps = {
  label: string
  value: string
  display: string
  extras?: Extra[]
  onPick: (key: string) => void
}

export function KeyPickerButton(props: KeyPickerButtonProps) {
  const [open, setOpen] = createSignal(false)

  return (
    <Popover open={open()} onOpenChange={setOpen} gutter={6} placement="bottom-start">
      <Popover.Trigger
        aria-label={props.label}
        class="flex min-w-28 items-center justify-between gap-2 rounded-md bg-surface-2 px-2.5 py-1 text-[12.5px] text-ink outline-none transition-colors duration-150 hover:bg-surface-3 focus-visible:bg-surface-3 data-[expanded]:bg-surface-3"
      >
        <span class="truncate">{props.display}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" class="text-ink-faint">
          <path d="M2 3.8 5 6.8l3-3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content class="kb-select-content z-50 w-[26rem] max-w-[calc(100vw-2rem)] rounded-lg bg-surface-2 p-2.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.9)] outline-none">
          <KeyPicker
            value={props.value}
            extras={props.extras}
            autofocus
            onPick={(key) => {
              props.onPick(key)
              setOpen(false)
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  )
}
