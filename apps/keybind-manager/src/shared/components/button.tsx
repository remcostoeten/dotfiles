import type { JSX } from "solid-js"
import { Show, splitProps } from "solid-js"

type Props = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "danger" | "ghost"
  loading?: boolean
}

export function Button(props: Props) {
  const [local, rest] = splitProps(props, ["variant", "class", "children", "loading", "disabled"])
  const variants: Record<string, string> = {
    default: "bg-surface-2 border-transparent hover:bg-surface-3 focus-visible:bg-surface-3 text-ink",
    primary: "bg-ink border-transparent text-surface-0 font-medium hover:bg-accent",
    danger: "bg-bad/10 border-transparent hover:bg-bad/20 text-bad",
    ghost: "bg-transparent border-transparent hover:bg-surface-3 focus-visible:bg-surface-3 text-ink-dim hover:text-ink"
  }
  return (
    <button
      type="button"
      class={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-[12.5px] leading-5 transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] disabled:opacity-45 disabled:pointer-events-none ${variants[local.variant ?? "default"]} ${local.class ?? ""}`}
      disabled={local.disabled || local.loading}
      aria-busy={local.loading || undefined}
      {...rest}
    >
      <Show when={local.loading}>
        <span
          class="kb-spinner h-3 w-3 shrink-0 rounded-full border-[1.5px] border-current border-t-transparent opacity-70"
          aria-hidden="true"
        />
      </Show>
      {local.children}
    </button>
  )
}
