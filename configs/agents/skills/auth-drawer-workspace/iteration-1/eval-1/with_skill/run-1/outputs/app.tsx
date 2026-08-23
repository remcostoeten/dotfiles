// src/App.tsx
//
// App root: imports the stylesheet once and wraps everything in AuthProvider.
// AuthProvider calls adapter.useSession() once and exposes session + drawer
// controls through context, so anything under it can call useAuth().

import { AuthProvider } from "@remcostoeten/auth-drawer";

// Import the package stylesheet ONCE, at the root. It ships separately and is
// not auto-injected — without this the modal renders unstyled.
import "@remcostoeten/auth-drawer/styles.css";

import { authAdapter } from "./auth/auth-adapter";
import { ArticlePage } from "./components/article-page";

export function App() {
  return (
    <AuthProvider adapter={authAdapter}>
      <ArticlePage />
    </AuthProvider>
  );
}

export default App;
