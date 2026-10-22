export type Matrix = {
  rows: number
  cols: number
}

export type CustomKeycode = {
  name: string
  title: string
  shortName: string
}

export type LayoutOption = {
  label: string
  choices: string[]
}

export type KeyOption = {
  index: number
  choice: number
}

export type ViaKey = {
  row: number
  col: number
  x: number
  y: number
  w: number
  h: number
  option: KeyOption | null
}

export type ViaDefinition = {
  name: string
  vendor: string
  product: string
  matrix: Matrix
  customKeycodes: CustomKeycode[]
  options: LayoutOption[]
  keys: ViaKey[]
}

export type SavedLayout = {
  name: string
  layers: string[][]
}
