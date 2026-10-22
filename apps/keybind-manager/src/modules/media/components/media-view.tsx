import { For, Show, createResource, createSignal, onCleanup, onMount, type JSX } from "solid-js"
import { Badge } from "@/shared/components/badge"
import { Button } from "@/shared/components/button"
import { Select } from "@/shared/components/select"
import { Toggle } from "@/shared/components/toggle"
import { noop } from "@/shared/utilities/noop"
import {
  describeMediaError,
  mediaOptions,
  mediaSupported,
  playTestTone,
  signalLevel,
  type Channel,
  type MediaOption
} from "@/modules/media/utilities/media"

const RECORD_SECONDS = 4
const DEFAULT_OPTION: MediaOption = { value: "", label: "System default" }

type RecordState = "idle" | "recording" | "playing"

async function listDevices(): Promise<MediaDeviceInfo[]> {
  if (!mediaSupported()) {
    return []
  }
  return navigator.mediaDevices.enumerateDevices().catch(() => [])
}

function stopStream(stream: MediaStream | undefined) {
  stream?.getTracks().forEach((track) => track.stop())
}

function deviceConstraint(deviceId: string): MediaTrackConstraints {
  return deviceId ? { deviceId: { exact: deviceId } } : {}
}

export function MediaView() {
  const [devices, { refetch }] = createResource(listDevices)

  onMount(() => {
    if (!mediaSupported()) {
      return
    }
    const onChange = () => void refetch()
    navigator.mediaDevices.addEventListener("devicechange", onChange)
    onCleanup(() => navigator.mediaDevices.removeEventListener("devicechange", onChange))
  })

  function options(kind: "audioinput" | "videoinput" | "audiooutput"): MediaOption[] {
    return [DEFAULT_OPTION, ...mediaOptions(devices() ?? [], kind)]
  }

  return (
    <div class="flex min-h-0 flex-1 flex-col overflow-auto p-3">
      <Show
        when={mediaSupported()}
        fallback={
          <div class="flex flex-col items-center gap-1 rounded-md border border-dashed border-line py-8 text-center">
            <p class="text-ink-dim">Media capture is unavailable in this webview.</p>
            <p class="text-[12px] text-ink-faint">WebKitGTK needs GStreamer with the PipeWire or PulseAudio plugins.</p>
          </div>
        }
      >
        <div class="grid gap-3 lg:grid-cols-2">
          <MicrophoneTest options={options("audioinput")} onOpened={() => void refetch()} />
          <CameraTest options={options("videoinput")} onOpened={() => void refetch()} />
          <SpeakerTest outputs={mediaOptions(devices() ?? [], "audiooutput")} />
        </div>
      </Show>
    </div>
  )
}

type CardProps = {
  title: string
  status?: JSX.Element
  children: JSX.Element
}

function Card(props: CardProps) {
  return (
    <section class="flex flex-col gap-3 rounded-lg border border-line bg-surface-1 p-3.5">
      <div class="flex items-center gap-2">
        <h2 class="section-heading">{props.title}</h2>
        <span class="flex-1" />
        {props.status}
      </div>
      {props.children}
    </section>
  )
}

type CaptureProps = {
  options: MediaOption[]
  onOpened: () => void
}

