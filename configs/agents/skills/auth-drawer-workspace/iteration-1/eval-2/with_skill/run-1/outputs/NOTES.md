# auth-drawer mock demo (Vite + React)

Demo the `@remcostoeten/auth-drawer` login UI with a fake/in-memory backend, so
you can click through sign-in, watch the loading state, and trigger an error —
all before your real auth backend exists.

## Files

- `AuthDemo.tsx` — the whole integration: mock adapter + `AuthProvider` +
  `AuthDrawer` + a header that opens/closes the drawer. Drop this in as
  `src/AuthDemo.tsx`.
- `main.tsx` — a minimal Vite entry that renders `<AuthDemo />`. If you already
  have `src/main.tsx`, skip this and just render `<AuthDemo />` from your app.

## Setup

1. Install the package (use your project's package manager — pick the one whose
   lockfile is present):

   ```sh
   npm install @remcostoeten/auth-drawer
   # or: pnpm add @remcostoeten/auth-drawer
   # or: bun add @remcostoeten/auth-drawer
   ```

2. Make sure the peer deps are present (most React apps already have the first
   two; the package needs all four):

   ```sh
   npm install react react-dom framer-motion lucide-react
   ```

3. Copy `AuthDemo.tsx` into `src/`, then render it. Either use the provided
   `main.tsx`, or in your existing entry/app:

   ```tsx
   import AuthDemo from "./AuthDemo";
   // ...
   <AuthDemo />
   ```

4. Run the dev server:

   ```sh
   npm run dev
   ```

The stylesheet is imported at the top of `AuthDemo.tsx`
(`@remcostoeten/auth-drawer/styles.css`) — without it the drawer renders
unstyled. It's already wired, so no extra step.

## How it works

There is no real backend. `createMockAdapter()` holds an in-memory user and
fakes network latency. Because the mock adapter implements `signInWithOAuth`,
the **GitHub** and **Google** buttons appear (configured via
`ui.auth.providers: ["github", "google"]`). Registration is turned off
(`allowRegister: false`) to keep the demo focused on sign-in; remove that line
to also show the Register tab.

## Exercising each state

Open the drawer with the **Sign in** button in the header (or the floating
trigger button the drawer renders by default).

| State | How to trigger |
| :-- | :-- |
| **Success** | Email `admin@example.com`, password `password`. Drawer closes and the header shows "Sign out (admin@example.com)". |
| **Loading** | Any submit waits `latencyMs` (set to **1200ms** in `AuthDemo.tsx`) before resolving — the submit/OAuth button shows its loading spinner during that window. Lower/raise `latencyMs` to taste. |
| **Error** | Sign in with `spam@example.com` (any password). The mock backend returns a `rate_limited` error and the message renders on the form. |
| **OAuth** | Click **GitHub** or **Google** — the mock adapter resolves them after the same fake delay. |

`onSuccess` / `onError` are wired to `console.log` so you can watch the
lifecycle in the browser console.

## Notes

- `useAuth()` must be called inside `<AuthProvider>` — the `DemoHeader`
  component is rendered as a child of the provider for exactly this reason.
- When your real backend is ready, swap `createMockAdapter(...)` for the
  matching prebuilt adapter (Better Auth, Supabase, Clerk, NextAuth, Firebase,
  custom JWT/REST, or Passport) — the rest of `AuthDemo.tsx` stays the same.
