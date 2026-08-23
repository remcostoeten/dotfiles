/**
 * MockAuthDemo.tsx
 *
 * A self-contained demo of the @remcostoeten/auth-drawer login UI driven by a
 * fake/mock backend. Lets you click through sign-in, watch the loading state,
 * and trigger an error state — all without a real auth backend.
 *
 * Drop this file into a Vite + React app and render <MockAuthDemo /> somewhere
 * (e.g. from App.tsx). See NOTES.md for setup + how to exercise each state.
 */

import { useState } from "react";
import { AuthDrawer } from "@remcostoeten/auth-drawer";
import "@remcostoeten/auth-drawer/styles.css";

/**
 * Toggle this to force the mock backend to fail, so you can see the error state.
 * (You can also flip it live via the checkbox rendered below.)
 */
const DEFAULT_SHOULD_FAIL = false;

/**
 * Simulated network latency in ms so the loading spinner is actually visible.
 */
const FAKE_LATENCY_MS = 1200;

type TProvider = "github" | "google";

type TMockResult = {
  user: {
    id: string;
    name: string;
    email: string;
    provider: TProvider;
  };
};

/**
 * Pretend we're hitting an auth server. Resolves with a fake user after a
 * short delay, or rejects to simulate a failed login.
 */
function mockSignIn(provider: TProvider, shouldFail: boolean): Promise<TMockResult> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (shouldFail) {
        reject(new Error(`Mock backend: ${provider} sign-in failed (this is a simulated error)`));
        return;
      }

      resolve({
        user: {
          id: `mock_${provider}_${Date.now()}`,
          name: provider === "github" ? "Octo Cat" : "Goo Gler",
          email: provider === "github" ? "octocat@example.com" : "googler@example.com",
          provider,
        },
      });
    }, FAKE_LATENCY_MS);
  });
}

export function MockAuthDemo() {
  const [open, setOpen] = useState(true);
  const [shouldFail, setShouldFail] = useState(DEFAULT_SHOULD_FAIL);
  const [signedInUser, setSignedInUser] = useState<TMockResult["user"] | null>(null);
  const [lastEvent, setLastEvent] = useState<string>("idle");

  async function handleProviderSignIn(provider: TProvider) {
    // AuthDrawer awaits this promise: while it's pending the button shows the
    // built-in loading state; if it throws, the drawer surfaces the error.
    setLastEvent(`signing-in:${provider}`);
    try {
      const result = await mockSignIn(provider, shouldFail);
      setSignedInUser(result.user);
      setLastEvent(`success:${provider}`);
      setOpen(false);
    } catch (error) {
      setLastEvent(`error:${provider}`);
      // Re-throw so the drawer renders its own error UI for the provider button.
      throw error;
    }
  }

  return (
    <div style={pageStyle}>
      <div style={panelStyle}>
        <h1 style={{ margin: 0, fontSize: 20 }}>auth-drawer mock demo</h1>
        <p style={{ color: "#666", marginTop: 4 }}>
          Fake backend, no server required. Click a provider to sign in.
        </p>

        <label style={toggleRowStyle}>
          <input
            type="checkbox"
            checked={shouldFail}
            onChange={(e) => setShouldFail(e.target.checked)}
          />
          Force sign-in to fail (error state)
        </label>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button style={buttonStyle} onClick={() => setOpen(true)}>
            Open drawer
          </button>
          <button
            style={buttonStyle}
            onClick={() => {
              setSignedInUser(null);
              setLastEvent("idle");
            }}
          >
            Reset
          </button>
        </div>

        <pre style={statusStyle}>
          {JSON.stringify(
            {
              lastEvent,
              shouldFail,
              signedInUser,
            },
            null,
            2,
          )}
        </pre>
      </div>

      <AuthDrawer
        open={open}
        onOpenChange={setOpen}
        title="Sign in to Demo"
        description="Continue with one of the providers below."
        providers={[
          {
            id: "github",
            label: "Continue with GitHub",
            onClick: () => handleProviderSignIn("github"),
          },
          {
            id: "google",
            label: "Continue with Google",
            onClick: () => handleProviderSignIn("google"),
          },
        ]}
      />
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "system-ui, sans-serif",
  background: "#0b0b0c",
  color: "#eaeaea",
};

const panelStyle: React.CSSProperties = {
  width: 420,
  maxWidth: "90vw",
  padding: 24,
  borderRadius: 12,
  background: "#161618",
  border: "1px solid #262629",
};

const toggleRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginTop: 16,
  color: "#cfcfcf",
};

const buttonStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "#222",
  color: "#fff",
  cursor: "pointer",
};

const statusStyle: React.CSSProperties = {
  marginTop: 16,
  padding: 12,
  borderRadius: 8,
  background: "#0e0e10",
  border: "1px solid #262629",
  fontSize: 12,
  overflowX: "auto",
};

export default MockAuthDemo;
