export const commonKeys = [
  "capslock", "esc", "tab", "enter", "space", "backspace", "delete", "insert",
  "leftcontrol", "rightcontrol", "leftshift", "rightshift", "leftalt", "rightalt",
  "leftmeta", "rightmeta", "compose", "menu",
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p",
  "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12",
  "up", "down", "left", "right", "home", "end", "pageup", "pagedown",
  "minus", "equal", "leftbrace", "rightbrace", "semicolon", "apostrophe", "grave",
  "backslash", "comma", "dot", "slash", "102nd",
  "numlock", "scrolllock", "print", "pause",
  "volumeup", "volumedown", "mute", "playpause", "nextsong", "previoussong",
  "brightnessup", "brightnessdown"
] as const

export const modifiers = ["control", "shift", "alt", "meta", "altgr"] as const

const codeMap: Record<string, string> = {
  Escape: "esc",
  CapsLock: "capslock",
  Tab: "tab",
  Enter: "enter",
  Space: "space",
  Backspace: "backspace",
  Delete: "delete",
  Insert: "insert",
  ControlLeft: "leftcontrol",
  ControlRight: "rightcontrol",
  ShiftLeft: "leftshift",
  ShiftRight: "rightshift",
  AltLeft: "leftalt",
  AltRight: "rightalt",
  MetaLeft: "leftmeta",
  MetaRight: "rightmeta",
  ContextMenu: "menu",
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Home: "home",
  End: "end",
  PageUp: "pageup",
  PageDown: "pagedown",
  Minus: "minus",
  Equal: "equal",
  BracketLeft: "leftbrace",
  BracketRight: "rightbrace",
  Semicolon: "semicolon",
  Quote: "apostrophe",
  Backquote: "grave",
  Backslash: "backslash",
  Comma: "comma",
  Period: "dot",
  Slash: "slash",
  IntlBackslash: "102nd",
  NumLock: "numlock",
  ScrollLock: "scrolllock",
  PrintScreen: "print",
  Pause: "pause"
}

export function codeToKey(code: string): string | null {
  const direct = codeMap[code]
  if (direct) {
    return direct
  }
  const letter = code.match(/^Key([A-Z])$/)
  if (letter?.[1]) {
    return letter[1].toLowerCase()
  }
  const digit = code.match(/^Digit([0-9])$/)
  if (digit?.[1]) {
    return digit[1]
  }
  const fn = code.match(/^F([0-9]{1,2})$/)
  if (fn?.[1]) {
    return `f${fn[1]}`
  }
  const numpad = code.match(/^Numpad([0-9])$/)
  if (numpad?.[1]) {
    return `kp${numpad[1]}`
  }
  return null
}

export function keyLabel(key: string): string {
  const labels: Record<string, string> = {
    capslock: "Caps Lock",
    esc: "Esc",
    leftcontrol: "L Ctrl",
    rightcontrol: "R Ctrl",
    leftshift: "L Shift",
    rightshift: "R Shift",
    leftalt: "L Alt",
    rightalt: "R Alt",
    leftmeta: "L Meta",
    rightmeta: "R Meta",
    backspace: "Bksp",
    pageup: "PgUp",
    pagedown: "PgDn"
  }
  const label = labels[key]
  if (label) {
    return label
  }
  return key.length <= 3 ? key.toUpperCase() : key[0]!.toUpperCase() + key.slice(1)
}
