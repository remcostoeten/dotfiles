# Dev loop: confirm an edit works in the running app

While iterating, verify against `next dev` that a change compiles, renders without errors and behaves as intended. This is the inner loop. It is never the verdict for instant navigation or skeleton fidelity; those need the production rig (`instant-guard.md`).

## Two views of the same app

- **`/_next/mcp`**: an HTTP endpoint Next.js 16.3+ exposes about itself while `next dev` runs. It knows routes, segments, server actions, server logs, and errors as Next saw them, including browser errors the dev server caught. Requires Turbopack for compile checks.
- **A real browser**: DOM, console, network, visual result. Use whatever browser automation the session has. Upstream recommends the `agent-browser` CLI (0.31.1+, `npm i -g agent-browser`; run `agent-browser skills get core` once for its usage guide). Claude in Chrome or Playwright work too.

When the two disagree (the browser shows a broken page, Next says it rendered cleanly), suspect a stale or misdirected browser session before the app.

## Preflight, once per session

Read the port off the `next dev` banner, then:

```bash
MCP=http://localhost:5182/_next/mcp
curl -s "$MCP" -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | sed -n 's/^data: //p'
```

- Unreachable: `next dev` isn't running, or Next is below 16.3. Check `package.json`.
- `get_compilation_issues` missing from the list: Next is below 16.3.
- `get_compilation_issues` answers "Turbopack project is not available": the app runs webpack. Compile checks are unavailable; the other tools still work.

Replies are SSE. Read the JSON off the `data:` line with `sed -n 's/^data: //p'`; a plain `sed 's/^data: //'` leaves the `event:` line and the parse fails.

Call a tool:

```bash
curl -s "$MCP" -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_routes","arguments":{}}}' | sed -n 's/^data: //p'
```

| Tool | Use |
|---|---|
| `get_project_metadata` | project path, dev server URL, bundler |
| `get_routes` | route map from a filesystem scan; no browser needed |
| `get_page_metadata` | segment tree and which files render the current route; needs one browser navigation first |
| `get_errors` | runtime and build errors, including browser-side ones; needs one browser navigation first |
| `get_logs` | path to the server log file |
| `get_server_action_by_id` | hashed action id to file and function name |
| `get_compilation_issues` | Turbopack compile errors and warnings |
| `compile_route` | compile one route on demand, to surface its errors without a browser visit |
| `get_request_insights` | per-request details as Next saw them; read its `tools/list` description for the current fields |

Pick tools from `tools/list` rather than memory; the surface grows. Verified against Next 16.3.5: all nine tools above are present, and the curl calls work as written.

## Before an edit: narrow the scope

Ask the running app which files render the route (`get_page_metadata`) and search there, instead of grepping the whole codebase.

## After an edit: four checks

1. **Compiles:** `get_compilation_issues`.
2. **No errors:** `get_errors` after navigating to the route.
3. **Behaves as intended:** drive the page in the browser and assert what the user sees. After a click, wait for network idle before reading; a guessed URL wait times out.
4. **React-level behavior:** for extra renders, server-client boundary shifts and which Suspense fallback showed, use React DevTools through the browser tool (`agent-browser --enable react-devtools`) rather than DOM asserts alone. Introspection goes stale after navigation; re-run it.

## Gotchas

- **Don't move or delete `.next` while `next dev` runs.** It disconnects the server from its generated state. If a production build must run alongside, give it its own `distDir`.
- A blank read or `about:blank` right after opening a page is the browser session dropping the page, not a broken route. Reopen the session; don't fall back to `curl`, which bypasses the browser.
- Leave `next dev` running between loops.
