-- Core plugin overrides & LazyVim defaults tuning
return {
  { "folke/flash.nvim", enabled = false },
  { "folke/todo-comments.nvim", enabled = false },
  { "MagicDuck/grug-far.nvim", enabled = false },

  {
    "akinsho/bufferline.nvim",
    opts = {
      options = {
        always_show_bufferline = true,
        diagnostics = "nvim_lsp",
        separator_style = "slant",
      },
    },
  },

  {
    "nvim-lualine/lualine.nvim",
    opts = {
      options = {
        globalstatus = true,
      },
    },
  },

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
      terminal = { enabled = true },
      words = { enabled = true },
    },
  },
}
