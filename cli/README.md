# Custom CLI Tools

This subdirectory contains custom-built CLI tools that are part of the overall `dotfiles` ecosystem. These tools are more complex than simple shell scripts and require a dedicated folder due to their structure or dependencies.

## 📁 Why a Separate Directory?

Tools in this directory:

- Consist of multiple related files (e.g. logic, config, helpers)
- May be written in languages like TypeScript, Go, or Python
- May Require build steps or additional tooling
- Are often standalone programs with specific functionality

Because of this, they don't belong in the `scripts/` folder, which is reserved for simpler, single-file scripts.

## 🔧 Usage

Each subdirectory represents a self-contained CLI utility. You can often run them directly by using `./some-file.sh`, `node some-javascript.js` or typescript equivalent or simply typing the CLI-name. Consult the local `README.md` of the specific CLI tool.

