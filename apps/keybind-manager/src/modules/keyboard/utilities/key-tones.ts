import type { PhysicalKey } from "@/modules/keyboard/utilities/layouts"
import { noop } from "@/shared/utilities/noop"

const STORAGE_KEY = "kb-test-sound-settings"
const ROW_WIDTH = 2.67
const MAX_GAIN = 0.4
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

export const voices = {
  pluck: { label: "Soft pluck", sweep: true, partials: [["triangle", 1, 0.8], ["sine", 2, 0.25]] },
  bell: { label: "Bell", sweep: false, partials: [["sine", 1, 0.7], ["sine", 2.76, 0.25], ["sine", 5.4, 0.08]] },
  chip: { label: "Chiptune", sweep: false, partials: [["square", 1, 0.35]] },
  sine: { label: "Pure sine", sweep: false, partials: [["sine", 1, 0.9]] }
} as const satisfies Record<string, { label: string; sweep: boolean; partials: [OscillatorType, number, number][] }>

export const scales = {
  pentatonic: { label: "Major pentatonic", steps: [0, 2, 4, 7, 9] },
  minor: { label: "Minor pentatonic", steps: [0, 3, 5, 7, 10] },
  major: { label: "Major", steps: [0, 2, 4, 5, 7, 9, 11] },
  chromatic: { label: "Chromatic", steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }
} as const

export type Voice = keyof typeof voices
export type Scale = keyof typeof scales

export type SoundSettings = {
  enabled: boolean
  volume: number
  voice: Voice
  scale: Scale
  baseNote: number
  spread: number
  length: number
}

export const defaultSoundSettings: SoundSettings = {
  enabled: true,
  volume: 0.45,
  voice: "pluck",
  scale: "pentatonic",
  baseNote: 48,
  spread: 0.75,
  length: 0.6
}

let context: AudioContext | null = null
let output: GainNode | null = null

export function noteName(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`
}

/**
 * @name keyPitches
 * @description Maps every key code in a layout to a frequency on the chosen scale, rising left to right and bottom to top.
 * @example keyPitches(layout.rows, defaultSoundSettings).get("a")
 */
export function keyPitches(rows: PhysicalKey[][], settings: SoundSettings): Map<string, number> {
  const steps = scales[settings.scale].steps
  const pitches = new Map<string, number>()
  rows.forEach((row, rowIndex) => {
    let offset = 0
    for (const key of row) {
      const width = key.width ?? 1
      const center = offset + width / 2
      offset += width
      if (!key.code) {
        continue
      }
      const step = Math.round((center + (rows.length - 1 - rowIndex) * ROW_WIDTH) * settings.spread)
      const semitone = Math.floor(step / steps.length) * 12 + (steps[step % steps.length] ?? 0)
      pitches.set(key.code, 440 * 2 ** ((settings.baseNote + semitone - 69) / 12))
    }
  })
  return pitches
}

function audio(): { ctx: AudioContext; out: GainNode } {
  if (!context || !output) {
    context = new AudioContext()
    const compressor = context.createDynamicsCompressor()
    output = context.createGain()
    output.connect(compressor).connect(context.destination)
  }
  if (context.state === "suspended") {
    void context.resume()
  }
  return { ctx: context, out: output }
}

/**
 * @name playKeyTone
 * @description Plays one short note at the given frequency using the voice, volume and length from the settings.
 * @example playKeyTone(440, defaultSoundSettings)
 */
export function playKeyTone(frequency: number, settings: SoundSettings) {
  const { ctx, out } = audio()
  const voice = voices[settings.voice]
  const now = ctx.currentTime
  const end = now + settings.length
  out.gain.setValueAtTime(settings.volume * MAX_GAIN, now)

  const envelope = ctx.createGain()
  const filter = ctx.createBiquadFilter()
  filter.type = "lowpass"
  filter.frequency.setValueAtTime(Math.min(frequency * 6, 18000), now)
  if (voice.sweep) {
    filter.frequency.exponentialRampToValueAtTime(frequency * 1.5, now + settings.length * 0.6)
  }
  envelope.gain.setValueAtTime(0.0001, now)
  envelope.gain.exponentialRampToValueAtTime(1, now + 0.008)
  envelope.gain.exponentialRampToValueAtTime(0.0001, end)
  filter.connect(envelope).connect(out)

  for (const [type, ratio, level] of voice.partials) {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = type
    oscillator.frequency.value = frequency * ratio
    gain.gain.value = level
    oscillator.connect(gain).connect(filter)
    oscillator.start(now)
    oscillator.stop(end + 0.05)
  }
}

export function readSoundSettings(): SoundSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<SoundSettings>
    const merged = { ...defaultSoundSettings, ...stored }
    return merged.voice in voices && merged.scale in scales ? merged : defaultSoundSettings
  } catch {
    noop()
    return defaultSoundSettings
  }
}

export function writeSoundSettings(settings: SoundSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    noop()
  }
}
