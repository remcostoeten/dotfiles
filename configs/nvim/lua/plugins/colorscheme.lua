local aetherTheme = vim.fn.expand("~/.config/aether/theme/neovim.lua")
local useAether = vim.fn.filereadable(aetherTheme) == 1
local riceFile = vim.fn.stdpath("config") .. "/.rice-colorscheme"
local rice = vim.fn.filereadable(riceFile) == 1 and vim.trim(vim.fn.readfile(riceFile)[1] or "") or ""

local specs = {
  -- keep catppuccin available as a fallback theme
  { "catppuccin/nvim", name = "catppuccin", priority = 1000 },
}

if useAether then
  vim.list_extend(specs, dofile(aetherTheme))
end

table.insert(specs, {
  "LazyVim/LazyVim",
  opts = {
    colorscheme = rice ~= "" and rice or (useAether and "aether" or "sunset-drive"),
  },
})

return specs
