// src/components/site-header.tsx
//
// Header that reflects auth state. useAuth() must run under AuthProvider,
// and it is client-only.
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
        padding: "0.75rem 1.5rem",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <span style={{ fontWeight: 600 }}>My App</span>

      <nav style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {isPending ? null : user ? (
          <>
            <span style={{ color: "#374151" }}>{user.email}</span>
            <button type="button" onClick={() => signOut()}>
              Sign out
            </button>
          </>
        ) : (
          <button type="button" onClick={openDrawer}>
            Sign in
          </button>
        )}
      </nav>
    </header>
  );
}
