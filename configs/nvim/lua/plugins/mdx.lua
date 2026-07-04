-- MDX editing support (salvaged from the old standalone neovim repo, modernised).
--
-- Dropped vs the original, on purpose:
--   * tsserver LSP block  -> renamed upstream; the LazyVim typescript extra
--                            already wires tsx/jsx LSP.
--   * windwp/nvim-autopairs -> conflicts with LazyVim's mini.pairs.
--   * peek.nvim           -> needs deno; markdown-preview covers preview.
--   * vim-markdown / treesitter-context -> covered by the LazyVim markdown
--                            extra / out of scope here.

-- Treat .mdx as its own filetype so the ft-gated plugins below load for it.
vim.filetype.add({ extension = { mdx = "mdx" } })

return {
  -- Live browser preview: :MarkdownPreview / :MarkdownPreviewToggle
  {
    "iamcco/markdown-preview.nvim",
    ft = { "markdown", "mdx" },
    build = "cd app && npm install",
    init = function()
      vim.g.mkdp_filetypes = { "markdown", "mdx" }
      vim.g.mkdp_auto_close = 1
    end,
  },

  -- Markdown table editing: :TableModeToggle
  {
    "dhruvasagar/vim-table-mode",
    ft = { "markdown", "mdx" },
    init = function()
      vim.g.table_mode_corner = "|"
    end,
  },

  -- JSX-aware syntax highlighting inside MDX components
  {
    "maxmellon/vim-jsx-pretty",
    ft = { "javascript", "javascriptreact", "typescript", "typescriptreact", "mdx" },
  },

  -- Emmet expansion for HTML/JSX (leader key <C-Z>)
  {
    "mattn/emmet-vim",
    ft = { "html", "css", "javascript", "javascriptreact", "typescript", "typescriptreact", "mdx", "twig" },
    init = function()
      vim.g.user_emmet_install_global = 0
      vim.g.user_emmet_leader_key = "<C-Z>"
    end,
    config = function()
      vim.cmd(
        [[autocmd FileType html,css,javascript,javascriptreact,typescript,typescriptreact,mdx,twig EmmetInstall]]
      )
    end,
  },
}
