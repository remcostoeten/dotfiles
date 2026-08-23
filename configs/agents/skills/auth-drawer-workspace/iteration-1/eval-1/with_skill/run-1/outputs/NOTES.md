# Auth Drawer paywall — setup notes

A scroll-triggered **modal** paywall backed by your own Express + JWT API, with
**no social login**.

## 1. Install

The package is already a dependency. Make sure the peer deps are present:

```sh
# use your package manager (npm / pnpm / yarn / bun)
npm install react react-dom framer-motion lucide-react
```

(`@remcostoeten/auth-drawer` requires `react` ^18||^19, `react-dom`,
`framer-motion` ^12, and `lucide-react`.)

## 2. Drop in the files

```
src/
  App.tsx                       <- app.tsx        (wraps app in AuthProvider, imports CSS)
  auth/
    auth-adapter.ts             <- auth-adapter.ts (custom-jwt adapter -> your Express API)
    auth-config.ts              <- auth-config.ts  (modal + no OAuth + scroll trigger)
    trigger-store.ts            <- trigger-store.ts (shared store for scroll events)
  components/
    article-paywall.tsx         <- article-paywall.tsx (scroll watcher + <AuthDrawer/>)
    article-page.tsx            <- article-page.tsx (example page wiring it together)
```

## 3. Configure the API base URL

Set it in a Vite env file (`.env.local`):

```
VITE_API_BASE_URL=http://localhost:3001/api
```

If you proxy `/api` to Express via Vite's `server.proxy`, you can leave it unset
(defaults to `/api`). The adapter then calls:

- `POST  {base}/auth/login`
- `POST  {base}/auth/register`
- `POST  {base}/auth/logout`
- `GET   {base}/auth/me`

## 4. How it works

- **Custom JWT adapter** (`createCustomJwtAdapter`) stores the JWT in
  `localStorage` (key `paywall.token`) and re-sends it as
  `Authorization: Bearer <token>`. It maps 401/429/5xx to friendly errors.
- **Modal, not drawer**: `ui.presentation.variant: "modal"`.
- **No social login**: the adapter is created WITHOUT `providers`/`oauthUrl`
  (OAuth is feature-detected, so omitting it removes the buttons), and
  `ui.auth.providers: []` enforces it again at the config layer.
- **Login + Register only**: the Register tab appears automatically because the
  adapter implements `signUp` (your `/register` endpoint). Forgot-password is
  hidden (`showForgotPassword: false`) since no reset endpoint was wired.
- **Scroll auto-open (~1/3 down)**: `useScrollOpenTrigger` watches the article
  container and emits a `scrollOpen` event into a **shared** `triggerStore`.
  `<AuthDrawer>` is registered against that same store and applies the
  `scrollOpen` policy (`threshold: 0.33`, `once: true`) from `auth-config.ts`.
  `hideTrigger` removes the default floating button.

## 5. Backend response shape

The adapter expects login/register to return the JWT (commonly `{ token, user }`)
and `/auth/me` to return the current user when given a valid Bearer token. If your
field names differ (e.g. `accessToken` instead of `token`), pass a custom
`fetcher` to `createCustomJwtAdapter` to adapt the response, or align your API.

## 6. Notes / gotchas

- The CSS import (`@remcostoeten/auth-drawer/styles.css`) must stay at the app
  root exactly once, or the modal renders unstyled.
- `useAuth()` only works under `<AuthProvider>` — `article-page.tsx` is rendered
  inside it.
- For the scroll trigger to fire, the article container must actually be
  scrollable (it must be the scroll container, or have a constrained height with
  overflow). If your whole page scrolls instead, point the ref at the page scroll
  container or switch the trigger to `container: "page"`.
- Signed-in readers bypass the paywall (`article-page.tsx` branches on `user`).
- To also pop the modal on a 401 / expired token, add a `state` trigger to
  `authConfig.triggers` and `triggerStore.emit({ kind: "state", state: "expired" })`
  from your API error handler.
