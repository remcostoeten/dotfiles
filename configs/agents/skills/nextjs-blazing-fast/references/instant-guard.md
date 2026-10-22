# Track B: the instant() guard, rig and RED trust

The verification half of track B. Sections: the rig, the test templates, verifying the RED, the PR checklist.

Phase letters used below map to the checklist in `SKILL.md` track B: phase A is the rig (0), B the unlocked baseline (1), C the locked RED (2), the C-gate is "Verifying the RED", D the fix (3, 4), E parity (5), F the differential (6).

Prerequisites: Next 16.3+ with `cacheComponents: true`, and `@next/playwright` on the same release line as `next` (`npm ls next @next/playwright`). If the repo has no Playwright harness, standing up a minimal one (`@playwright/test`, `@next/playwright`, a config with `baseURL`, one authenticated path) is part of the rig step.

## The rig

The optimizer suite needs a production build that exposes the Next.js testing
API, a stable URL for that build, and a Playwright command that can drive the
initial loads or client navigations being optimized. Discover this setup once,
record it in `instant-nav.rig.md`, and reuse it across optimization runs.

Read an existing `instant-nav.rig.md` before creating one. Inspect the
repository before asking the user:

- `package.json` scripts for build, start, and end-to-end tests
- `playwright.config.*` for `baseURL`, `webServer`, projects, and authentication
- `next.config.*` for existing `experimental` options
- CI, preview deployment, container, and hosting configuration
- test helpers for login, `storageState`, fixtures, flags, and seeded data

Ask only for details the repository cannot answer, such as unavailable
credentials or which remote environment may expose the testing API.

### What the rig must define

### Production build and server

Use `next build` followed by `next start`, or a remote artifact produced by the
same production build. Development can help diagnose a route, but the final
RED and GREEN must come from a production build.

Record separate build and start commands. For a local rig, record the port,
stop any previous server before starting, fail on `EADDRINUSE`, and confirm the
new process owns the port before running Playwright. `next start` can fork a
`next-server` child, so the launcher process ID may not own the port. Start the
server in a process group that the rig can stop as a unit, or discover and stop
the process listening on the recorded port before the next build.

### Testing API

An `instant()` test against a production build requires
`experimental.exposeTestingApiInProductionBuild`. Gate it so real production
builds do not expose the API:

```ts filename="next.config.ts" highlight={3,8-10}
import type { NextConfig } from 'next'

const exposeTestingApi = process.env.EXPOSE_TESTING_API === '1'

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    exposeTestingApiInProductionBuild: exposeTestingApi,
  },
}

export default nextConfig
```

Merge the option into an existing `experimental` object instead of replacing
the project's other experimental options.

Set the condition while running `next build`. Setting it only for `next start`
is too late because the testing API is compiled into the production artifact.
When the artifact was built without it, Next.js does not activate the
navigation lock, so the test cannot distinguish shell content from streamed
dynamic content. Rebuild with the condition enabled before interpreting the
results. Use the project's existing environment naming when it already
distinguishes test, staging, preview, and production builds.

### Test command and base URL

Record the exact Playwright command and how it receives the measured build's
URL. Reuse the project's package manager, Playwright configuration, projects,
and reporters. The suite must import `instant()` from `@next/playwright`. If
the dependencies are absent, install `@next/playwright` on the same release
line as the project's `next`, alongside `@playwright/test`.

For a local rig, a typical sequence is:

```bash filename="Terminal"
EXPOSE_TESTING_API=1 pnpm build
pnpm start --port 3000
BASE_URL=http://localhost:3000 pnpm playwright test tests/static-shell.spec.ts
```

