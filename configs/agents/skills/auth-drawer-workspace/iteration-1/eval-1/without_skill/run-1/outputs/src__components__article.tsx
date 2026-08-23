// src/components/article.tsx
//
// Example article page that demonstrates the scroll-triggered paywall.
// When an unauthenticated reader scrolls ~1/3 of the way down, the modal
// auto-opens. Authenticated readers are never interrupted.

import { useRef } from "react";
import { useAuth } from "../lib/auth/auth-context";
import { useScrollTrigger } from "../hooks/use-scroll-trigger";

export function Article() {
  const { isAuthenticated, isLoading, openPaywall } = useAuth();
  const articleRef = useRef<HTMLElement | null>(null);

  // Auto-open the paywall at ~1/3 scroll depth, but only for readers who are
  // not signed in (and not while we're still hydrating the session).
  useScrollTrigger(openPaywall, {
    threshold: 1 / 3,
    targetRef: articleRef,
    enabled: !isLoading && !isAuthenticated,
    once: true,
  });

  return (
    <article ref={articleRef} style={{ maxWidth: 680, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1>The Article Title</h1>
      <p>
        This is the opening of the article. Readers can see this much for free.
        Keep scrolling and, about a third of the way down, the paywall modal
        will appear asking them to sign in or create an account.
      </p>

      {/* Long-form body. Replace with your real content / MDX. */}
      {Array.from({ length: 30 }).map((_, i) => (
        <p key={i}>
          Paragraph {i + 1}. Lorem ipsum dolor sit amet, consectetur adipiscing
          elit. Sed do eiusmod tempor incididunt ut labore et dolore magna
          aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco.
        </p>
      ))}
    </article>
  );
}
