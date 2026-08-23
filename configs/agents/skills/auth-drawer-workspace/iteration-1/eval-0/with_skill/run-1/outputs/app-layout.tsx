// app/layout.tsx
//
// Root layout (a Server Component). It imports the package stylesheet ONCE
// here so the drawer renders styled, then wraps the tree in the client-side
// AuthProvider. The SiteHeader sits inside the provider so it can read the
// session via useAuth().

import type { ReactNode } from "react";

// Import the auth-drawer stylesheet exactly once, at the app root.
// (It ships separately and is not auto-injected.)
import "@remcostoeten/auth-drawer/styles.css";

import { AuthProvider } from "@/components/auth-provider";
import { SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "My App",
};

type TProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: TProps) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <SiteHeader />
          <main>{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
