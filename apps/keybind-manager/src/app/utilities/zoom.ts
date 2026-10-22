import { getCurrentWebview } from "@tauri-apps/api/webview"
import { noop } from "@/shared/utilities/noop"

const STORAGE_KEY = "kb-zoom"
const DEFAULT_ZOOM = 1.15
const MIN_ZOOM = 0.7
const MAX_ZOOM = 2
const STEP = 0.1

function readZoom(): number {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY))
    return stored >= MIN_ZOOM && stored <= MAX_ZOOM ? stored : DEFAULT_ZOOM
  } catch {
    noop()
    return DEFAULT_ZOOM
  }
}

function applyZoom(value: number) {
  const clamped = Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value)) * 100) / 100
  getCurrentWebview().setZoom(clamped).catch(noop)
  try {
    localStorage.setItem(STORAGE_KEY, String(clamped))
  } catch {
    noop()
  }
  return clamped
}

/** Enables Ctrl+=/Ctrl+-/Ctrl+0 and Ctrl+wheel page zoom, persisted per machine. */
export function installZoom() {
  let zoom = applyZoom(readZoom())

  window.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) {
      return
    }
    if (event.key === "=" || event.key === "+") {
      zoom = applyZoom(zoom + STEP)
    } else if (event.key === "-" || event.key === "_") {
      zoom = applyZoom(zoom - STEP)
    } else if (event.key === "0") {
      zoom = applyZoom(DEFAULT_ZOOM)
    } else {
      return
    }
    event.preventDefault()
  })

  window.addEventListener(
    "wheel",
    (event) => {
      if (!event.ctrlKey) {
        return
      }
      event.preventDefault()
      zoom = applyZoom(zoom + (event.deltaY < 0 ? STEP : -STEP))
    },
    { passive: false }
  )
}
