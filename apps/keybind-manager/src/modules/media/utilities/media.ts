export type MediaKind = "audioinput" | "videoinput" | "audiooutput"

export type MediaOption = {
  value: string
  label: string
}

export type Channel = "left" | "right" | "both"

const pans: Record<Channel, number> = { left: -1, right: 1, both: 0 }

/**
 * @name mediaSupported
 * @description Reports whether the webview exposes camera and microphone capture at all.
 *
 * @example
 * if (!mediaSupported()) {
 *   showUnavailable()
 * }
 */
export function mediaSupported(): boolean {
  return "mediaDevices" in navigator && "getUserMedia" in navigator.mediaDevices
}

/**
 * @name mediaOptions
 * @description Turns enumerated devices of one kind into select options, numbering devices
 * whose labels stay hidden until capture permission is granted.
 *
 * @example
 * const microphones = mediaOptions(await navigator.mediaDevices.enumerateDevices(), "audioinput")
 */
export function mediaOptions(devices: MediaDeviceInfo[], kind: MediaKind): MediaOption[] {
  const fallback = { audioinput: "Microphone", videoinput: "Camera", audiooutput: "Output" }[kind]
  return devices
    .filter((device) => device.kind === kind && device.deviceId !== "")
    .map((device, index) => ({ value: device.deviceId, label: device.label || `${fallback} ${index + 1}` }))
}

/**
 * @name describeMediaError
 * @description Maps a failed `getUserMedia` call to a sentence the user can act on.
 *
 * @example
 * setError(describeMediaError(error))
 */
export function describeMediaError(error: unknown): string {
  const name = error instanceof DOMException || error instanceof Error ? error.name : ""
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Access was denied. Check that no portal or privacy setting blocks this app."
    case "NotFoundError":
    case "OverconstrainedError":
      return "No matching device was found. Plug one in and refresh."
    case "NotReadableError":
    case "AbortError":
      return "The device is busy or failed to start. Close other apps using it and try again."
    default:
      return error instanceof Error && error.message ? error.message : "The device could not be opened."
  }
}

/**
 * @name signalLevel
 * @description Returns the RMS level of a block of samples on a 0 to 1 scale, weighted
 * towards quiet input so speech moves the meter visibly.
 *
 * @example
 * analyser.getFloatTimeDomainData(samples)
 * setLevel(signalLevel(samples))
 */
export function signalLevel(samples: Float32Array): number {
  if (samples.length === 0) {
    return 0
  }
  let sum = 0
  for (const sample of samples) {
    sum += sample * sample
  }
  const rms = Math.sqrt(sum / samples.length)
  if (rms <= 0) {
    return 0
  }
  const decibels = 20 * Math.log10(rms)
  return Math.min(1, Math.max(0, (decibels + 60) / 60))
}

/**
 * @name playTestTone
 * @description Plays a short two-note chime on the chosen stereo channel through the
 * default output and resolves once it has finished.
 *
 * @example
 * await playTestTone(context, "left")
 */
export function playTestTone(context: AudioContext, channel: Channel): Promise<void> {
  const panner = context.createStereoPanner()
  panner.pan.value = pans[channel]
  panner.connect(context.destination)
  const start = context.currentTime + 0.02
  const notes = [660, 880]
  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const at = start + index * 0.28
    oscillator.type = "sine"
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(0.25, at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.26)
    oscillator.connect(gain).connect(panner)
    oscillator.start(at)
    oscillator.stop(at + 0.27)
  })
  const duration = notes.length * 280 + 60
  return new Promise((resolve) => setTimeout(resolve, duration))
}
