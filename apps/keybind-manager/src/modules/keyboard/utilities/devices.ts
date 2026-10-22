import type { DeviceKind, InputDevice } from "@/shared/types/native"
import { layouts } from "@/modules/keyboard/utilities/layouts"

export type Board = {
  vendor: string
  product: string
  name: string
  known: boolean
}

export type Peripheral = {
  vendor: string
  product: string
  name: string
  kind: DeviceKind
  virtual: boolean
  phys?: string
  interfaces: number
}

const NOISE = /\s+(Mouse|Keyboard|Consumer Control|System Control|Wireless Radio Control)$/i

function baseName(device: InputDevice): string {
  return device.name.replace(NOISE, "").replace(/\s+/g, " ").trim() || device.name
}

/** Groups the input nodes each physical device exposes, dropping built-in nodes without a vendor id. */
export function peripheralsFrom(devices: InputDevice[]): Peripheral[] {
  const byId = new Map<string, Peripheral>()
  for (const device of devices) {
    if (!device.vendor || device.vendor === "0000") {
      continue
    }
    const id = `${device.vendor}:${device.product}:${device.virtual_keyd ? device.name : ""}`
    const name = baseName(device)
    const current = byId.get(id)
    if (!current) {
      byId.set(id, {
        vendor: device.vendor,
        product: device.product,
        name,
        kind: device.kind,
        virtual: device.virtual_keyd,
        phys: device.phys,
        interfaces: 1
      })
      continue
    }
    current.interfaces += 1
    if (name.length < current.name.length) {
      current.name = name
      current.phys = device.phys
    }
  }
  return [...byId.values()].sort((a, b) => Number(a.virtual) - Number(b.virtual) || a.name.localeCompare(b.name))
}

/** Collapses the several input nodes one physical keyboard exposes into a single board. */
export function boardsFrom(devices: InputDevice[]): Board[] {
  const byId = new Map<string, Board>()
  for (const device of devices) {
    if (device.kind !== "keyboard" || device.virtual_keyd || !device.vendor || device.vendor === "0000") {
      continue
    }
    const id = `${device.vendor}:${device.product}`
    const name = baseName(device)
    const current = byId.get(id)
    if (!current || name.length < current.name.length) {
      byId.set(id, {
        vendor: device.vendor,
        product: device.product,
        name,
        known: layouts.some((l) => l.match?.vendor === device.vendor && l.match?.product === device.product)
      })
    }
  }
  return [...byId.values()].sort((a, b) => Number(b.known) - Number(a.known) || a.name.localeCompare(b.name))
}
