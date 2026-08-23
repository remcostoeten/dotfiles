// Intended path: src/components/site-header.tsx (or @/components/site-header)
//
// Header that reflects auth state:
//  - Logged out: a "Sign in" button that opens the auth drawer.
//  - Logged in:  the user's email + a "Sign out" button.
//
// Uses the package's useAuthDrawer hook for both the session/user state
// and the drawer open control, plus signOut for logging out.

"use client";

import { useAuthDrawer } from "@remcostoeten/auth-drawer";

export function SiteHeader() {
  const { user, isLoading, openDrawer, signOut } = useAuthDrawer();

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.75rem 1.25rem",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <span style={{ fontWeight: 600 }}>My App</span>

      <nav style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {isLoading ? null : user ? (
          <>
            <span style={{ color: "#374151", fontSize: "0.875rem" }}>
              {user.email}
            </span>
            <button type="button" onClick={() => signOut()}>
              Sign out
            </button>
          </>
        ) : (
          <button type="button" onClick={() => openDrawer()}>
            Sign in
          </button>
        )}
      </nav>
    </header>
  );
}
