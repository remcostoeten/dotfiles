// AuthDemo.tsx
//
// Minimal, self-contained demo of the @remcostoeten/auth-drawer login UI
// running against a FAKE/MOCK backend (no real auth server required).
//
// What this gives you:
//   - GitHub + Google OAuth buttons (mock adapter implements signInWithOAuth)
//   - Email/password sign-in with a simulated network delay (loading state)
//   - An easy way to trigger the error state
//
// How to exercise each state (see NOTES.md for the full rundown):
//   - SUCCESS : sign in with  admin@example.com  /  password
//   - LOADING : the mock adapter waits `latencyMs` (1200ms below) before
//               resolving — watch the button spinner during that window
//   - ERROR   : sign in with  spam@example.com  (any password) -> rate_limited
//
// Drop this file into your Vite React app (e.g. src/AuthDemo.tsx) and render
// <AuthDemo /> from src/main.tsx (or App.tsx). Nothing else is needed.

import { createMockAdapter } from "@remcostoeten/auth-drawer/adapters/mock";
import { AuthProvider, AuthDrawer, useAuth } from "@remcostoeten/auth-drawer";

// The stylesheet ships separately and is NOT auto-injected — import it once.
import "@remcostoeten/auth-drawer/styles.css";

// 1. The mock adapter is the entire "backend". It holds an in-memory user and
//    fakes network latency so you can see the loading state. It implements
//    signInWithOAuth, so the GitHub/Google buttons render.
const authAdapter = createMockAdapter({
  latencyMs: 1200, // bump from the 800ms default so the loading state is obvious
  mockEmail: "admin@example.com",
  mockPassword: "password",
});

// 2. A tiny header that reads the mock session and drives the drawer. It must
//    live INSIDE <AuthProvider> because it calls useAuth().
function DemoHeader() {
  const { user, isPending, openDrawer, signOut } = useAuth();

  if (isPending) return null;

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 24px",
        borderBottom: "1px solid #e5e7eb",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <strong>auth-drawer mock demo</strong>
      {user ? (
        <button onClick={signOut}>Sign out ({user.email})</button>
      ) : (
        <button onClick={openDrawer}>Sign in</button>
      )}
    </header>
  );
}

// 3. Wire it together: provider wraps everything, the drawer renders the UI,
//    and we point both at the same mock adapter.
export default function AuthDemo() {
  return (
    <AuthProvider adapter={authAdapter}>
      <DemoHeader />

      <main
        style={{
          padding: 24,
          fontFamily: "system-ui, sans-serif",
          color: "#374151",
        }}
      >
        <p>
          Click <em>Sign in</em> above (or the floating trigger button) to open
          the auth drawer.
        </p>
        <ul style={{ lineHeight: 1.8 }}>
          <li>
            <strong>Success:</strong> <code>admin@example.com</code> /{" "}
            <code>password</code>
          </li>
          <li>
            <strong>Loading:</strong> watch the ~1.2s delay after submitting
          </li>
          <li>
            <strong>Error:</strong> sign in with <code>spam@example.com</code>{" "}
            to get a rate-limited error
          </li>
        </ul>
      </main>

      {/* The drawer. Showing only GitHub + Google. allowRegister is off to keep
          the demo focused on sign-in; the mock adapter supports sign-up too if
          you want the Register tab — just flip the flag. */}
      <AuthDrawer
        adapter={authAdapter}
        config={{
          ui: {
            auth: {
              providers: ["github", "google"],
              allowRegister: false,
            },
          },
        }}
        onSuccess={(action) => console.log("[auth-drawer] success:", action)}
        onError={(error, action) =>
          console.log("[auth-drawer] error:", action, error.code)
        }
      />
    </AuthProvider>
  );
}
