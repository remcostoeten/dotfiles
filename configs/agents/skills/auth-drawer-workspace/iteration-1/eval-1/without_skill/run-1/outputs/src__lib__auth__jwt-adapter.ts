// src/lib/auth/jwt-adapter.ts
//
// A custom auth adapter for @remcostoeten/auth-drawer that talks to our own
// Express + JWT backend. The auth-drawer accepts an adapter object whose
// methods return a normalized user (or throw on failure); the drawer/modal
// handles the form UI and calls these on submit.
//
// Backend contract:
//   POST /api/auth/login     { email, password } -> { token, user }
//   POST /api/auth/register  { email, password, name? } -> { token, user }
//   POST /api/auth/logout    (Bearer)            -> 200
//   GET  /api/auth/me        (Bearer)            -> { user }

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";
const TOKEN_STORAGE_KEY = "auth_token";

export type TUser = {
  id: string;
  email: string;
  name?: string;
};

export type TCredentials = {
  email: string;
  password: string;
  name?: string;
};

// ---- token helpers ----------------------------------------------------------

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // storage may be unavailable (private mode / SSR) — fail silently
  }
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.message || data?.error || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

// ---- raw API calls ----------------------------------------------------------

async function login(credentials: TCredentials): Promise<TUser> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      email: credentials.email,
      password: credentials.password,
    }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  setToken(data.token);
  return data.user as TUser;
}

async function register(credentials: TCredentials): Promise<TUser> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      email: credentials.email,
      password: credentials.password,
      name: credentials.name,
    }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  setToken(data.token);
  return data.user as TUser;
}

async function logout(): Promise<void> {
  const token = getToken();
  if (token) {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: authHeaders(),
      });
    } catch {
      // even if the network call fails, we still clear the local token below
    }
  }
  setToken(null);
}

async function getCurrentUser(): Promise<TUser | null> {
  const token = getToken();
  if (!token) return null;
  const res = await fetch(`${API_BASE}/auth/me`, {
    method: "GET",
    headers: authHeaders(),
  });
  if (res.status === 401) {
    // token is stale/invalid — drop it
    setToken(null);
    return null;
  }
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  return data.user as TUser;
}

// ---- adapter object consumed by @remcostoeten/auth-drawer -------------------
//
// The drawer calls these handlers from its built-in email/password form.
// No social providers are configured, so no OAuth methods are exposed here.

export const jwtAuthAdapter = {
  // Sign in with email + password.
  signIn: async ({ email, password }: TCredentials): Promise<TUser> =>
    login({ email, password }),

  // Create a new account.
  signUp: async ({ email, password, name }: TCredentials): Promise<TUser> =>
    register({ email, password, name }),

  // End the session.
  signOut: async (): Promise<void> => logout(),

  // Used on mount to hydrate the current session from the stored Bearer token.
  getSession: async (): Promise<TUser | null> => getCurrentUser(),
};

export type TJwtAuthAdapter = typeof jwtAuthAdapter;
