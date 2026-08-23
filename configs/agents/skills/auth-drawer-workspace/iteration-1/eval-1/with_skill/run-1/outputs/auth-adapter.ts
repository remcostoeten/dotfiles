// src/auth/auth-adapter.ts
//
// Adapter that bridges <AuthDrawer> to your own Express + JWT backend.
//
// Endpoints (Bearer-token auth):
//   POST /api/auth/login     -> { token, user }   (or whatever your API returns)
//   POST /api/auth/register  -> { token, user }
//   POST /api/auth/logout
//   GET  /api/auth/me        -> { user }           (read with Authorization: Bearer <token>)
//
// The prebuilt custom-jwt adapter already:
//   - stores the JWT in localStorage under `tokenStorageKey`
//   - sends it back as `Authorization: Bearer <token>` on subsequent requests
//   - maps common HTTP errors (401/429/5xx) to AuthUiError
//
// Notably we do NOT pass `providers` / `oauthUrl` here. The drawer feature-detects
// OAuth from the adapter, so omitting them means NO social-login UI is rendered.
// (We also belt-and-suspenders this with `ui.auth.providers: []` in the config.)

import { createCustomJwtAdapter } from "@remcostoeten/auth-drawer/adapters/custom-jwt";

// Point this at your Express API. In Vite, read it from import.meta.env.
const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

export const TOKEN_STORAGE_KEY = "paywall.token";

export const authAdapter = createCustomJwtAdapter({
  // baseUrl is the prefix for the default endpoint paths. We override each
  // endpoint explicitly below so it lines up exactly with your routes.
  baseUrl: API_BASE_URL,

  loginUrl: `${API_BASE_URL}/auth/login`,
  registerUrl: `${API_BASE_URL}/auth/register`,
  logoutUrl: `${API_BASE_URL}/auth/logout`,
  profileUrl: `${API_BASE_URL}/auth/me`,

  // localStorage key under which the JWT is persisted + re-sent as a Bearer token.
  tokenStorageKey: TOKEN_STORAGE_KEY,

  // Collect a name during registration. Set to false if your /register
  // endpoint does not accept a name.
  requireName: true,

  // No social login: providers/oauthUrl are intentionally omitted so the
  // drawer never renders OAuth buttons.
});
