export type InputMode = "press" | "tap" | "hold"

export type ActionKind = "key" | "combo" | "layer" | "disable" | "macro"

export type KeyInput = {
  key: string
  mods: string[]
  mode: InputMode
}

export type KeyAction = {
  kind: ActionKind
  key?: string
  mods?: string[]
  layer?: string
  macro_text?: string
}

export type Mapping = {
  id: string
  source: KeyInput
  target: KeyAction
  enabled: boolean
}

export type Layer = {
  id: string
  name: string
  mappings: Mapping[]
}

export type DeviceRef = {
  vendor: string
  product: string
  name?: string
}

export type Profile = {
  id: string
  name: string
  enabled: boolean
  devices: DeviceRef[]
  mappings: Mapping[]
  layers: Layer[]
}

export type Settings = {
  confirm_dangerous?: boolean | null
  dotfiles_dir?: string
  export_hardware_ids?: boolean
}

export type AppConfig = {
  version: number
  active: string
  profiles: Profile[]
  settings: Settings
}
