---
name: gpui-app
description: Best practices for building native desktop apps in Rust with GPUI (Zed's UI framework) and gpui-kit / gpui-component. Covers Cargo profiles that keep debug builds fast and linkable, app structure with cached views and an in-app route enum so nothing is a dead end, background work and freshness rules, virtualized lists (uniform_list, list/ListState), render performance and how to measure it, gpui-kit gotchas (dialog buttons, inputs, scrollables, test macro clash), safe handling of irreversible actions, and how an agent verifies the UI on a virtual display without touching the user's session. Use whenever creating, editing, reviewing or debugging a project that depends on gpui, gpui-kit or gpui-component, when a GPUI app feels slow or janky, when adding lists, dialogs, navigation or polling to one, and when starting a new Rust desktop app where GPUI is an option.
---

# GPUI app practices

Learned the hard way on release-gui (`~/dev/work/tooling/release-gui`), a GPUI + gpui-kit 0.8 desktop app. Read that repo for working examples of everything below: `src/route.rs`, `src/tree.rs` (uniform_list), `src/pipelines.rs` (list + accordion), `src/perf.rs`, `src/watch.rs`, `src/release.rs` (confirm dialogs).

## 1. Cargo profiles first

Unoptimized GPUI feels far from 60 fps, and full debug info on optimized dependencies makes `rust-lld` need around 6 GB to link. Both happened. Start every project with:

```toml
[profile.dev]
opt-level = 1
debug = "line-tables-only"

[profile.dev.package."*"]
opt-level = 3
debug = false

[profile.release]
strip = true
```

- Judge smoothness on `cargo build --release`, never on a plain debug build.
- Changing a profile recompiles every dependency once (20 minutes on a small machine). Do it at project start, not mid-session.
- On machines with 8 to 16 GB: `-j 2`, one cargo command at a time, never two agents building in the same tree at once. OOM kills show up as `Killed process ... (rust-lld)` in `journalctl -k`.

## 2. App structure

- One root view (`ReleaseApp`-style) owns every screen as an `Entity<V>` created once at startup. Views keep their data between switches; switching views never refetches by itself.
- Render inactive-proof: wrap each screen as `view.clone().cached(StyleRefinement::default().size_full())`. Without `.cached`, any update in the title bar or a side band rebuilds and re-lays-out the active screen.
- Navigation is data, not ad hoc calls. Define one `AppRoute` enum (screen plus target: run id, commit, branch, site). Child views `impl EventEmitter<AppRoute>` and `cx.emit(route)`; the root subscribes with `cx.subscribe_in(&child, window, Self::on_route)` and handles everything in one `navigate(route, window, cx)`. Each screen exposes small entry points (`reveal(target)`, `prefill(branch)`, `preselect(site)`) that wait for data if it is still loading.
- No dead ends: anything that names another object in the app (a hash, branch, tag, run, PR, site) is clickable and routes there, with a pointer cursor, hover state and a tooltip naming the destination. Primary flow actions belong where the user is looking (an unreleased run offers "Release this"). External links (browser) are the exception, not the default.
- Inner clickables inside a clickable row must call `cx.stop_propagation()` (gpui-kit `Link` already stops propagation on mouse down).

## 3. Background work and freshness

- Never run `std::process::Command`, file IO or network on the UI thread from render or event handlers. Use `cx.spawn(async move |this, cx| { let r = cx.background_executor().spawn(async move { work() }).await; this.update(cx, |view, cx| ...).ok(); })`.
- Guard every async result with a generation counter: bump on each load, drop results whose generation is stale.
- Freshness windows instead of reload-on-show: keep `loaded_at: Option<Instant>` and only refetch on show if older than 30 to 60 s. Explicit refresh keys always force.
- Stale while revalidate: keep showing old data with a small "Reloading" label; skeletons only on the first load.
- No background polling by default. Poll only while something the user watches is in progress (their own run, the open detail, a run they just started), and notify when it finishes. A reusable watcher (find target, poll every N s while active, stop on finish, missing or repeated errors, notify only if it saw it running) beats ad hoc timers.
- Load fast local data (git) first and merge slow network data (API) in when it arrives; degrade with a muted note when the network part fails.
- Measure CLI calls before blaming the UI: a server-side filter flag once made a query 3.5x slower than filtering client-side.

## 4. Lists

- Never build more than about 50 rows eagerly. Layout, not element building, was the cost: 220 eager rows took 15 ms of layout per frame.
- Fixed row height: `uniform_list(id, count, cx.processor(|this, range, _, cx| this.render_rows(range, cx))).track_scroll(&handle)` with a `UniformListScrollHandle`; keep selection visible with `handle.scroll_to_item(ix, ScrollStrategy::Nearest)`.
- Variable height (inline accordion, expandable rows): `list(state.clone(), cx.processor(|this, ix, _, cx| this.render_item(ix, cx)))` with a `ListState::new(0, ListAlignment::Top, px(overdraw))`. When the item set changes, `reset_with_uniform_height(count, row_height)` and restore `logical_scroll_top()`; reveal with `scroll_to_reveal_item(ix)`.
- Make each logical row (row plus its expansion) one list item so index math stays simple.
- Precompute per-row display data (strings, colours, lane geometry, parsed timestamps if they show up in measurements) once per load, not per frame.
- gpui-kit `DataTable` cannot expand rows in place (fixed-height uniform list). Use your own list for accordions; do not keep a hidden `TableState` just as a data store.
- Scrollbars: `.vertical_scrollbar(&handle)` on a relative wrapper. Needs `use gpui_kit::component::scroll::ScrollableElement;`.

## 5. Render performance

- Notify narrowly and only on real change. Do not `cx.notify()` on every modifier key, every prepaint width callback, or from idle timers. Guard feedback loops (`if (old - new).abs() < 1. { return; }`).
- Observing a shared entity (`cx.observe(&model, |_, _, cx| cx.notify())`) re-renders the whole observer; split views so only the part that shows the data re-renders.
- Idle must be 0 frames. Check it.
- Measure with an env-gated recorder (pattern in `src/perf.rs`): `static ENABLED: OnceLock<bool>` from `APP_PERF=1`, spans around each view's `render`, marker elements at the start and end of the root to time render+layout, prepaint and paint, counts of renders per keypress, a summary table (count, p50, p95, max) on stderr after a quiet period. For GPU present time run with `ZED_MEASUREMENTS=1`.
- Budgets: under 8 ms CPU per frame for navigation and hover, under 16 ms for view switches.

## 6. gpui-kit gotchas (0.8)

- Plain dialogs do not draw OK/Cancel. Give every dialog an explicit footer: `DialogFooter::new().child(DialogClose::new().trigger(|b| b.label("Cancel"))).child(DialogAction::new().child(Button::new("ok").danger().label(text)))`.
- Set input text with `state.update(cx, |s, cx| s.set_value(value, window, cx))` (`InputState`, defined in gpui-base).
- `overflow_y_scrollbar()` wraps the element: the element itself is the scroll area, its children get natural height. Do not nest a scroll area inside a fixed-height scroll area unless the inner one has a fixed height.
- Test modules in files that `use gpui_kit::*;` must import items explicitly. `use super::*;` pulls in gpui's `test` attribute macro, and every `#[test]` fails with a recursion-limit error.
- Theme tokens can be identical to the background (`table.even.background` equalled `background`, so stripes were invisible). Check tokens before relying on them; use your own panel token for zebra rows.
- Drag to resize: a thin `occlude()` handle with `cursor_col_resize()`, `on_drag(Marker, |m, _, _, cx| cx.new(|_| m.clone()))` where `Marker` renders `Empty`, and `on_drag_move::<Marker>` reading `event.event.position`.
- Monospace for hashes, tabular figures for numbers, dimmer tone for hashes and `#` prefixes so names and statuses carry the row.

## 7. Irreversible actions

- Merge, tag, push, deploy, delete: typed `yes` confirm that restates what will happen and warns about failing checks, but does not hide the button.
- Every external binary the app calls gets an env override (`APP_TWG_BIN`, `APP_RELEASE_BIN`) so tests and agents drive the full UI path against a fake script that records arguments and prints canned JSON. Never exercise a real write during development.
- If an external tool requires a clean checkout, run it in an app-owned clone (`~/.cache/<app>/clones/<repo>`, marker file in `.git`, refuse to reset anything without the marker), synced with fetch plus hard reset, and copy in untracked local-only config it needs.

## 8. Platform bits

- Desktop notifications: `notify-send --app-name <app>` on Linux, `osascript -e 'display notification ...'` on macOS (escape quotes and backslashes), no-op elsewhere, always on a spawned thread.
- Settings: small JSON under `$XDG_CONFIG_HOME/<app>/` (fallback `~/.config`), defaults on any parse error.
- Prefer one good default over a setting. A layout toggle was added and then removed because the user wanted the better option to just be the behaviour.

## 9. Verifying as an agent

Never claim a UI change works without looking at it. Run a real instance on a private virtual display:

```sh
mkdir -p /tmp/app-test/cfg && ln -s ~/.config/<cli-auth-dir> /tmp/app-test/cfg/<cli-auth-dir>
Xvfb :95 -screen 0 1440x900x24 &
DISPLAY=:95 XDG_CONFIG_HOME=/tmp/app-test/cfg WAYLAND_DISPLAY= ./target/release/<app> &
DISPLAY=:95 xdotool key j; DISPLAY=:95 xdotool mousemove 700 330 click 1
DISPLAY=:95 import -window root /tmp/app-test/shot.png   # then read the PNG
```

- Override `XDG_CONFIG_HOME` so the app's settings do not touch the user's, but symlink the auth dirs of CLIs the app shells out to, or they fail with auth errors.
- Never kill by pattern (`pkill -f <app>` matches the user's own instance and even your shell). Kill by PID, or check `/proc/<pid>/environ` for your `DISPLAY` first.
- Never click anything that writes externally or opens the user's browser on the test display.
- One app instance and one Xvfb at a time; kill them after each screenshot round; remove the temp dir.
- Xvfb renders in software: trust CPU-side timings and render counts, not absolute fps.
