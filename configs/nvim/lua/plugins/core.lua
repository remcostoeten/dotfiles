-- Core plugin overrides & LazyVim defaults tuning
return {
  -- disable default plugins you don't want
  { "folke/noice.nvim", enabled = false },
  { "folke/trouble.nvim", enabled = false },
  { "folke/flash.nvim", enabled = false },
  { "folke/todo-comments.nvim", enabled = false },
  { "MagicDuck/grug-far.nvim", enabled = false },
  { "akinsho/bufferline.nvim", enabled = false },
  { "nvim-lualine/lualine.nvim", enabled = false },

  -- use snacks.nvim for statusline instead (leaner)
  {
    "snacks.nvim",
    opts = {
      dashboard = { enabled = true },
      indent = { enabled = true },
      input = { enabled = true },
      notifier = { enabled = true },
      scope = { enabled = true },
      scroll = { enabled = true },
      statuscolumn = { enabled = true },
      words = { enabled = true },
    },
  },
}
