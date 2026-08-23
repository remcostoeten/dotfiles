# auth-drawer mock demo (Vite + React)

A minimal demo of the `@remcostoeten/auth-drawer` login UI backed by a **fake**
mock backend. No real auth server needed — you can click through sign-in, watch
the loading state, and trigger an error state.

## Files

- `MockAuthDemo.tsx` — the whole demo: the drawer, GitHub + Google buttons, and
  an inline fake backend (`mockSignIn`) with simulated latency and a failure
  switch. This is the "one file is fine" core.
- `App.tsx` — trivial entry that renders `<MockAuthDemo />`. Optional; you can
  instead import `MockAuthDemo` into your own existing `App.tsx`.

## Setup

1. Make sure the package is installed (it already is in this app):

   ```bash
   npm install @remcostoeten/auth-drawer
   ```

2. Copy `MockAuthDemo.tsx` into `src/` of your Vite app.

3. Render it. Either replace `src/App.tsx` with the provided `App.tsx`, or add
   to your existing entry:

   ```tsx
   import { MockAuthDemo } from "./MockAuthDemo";
   // ...
   <MockAuthDemo />
   ```

4. Run the dev server:

   ```bash
   npm run dev
   ```

   Open the printed `http://localhost:5173`.

> Note: the demo imports the package stylesheet via
> `import "@remcostoeten/auth-drawer/styles.css";` so the drawer is styled out
> of the box. If your build complains that the stylesheet path doesn't exist,
> just delete that one import line — the component will still work, it'll just
> be unstyled.

## How to exercise each state

### Sign-in (happy path)

1. The drawer opens automatically on load (or click **Open drawer**).
2. Leave the **"Force sign-in to fail"** checkbox unchecked.
3. Click **Continue with GitHub** or **Continue with Google**.
4. After ~1.2s the mock resolves, the drawer closes, and the status panel shows
   `signedInUser` populated with a fake user.

### Loading state

- Loading is visible during that ~1.2s window after you click a provider —
  `AuthDrawer` shows its built-in pending/spinner state on the button while the
  `onClick` promise is in flight. Increase `FAKE_LATENCY_MS` in
  `MockAuthDemo.tsx` if you want a longer window to inspect it.

### Error state

1. Check the **"Force sign-in to fail"** checkbox.
2. Click either provider.
3. After the fake latency the mock backend **rejects**; the demo re-throws so
   the drawer renders its error UI, and the status panel shows
   `lastEvent: "error:<provider>"`.

Use **Reset** to clear the signed-in user and event back to idle.

## API assumptions

This integration assumes the published `AuthDrawer` API roughly looks like:

- A controlled drawer via `open` / `onOpenChange`.
- A `providers` array of `{ id, label, onClick }`, where `onClick` returns a
  promise. The drawer awaits it for the loading state and surfaces a thrown
  error as the error state.

If the real prop names differ slightly in your installed version, the mock
backend logic (`mockSignIn`) stays the same — only the `<AuthDrawer .../>` prop
wiring would need adjusting.
