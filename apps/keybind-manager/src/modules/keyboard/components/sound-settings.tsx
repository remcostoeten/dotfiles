import { Popover } from "@kobalte/core/popover"
import { Show, type JSX } from "solid-js"
import { Select } from "@/shared/components/select"
import { Toggle } from "@/shared/components/toggle"
import {
  defaultSoundSettings,
  noteName,
  playKeyTone,
  scales,
  voices,
  type Scale,
  type SoundSettings,
  type Voice
} from "@/modules/keyboard/utilities/key-tones"

type Props = {
  settings: SoundSettings
  onChange: (settings: SoundSettings) => void
}

function preview(settings: SoundSettings) {
  if (!settings.enabled) {
    return
  }
  const steps = scales[settings.scale].steps
  const picks = [0, Math.min(2, steps.length - 1), Math.min(4, steps.length - 1)]
  picks.forEach((index, order) => {
    const frequency = 440 * 2 ** ((settings.baseNote + (steps[index] ?? 0) - 69) / 12)
    setTimeout(() => playKeyTone(frequency, settings), order * 110)
  })
}

export function SoundSettingsButton(props: Props) {
  function update(patch: Partial<SoundSettings>, audition = true) {
    const next = { ...props.settings, ...patch }
    props.onChange(next)
    if (audition) {
      preview(next)
    }
  }

  return (
    <Popover gutter={6} placement="bottom-end">
      <Popover.Trigger
        aria-label="Key sound settings"
        title="Key sound settings"
        class={`grid h-7 w-7 place-items-center rounded-md transition-colors duration-150 hover:bg-surface-3 data-[expanded]:bg-surface-3 ${props.settings.enabled ? "text-accent" : "text-ink-faint hover:text-ink-dim"}`}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M2.5 6h2.5l3.5-3v10l-3.5-3h-2.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
          <Show
            when={props.settings.enabled}
            fallback={<path d="M11 6.5l3 3m0-3l-3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />}
          >
            <path d="M11 5.5a3.5 3.5 0 010 5M12.8 3.8a6 6 0 010 8.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
          </Show>
        </svg>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content class="kb-select-content z-50 w-72 rounded-xl border border-line-strong bg-surface-1 p-3.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.9)] outline-none">
          <div class="flex items-center justify-between">
            <Popover.Title class="text-[13px] font-semibold tracking-tight">Key sounds</Popover.Title>
            <Toggle
              label="Play key sounds"
              checked={props.settings.enabled}
              onChange={(enabled) => update({ enabled })}
            />
          </div>

          <div
            class={`mt-3 flex flex-col gap-3 transition-opacity duration-150 ${props.settings.enabled ? "" : "pointer-events-none opacity-40"}`}
          >
            <Field label="Voice">
              <Select
                label="Voice"
                options={Object.entries(voices).map(([value, voice]) => ({ value, label: voice.label }))}
                value={props.settings.voice}
                onChange={(voice) => update({ voice: voice as Voice })}
              />
            </Field>
            <Field label="Scale">
              <Select
                label="Scale"
                options={Object.entries(scales).map(([value, scale]) => ({ value, label: scale.label }))}
                value={props.settings.scale}
                onChange={(scale) => update({ scale: scale as Scale })}
              />
            </Field>
            <Slider
              label="Volume"
              value={props.settings.volume}
              min={0}
              max={1}
              step={0.05}
              display={`${Math.round(props.settings.volume * 100)}%`}
              onInput={(volume) => update({ volume }, false)}
              onCommit={() => preview(props.settings)}
            />
            <Slider
              label="Lowest note"
              value={props.settings.baseNote}
              min={24}
              max={72}
              step={1}
              display={noteName(props.settings.baseNote)}
              onInput={(baseNote) => update({ baseNote }, false)}
              onCommit={() => preview(props.settings)}
            />
            <Slider
              label="Pitch spread"
              value={props.settings.spread}
              min={0.25}
              max={1.5}
              step={0.05}
              display={`${props.settings.spread.toFixed(2)}×`}
              onInput={(spread) => update({ spread }, false)}
            />
            <Slider
              label="Note length"
              value={props.settings.length}
              min={0.08}
              max={1.5}
              step={0.02}
              display={`${Math.round(props.settings.length * 1000)} ms`}
              onInput={(length) => update({ length }, false)}
              onCommit={() => preview(props.settings)}
            />
          </div>

          <button
            type="button"
            class="mt-3.5 text-[11.5px] text-ink-faint transition-colors duration-100 hover:text-ink"
            onClick={() => update({ ...defaultSoundSettings, enabled: props.settings.enabled })}
          >
            Reset to defaults
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  )
}

function Field(props: { label: string; children: JSX.Element }) {
  return (
    <div class="flex items-center justify-between gap-3">
      <span class="text-[12px] text-ink-dim">{props.label}</span>
      <div class="w-40">{props.children}</div>
    </div>
  )
}

type SliderProps = {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onInput: (value: number) => void
  onCommit?: () => void
}

function Slider(props: SliderProps) {
  return (
    <label class="flex flex-col gap-1.5">
      <span class="flex items-center justify-between text-[12px]">
        <span class="text-ink-dim">{props.label}</span>
        <span class="font-mono text-[11px] text-ink-faint">{props.display}</span>
      </span>
      <input
        type="range"
        class="kb-range w-full"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onInput={(event) => props.onInput(Number(event.currentTarget.value))}
        onChange={() => props.onCommit?.()}
      />
    </label>
  )
}
