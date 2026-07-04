vim.cmd("highlight clear")

if vim.fn.exists("syntax_on") == 1 then
  vim.cmd("syntax reset")
end

vim.g.colors_name = "deafened"

local palette = {
  bg = "NONE",
  fg = "#f2efe6",
  black = "#181c23",
  red = "#d16b72",
  green = "#8ec07c",
  yellow = "#e5c07b",
  blue = "#7aa2f7",
  magenta = "#c678dd",
  cyan = "#56b6c2",
  white = "#e6e1d8",
  bright_black = "#4b5563",
  bright_red = "#e06c75",
  bright_green = "#98c379",
  bright_yellow = "#f0d98c",
  bright_blue = "#8ab4ff",
  bright_magenta = "#d7a1ff",
  bright_cyan = "#8be9fd",
  bright_white = "#ffffff",
  surface = "#11161d",
  surface_alt = "#171d26",
  surface_soft = "#202837",
  accent_surface = "#18202b",
}

local function hi(group, opts)
  vim.api.nvim_set_hl(0, group, opts)
end

local function link(group, target)
  hi(group, { link = target })
end

hi("Normal", { fg = palette.fg, bg = palette.bg })
hi("NormalNC", { fg = palette.white, bg = palette.bg })
hi("NormalFloat", { fg = palette.fg, bg = palette.surface })
hi("FloatBorder", { fg = palette.cyan, bg = palette.surface })
hi("FloatTitle", { fg = palette.bright_white, bg = palette.surface_alt, bold = true })
hi("Cursor", { fg = palette.bg, bg = palette.fg })
hi("CursorLine", { bg = palette.surface })
hi("CursorColumn", { bg = palette.surface })
hi("ColorColumn", { bg = palette.surface_soft })
hi("LineNr", { fg = palette.bright_black })
hi("CursorLineNr", { fg = palette.bright_white, bold = true })
hi("SignColumn", { fg = palette.white, bg = palette.bg })
hi("FoldColumn", { fg = palette.bright_black, bg = palette.bg })
hi("Folded", { fg = palette.white, bg = palette.surface })
hi("EndOfBuffer", { fg = palette.bg })
hi("NonText", { fg = palette.bright_black })
hi("Whitespace", { fg = palette.black })
hi("WinSeparator", { fg = palette.cyan })
hi("StatusLine", { fg = palette.fg, bg = palette.surface_alt })
hi("StatusLineNC", { fg = palette.white, bg = palette.surface })
hi("TabLine", { fg = palette.white, bg = palette.surface })
hi("TabLineFill", { fg = palette.black, bg = palette.bg })
hi("TabLineSel", { fg = palette.bright_white, bg = palette.accent_surface, bold = true })
hi("Pmenu", { fg = palette.fg, bg = palette.surface })
hi("PmenuSel", { fg = palette.bright_white, bg = palette.accent_surface, bold = true })
hi("PmenuSbar", { bg = palette.surface })
hi("PmenuThumb", { bg = palette.bright_black })
hi("WildMenu", { fg = palette.bright_white, bg = palette.accent_surface, bold = true })
hi("Visual", { bg = palette.surface_soft })
hi("VisualNOS", { bg = palette.surface_soft })
hi("Search", { fg = palette.black, bg = palette.yellow, bold = true })
hi("IncSearch", { fg = palette.black, bg = palette.bright_cyan, bold = true })
hi("CurSearch", { fg = palette.black, bg = palette.bright_magenta, bold = true })
hi("Substitute", { fg = palette.black, bg = palette.bright_green, bold = true })
hi("MatchParen", { fg = palette.bright_white, bg = palette.accent_surface, bold = true })
hi("Directory", { fg = palette.blue })
hi("Title", { fg = palette.bright_white, bold = true })
hi("Question", { fg = palette.green })
hi("MoreMsg", { fg = palette.green })
hi("ModeMsg", { fg = palette.white })
hi("WarningMsg", { fg = palette.yellow })
hi("ErrorMsg", { fg = palette.red, bold = true })

hi("Comment", { fg = palette.cyan, italic = true })
hi("Constant", { fg = palette.yellow })
hi("String", { fg = palette.green })
hi("Character", { fg = palette.green })
hi("Number", { fg = palette.yellow })
hi("Boolean", { fg = palette.magenta })
hi("Float", { fg = palette.yellow })
hi("Identifier", { fg = palette.fg })
hi("Function", { fg = palette.blue })
hi("Statement", { fg = palette.magenta })
hi("Conditional", { fg = palette.magenta })
hi("Repeat", { fg = palette.magenta })
hi("Label", { fg = palette.magenta })
hi("Operator", { fg = palette.cyan })
hi("Keyword", { fg = palette.magenta })
hi("Exception", { fg = palette.red })
hi("PreProc", { fg = palette.magenta })
hi("Include", { fg = palette.magenta })
hi("Define", { fg = palette.magenta })
hi("Macro", { fg = palette.magenta })
hi("PreCondit", { fg = palette.magenta })
hi("Type", { fg = palette.blue })
hi("StorageClass", { fg = palette.blue })
hi("Structure", { fg = palette.blue })
hi("Typedef", { fg = palette.blue })
hi("Special", { fg = palette.cyan })
hi("SpecialChar", { fg = palette.cyan })
hi("Tag", { fg = palette.blue })
hi("Delimiter", { fg = palette.white })
hi("SpecialComment", { fg = palette.bright_black, italic = true })
hi("Debug", { fg = palette.red })
hi("Underlined", { fg = palette.blue, underline = true })
hi("Ignore", { fg = palette.bright_black })
hi("Error", { fg = palette.red, bold = true })
hi("Todo", { fg = palette.bg, bg = palette.yellow, bold = true })