function MicrophoneTest(props: CaptureProps) {
  const [deviceId, setDeviceId] = createSignal("")
  const [processing, setProcessing] = createSignal(true)
  const [active, setActive] = createSignal(false)
  const [starting, setStarting] = createSignal(false)
  const [level, setLevel] = createSignal(0)
  const [peak, setPeak] = createSignal(0)
  const [recordState, setRecordState] = createSignal<RecordState>("idle")
  const [error, setError] = createSignal("")
  let stream: MediaStream | undefined
  let context: AudioContext | undefined
  let source: MediaStreamAudioSourceNode | undefined
  let frame = 0

  function meter(analyser: AnalyserNode) {
    const samples = new Float32Array(analyser.fftSize)
    const tick = () => {
      analyser.getFloatTimeDomainData(samples)
      const next = signalLevel(samples)
      setLevel(next)
      setPeak(Math.max(next, peak() - 0.01))
      frame = requestAnimationFrame(tick)
    }
    tick()
  }

  async function start() {
    stop()
    setError("")
    setStarting(true)
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...deviceConstraint(deviceId()),
          echoCancellation: processing(),
          noiseSuppression: processing(),
          autoGainControl: processing()
        }
      })
      context = new AudioContext()
      source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)
      meter(analyser)
      setActive(true)
      props.onOpened()
    } catch (reason) {
      stop()
      setError(describeMediaError(reason))
    } finally {
      setStarting(false)
    }
  }

  function stop() {
    cancelAnimationFrame(frame)
    stopStream(stream)
    context?.close().catch(noop)
    stream = undefined
    context = undefined
    source = undefined
    setActive(false)
    setLevel(0)
    setPeak(0)
    setRecordState("idle")
  }

  function recordAndPlay() {
    const ctx = context
    const input = source
    if (!ctx || !input) {
      return
    }
    // ScriptProcessorNode is deprecated but works in WebKitGTK without needing a worklet module or codec.
    const processor = ctx.createScriptProcessor(4096, 1, 1)
    const chunks: Float32Array[] = []
    const target = RECORD_SECONDS * ctx.sampleRate
    let captured = 0
    setRecordState("recording")
    processor.onaudioprocess = (event) => {
      if (captured >= target) {
        return
      }
      const chunk = new Float32Array(event.inputBuffer.getChannelData(0))
      chunks.push(chunk)
      captured += chunk.length
      if (captured >= target) {
        input.disconnect(processor)
        processor.disconnect()
        play(ctx, chunks, captured)
      }
    }
    input.connect(processor)
    processor.connect(ctx.destination)
  }

  function play(ctx: AudioContext, chunks: Float32Array[], length: number) {
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const channel = buffer.getChannelData(0)
    let offset = 0
    for (const chunk of chunks) {
      channel.set(chunk, offset)
      offset += chunk.length
    }
    const playback = ctx.createBufferSource()
    playback.buffer = buffer
    playback.connect(ctx.destination)
    playback.onended = () => setRecordState((state) => (state === "playing" ? "idle" : state))
    setRecordState("playing")
    playback.start()
  }

  onCleanup(stop)

  return (
    <Card
      title="Microphone"
      status={<Badge tone={active() ? "ok" : "muted"} text={active() ? "listening" : "off"} />}
    >
      <div class="flex flex-wrap items-center gap-2">
        <Select
          class="min-w-0 flex-1"
          label="Microphone"
          options={props.options}
          value={deviceId()}
          onChange={(value) => {
            setDeviceId(value)
            if (active()) {
              void start()
            }
          }}
        />
        <Show
          when={active()}
          fallback={
            <Button variant="primary" loading={starting()} onClick={() => void start()}>
              Start
            </Button>
          }
        >
          <Button onClick={stop}>Stop</Button>
        </Show>
      </div>
      <LevelMeter level={level()} peak={peak()} />
      <div class="flex flex-wrap items-center gap-3">
        <Button disabled={!active() || recordState() !== "idle"} onClick={recordAndPlay}>
          {recordState() === "recording"
            ? "Recording…"
            : recordState() === "playing"
              ? "Playing back…"
              : `Record ${RECORD_SECONDS}s and play back`}
        </Button>
        <span class="flex-1" />
        <Toggle
          label="Noise and echo processing"
          showLabel
          checked={processing()}
          onChange={(checked) => {
            setProcessing(checked)
            if (active()) {
              void start()
            }
          }}
        />
      </div>
      <Show when={error()}>
        <p class="text-[12px] text-bad">{error()}</p>
      </Show>
    </Card>
  )
}

type LevelMeterProps = {
  level: number
  peak: number
}

function LevelMeter(props: LevelMeterProps) {
  return (
    <div
      role="meter"
      aria-label="Input level"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(props.level * 100)}
      class="relative h-2.5 overflow-hidden rounded-full bg-surface-3"
    >
      <div
        class={`h-full rounded-full ${props.level > 0.9 ? "bg-bad" : props.level > 0.7 ? "bg-warn" : "bg-ok"}`}
        style={{ width: `${props.level * 100}%` }}
      />
      <div class="absolute inset-y-0 w-0.5 bg-ink/70" style={{ left: `${props.peak * 100}%` }} />
    </div>
  )
}

