-- Transparent background (salvaged from the old standalone neovim repo).
-- Wrapped in a ColorScheme autocmd + applied once so the highlights survive
-- LazyVim loading the colorscheme after startup (the original ran too early).
local function make_transparent()
  local groups = {
    "Normal",
    "NormalNC",
    "NormalFloat",
    "FloatBorder",
    "Pmenu",
    "EndOfBuffer",
    "FoldColumn",
    "Folded",
    "SignColumn",
    -- neo-tree (the explorer this config actually uses)
    "NeoTreeNormal",
    "NeoTreeNormalNC",
    "NeoTreeVertSplit",
    "NeoTreeWinSeparator",
    "NeoTreeEndOfBuffer",
    -- telescope
    "TelescopeBorder",
    "TelescopeNormal",
    "TelescopePromptBorder",
    -- snacks notifier
    "SnacksNotifierInfo",
    "SnacksNotifierWarn",
    "SnacksNotifierError",
  }
  for _, group in ipairs(groups) do
    vim.api.nvim_set_hl(0, group, { bg = "none" })
  end
end

vim.api.nvim_create_autocmd("ColorScheme", {
  desc = "Reapply transparent background after any colorscheme load",
  callback = make_transparent,
})

make_transparent()
