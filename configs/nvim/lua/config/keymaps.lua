-- Word wrap
vim.opt.wrap = true
vim.opt.linebreak = true
vim.opt.breakindent = true
-- Shift+X as backspace
vim.keymap.set("i", "<S-X>", "<BS>", { desc = "Backspace in insert" })
vim.keymap.set("n", "<S-X>", "X", { desc = "Backspace in normal" })
vim.keymap.set("v", "<S-X>", "<BS>", { desc = "Delete selection" })
