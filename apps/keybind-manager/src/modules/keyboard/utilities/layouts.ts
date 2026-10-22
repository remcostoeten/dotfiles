export type PhysicalKey = {
  legend: string
  code: string
  width?: number
}

export type BoardLayout = {
  id: string
  name: string
  match?: { vendor: string; product: string }
  note?: string
  knob?: boolean
  rows: PhysicalKey[][]
}

function k(legend: string, code: string, width?: number): PhysicalKey {
  return { legend, code, width }
}

function letters(chars: string): PhysicalKey[] {
  return [...chars].map((c) => k(c.toUpperCase(), c))
}

const numberRow = [
  k("1", "1"), k("2", "2"), k("3", "3"), k("4", "4"), k("5", "5"),
  k("6", "6"), k("7", "7"), k("8", "8"), k("9", "9"), k("0", "0"),
  k("-", "minus"), k("=", "equal")
]

function sixtyFiveRows(capsCode: string, ctrlCode: string): PhysicalKey[][] {
  return [
    [k("Esc", "esc"), ...numberRow, k("Backspace", "backspace", 2), k("Home", "home")],
    [k("Tab", "tab", 1.5), ...letters("qwertyuiop"), k("[", "leftbrace"), k("]", "rightbrace"), k("\\", "backslash", 1.5), k("Del", "delete")],
    [k("Caps", capsCode, 1.75), ...letters("asdfghjkl"), k(";", "semicolon"), k("'", "apostrophe"), k("Enter", "enter", 2.25), k("PgUp", "pageup")],
    [k("Shift", "leftshift", 2.25), ...letters("zxcvbnm"), k(",", "comma"), k(".", "dot"), k("/", "slash"), k("Shift", "rightshift", 1.75), k("↑", "up"), k("PgDn", "pagedown")],
    [k("Ctrl", ctrlCode, 1.25), k("Win", "leftmeta", 1.25), k("Alt", "leftalt", 1.25), k("", "space", 6.25), k("Alt", "rightalt"), k("Fn", ""), k("Ctrl", "rightcontrol"), k("←", "left"), k("↓", "down"), k("→", "right")]
  ]
}

export const layouts: BoardLayout[] = [
  {
    id: "zoom65",
    name: "Zoom65",
    match: { vendor: "1ea7", product: "7777" },
    note: "Zoom65 firmware swaps Caps and Left Ctrl; keys below show what the board actually sends.",
    knob: true,
    rows: sixtyFiveRows("leftcontrol", "capslock")
  },
  {
    id: "ansi65",
    name: "ANSI 65%",
    rows: sixtyFiveRows("capslock", "leftcontrol")
  }
]

/** Picks the layout matching one of the profile's scoped devices, else the generic board. */
export function layoutForDevices(devices: { vendor: string; product: string }[]): BoardLayout {
  const matched = layouts.find((layout) =>
    devices.some((d) => layout.match?.vendor === d.vendor && layout.match?.product === d.product)
  )
  return matched ?? layouts[layouts.length - 1]!
}
