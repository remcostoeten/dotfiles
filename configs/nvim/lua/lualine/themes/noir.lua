local orange, gold, sage, red = "#ff6b2c", "#f5c065", "#9ccf8f", "#ff5f56"
local bg, surface, fg, muted = "#151515", "#2a2a2a", "#e6e1d6", "#8f897f"

local function mode(color)
  return {
    a = { fg = bg, bg = color, gui = "bold" },
    b = { fg = color, bg = surface },
    c = { fg = fg, bg = bg },
    z = { fg = bg, bg = color, gui = "bold" },
  }
end

return {
  normal = mode(orange),
  insert = mode(gold),
  visual = mode(sage),
  replace = mode(red),
  command = mode(gold),
  inactive = { a = { fg = muted, bg = bg }, b = { fg = muted, bg = bg }, c = { fg = muted, bg = bg } },
}
