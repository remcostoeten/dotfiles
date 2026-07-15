import { Switch } from "@kobalte/core/switch"

type Props = {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  showLabel?: boolean
  disabled?: boolean
}

export function Toggle(props: Props) {
  return (
    <Switch
      checked={props.checked}
      onChange={props.onChange}
      disabled={props.disabled}
      class="inline-flex items-center gap-2"
    >
      <Switch.Input aria-label={props.label} />
      <Switch.Control class="h-4 w-7 rounded-full border border-line-strong bg-surface-2 transition-colors data-[checked]:bg-ok/40">
        <Switch.Thumb class="block h-3 w-3 translate-x-0.5 translate-y-[1px] rounded-full bg-ink-dim transition-transform data-[checked]:translate-x-3.5 data-[checked]:bg-ink" />
      </Switch.Control>
      {props.showLabel && <Switch.Label class="text-[12px] text-ink-dim">{props.label}</Switch.Label>}
    </Switch>
  )
}
