-- LSP, Mason, formatting & linting
return {
  -- mason — install LSP servers & tools automatically
  {
    "mason-org/mason.nvim",
    opts = {
      -- note: vtsls, tailwindcss-language-server, marksman & markdownlint
      -- come from the lang.typescript / lang.tailwind / lang.markdown extras
      ensure_installed = {
        "stylua",
        "shfmt",
        "prettier",
        "bash-language-server",
        "intelephense",
        "php-cs-fixer",
        "css-lsp",
        "mdx-analyzer",
        "elixir-ls",
        "graphql-language-service-cli",
      },
    },
  },

  -- lspconfig — wire up LSP servers
  {
    "neovim/nvim-lspconfig",
    opts = {
      servers = {
        lua_ls = {},
        bashls = {},
        -- PHP language server (completion, diagnostics, go-to-def)
        intelephense = {
          filetypes = { "php", "twig" },
        },
        -- CSS / SCSS / LESS (not covered by any extra)
        cssls = {},
        -- MDX (JSX-in-markdown) language server
        mdx_analyzer = {
          filetypes = { "markdown.mdx", "mdx" },
        },
        -- Elixir language server (completion, diagnostics, go-to-def)
        elixirls = {},
        -- GraphQL language server
        graphql = {},
      },
    },
  },

  -- conform.nvim — auto-format on save
  {
    "stevearc/conform.nvim",
    opts = {
      formatters = {
        ["markdownlint-cli2"] = {
          -- markdownlint-cli2 treats file arguments as globs. Prefixing the
          -- path with ":" keeps route groups like "(marketing)" literal.
          args = function(_, ctx)
            return { "--fix", ":" .. ctx.filename }
          end,
          condition = function()
            return true
          end,
        },
      },
      formatters_by_ft = {
        lua = { "stylua" },
        php = { "php_cs_fixer" },
        sh = { "shfmt" },
        bash = { "shfmt" },
        zsh = { "shfmt" },
        javascript = { "prettier" },
        typescript = { "prettier" },
        javascriptreact = { "prettier" },
        typescriptreact = { "prettier" },
        json = { "prettier" },
        jsonc = { "prettier" },
        markdown = { "prettier", "markdownlint-cli2" },
        ["markdown.mdx"] = { "prettier", "markdownlint-cli2" },
        mdx = { "prettier", "markdownlint-cli2" },
        css = { "prettier" },
        html = { "prettier" },
        yaml = { "prettier" },
        graphql = { "prettier" },
      },
    },
  },
}