function CameraTest(props: CaptureProps) {
  const [deviceId, setDeviceId] = createSignal("")
  const [mirrored, setMirrored] = createSignal(true)
  const [active, setActive] = createSignal(false)
  const [starting, setStarting] = createSignal(false)
  const [details, setDetails] = createSignal("")
  const [error, setError] = createSignal("")
  let stream: MediaStream | undefined
  let video: HTMLVideoElement | undefined

  async function start() {
    stop()
    setError("")
    setStarting(true)
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { ...deviceConstraint(deviceId()), width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      if (video) {
        video.srcObject = stream
      }
      const settings = stream.getVideoTracks()[0]?.getSettings()
      const fps = settings?.frameRate ? ` · ${Math.round(settings.frameRate)} fps` : ""
      setDetails(settings?.width ? `${settings.width}×${settings.height}${fps}` : "")
      setActive(true)
      props.onOpened()
    } catch (reason) {
      stop()
      setError(describeMediaError(reason))
    } finally {
      setStarting(false)
    }
  }

  function stop() {
    stopStream(stream)
    stream = undefined
    if (video) {
      video.srcObject = null
    }
    setActive(false)
    setDetails("")
  }

  onCleanup(stop)

  return (
    <Card
      title="Camera"
      status={<Badge tone={active() ? "ok" : "muted"} text={active() ? details() || "live" : "off"} />}
    >
      <div class="flex flex-wrap items-center gap-2">
        <Select
          class="min-w-0 flex-1"
          label="Camera"
          options={props.options}
          value={deviceId()}
          onChange={(value) => {
            setDeviceId(value)
            if (active()) {
              void start()
            }
          }}
        />
        <Show
          when={active()}
          fallback={
            <Button variant="primary" loading={starting()} onClick={() => void start()}>
              Start
            </Button>
          }
        >
          <Button onClick={stop}>Stop</Button>
        </Show>
      </div>
      <div class="relative aspect-video overflow-hidden rounded-md bg-surface-0">
        <video
          ref={video}
          autoplay
          muted
          playsinline
          class={`h-full w-full object-contain ${mirrored() ? "-scale-x-100" : ""} ${active() ? "" : "invisible"}`}
        />
        <Show when={!active()}>
          <p class="absolute inset-0 grid place-items-center text-[12px] text-ink-faint">Camera preview is off</p>
        </Show>
      </div>
      <div class="flex items-center gap-3">
        <span class="flex-1" />
        <Toggle label="Mirror preview" showLabel checked={mirrored()} onChange={setMirrored} />
      </div>
      <Show when={error()}>
        <p class="text-[12px] text-bad">{error()}</p>
      </Show>
    </Card>
  )
}

type SpeakerProps = {
  outputs: MediaOption[]
}

function SpeakerTest(props: SpeakerProps) {
  const [playing, setPlaying] = createSignal<Channel | undefined>()
  let context: AudioContext | undefined
  const channels: { id: Channel; label: string }[] = [
    { id: "left", label: "Left" },
    { id: "both", label: "Both" },
    { id: "right", label: "Right" }
  ]

  async function play(channel: Channel) {
    context ??= new AudioContext()
    await context.resume().catch(noop)
    setPlaying(channel)
    await playTestTone(context, channel)
    setPlaying(undefined)
  }

  onCleanup(() => {
    context?.close().catch(noop)
  })

  return (
    <Card title="Speakers and headphones">
      <p class="text-[12px] text-ink-dim">
        Plays a chime on the system default output. Check that left and right come from the matching side.
      </p>
      <div class="flex gap-2">
        <For each={channels}>
          {(channel) => (
            <Button
              class="flex-1 justify-center"
              variant={playing() === channel.id ? "primary" : "default"}
              disabled={playing() !== undefined}
              onClick={() => void play(channel.id)}
            >
              {channel.label}
            </Button>
          )}
        </For>
      </div>
      <Show when={props.outputs.length > 0}>
        <div class="flex flex-col gap-1">
          <For each={props.outputs}>
            {(output) => <p class="truncate text-[11px] text-ink-faint">{output.label}</p>}
          </For>
        </div>
      </Show>
    </Card>
  )
}
