import { keyLabel } from "@/modules/mappings/utilities/key-names"

type Props = {
  name: string
  mods?: string[]
  dim?: boolean
}

export function KeyCap(props: Props) {
  return (
    <span class="inline-flex items-center gap-1">
      {(props.mods ?? []).map(function renderMod(mod) {
        return (
          <kbd class="rounded border border-line-strong bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-dim shadow-[0_1.5px_0_0_var(--color-line-strong)]">
            {keyLabel(mod)}
          </kbd>
        )
      })}
      <kbd
        class={`rounded border border-line-strong bg-surface-3 px-1.5 py-0.5 text-[11px] shadow-[0_1.5px_0_0_var(--color-line-strong)] ${props.dim ? "text-ink-faint" : "text-ink"}`}
      >
        {keyLabel(props.name)}
      </kbd>
    </span>
  )
}
