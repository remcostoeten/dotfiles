# Auth Drawer + Supabase (Next.js 15 App Router) — Setup

End-to-end integration of `@remcostoeten/auth-drawer` backed by your existing
Supabase browser client (`supabase` from `@/lib/supabase`).

## Files in this output

| File here | Intended path |
|---|---|
| `lib__supabase.ts` | `src/lib/supabase.ts` (you likely already have this — keep yours) |
| `lib__auth-adapter.ts` | `src/lib/auth-adapter.ts` |
| `components__providers.tsx` | `src/components/providers.tsx` |
| `components__site-header.tsx` | `src/components/site-header.tsx` |
| `app__layout.tsx` | `app/layout.tsx` |

> Filenames use `__` to imply directory separators. Rename to the real paths
> shown above when copying into your project.

## 1. Install

The package is already a dependency. You also need the Supabase SSR client for
the browser client (if not already installed):

```bash
npm install @remcostoeten/auth-drawer @supabase/ssr @supabase/supabase-js
```

## 2. Environment variables

Add to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

These are public (anon) keys and safe to expose to the browser.

## 3. How it wires together

1. `lib/supabase.ts` — your existing browser client exported as `supabase`.
2. `lib/auth-adapter.ts` — wraps that client in the package's Supabase adapter
   (`createSupabaseAdapter`). The adapter is the bridge between the drawer UI
   and Supabase Auth (sign in / sign up / sign out / session).
3. `components/providers.tsx` — a `"use client"` wrapper that mounts
   `<AuthDrawerProvider adapter={authAdapter}>` at the app root so the rest of
   the tree can read auth state via the `useAuthDrawer` hook.
4. `app/layout.tsx` — Server Component root layout. Wraps everything in
   `<Providers>`, renders `<SiteHeader />`, and mounts `<AuthDrawer />` once
   near the root as the controlled overlay. Also imports the package stylesheet.
5. `components/site-header.tsx` — reads `useAuthDrawer()`:
   - logged out → **Sign in** button calls `openDrawer()`
   - logged in → shows `user.email` + a **Sign out** button calling `signOut()`

## 4. Run

```bash
npm run dev
```

Click **Sign in** to open the drawer, authenticate with Supabase, and the
header should swap to your email + **Sign out**.

## Notes / things to verify against your installed version

- Import paths assume the `@/` alias points at `src/` (configured in
  `tsconfig.json` `paths`). Adjust if your alias differs.
- The package stylesheet import path may be `@remcostoeten/auth-drawer/styles.css`
  or `@remcostoeten/auth-drawer/dist/styles.css` depending on the version — if
  the drawer renders unstyled, check the package's `exports` field.
- If your installed version exposes the adapter under a different subpath or as
  a top-level `createSupabaseAdapter` export, adjust the import in
  `lib/auth-adapter.ts` accordingly.
- Supabase email/password auth must be enabled in your Supabase project
  (Authentication → Providers).
