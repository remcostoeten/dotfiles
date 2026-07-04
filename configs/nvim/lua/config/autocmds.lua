local augroup = vim.api.nvim_create_augroup
vim.api.nvim_create_augroup("user_autocmds", { clear = true })

vim.api.nvim_create_autocmd("TextYankPost", {
  desc = "Highlight on yank",
  group = augroup("highlight_yank", { clear = true }),
  callback = function()
    vim.highlight.on_yank()
  end,
})

-- Custom filetype detection
--  .twig -> twig         (treesitter parser + intelephense)
--  .mdx  -> markdown.mdx (markdown rendering + mdx_analyzer LSP)
--  .mjs  -> javascript   (ES modules: js LSP/treesitter/prettier all apply)
--  .mjml -> html         (email markup: html highlight/emmet/autotag/prettier)
vim.filetype.add({
  extension = {
    twig = "twig",
    mdx = "markdown.mdx",
    mjs = "javascript",
    mjml = "html",
  },
})
