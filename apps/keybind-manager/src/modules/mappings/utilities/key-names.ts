export const keyGroups: { name: string; keys: readonly string[] }[] = [
  { name: "Letters", keys: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"] },
  { name: "Numbers", keys: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] },
  { name: "Modifiers", keys: ["leftcontrol", "rightcontrol", "leftshift", "rightshift", "leftalt", "rightalt", "leftmeta", "rightmeta", "fn", "compose", "iso-level3-shift"] },
  { name: "Editing", keys: ["esc", "tab", "capslock", "enter", "space", "backspace", "delete", "insert", "menu"] },
  { name: "Navigation", keys: ["up", "down", "left", "right", "home", "end", "pageup", "pagedown"] },
  { name: "Function", keys: ["f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12", "f13", "f14", "f15", "f16", "f17", "f18", "f19", "f20", "f21", "f22", "f23", "f24"] },
  { name: "Symbols", keys: ["minus", "equal", "leftbrace", "rightbrace", "semicolon", "apostrophe", "grave", "backslash", "comma", "dot", "slash", "102nd"] },
  { name: "Media", keys: ["mute", "volumedown", "volumeup", "micmute", "playpause", "play", "pause", "stopcd", "nextsong", "previoussong", "rewind", "fastforward", "record"] },
  { name: "System", keys: ["print", "sysrq", "scrolllock", "numlock", "brightnessdown", "brightnessup", "kbdillumtoggle", "kbdillumdown", "kbdillumup", "power", "sleep", "suspend", "wakeup", "switchvideomode", "wlan", "bluetooth", "rfkill", "camera", "calc", "mail", "www", "search", "homepage", "back", "forward", "refresh"] },
  { name: "Numpad", keys: ["kp0", "kp1", "kp2", "kp3", "kp4", "kp5", "kp6", "kp7", "kp8", "kp9", "kpdot", "kpenter", "kpplus", "kpminus", "kpasterisk", "kpslash", "kpequal", "kpcomma", "kpleftparen", "kprightparen", "kpplusminus"] },
  { name: "Other", keys: ["zenkakuhankaku", "ro", "katakana", "hiragana", "henkan", "katakanahiragana", "muhenkan", "kpjpcomma", "linefeed", "scale", "hangeul", "hanja", "yen", "stop", "again", "props", "undo", "front", "copy", "open", "paste", "find", "cut", "help", "setup", "file", "sendfile", "deletefile", "xfer", "scrolldown", "scrollup", "msdos", "coffee", "display", "cyclewindows", "favorites", "bookmarks", "computer", "closecd", "ejectcd", "ejectclosecd", "phone", "iso", "config", "exit", "move", "edit", "zoom", "mouseback", "new", "redo", "prog1", "prog2", "prog3", "prog4", "playcd", "pausecd", "scrollleft", "scrollright", "dashboard", "close", "bassboost", "hp", "sound", "question", "email", "chat", "connect", "finance", "sport", "shop", "voicecommand", "cancel", "media", "send", "reply", "forwardmail", "save", "documents", "battery", "uwb", "next", "prev", "cycle", "auto", "off", "wwan", "leftmouse", "middlemouse", "rightmouse", "mouse1", "mouse2", "mouseforward"] },
]

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
    pagedown: "PgDn",
    fn: "Fn",
    "iso-level3-shift": "AltGr (ISO)",
    volumeup: "Vol +",
    volumedown: "Vol −",
    brightnessup: "Bright +",
    brightnessdown: "Bright −",
    playpause: "Play/Pause",
    nextsong: "Next",
    previoussong: "Prev"
  }
  const label = labels[key]
  if (label) {
    return label
  }
  return key.length <= 3 ? key.toUpperCase() : key[0]!.toUpperCase() + key.slice(1)
}
