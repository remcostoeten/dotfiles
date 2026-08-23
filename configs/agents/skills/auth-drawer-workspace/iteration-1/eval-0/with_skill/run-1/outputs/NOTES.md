# Auth Drawer + Supabase (Next.js 15 App Router) — setup notes

Wires `@remcostoeten/auth-drawer` to your existing Supabase browser client
(`supabase` from `@/lib/supabase`) end to end: provider at the app root, one
app-wide drawer, and a header with Sign in / email + Sign out.

## Files (map to your project)

| Output file          | Destination in your app             |
| -------------------- | ----------------------------------- |
| `auth-adapter.ts`    | `src/lib/auth-adapter.ts`           |
| `auth-provider.tsx`  | `src/components/auth-provider.tsx`  |
| `site-header.tsx`    | `src/components/site-header.tsx`    |
| `app-layout.tsx`     | `app/layout.tsx`                    |

(Paths assume the `@/*` alias points at `src/`. Adjust import paths if your
alias differs — e.g. drop `src/` if `@/*` maps to the repo root.)

## Install

The package itself is already installed. Make sure these peer dependencies are
present (most Next 15 apps already have React 18/19):

```sh
# use whatever package manager the app uses (bun / pnpm / npm / yarn)
bun add framer-motion lucide-react
# react / react-dom come with Next.js
```

Peer deps required by the package: `react` (^18 || ^19), `react-dom`,
`framer-motion` (^12), `lucide-react`.

## How the pieces fit

1. **Adapter** (`auth-adapter.ts`) — the only integration point with Supabase.
   `createSupabaseAdapter({ supabase })` already implements `signIn`, `signUp`,
   `signOut`, `signInWithOAuth`, password reset, and a reactive `useSession`.
   Because it implements those methods, the drawer auto-shows the Register tab,
   OAuth buttons, and the forgot-password link (feature detection — you do NOT
   toggle these via config).

2. **Provider** (`auth-provider.tsx`) — a `"use client"` wrapper around
   `AuthProvider`. It also renders `<AuthDrawer hideTrigger />` once so a single
   auth surface lives app-wide and is driven from your own UI.

3. **Layout** (`app-layout.tsx`) — a Server Component that imports the
   stylesheet once and mounts the provider + header.

4. **Header** (`site-header.tsx`) — reads `useAuth()`: shows a **Sign in**
   button (calls `openDrawer()`) when logged out, and the user's email + a
   **Sign out** button (calls `signOut()`) when logged in.

## Required: the CSS import

`app-layout.tsx` does `import "@remcostoeten/auth-drawer/styles.css";` exactly
once at the root. Without it the drawer renders unstyled. If you use Tailwind
and prefer the source layer, import
`@remcostoeten/auth-drawer/styles/tailwind.css` from your Tailwind entry instead.

## Supabase / OAuth config

- The adapter passes `providers: ["github", "google"]`. OAuth buttons only
  appear if those providers are also enabled in your Supabase dashboard
  (Authentication → Providers). To ship email/password only, remove the
  `providers` line in `auth-adapter.ts` and drop the `providers` array in the
  drawer config in `auth-provider.tsx`.
- `redirectTo` / `passwordResetRedirectTo` are derived from
  `window.location.origin`. Add those URLs to Supabase's allowed redirect URLs.
  Create a `/reset-password` route if you want the password-reset email flow to
  land somewhere useful.

## Gotchas to remember

- `AuthProvider`, `AuthDrawer`, and `useAuth` are client-side — keep them under
  a `"use client"` boundary (done in `auth-provider.tsx` / `site-header.tsx`).
- `useAuth()` throws outside `AuthProvider`; the header is mounted inside it.
- Don't try to hide Register/OAuth via config — that's driven by which adapter
  methods exist. The Supabase adapter implements them, so they show by default.
