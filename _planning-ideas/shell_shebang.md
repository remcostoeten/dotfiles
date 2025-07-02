## `SHELL_SHEBANG` – Global Shebang Variable

To make this shell architecture fully **shell-agnostic**, we define a single global environment variable:

### 🔹 `SHELL_SHEBANG`

This variable represents the appropriate shebang line (`#!...`) for the current shell or interpreter environment.

#### Example values:

| Shell/Provider | `SHELL_SHEBANG` value         |
|----------------|-------------------------------|
| `bash`         | `#!/usr/bin/env bash`         |
| `zsh`          | `#!/usr/bin/env zsh`          |
| `fish`         | `#!/usr/bin/env fish`         |

You can detect the current shell dynamically and set `SHELL_SHEBANG` accordingly during runtime.

---

## 🌱 Future Support for Other Languages

We may later extend this concept to support other environments:

| Environment | Variable           | Shebang                          |
|-------------|--------------------|----------------------------------|
| Node.js     | `NODE_SHEBANG`     | `#!/usr/bin/env node`           |
| TSX         | `TSX_SHEBANG`      | `#!/usr/bin/env tsx`            |
| Python      | `PYTHON_SHEBANG`   | `#!/usr/bin/env python3`        |
| Deno        | `DENO_SHEBANG`     | `#!/usr/bin/env -S deno run`    |

---

## ✅ TODOs

- [ ] Implement shell detection logic to set `SHELL_SHEBANG`
- [ ] Use `SHELL_SHEBANG` in code generation or templating tools
- [ ] Extend support for non-shell environments (Node, Python, etc.)

