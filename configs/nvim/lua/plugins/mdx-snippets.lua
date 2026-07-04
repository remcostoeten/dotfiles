-- MDX / Markdown snippets (salvaged). These are LuaSnip snippets, so blink.cmp
-- is switched to the luasnip preset; friendly-snippets are reloaded through
-- luasnip so the default snippet set keeps working.
return {
  {
    "saghen/blink.cmp",
    dependencies = { "L3MON4D3/LuaSnip" },
    opts = {
      snippets = { preset = "luasnip" },
    },
  },

  {
    "L3MON4D3/LuaSnip",
    dependencies = { "rafamadriz/friendly-snippets" },
    config = function()
      -- keep the default friendly-snippets working under luasnip
      require("luasnip.loaders.from_vscode").lazy_load()

      local ls = require("luasnip")
      local s = ls.snippet
      local t = ls.text_node
      local i = ls.insert_node
      local f = ls.function_node
      local c = ls.choice_node

      local mdx_snippets = {
        -- Frontmatter
        s("fm", {
          t("---"),
          t({ "", "title: " }), i(1, "Title"),
          t({ "", "description: " }), i(2, "Description"),
          t({ "", "date: " }), f(function()
            return os.date("%Y-%m-%d")
          end),
          t({ "", "tags: [" }), i(3, "tag1, tag2"), t("]"),
          t({ "", "---", "", "" }), i(0),
        }),

        -- Import statement
        s("imp", {
          t("import "), i(1, "Component"), t(" from '"), i(2, "./Component"), t("'"),
          t({ "", "" }), i(0),
        }),

        -- Export statement
        s("exp", {
          t("export "), c(1, { t("default "), t("const "), t("{ ") }), i(2, "Component"), i(0),
        }),

        -- React component
        s("comp", {
          t("const "), i(1, "Component"), t(" = ("), i(2, ""), t(") => {"),
          t({ "", "  return (" }),
          t({ "", "    <div>" }),
          t({ "", "      " }), i(3, "Component content"),
          t({ "", "    </div>" }),
          t({ "", "  )" }),
          t({ "", "}" }),
          t({ "", "" }), i(0),
        }),

        -- JSX expression block
        s("jsx", { t("{"), i(1, "javascript code"), t("}"), i(0) }),

        -- Fenced code block
        s("code", {
          t("```"), i(1, "javascript"),
          t({ "", "" }), i(2, "code here"),
          t({ "", "```" }), i(0),
        }),

        -- Callout / Alert component
        s("alert", {
          t('<Alert type="'), c(1, { t("info"), t("warning"), t("error"), t("success") }), t('">'),
          t({ "", "  " }), i(2, "Alert content"),
          t({ "", "</Alert>" }), i(0),
        }),

        -- Image / Link
        s("img", { t("!["), i(1, "alt text"), t("]("), i(2, "image-url"), t(")"), i(0) }),
        s("link", { t("["), i(1, "link text"), t("]("), i(2, "url"), t(")"), i(0) }),

        -- Table
        s("table", {
          t("| "), i(1, "Header 1"), t(" | "), i(2, "Header 2"), t(" |"),
          t({ "", "|----------|----------|" }),
          t({ "", "| " }), i(3, "Cell 1"), t(" | "), i(4, "Cell 2"), t(" |"), i(0),
        }),

        -- div with className
        s("div", {
          t('<div className="'), i(1, "class-name"), t('">'),
          t({ "", "  " }), i(2, "content"),
          t({ "", "</div>" }), i(0),
        }),

        -- React fragment
        s("frag", {
          t("<>"),
          t({ "", "  " }), i(1, "content"),
          t({ "", "</>" }), i(0),
        }),

        -- MDX meta export
        s("meta", {
          t("export const meta = {"),
          t({ "", "  title: '" }), i(1, "Page Title"), t("',"),
          t({ "", "  description: '" }), i(2, "Page Description"), t("',"),
          t({ "", "}" }), i(0),
        }),

        -- JSX comment / props destructuring
        s("comment", { t("{/* "), i(1, "comment"), t(" */}"), i(0) }),
        s("props", { t("const { "), i(1, "prop1, prop2"), t(" } = props"), i(0) }),
      }

      ls.add_snippets("mdx", mdx_snippets)

      -- Frontmatter snippet for plain markdown too
      ls.add_snippets("markdown", {
        s("fm", {
          t("---"),
          t({ "", "title: " }), i(1, "Title"),
          t({ "", "description: " }), i(2, "Description"),
          t({ "", "date: " }), f(function()
            return os.date("%Y-%m-%d")
          end),
          t({ "", "---", "", "" }), i(0),
        }),
      })
    end,
  },
}
