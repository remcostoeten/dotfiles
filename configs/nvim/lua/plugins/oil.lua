-- lua/plugins/oil.lua
return {
  "stevearc/oil.nvim",
  opts = {
    default_file_explorer = true,
    delete_to_trash = false,
    view_options = {
      show_hidden = true,
    },
  },
  keys = {
    { "<leader>e", "<cmd>Oil<CR>", desc = "Open Oil file browser" },
  },
}
