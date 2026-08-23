// src/App.tsx
//
// App root. The AuthProvider wraps everything so the article (and any other
// gated UI) shares one auth state, and the PaywallModal is mounted once at
// the top level so it can overlay the whole app.

import { AuthProvider } from "./lib/auth/auth-context";
import { PaywallModal } from "./components/paywall-modal";
import { Article } from "./components/article";

export default function App() {
  return (
    <AuthProvider>
      <Article />
      {/* Mounted once; visibility is controlled via auth context. */}
      <PaywallModal />
    </AuthProvider>
  );
}
