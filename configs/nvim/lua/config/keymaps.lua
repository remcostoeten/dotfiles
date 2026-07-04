local map = LazyVim.safe_keymap_set

map("n", "<leader>wq", "<cmd>wqa<cr>", { desc = "Write & quit all" })
map("n", "<leader>qq", "<cmd>qa<cr>", { desc = "Quit all" })
map("n", "<leader>ww", "<cmd>wa<cr>", { desc = "Write all" })
map("n", "<leader>wj", "<cmd>lnext<cr>", { desc = "Next location" })
map("n", "<leader>wk", "<cmd>lprev<cr>", { desc = "Previous location" })
map("n", "<C-h>", "<cmd>wincmd h<cr>", { desc = "Go to left window" })
map("n", "<C-j>", "<cmd>wincmd j<cr>", { desc = "Go to lower window" })
map("n", "<C-k>", "<cmd>wincmd k<cr>", { desc = "Go to upper window" })
map("n", "<C-l>", "<cmd>wincmd l<cr>", { desc = "Go to right window" })
map("n", "<C-S-h>", "<cmd>split<cr>", { desc = "Horizontal split" })
map("n", "<C-S-l>", "<cmd>vsplit<cr>", { desc = "Vertical split" })
map("n", "<C-S-;>", "<C-w>w", { desc = "Cycle clockwise through windows" })
map("i", "jj", "<Esc>", { desc = "Exit insert mode" })

-- Tab to cycle buffers
map("n", "<Tab>", "<cmd>bn<cr>", { desc = "Next buffer" })
map("n", "<S-Tab>", "<cmd>bp<cr>", { desc = "Prev buffer" })

-- Ctrl-A to select all
map("n", "<C-a>", "ggVG", { desc = "Select all" })
map("i", "<C-a>", "<Esc>ggVG", { desc = "Select all" })

-- Delete without yanking (black hole register)
vim.keymap.set("v", "x", '"_x', { desc = "Delete without yanking", silent = true })
vim.keymap.set("v", "X", '"_X', { desc = "Delete without yanking (backward)", silent = true })

-- Ctrl-C to copy selection to system clipboard
map("v", "<C-c>", '"+y', { desc = "Copy to clipboard" })

-- Ctrl-X to clear file without overwriting clipboard
map("n", "<C-x>", "gg\"_dG", { desc = "Clear file (no clipboard)" })

-- Ctrl-Shift-Up/Down to extend selection line-wise
map("n", "<C-S-Up>", "V<Up>", { desc = "Extend selection up" })
map("n", "<C-S-Down>", "V<Down>", { desc = "Extend selection down" })
map("v", "<C-S-Up>", "<Up>", { desc = "Extend selection up" })
map("v", "<C-S-Down>", "<Down>", { desc = "Extend selection down" })

-- Theme picker
map("n", "<leader>uC", function()
  LazyVim.pick("colorscheme")
end, { desc = "Pick colorscheme" })
map("n", "<leader>uF", function()
  require("config.ghostty_presets").pick()
end, { desc = "Ghostty typography preset" })
