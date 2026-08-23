// app/layout.tsx
//
// App root. The provider wraps the whole tree so the drawer and any useAuth()
// consumer (the header) sit under it. The layout itself stays a Server
// Component; the client boundary lives inside AppAuthProvider.
import type { ReactNode } from "react";
import { AppAuthProvider } from "@/components/auth-provider";
import { SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "My App",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppAuthProvider>
          <SiteHeader />
          <main>{children}</main>
        </AppAuthProvider>
      </body>
    </html>
  );
}
