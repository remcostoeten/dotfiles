// auth-adapter.ts
//
// The single bridge between the auth-drawer UI and your Express + JWT backend.
//
// Your backend:
//   POST /api/auth/login
//   POST /api/auth/register
//   POST /api/auth/logout
//   GET  /api/auth/me
//   Auth via a Bearer token in the Authorization header.
//
// We use the prebuilt custom-jwt adapter. It stores the JWT in localStorage
// (under tokenStorageKey) and automatically attaches it as a Bearer token on
// requests, including the GET /me profile call used by useSession.
//
// NOTE ON FEATURE DETECTION (this is what hides the social buttons):
// The drawer shows OAuth buttons ONLY when the adapter exposes signInWithOAuth.
// The custom-jwt adapter only adds signInWithOAuth when you pass `oauthUrl`.
// We deliberately do NOT pass it, so no social login is wired up at all.
// (We also set ui.auth.providers: [] in the config as belt-and-suspenders.)

import { createCustomJwtAdapter } from "@remcostoeten/auth-drawer/adapters/custom-jwt";

// Point at your Express API. Change BASE if your API lives on another origin
// (e.g. "https://api.example.com/api/auth") — these are full URLs, so absolute
// origins work too.
const BASE = "/api/auth";

export const authAdapter = createCustomJwtAdapter({
  // Each endpoint set explicitly so it matches your exact routes (notably GET
  // /me rather than a /profile default).
  loginUrl: `${BASE}/login`,
  registerUrl: `${BASE}/register`,
  logoutUrl: `${BASE}/logout`,
  profileUrl: `${BASE}/me`,

  // localStorage key under which the JWT is persisted and read back for the
  // Bearer header.
  tokenStorageKey: "auth_token",

  // Registration collects a name field. Drop this if /register only needs
  // email + password.
  requireName: true,

  // No `oauthUrl` -> adapter omits signInWithOAuth -> no social buttons.
  // No `providers` for the same reason.
});
