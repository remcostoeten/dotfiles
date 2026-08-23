// src/lib/auth/auth-context.tsx
//
// App-level auth state. Wraps the JWT adapter and exposes the current user,
// loading state, and helpers to open/close the paywall modal. The paywall
// component and any "gated" UI read from this context.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { jwtAuthAdapter, type TUser } from "./jwt-adapter";

type TAuthContext = {
  user: TUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  // Modal open state for the paywall.
  isPaywallOpen: boolean;
  openPaywall: () => void;
  closePaywall: () => void;
  // Called by the modal after a successful sign in / sign up.
  setUser: (user: TUser | null) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<TAuthContext | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<TUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);

  // Hydrate the session from the stored Bearer token on first mount.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const current = await jwtAuthAdapter.getSession();
        if (active) setUser(current);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const openPaywall = useCallback(() => setIsPaywallOpen(true), []);
  const closePaywall = useCallback(() => setIsPaywallOpen(false), []);

  const signOut = useCallback(async () => {
    await jwtAuthAdapter.signOut();
    setUser(null);
  }, []);

  // When a user successfully authenticates, close the paywall automatically.
  const handleSetUser = useCallback((next: TUser | null) => {
    setUser(next);
    if (next) setIsPaywallOpen(false);
  }, []);

  const value = useMemo<TAuthContext>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      isPaywallOpen,
      openPaywall,
      closePaywall,
      setUser: handleSetUser,
      signOut,
    }),
    [user, isLoading, isPaywallOpen, openPaywall, closePaywall, handleSetUser, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): TAuthContext {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an <AuthProvider>");
  return ctx;
}