Adapt the script names and port to the project. Keep the production server
running while the test command executes. Follow the public
[`instant()` testing pattern](https://nextjs.org/docs/app/guides/instant-navigation#prevent-regressions-with-e2e-tests): use `page.goto()` for an initial-load
contract and click the real `<Link>` for a client-navigation contract.

### Test context

Record the state required to reach the target route and shell marker:

- Use `public; no authentication` when the route is public.
- Otherwise record the test account and login mechanism, including a fixture,
  `storageState`, API login, or seeded session.
- Record flags, plan, role, locale, seeded data, and other state that can change
  which shell the test sees.

A test user is not required. The field exists to make authenticated and
state-dependent tests reproducible when the app needs one.

### Drift

List differences between the state used to choose the shell contract and the
state used by Playwright. Feature flags, permissions, empty test data, and
locale differences can make an assertion fail because the target is
unreachable, not because its shell blocks. Write `none known`
only after checking the test context.

### Iteration loop

Record the complete loop the agent can repeat without rediscovering commands:

- Local: build with the testing API, start the new artifact, run the focused
  suite, stop the server, edit, and repeat.
- Remote: push, wait for the measured artifact, verify it matches `HEAD`, run
  the focused suite against its URL, edit, and repeat.

Note any step the agent cannot perform without the user, including deployment
approval, protected branches, secrets, or multi-factor authentication.

### Artifact liveness

For a remote rig, record how the test proves the deployment matches `HEAD`.
Prefer an endpoint or response header that exposes the deployed commit SHA. If
the app has neither, use the deployment provider's API to select the artifact
whose commit SHA matches `HEAD`.

A freshly completed local `build` followed by `start` does not need a SHA
probe. Record `n/a; local build and start`.

### Walls

Record build and run obstacles with their working resolution, such as required
environment variables, server-only imports that fail during prerendering,
unavailable credentials, or a process that keeps reclaiming the test port.
Reuse these notes on the next iteration.

### Write `instant-nav.rig.md`

Place this file at the repository root or next to the end-to-end configuration:

```md
# instant-nav rig: <project>

- BUILD: <commands or platform that builds and serves the measured production artifact>
- EXPOSE: <condition that enables exposeTestingApiInProductionBuild during build>
- RUN: <focused Playwright command and how it receives BASE_URL>
- TEST USER: <public/no auth, or account and login>; state: <flags, role, data, locale>
- DRIFT: <differences that could change the asserted UI>
- CONTRACTS: <route, initial load or source Link, shell marker, and deferred marker>
- LOOP: <local build → start → test, or push → deploy → test>; agent limits: <...>
- LIVENESS: <deployed SHA check, or n/a for a local build and start>
- WALLS: <project-specific obstacles and their resolutions>
```

`CONTRACTS` may list more than one focused navigation, but each route and
navigation type needs its own test. Every field needs a concrete value. `n/a`
is valid only with a reason, such as `TEST USER: public; no authentication` or
`LIVENESS: n/a; local build and start`.

### Check the rig before writing the baseline

Before recording the static-shell contract:

1. Build with the testing API condition enabled.
2. Start or locate that exact artifact and confirm the base URL responds.
3. Run one focused `instant()` smoke test using the intended navigation type.
4. Confirm the test can reach the route and eventual destination UI in the
   recorded test context.

Fix the rig before interpreting an optimizer failure. A missing testing API,
stale deployment, unreachable target, or wrong test state is an environment
failure rather than evidence that the shell blocks.

## Test templates

See: [`@next/playwright` `instant()`](https://nextjs.org/docs/app/guides/instant-navigation#prevent-regressions-with-e2e-tests).

Ship one test per navigation type you are guarding: under `instant()`, assert that the
destination's static shell appears. `instant()` gates dynamic data, so a correctly instant route
commits its shell under the lock and a blocking route does not. `instant()` is a ruler, not a
stopwatch: do not add custom timeouts or timing races (see "Verifying the RED" below).
Whether the marker is the right one (rendering for the test user, not flag-gated, not redirected
away, not guessed) is established at authoring time with the unlocked baseline scaffold below
(phase B, the C-gate), not by additional assertions in the shipped test.

All identifiers in angle brackets (`<b>`, `<Trigger>`) and the `../helpers` import are placeholders;
substitute your project's e2e auth helper, URL helper, and real testids/trigger before running.

### Soft navigation (client-side navigation)

Drive a real `<Link>` click. The committed shell is the destination's prefetched App Shell.
Under the lock the router initiates and awaits the route prefetch itself, so no manual warming is
needed; if the shell is intermittently absent, treat it as a real blocker or marker bug (C-gate),
never as a warming race. Do not add waits or hovers.

```ts
import { test, expect } from '@playwright/test'
import { instant } from '@next/playwright'
// Use the auth/setup helpers your e2e suite already has. Run as the test user
// (the account the e2e suite logs in as).
import { logIntoTestAccount, testUrl } from '../helpers'

// A SYNC element of the destination's static shell (header, action button,
// column header), not data that streams in, and one that renders for the
// test user (not gated by a flag, plan, role, or empty state). Prefer a
// data-testid on a known static node over a guessed role/name.
const SHELL_MARKER = '[data-testid="<b>-shell-marker"]'

test.describe('instant nav: A -> B', () => {
  test.beforeEach(async ({ page, browser }) => {
    await logIntoTestAccount(page, browser)
  })

  test('B shell commits under instant()', async ({ page }) => {
    await page.goto(testUrl('/'))
    const trigger = page.getByRole('link', { name: '<Trigger>', exact: true })
    await expect(trigger).toBeVisible({ timeout: 20000 })

    await instant(page, async () => {
      await trigger.click()
      // static shell asserted under the lock; no timeout
      await expect(page.locator(SHELL_MARKER)).toBeVisible()
    })
  })
})
```

The trigger selector follows the same rule as `SHELL_MARKER`: prefer a `data-testid` on the real
`<Link>` (`page.getByTestId('<trigger>-link')`) over a guessed accessible name. `getByRole({ name })`
is shown only for brevity; like the marker, the trigger must reliably resolve for the test user.

### Initial load (hard navigation)

Drive `page.goto()` inside `instant()` with the `baseURL` option. The served document is the
route's prerendered static shell. `baseURL` is required because `page` is still `about:blank` when
`instant()` runs (`resolveURL` falls back to `page.url()` only when no `baseURL` is passed).
Establish the session WITHOUT navigating `page` (inject `storageState`, or log in on a separate
context/page). A login helper that navigates `page` itself defeats the measurement for a different
reason: that navigation completes before `instant()` acquires the lock, so it runs unmeasured. The
session must be pre-established either way; otherwise an authenticated route redirects to login
and the RED is false.

If the project's only login helper navigates `page`, the agent must use a
storageState/separate-context path here instead, a session-injection call that
does NOT call `page.goto`:

```ts
test.describe('instant initial load: B', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestUserSession(page) // storageState only; must NOT call page.goto
  })

  test('B shell is served', async ({ page }) => {
    const url = testUrl('/<b>')
    await instant(
      page,
      async () => {
        await page.goto(url)
        await expect(page.locator(SHELL_MARKER)).toBeVisible()
      },
      { baseURL: new URL(url).origin }
    )
  })
})
```

### Self-validating variant (recommended for routes with deferred content)

Also assert that the deferred content is gated under the lock and streams after release. This
makes a vacuous pass impossible: if the lock did not engage (testing API missing from the build),
the content is already present and `toHaveCount(0)` fails (see "Verifying the RED" below).

`SHELL_MARKER` is the shell node; `[data-testid="<b>-content"]` is the deferred data it guards.

```ts
// soft navigation
await instant(page, async () => {
  await trigger.click()
  await expect(page.locator(SHELL_MARKER)).toBeVisible() // shell present
  await expect(page.getByTestId('<b>-content')).toHaveCount(0) // deferred data gated
})
await expect(page.getByTestId('<b>-content')).toBeVisible() // streams after release
```

The two **gated-half** assertions (shell visible, deferred content `toHaveCount(0)`) apply to the
initial-load `page.goto()` form too. The cookie gates the deferred content identically for both:
on a soft navigation the client lock gates dynamic-data writes; on an initial load the server
honors the cookie on the document request (set via `addCookies()` before navigation, scoped by
`baseURL`) and suspends dynamic data, independent of whether the route was previously rendered or
cached. So the initial-load `toHaveCount(0)` gated half is as valid as the soft-nav one; it needs
no fresh browser context and no cache-busting query param.

The **post-release** assertion (`getByTestId('<b>-content').toBeVisible()` after the `instant()`
block) is soft-nav only. On an initial load the document was already emitted under the lock, so
nothing streams in after release; drop that assertion from the initial-load test, or
`page.reload()` first to fetch an unlocked document. The mechanism is in
"Verifying the RED" below.

### Baseline scaffold: do not ship

Before optimizing, confirm the target exists with an unlocked check (no `instant()`). It
disambiguates "not instant" from "marker absent for this user or environment". Run it as the test
user; mismatch against the rig DRIFT list is what the C-gate catches
("Verifying the RED" below). Confirm the marker is real and reachable, then delete the
scaffold before the PR.

**The baseline must mirror the navigation type of the test you are shipping.** Drive a `<Link>`
click when guarding the soft-nav shell; drive `page.goto()` when guarding the initial-load shell.
The two shells can differ (`shell-patterns.md` (real-app patterns)): a click-driven baseline run against a
shipped `goto` test would confirm a marker that the `goto` path never shows, which produces exactly
the false RED the C-gate exists to prevent.

```ts
// soft-nav baseline: mirror the soft-nav instant() test
test('dev-only: navigating to <b> renders its shell (no lock)', async ({
  page,
}) => {
  await page.goto(testUrl('/'))
  const trigger = page.getByRole('link', { name: '<Trigger>', exact: true })
  await expect(trigger).toBeVisible({ timeout: 20000 })
  await trigger.click()
  await expect(page).toHaveURL(/\/<b>(\?|$)/) // confirm the real destination (no redirect away)
  await expect(page.locator(SHELL_MARKER)).toBeVisible({ timeout: 15000 })
})
```

```ts
// initial-load baseline: mirror the initial-load instant() test (session pre-established)
test('dev-only: <b> shell is served (no lock)', async ({ page }) => {
  await page.goto(testUrl('/<b>'))
  await expect(page.locator(SHELL_MARKER)).toBeVisible({ timeout: 15000 })
})
```

Notes:

- Pick `SHELL_MARKER` as a sync element of the destination's static shell, never streamed data.
  Use a `data-testid` on a known static node rather than a guessed role/name.
- Do not put a custom timeout, a `painted` boolean, or `isVisible({ timeout })` in the shipped
  assertion, and do not add retries or hover-warming; see "Verifying the RED" below.

## Verifying the RED

The C-gate of the workflow. A RED that is red for the wrong reason sends you optimizing a route that
was never broken: the route becomes instant, the test stays red (or the code is contorted to
satisfy a broken assertion), and the effort lands on the wrong problem. The prevention is cheap:
spend a few minutes verifying the RED is trustworthy first.

### The deciding question

> **Does the marker render WITHOUT the lock, as the test user?**

- **No**: the test is red because the marker or page is not there for that user or environment. A
  marker bug, not an instant-navigation bug. Fix the marker. (This is the most common case.)
- **Yes**: the marker exists and is reachable; a red under the lock is a genuine "not instant".
  Optimize the route.

Everything below serves answering that question honestly.

### When the blocked route will not build

With Cache Components, a top-level blocking read can fail the build before the
test can produce a RED. Add `export const instant = false` to the target route
as part of the temporary RED scaffold. It lets the known blocker build without
making the navigation instant. Remove the opt-out with the fix, and include it
when reverting the fix for the differential.

### Cookie and session reads are not lock probes

Do not manufacture a RED with `cookies()` or a session read alone. The testing
lock restricts the navigation to its shell; it does not make request cookies
unavailable. Use the route's real blocking uncached data, and prefer the
self-validating test variant when deferred content exists.

### The robustness checklist (all must hold)

1. **Red on baseline**: fails on the unfixed route.
2. **Right reason**: without the lock, the marker is visible on the production-build rig (never
   `next dev`), running as the test user, not only in the author's own logged-in session.
3. **Differential**: reverting only the fix → RED; re-applying → GREEN; nothing else moves it.
4. **Non-gameable marker**: a sync element of the static shell, never streamed data.
5. **Deterministic on a production build**: stable across N runs; never `next dev`.
6. **Discriminating both ways**: present under the lock on an instant route, absent under the
   lock on a blocking one.
7. **Renders for the test user**: under that user's flags, plan, role, and data.
8. **Conditional redirects accounted for**: assert at the route's real destination for that user.
9. **Real selector**: a `data-testid` on a known static-shell node, not a guessed `role`/`name`.
10. **Visible marker**: not `display:none`, off-screen, or inside a hover overlay; for lists,
    target `.filter({ visible: true }).first()`.
11. **Fresh build under test**: the deployment being measured contains the latest commit, not a
    build URL still serving the previous deploy.

### Taxonomy: red for the wrong reason

Any of these makes a RED untrustworthy. None of them is "the navigation isn't instant."

| Wrong reason                 | How it occurs                                                                              | How to rule it out                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| **Selector matches nothing** | a guessed `getByRole('button', { name: 'Folder' })`                                        | grep the component for the real accessible name; add a `data-testid`                              |
| **Conditional redirect**     | the route `redirect()`s for the test user (flag/role), so the marker page is never reached | check the page's top-level branches; assert at the real destination, or pin the flag              |
| **Flag / plan / role gate**  | the author has the flag or plan; the test user does not                                    | run the unlocked baseline as the test user; pin flags via the project's override mechanism        |
| **Empty state**              | the marker only exists when data does; the CI account is empty                             | pick a marker present in the empty state (a layout element such as the page header), or seed data |
| **Timeout / flake**          | a slow API or transient infrastructure error                                               | re-run; separate infrastructure flake from a real signal                                          |
| **Streamed marker**          | the marker is behind `<Suspense>`, so it is never in the shell                             | choose a sync shell element; verify it sits outside every `<Suspense>`                            |
| **Auth redirect**            | unauthenticated → `/login`                                                                 | confirm login succeeded before the navigation                                                     |
| **Stale deployment**         | the test ran against the previous build (the URL under test still serves the prior deploy) | poll the deployment for a marker from the latest commit before trusting any verdict               |
| **Hidden / off-screen**      | the testid is on a hover-overlay or off-screen list item                                   | put the marker on an always-visible node; `.filter({ visible: true }).first()` for lists          |

### Worked cases

These are illustrative failures from real optimization runs; each was red for a wrong reason, and
none was an instant-navigation problem. One app's drift surface might be dominated by feature flags and
plans; another's by auth state, an empty database, or locale. The taxonomy lists every wrong
reason; the rig file's DRIFT list says which rows apply to your app.

- **Guessed selector + empty state**: the marker was a button picked by a guessed accessible name
  that no element actually had, on a list page whose CI account had no rows. → checks 7, 9. Fix: a
  `data-testid` on a real static-shell node.
- **Hidden marker**: the testid sat first on a `hidden sm:block` hover-overlay link, then on an
  off-screen carousel card; Playwright resolved the element but reported it hidden. → check 10.
  Fix: an always-visible node; for lists, `.filter({ visible: true }).first()`.

### Differential check (capture in the PR)

The strongest evidence that the RED measured the property:

```
1. on the fixed branch → GREEN
2. revert ONLY the fix (the <Suspense> push-down) → RED
3. re-apply → GREEN
4. confirm no other change moves it
```

Link the two runs (or include the toggle diff and results) in the PR description. A reviewer who
sees the differential knows the test measures the property.

### `instant()` is not a stopwatch

See: [`instant()`](https://nextjs.org/docs/app/guides/instant-navigation#prevent-regressions-with-e2e-tests).

The test does not measure how fast a navigation is. `instant()` gates dynamic data so the content
of the static shell can be asserted; the signal is presence, not speed. Under the lock, an instant
route's shell is present, and a blocking route's content never commits, regardless of wait time.
Therefore:

- The shipped assertion is `await expect(SHELL_MARKER).toBeVisible()` under the lock. Do not add a
  custom timeout or a `painted` boolean.
- A custom short timeout (e.g. `3000`) implies a race against a clock that does not exist. It adds
  nothing to the verdict and invites false REDs on an instant route whose commit lands a microtask
  late.
- Do not use `locator.isVisible({ timeout })` as a soft wait: Playwright deprecated and ignores
  that timeout; the call returns immediately.
- "Renders for the test user" (checks 7-9) is established at authoring time with the unlocked
  baseline scaffold, not by a timed assertion in the shipped test.

### `instant()` guards need no retries and no prefetch warming

An `instant()` guard is deterministic. Do not configure retries on one, and do not hover-warm to
help a prefetch land in time. Under the lock, the router initiates the route prefetch and awaits it
before committing (even for a `prefetch={false}` link, even for a route already in the prefetch
cache), so the committed shell does not depend on any prior render, hover, or menu-open prefetch.
A flaky guard has a real cause: a marker that is not a sync node of the destination's shell, a
flag/role/empty-state gap for the test user, or a genuinely blocking route. The fix is in the page or
the marker; a retry masks the regression the guard exists to catch. The only legitimate
`.hover()`/menu-open is when the trigger element itself is not in the DOM until hovered or opened.

### Silent no-op: the testing API must be exposed in the measured build

`instant()` works by setting a cookie (`next-instant-navigation-testing`) that lock code inside the
build reads. It does not throw when that lock code is absent; it only throws on nested calls or an
unknown base URL. If the build was produced without the testing API
(`experimental.exposeTestingApiInProductionBuild`), the cookie is ignored, the navigation runs
normally, and the `instant()` test passes vacuously. A green `instant()` test is only meaningful if
the lock engaged.

Two defenses; use both:

1. **Confirm the API is exposed on the target.** Wire the flag to the platform's preview/staging
   condition or an explicit environment variable; the rig file records the project's spelling
   (the rig section above). Do not trust a pass from a build where it is not set.
2. **Make the test self-validating**: for any route with deferred content, also assert that the
   deferred content is gated under the lock, not only that the shell is present
   (self-validating variant above). If the lock did not engage, the content is
   already present and `toHaveCount(0)` fails.

   The gated half holds under the lock for both navigation types regardless of warm state: the
   soft-nav client lock gates dynamic-data writes, and on an initial load the server honors the
   cookie on the document request and suspends dynamic data. A vacuous pass is only possible with
   a build produced WITHOUT the testing API, which defense #1 above covers.

### Determinism and the rig

- Always measure on a production build, never `next dev`; the rig section owns this invariant and
  its rationale.
- Run the RED several times; an intermittently red gate is not a gate. If it flakes, determine
  whether the cause is infrastructure (transient errors) or a real race before trusting either
  color.

## PR checklist

A green final state means nothing if the RED was never trustworthy. Confirm the robustness checklist above, then:

- [ ] **Differential shown:** RED without the fix, GREEN with it, runs linked.
- [ ] **Parity confirmed:** same content, data, ordering, empty and error states; a deferred `redirect()` or `notFound()` still fires at request time; open menus, scroll, focus and input survive the stream.
- [ ] **Mutations verified** when a cache was added or widened: write, then the next read returns the new value.
- [ ] **Existing loading UI reused:** no new page-mirroring skeleton.
- [ ] **Shell matches the real render at desktop and mobile widths** (`skeleton-qa.md`, or re-assert the marker at 1280x800 and 390x844).
- [ ] **Baseline scaffold removed:** only the locked test ships.
- [ ] **Temporary `export const instant = false`** used to get the RED building is gone.

If anything other than whether the route is instant changed, shrink the refactor. If the route errors after the change, reproduce on the base branch before blaming the refactor.
