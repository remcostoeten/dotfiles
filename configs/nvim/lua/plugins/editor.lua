return {
  -- widen the default explorer width
  {
    "nvim-neo-tree/neo-tree.nvim",
    opts = {
      filesystem = {
        window = { width = 35 },
      },
    },
  },

  -- treesitter parsers
  {
    "nvim-treesitter/nvim-treesitter",
    opts = function(_, opts)
      vim.list_extend(opts.ensure_installed or {}, {
        "bash",
        "css",
        "html",
        "javascript",
        "json",
        "lua",
        "markdown",
        "markdown_inline",
        "php",
        "phpdoc",
        "python",
        "query",
        "regex",
        "tsx",
        "twig",
        "typescript",
        "vim",
        "vimdoc",
        "yaml",
      })
    end,
  },

  -- telescope tweaks
  {
    "nvim-telescope/telescope.nvim",
    opts = {
      defaults = {
        layout_strategy = "horizontal",
        layout_config = { prompt_position = "top" },
        sorting_strategy = "ascending",
        winblend = 0,
      },
    },
  },

  -- auto-close & auto-rename HTML/JSX/Twig/MDX tags
  {
    "windwp/nvim-ts-autotag",
    event = "LazyFile",
    opts = {},
  },

  -- inline color previews for hex/rgb/hsl + tailwind classes
  {
    "catgoose/nvim-colorizer.lua",
    event = "LazyFile",
    opts = {
      filetypes = { "*", "!lazy" },
      user_default_options = {
        names = false, -- don't colorize words like "red"
        tailwind = true,
        css = true,
        mode = "background",
      },
    },
  },
}
