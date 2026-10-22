type Props = {
  tone: "ok" | "warn" | "bad" | "muted"
  text: string
}

export function Badge(props: Props) {
  const tones: Record<string, string> = {
    ok: "border-ok/25 bg-ok/10 text-ok",
    warn: "border-warn/25 bg-warn/10 text-warn",
    bad: "border-bad/30 bg-bad/10 text-bad",
    muted: "border-line-strong/70 bg-surface-2 text-ink-dim"
  }
  return (
    <span class={`inline-flex items-center rounded-full border px-2 py-px font-mono text-[10.5px] leading-4 whitespace-nowrap ${tones[props.tone]}`}>
      {props.text}
    </span>
  )
}
