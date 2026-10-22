import { Select as Kobalte } from "@kobalte/core/select"

type Option = { value: string; label: string }

type Props = {
  options: Option[]
  value: string
  onChange: (value: string) => void
  label?: string
  class?: string
  disabled?: boolean
}

export function Select(props: Props) {
  const selected = () => props.options.find((o) => o.value === props.value) ?? null

  return (
    <Kobalte<Option>
      options={props.options}
      optionValue="value"
      optionTextValue="label"
      value={selected()}
      onChange={(option) => option && props.onChange(option.value)}
      disabled={props.disabled}
      gutter={6}
      sameWidth={false}
      itemComponent={(itemProps) => (
        <Kobalte.Item
          item={itemProps.item}
          class="flex cursor-default items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-[12.5px] text-ink-dim outline-none data-[highlighted]:bg-surface-3 data-[highlighted]:text-ink data-[selected]:text-ink"
        >
          <Kobalte.ItemLabel>{itemProps.item.rawValue.label}</Kobalte.ItemLabel>
          <Kobalte.ItemIndicator class="text-accent">
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M1.5 5.2 4 7.5l4.5-5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </Kobalte.ItemIndicator>
        </Kobalte.Item>
      )}
      class={props.class}
    >
      <Kobalte.Trigger
        aria-label={props.label}
        class="group flex w-full min-w-28 items-center justify-between gap-2 rounded-md bg-surface-2 px-2.5 py-1 text-[12.5px] text-ink outline-none transition-colors duration-150 hover:bg-surface-3 focus-visible:bg-surface-3 data-[expanded]:bg-surface-3 disabled:pointer-events-none disabled:opacity-45"
      >
        <Kobalte.Value<Option> class="truncate">{(state) => state.selectedOption()?.label}</Kobalte.Value>
        <Kobalte.Icon class="text-ink-faint transition-transform duration-150 group-data-[expanded]:rotate-180">
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M2 3.8 5 6.8l3-3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </Kobalte.Icon>
      </Kobalte.Trigger>
      <Kobalte.Portal>
        <Kobalte.Content class="kb-select-content z-50 min-w-40 overflow-hidden rounded-lg bg-surface-2 p-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.9)]">
          <Kobalte.Listbox class="max-h-72 overflow-y-auto outline-none" />
        </Kobalte.Content>
      </Kobalte.Portal>
    </Kobalte>
  )
}
