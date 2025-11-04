return {
	-- Load schemastore first
	{
		"b0o/schemastore.nvim",
		lazy = false, -- Load immediately so it's available for jsonls config
		priority = 1000, -- High priority to load early
		version = false,
	},
	-- Enhanced LSP configuration
	{
		"neovim/nvim-lspconfig",
		dependencies = {
			"b0o/schemastore.nvim",
		},
		opts = function(_, opts)
			opts.servers = opts.servers or {}
			opts.servers.tsserver = opts.servers.tsserver or {}
			opts.servers.tsserver.settings = opts.servers.tsserver.settings or {}
			opts.servers.tsserver.settings.typescript = {
				inlayHints = {
					includeInlayParameterNameHints = "all",
					includeInlayParameterNameHintsWhenArgumentMatchesName = false,
					includeInlayFunctionParameterTypeHints = true,
					includeInlayVariableTypeHints = true,
					includeInlayPropertyDeclarationTypeHints = true,
					includeInlayFunctionLikeReturnTypeHints = true,
					includeInlayEnumMemberValueHints = true,
				},
			}
			opts.servers.tsserver.settings.javascript = {
				inlayHints = {
					includeInlayParameterNameHints = "all",
					includeInlayParameterNameHintsWhenArgumentMatchesName = false,
					includeInlayFunctionParameterTypeHints = true,
					includeInlayVariableTypeHints = true,
					includeInlayPropertyDeclarationTypeHints = true,
					includeInlayFunctionLikeReturnTypeHints = true,
					includeInlayEnumMemberValueHints = true,
				},
			}

			-- Configure jsonls with schemastore using setup callback
			opts.servers.jsonls = opts.servers.jsonls or {}
			opts.servers.jsonls.setup = function(server_opts)
				-- Load schemastore when server actually starts
				local ok, schemastore = pcall(require, "schemastore")
				server_opts.settings = server_opts.settings or {}
				server_opts.settings.json = server_opts.settings.json or {}
				if ok then
					server_opts.settings.json.schemas = schemastore.json.schemas()
				end
				server_opts.settings.json.validate = { enable = true }
				require("lspconfig").jsonls.setup(server_opts)
				return true -- Prevent default setup
			end

			-- Configure cssls
			opts.servers.cssls = opts.servers.cssls or {}
			opts.servers.cssls.settings = opts.servers.cssls.settings or {}
			opts.servers.cssls.settings.css = {
				validate = true,
				lint = {
					unknownAtRules = "ignore",
				},
			}

			-- Configure tailwindcss
			opts.servers.tailwindcss = opts.servers.tailwindcss or {}
			opts.servers.tailwindcss.root_dir = function(...)
				return require("lspconfig.util").root_pattern(".git", "tailwind.config.js", "tailwind.config.ts", "tailwind.config.cjs", "tailwind.config.mjs", "postcss.config.js", "postcss.config.ts", "package.json")(...)
			end
			opts.servers.tailwindcss.settings = {
				tailwindCSS = {
					classAttributes = {
						"class",
						"className",
						"classList",
						"ngClass",
					},
					experimental = {
						classRegex = {
							{ "cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]" },
							{ "cn\\(([^)]*)\\)", "(?:'|\"|`)([^\"'`]*)(?:'|\"|`)" },
						},
					},
				},
			}

			return opts
		end,
	},
}