hi("DiagnosticError", { fg = palette.red })
hi("DiagnosticWarn", { fg = palette.yellow })
hi("DiagnosticInfo", { fg = palette.blue })
hi("DiagnosticHint", { fg = palette.cyan })
hi("DiagnosticOk", { fg = palette.green })
hi("DiagnosticUnderlineError", { sp = palette.red, undercurl = true })
hi("DiagnosticUnderlineWarn", { sp = palette.yellow, undercurl = true })
hi("DiagnosticUnderlineInfo", { sp = palette.blue, undercurl = true })
hi("DiagnosticUnderlineHint", { sp = palette.cyan, undercurl = true })
hi("DiagnosticVirtualTextError", { fg = palette.red, bg = palette.surface })
hi("DiagnosticVirtualTextWarn", { fg = palette.yellow, bg = palette.surface })
hi("DiagnosticVirtualTextInfo", { fg = palette.blue, bg = palette.surface })
hi("DiagnosticVirtualTextHint", { fg = palette.cyan, bg = palette.surface })

hi("DiffAdd", { fg = palette.green })
hi("DiffChange", { fg = palette.yellow })
hi("DiffDelete", { fg = palette.red })
hi("DiffText", { fg = palette.black, bg = palette.yellow, bold = true })
hi("Added", { fg = palette.green })
hi("Changed", { fg = palette.yellow })
hi("Removed", { fg = palette.red })

hi("GitSignsAdd", { fg = palette.green })
hi("GitSignsChange", { fg = palette.yellow })
hi("GitSignsDelete", { fg = palette.red })

hi("TelescopeNormal", { fg = palette.fg, bg = palette.bg })
hi("TelescopeBorder", { fg = palette.cyan, bg = palette.surface })
hi("TelescopePromptNormal", { fg = palette.fg, bg = palette.surface })
hi("TelescopePromptBorder", { fg = palette.cyan, bg = palette.surface })
hi("TelescopePromptTitle", { fg = palette.black, bg = palette.cyan, bold = true })
hi("TelescopePromptPrefix", { fg = palette.cyan })
hi("TelescopeSelection", { fg = palette.bright_white, bg = palette.surface_soft, bold = true })
hi("TelescopeMatching", { fg = palette.yellow, bold = true })

hi("NeoTreeNormal", { fg = palette.white, bg = palette.bg })
hi("NeoTreeNormalNC", { fg = palette.white, bg = palette.bg })
hi("NeoTreeDirectoryName", { fg = palette.blue })
hi("NeoTreeDirectoryIcon", { fg = palette.blue })
hi("NeoTreeFileName", { fg = palette.white })
hi("NeoTreeFileNameOpened", { fg = palette.bright_white, bold = true })
hi("NeoTreeGitAdded", { fg = palette.green })
hi("NeoTreeGitModified", { fg = palette.yellow })
hi("NeoTreeGitDeleted", { fg = palette.red })
hi("NeoTreeIndentMarker", { fg = palette.bright_black })

hi("SnacksPicker", { fg = palette.fg, bg = palette.bg })
hi("SnacksPickerBorder", { fg = palette.cyan, bg = palette.surface })
hi("SnacksPickerTitle", { fg = palette.black, bg = palette.cyan, bold = true })
hi("SnacksPickerMatch", { fg = palette.yellow, bold = true })
hi("SnacksDashboardHeader", { fg = palette.blue })
hi("SnacksDashboardDesc", { fg = palette.white })
hi("SnacksDashboardKey", { fg = palette.cyan })
hi("SnacksDashboardIcon", { fg = palette.magenta })
hi("SnacksDashboardSpecial", { fg = palette.yellow })

hi("LazyNormal", { fg = palette.fg, bg = palette.bg })
hi("LazyButton", { fg = palette.white, bg = palette.surface })
hi("LazyButtonActive", { fg = palette.black, bg = palette.cyan, bold = true })
hi("LazyH1", { fg = palette.black, bg = palette.cyan, bold = true })
hi("LazyH2", { fg = palette.blue, bold = true })

hi("@variable", { fg = palette.fg })
hi("@variable.builtin", { fg = palette.red })
hi("@constant", { fg = palette.yellow })
hi("@constant.builtin", { fg = palette.magenta })
hi("@module", { fg = palette.blue })
hi("@label", { fg = palette.magenta })
hi("@string", { fg = palette.green })
hi("@string.documentation", { fg = palette.green })
hi("@character", { fg = palette.green })
hi("@number", { fg = palette.yellow })
hi("@boolean", { fg = palette.magenta })
hi("@function", { fg = palette.blue })
hi("@function.builtin", { fg = palette.cyan })
hi("@function.method", { fg = palette.blue })
hi("@constructor", { fg = palette.blue })
hi("@keyword", { fg = palette.magenta })
hi("@keyword.function", { fg = palette.magenta })
hi("@keyword.operator", { fg = palette.magenta })
hi("@operator", { fg = palette.cyan })
hi("@type", { fg = palette.blue })
hi("@type.builtin", { fg = palette.blue })
hi("@property", { fg = palette.fg })
hi("@punctuation", { fg = palette.white })
hi("@punctuation.bracket", { fg = palette.white })
hi("@punctuation.delimiter", { fg = palette.white })
hi("@comment", { fg = palette.bright_black, italic = true })
hi("@tag", { fg = palette.blue })
hi("@tag.attribute", { fg = palette.yellow })
hi("@tag.delimiter", { fg = palette.cyan })

link("LspReferenceText", "Visual")
link("LspReferenceRead", "Visual")
link("LspReferenceWrite", "Visual")
