vim.g.mapleader = " "
vim.g.maplocalleader = " "

vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.signcolumn = "yes"
vim.opt.cursorline = true
vim.opt.wrap = true
vim.opt.linebreak = true -- wrap at word boundaries, not mid-word
vim.opt.breakindent = true -- wrapped lines keep their indentation
vim.opt.termguicolors = true
vim.opt.laststatus = 3
vim.opt.fillchars = { eob = " " }
vim.opt.list = true
vim.opt.listchars = { trail = "·", tab = "» " }
vim.opt.scrolloff = 4
vim.opt.sidescrolloff = 8
vim.opt.pumblend = 12
vim.opt.winblend = 10
vim.opt.tabstop = 2
vim.opt.shiftwidth = 2
vim.opt.softtabstop = 2
vim.opt.expandtab = true
vim.opt.undofile = true
vim.opt.sessionoptions = { "buffers", "curdir", "tabpages", "winsize", "globals" }
vim.opt.shortmess:append({ c = true, W = true, I = true })
vim.opt.formatoptions = "jcroqlnt"
vim.opt.confirm = true
vim.opt.splitkeep = "screen"
vim.opt.inccommand = "split"
vim.opt.splitbelow = true
vim.opt.splitright = true

-- enable auto-format on save (LazyVim uses conform.nvim)
vim.g.autoformat = true
