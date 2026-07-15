import type { JSX } from "solid-js"
import { splitProps } from "solid-js"

type Props = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "danger" | "ghost"
}

export function Button(props: Props) {
  const [local, rest] = splitProps(props, ["variant", "class", "children"])
  const variants: Record<string, string> = {
    default: "bg-surface-3 border-line-strong hover:bg-surface-2 text-ink",
    primary: "bg-accent/20 border-accent/60 hover:bg-accent/30 text-ink",
    danger: "bg-bad/10 border-bad/50 hover:bg-bad/20 text-ink",
    ghost: "bg-transparent border-transparent hover:bg-surface-2 text-ink-dim hover:text-ink"
  }
  return (
    <button
      type="button"
      class={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-[12.5px] leading-5 disabled:opacity-45 disabled:pointer-events-none ${variants[local.variant ?? "default"]} ${local.class ?? ""}`}
      {...rest}
    >
      {local.children}
    </button>
  )
}
