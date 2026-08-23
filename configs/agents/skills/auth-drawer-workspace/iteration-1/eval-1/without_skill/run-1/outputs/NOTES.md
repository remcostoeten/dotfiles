# Auth Drawer — JWT Scroll Paywall (Modal)

A scroll-triggered paywall for a React + Vite app, using
`@remcostoeten/auth-drawer` rendered as a **modal** with **no social login**,
backed by your own Express + JWT API.

## Files (drop into your `src/`)

| Output file | Goes to |
| --- | --- |
| `src__lib__auth__jwt-adapter.ts` | `src/lib/auth/jwt-adapter.ts` |
| `src__lib__auth__auth-context.tsx` | `src/lib/auth/auth-context.tsx` |
| `src__hooks__use-scroll-trigger.ts` | `src/hooks/use-scroll-trigger.ts` |
| `src__components__paywall-modal.tsx` | `src/components/paywall-modal.tsx` |
| `src__components__article.tsx` | `src/components/article.tsx` |
| `src__App.tsx` | `src/App.tsx` |

## Install

The package is already a dependency. If you're starting fresh:

```bash
npm install @remcostoeten/auth-drawer
```

## Environment

Point the adapter at your Express API. Create/append `.env`:

```bash
# Base URL for your Express API. Omit (defaults to "/api") if you proxy.
VITE_API_BASE_URL=http://localhost:3001/api
```

If your API runs on a different origin during dev, either set the absolute
URL above or add a Vite proxy in `vite.config.ts`:

```ts
export default defineConfig({
  server: {
    proxy: { "/api": "http://localhost:3001" },
  },
});
```

## How it works

1. **`jwt-adapter.ts`** — wraps your endpoints:
   - `POST /api/auth/login`, `POST /api/auth/register` → expect `{ token, user }`,
     store the token in `localStorage` under `auth_token`.
   - `GET /api/auth/me` → hydrate session; sends `Authorization: Bearer <token>`.
   - `POST /api/auth/logout` → clears the token (locally too, even on failure).
   - Returns a normalized `{ id, email, name? }` user, throws on error so the
     drawer can surface the message.
2. **`auth-context.tsx`** — single source of truth for `user`, loading state,
   and the modal's open/close. Hydrates the session on mount.
3. **`use-scroll-trigger.ts`** — fires once the reader passes the threshold
   (default `1/3`) of the article element.
4. **`paywall-modal.tsx`** — renders `AuthDrawer` with `variant="modal"`,
   `providers={[]}` / `showSocial={false}` (no social buttons), wired to the
   JWT adapter; closes itself on success.
5. **`article.tsx` / `App.tsx`** — the trigger is `enabled` only for
   unauthenticated, hydrated readers, so signed-in users are never interrupted.

## Backend response shape expected

```jsonc
// login / register
{ "token": "<jwt>", "user": { "id": "...", "email": "...", "name": "..." } }

// /api/auth/me
{ "user": { "id": "...", "email": "...", "name": "..." } }
```

If your API nests these differently, adjust the `data.token` / `data.user`
reads in `jwt-adapter.ts`.

## Customizing the trigger

In `article.tsx`, tweak `useScrollTrigger`:
- `threshold: 0.25` → quarter of the way down.
- Drop `targetRef` to measure whole-page scroll instead of the article element.
- `once: false` → re-open if dismissed and re-scrolled.

## Notes / assumptions

- Exact `AuthDrawer` prop names (`variant`, `adapter`, `providers`,
  `onAuthSuccess`) are my best read of the package API — verify against the
  version you have installed and rename if needed. The structure (controlled
  `open`/`onOpenChange`, an adapter object, an empty providers list to hide
  social) is the part to keep.
- Token is stored in `localStorage` for simplicity. If you prefer HttpOnly
  cookies, drop the token helpers and rely on `credentials: "include"` in the
  fetch calls instead.
