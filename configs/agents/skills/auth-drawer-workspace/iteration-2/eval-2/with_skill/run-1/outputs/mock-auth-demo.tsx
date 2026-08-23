// mock-auth-demo.tsx
//
// Self-contained demo of the @remcostoeten/auth-drawer login UI driven by a
// fake/mock backend. No real auth backend required.
//
// What you can exercise here:
//   - Sign in (success):  email "demo@example.com"  / password "password"
//   - Loading state:      every action waits ~900ms (simulated network latency)
//   - Error state:        email "fail@example.com" -> invalid_credentials
//                         email "spam@example.com" -> rate_limited
//   - OAuth buttons:      GitHub + Google are shown (signInWithOAuth implemented).
//                         In the demo they "succeed" after a fake delay; flip
//                         OAUTH_SHOULD_FAIL to true to see an OAuth error instead.
//
// Drop this into a Vite + React app and render <MockAuthDemo /> (see main.tsx).

import { useState } from "react";
import {
  AuthProvider,
  AuthDrawer,
  useAuth,
  createAdapter,
} from "@remcostoeten/auth-drawer";
// Styles ship automatically with the package entry above — no manual CSS import.

// ---------------------------------------------------------------------------
// Fake backend knobs
// ---------------------------------------------------------------------------
const LATENCY_MS = 900; // simulate network delay so the loading state is visible
const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "password";
const OAUTH_SHOULD_FAIL = false; // set true to demo an OAuth provider failure

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const FAKE_USER = {
  id: "user_mock_1",
  email: DEMO_EMAIL,
  name: "Demo User",
  image: null as string | null,
};

// ---------------------------------------------------------------------------
// Mock adapter — the ONLY bridge to the (fake) backend.
//
// Implementing signInWithOAuth + providers makes the GitHub/Google buttons
// appear (feature detection). Implementing signUp would add a Register tab; we
// omit it here to keep the demo focused on sign-in / loading / error.
// ---------------------------------------------------------------------------
export const mockAdapter = createAdapter({
  id: "mock-demo",
  providers: ["github", "google"],

  async signIn({ email, password }) {
    await wait(LATENCY_MS); // <- loading state shows during this delay

    if (email === "spam@example.com") {
      return {
        success: false,
        error: {
          code: "rate_limited",
          target: "form",
          message: "Too many attempts. Try again in a minute.",
          retryable: true,
        },
      };
    }

    if (email !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
      return {
        success: false,
        error: {
          code: "invalid_credentials",
          target: "form",
          message: "Invalid email or password.",
        },
      };
    }

    // Success -> drawer closes automatically.
    return { success: true, data: { user: FAKE_USER, session: { id: "sess_1" } } };
  },

  async signInWithOAuth(provider) {
    await wait(LATENCY_MS); // <- loading state on the provider button

    if (OAUTH_SHOULD_FAIL) {
      return {
        success: false,
        error: {
          code: "provider_unavailable",
          target: "oauth",
          message: `${provider} sign-in is unavailable right now.`,
          provider: provider as "github" | "google",
          retryable: true,
        },
      };
    }

    return { success: true, data: { user: { ...FAKE_USER, email: `${provider}@example.com` } } };
  },

  async signOut() {
    await wait(300);
    return { success: true };
  },

  // useSession is a real hook called once inside the provider. We have no
  // reactive session source in this demo, so return a static signed-out state.
  useSession() {
    return { data: null, isPending: false, error: null };
  },
});

// ---------------------------------------------------------------------------
// A tiny header that reads session from context and opens the drawer.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// The demo app: provider wraps everything; drawer opens on load so you can
// immediately click through sign-in / loading / error.
// ---------------------------------------------------------------------------
export function MockAuthDemo() {
  const [open, setOpen] = useState(true);

  return (
    <AuthProvider adapter={mockAdapter}>
      <DemoHeader />

      <main style={{ padding: 24, lineHeight: 1.6 }}>
        <p>This screen demos the auth-drawer login UI against a fake backend.</p>
        <ul>
          <li>
            <b>Success:</b> {DEMO_EMAIL} / {DEMO_PASSWORD}
          </li>
          <li>
            <b>Invalid credentials:</b> any other email/password
          </li>
          <li>
            <b>Rate-limited error:</b> spam@example.com
          </li>
          <li>
            <b>OAuth:</b> click GitHub or Google
          </li>
        </ul>
        <button onClick={() => setOpen(true)}>Open the drawer</button>
      </main>

      <AuthDrawer
        adapter={mockAdapter}
        open={open}
        onOpenChange={setOpen}
        hideTrigger
        config={{
          ui: {
            auth: {
              providers: ["github", "google"],
              // no allowRegister -> Register tab stays hidden (we omit signUp anyway)
            },
            presentation: { variant: "drawer" },
          },
        }}
        onSuccess={(action) => console.log("[auth] success:", action)}
        onError={(error, action) => console.log("[auth] error:", action, error)}
      />
    </AuthProvider>
  );
}

export default MockAuthDemo;
