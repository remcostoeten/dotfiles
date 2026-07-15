import type { JSX } from "solid-js"
import { For, splitProps } from "solid-js"

type Props = Omit<JSX.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> & {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  label?: string
}

export function Select(props: Props) {
  const [local, rest] = splitProps(props, ["options", "value", "onChange", "label", "class"])
  return (
    <select
      aria-label={local.label}
      class={`rounded border border-line bg-surface-2 px-1.5 py-1 text-[12.5px] text-ink hover:border-line-strong ${local.class ?? ""}`}
      value={local.value}
      onChange={(event) => local.onChange(event.currentTarget.value)}
      {...rest}
    >
      <For each={local.options}>
        {(option) => (
          <option value={option.value} selected={option.value === local.value}>
            {option.label}
          </option>
        )}
      </For>
    </select>
  )
}
