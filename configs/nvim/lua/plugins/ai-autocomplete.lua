return {
	-- Free AI autocomplete with Codeium
	-- Codeium automatically integrates with nvim-cmp when both are present
	{
		"Exafunction/codeium.nvim",
		dependencies = {
			"nvim-lua/plenary.nvim",
			"hrsh7th/nvim-cmp",
		},
		event = "VeryLazy",
		config = function()
			require("codeium").setup({
				-- Codeium is free and doesn't require API key for basic usage
				-- Run :Codeium Auth after first launch to authenticate
			})
		end,
	},
}
