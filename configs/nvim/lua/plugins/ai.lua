-- AI inline autocomplete (Supermaven, free tier).
--
-- Supermaven streams context-aware ghost text as you type — the closest thing
-- to Cursor's Tab completion outside Cursor, with a dedicated FIM model and
-- sub-100ms latency. Free tier needs no API key: run `:SupermavenUseFree` once
-- and follow the activation prompt.
--
-- Tab handoff: ghost text and blink.cmp's completion menu both want <Tab>, and
-- both are usually visible at once. We give <Tab> to Supermaven (Cursor-style
-- accept) and drive blink's menu with <Enter> + <C-n>/<C-p> instead.
return {
  {
    "supermaven-inc/supermaven-nvim",
    event = "InsertEnter",
    cmd = {
      "SupermavenUseFree",
      "SupermavenUsePro",
      "SupermavenStart",
      "SupermavenStop",
      "SupermavenStatus",
    },
    opts = {
      keymaps = {
        accept_suggestion = "<Tab>", -- Cursor-style: Tab accepts the ghost text
        clear_suggestion = "<C-]>", -- dismiss the current suggestion
        accept_word = "<C-Right>", -- accept only the next word
      },
      -- don't suggest inside pickers / prompt buffers
      ignore_filetypes = {
        TelescopePrompt = true,
        snacks_picker_input = true,
      },
      color = {
        suggestion_color = "#808080",
        cterm = 244,
      },
      disable_inline_completion = false, -- keep inline ghost text on
      disable_keymaps = false, -- let the keymaps above register
    },
  },

  -- Hand <Tab> over to Supermaven; confirm completions with <Enter>, navigate
  -- the menu with <C-n>/<C-p>.
  {
    "saghen/blink.cmp",
    opts = {
      keymap = {
        preset = "enter",
        ["<Tab>"] = { "fallback" },
        ["<S-Tab>"] = { "fallback" },
      },
    },
  },
}
