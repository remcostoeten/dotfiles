return {
  -- keep catppuccin available as a fallback theme
  { "catppuccin/nvim", name = "catppuccin", priority = 1000 },

  -- set it as the default colorscheme
  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = "sunset-drive",
    },
  },
}
