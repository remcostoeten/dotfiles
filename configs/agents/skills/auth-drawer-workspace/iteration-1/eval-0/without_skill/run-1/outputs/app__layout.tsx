// Intended path: app/layout.tsx
//
// Root layout. Stays a Server Component. The interactive auth pieces
// (provider, drawer, header) are mounted via the client-side <Providers>
// wrapper and the <SiteHeader> / <AuthDrawer> client components.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthDrawer } from "@remcostoeten/auth-drawer";
import "@remcostoeten/auth-drawer/styles.css";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "My App",
  description: "Next.js 15 app with @remcostoeten/auth-drawer + Supabase",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <SiteHeader />
          <main>{children}</main>
          {/* The drawer is a controlled overlay; mount once near the root. */}
          <AuthDrawer />
        </Providers>
      </body>
    </html>
  );
}
