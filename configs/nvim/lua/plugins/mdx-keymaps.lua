-- MDX / Markdown buffer-local keymaps + editing settings (salvaged, Peek
-- keymaps removed since peek.nvim was dropped). Registered via LazyVim's
-- autocmds option so they only apply in markdown/mdx buffers.
return {
  {
    "LazyVim/LazyVim",
    opts = {
      autocmds = {
        mdx_setup = {
          {
            event = "FileType",
            pattern = { "mdx", "markdown" },
            callback = function()
              local opts = { buffer = true }

              -- Preview
              vim.keymap.set("n", "<leader>mp", "<cmd>MarkdownPreview<cr>", vim.tbl_extend("force", opts, { desc = "Markdown Preview" }))
              vim.keymap.set("n", "<leader>ms", "<cmd>MarkdownPreviewStop<cr>", vim.tbl_extend("force", opts, { desc = "Markdown Preview Stop" }))
              vim.keymap.set("n", "<leader>mt", "<cmd>MarkdownPreviewToggle<cr>", vim.tbl_extend("force", opts, { desc = "Markdown Preview Toggle" }))

              -- Tables
              vim.keymap.set("n", "<leader>tm", "<cmd>TableModeToggle<cr>", vim.tbl_extend("force", opts, { desc = "Table Mode Toggle" }))

              -- Quick JSX insertion (insert mode, buffer-local)
              vim.keymap.set("i", "<C-j>", "<div></div><Esc>F>a", vim.tbl_extend("force", opts, { desc = "Insert div" }))
              vim.keymap.set("i", "<C-k>", "<></><Esc>F>a", vim.tbl_extend("force", opts, { desc = "Insert React Fragment" }))

              -- Inline markdown formatting on a visual selection
              vim.keymap.set("v", "<leader>mb", 'c**<C-r>"**<Esc>', vim.tbl_extend("force", opts, { desc = "Bold selection" }))
              vim.keymap.set("v", "<leader>mi", 'c*<C-r>"*<Esc>', vim.tbl_extend("force", opts, { desc = "Italic selection" }))
              vim.keymap.set("v", "<leader>mc", 'c`<C-r>"`<Esc>', vim.tbl_extend("force", opts, { desc = "Code selection" }))

              -- Prose-friendly buffer settings
              vim.bo.shiftwidth = 2
              vim.bo.tabstop = 2
              vim.bo.softtabstop = 2
              vim.bo.expandtab = true
              vim.wo.spell = true
              vim.bo.spelllang = "en_us"
              vim.wo.wrap = true
              vim.wo.linebreak = true
              vim.wo.breakindent = true
              vim.wo.conceallevel = 2
            end,
          },
        },
      },
    },
  },
}
