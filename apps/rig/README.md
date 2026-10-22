# rig

Runs a JavaScript project the way its folder says it should be run. One Rust binary, built to `bin/rig`.

```
rig                dev server of the project you are in
rig start          install if needed, build, then run the production server
rig install        install dependencies
rig build          production build
rig stop           stop the servers running from this project, frees their ports
rig info           show what was detected
rig help <command> help for one command, also rig <command> -h
```

Fish aliases: `r` is `rig dev`, `rs` is `rig start`, `i` is `rig install`, `b` is `rig build`.

## Detection

| Thing           | Order                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| Package manager | `pnpm-lock.yaml` gives pnpm, `bun.lock` gives bun, then the `packageManager` field, yarn or npm lockfiles, bun |
| Project         | nearest `package.json`, then the workspace packages below a monorepo root, then packages below the folder       |
| Monorepo        | `turbo.json`, `nx.json`, `lerna.json`, `rush.json`, `pnpm-workspace.yaml`, `workspaces` in `package.json`       |
| Framework       | Next.js, Nuxt, Astro, SvelteKit, React Router, Remix, TanStack Start, SolidStart, Angular, Gatsby, Docusaurus, Create React App, Vite, Vite+ |
| Dev script      | `dev`, `develop`, `start:dev`, then the framework CLI                                                            |
| Start script    | `start` for Next.js, `preview` for Vite, Astro, Nuxt and SvelteKit, then `serve` and `start:prod`                |

The lockfile search stops at the first folder with a `.git` entry. In a monorepo root with no script of its own, `rig` lists the packages that have one and asks which to run; `-w <name>` skips the question.

## Ports

The start port comes from `--port`, the script, `PORT`, then the framework default. A busy port is reported with the process and folder that hold it, and the next port is tried. Listening ports are read from the process tree after launch, so the printed URL is the one the app really bound.

`rig dev --auto-restart` restarts after a crash with a growing delay, up to 5 times in a row.

## Keys

| Key               | Action                                                        |
| ----------------- | ------------------------------------------------------------- |
| `o`               | open the app in the browser                                   |
| `.`               | open the folder in the file manager                           |
| `t`               | menu: `1` or `e` opens a terminal in the folder (`$TERMINAL`, then common ones), `2` or `u` starts or stops a tunnel |
| `+`               | add 30 minutes to the tunnel                                  |
| `c`               | copy the URL                                                  |
| `k`               | stop the process holding the wanted port and run on it        |
| `h`, `?`, enter   | show the keys again                                           |
| `r`               | restart                                                       |
| `q`, ctrl+c       | stop                                                          |

## Tunnel

`t` then `u` shares the running app through a Cloudflare quick tunnel: a temporary public HTTPS address, no account or config. It uses `cloudflared`, or Docker when that is missing. The address is printed once found, copied to the clipboard, and checked until Cloudflare routes it. The tunnel stops after 60 minutes (`--tunnel-for 2h`, `--tunnel-for 0` for no limit), warns 2 minutes before, and `+` adds 30 minutes. `rig dev --tunnel` starts one as soon as the app is ready. If the app moves to another port after a restart, the tunnel stops. Anyone with the address can open the app.

## Warnings

`rig` warns when several lockfiles sit in the same folder and when packages declared in `package.json` are missing from `node_modules`. Linux only (reads `/proc`).

## Build

```
apps/rig/build.sh
```
