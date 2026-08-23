// src/components/site-header.tsx
//
// Header that reads the session from context. useAuth() throws if called
// outside AuthProvider, so this component must render *inside* the provider
// (it does — the provider wraps the whole app from the root layout).

"use client";

import { useAuth } from "@remcostoeten/auth-drawer";

export function SiteHeader() {
  const { user, isPending, openDrawer, signOut } = useAuth();

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.75rem 1.25rem",
        borderBottom: "1px solid var(--border, #e5e7eb)",
      }}
    >
      <span style={{ fontWeight: 600 }}>My App</span>

      <nav style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {renderAuthState()}
      </nav>
    </header>
  );

  function renderAuthState() {
    // Avoid a flash of the wrong state while the initial session resolves.
    if (isPending) {
      return null;
    }

    if (user) {
      return (
        <>
          <span style={{ fontSize: "0.875rem", color: "var(--muted, #6b7280)" }}>
            {user.email}
          </span>
          <button type="button" onClick={() => signOut()}>
            Sign out
          </button>
        </>
      );
    }

    return (
      <button type="button" onClick={() => openDrawer()}>
        Sign in
      </button>
    );
  }
}
