local map = vim.keymap.set
local opts = { noremap = true, silent = true }

-- Undo/Redo
map("n", "<C-z>", "u", opts)
map("n", "<C-S-z>", "<C-r>", opts)

-- Select all
map("n", "<C-a>", "ggVG", opts)

-- Copy/Paste (using system clipboard)
map("v", "<C-c>", '"+y', opts)
map("n", "<C-v>", '"+p', opts)
map("i", "<C-v>", '<C-r>+', opts)

-- Custom <C-x> behavior (clear entire file/selection without copying)
-- Normal mode: Clear entire file
map("n", "<C-x>", '"_ggdG', opts)
-- Visual mode: Clear selection
map("v", "<C-x>", '"_d', opts)
-- Insert mode: Clear entire file (exits insert mode briefly)
map("i", "<C-x>", '<Esc>"_ggdG', opts)

-- Prevent 'x', 'd', 'c' from yanking (copying) deleted text
-- Normal, Visual, and Select modes
map({"n", "v", "x"}, "x", '"_x', opts)
map({"n", "v", "x"}, "d", '"_d', opts)
map({"n", "v", "x"}, "c", '"_c', opts)

-- Space combos for delete without yanking (normal mode)
map("n", "<Space><Space>", '"_dd', opts) -- Delete current line
map("n", "<Space>w", '"_dw', opts)       -- Delete word
map("n", "<Space>x", '"_ggdG', opts)     -- Delete entire file
map("n", "<Space>a", "ggVG", opts)       -- Select all

-- Rebind going into insert modde `:` to `;` (so without the shift)
map(";",":")
