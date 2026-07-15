type Props = {
  tone: "ok" | "warn" | "bad" | "muted"
  text: string
}

export function Badge(props: Props) {
  const tones: Record<string, string> = {
    ok: "border-ok/40 text-ok",
    warn: "border-warn/40 text-warn",
    bad: "border-bad/40 text-bad",
    muted: "border-line text-ink-faint"
  }
  return (
    <span class={`inline-flex items-center rounded-sm border px-1.5 py-px text-[11px] ${tones[props.tone]}`}>
      {props.text}
    </span>
  )
}
