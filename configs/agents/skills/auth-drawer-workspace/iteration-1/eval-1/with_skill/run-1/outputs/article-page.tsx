// src/components/article-page.tsx
//
// Example consumer page. Demonstrates:
//   - reading session state via useAuth() (so signed-in readers aren't paywalled)
//   - rendering the article inside <ArticlePaywall>, which auto-opens the modal
//     on scroll for anonymous readers.
//
// useAuth() must be called UNDER <AuthProvider> (App.tsx provides it).

import { useAuth } from "@remcostoeten/auth-drawer";

import { ArticlePaywall } from "./article-paywall";

export function ArticlePage() {
  const { user, isPending, openDrawer, signOut } = useAuth();

  return (
    <main>
      <header className="article-page__header">
        {isPending ? null : user ? (
          <button type="button" onClick={signOut}>
            Sign out ({user.email})
          </button>
        ) : (
          <button type="button" onClick={openDrawer}>
            Sign in
          </button>
        )}
      </header>

      {/* For a signed-in reader, skip the paywall entirely. For an anonymous
          reader, wrap the article so the scroll trigger can auto-open the modal. */}
      {user ? (
        <article className="article-page__content">
          <ArticleBody />
        </article>
      ) : (
        <ArticlePaywall>
          <article>
            <ArticleBody />
          </article>
        </ArticlePaywall>
      )}
    </main>
  );
}

function ArticleBody() {
  return (
    <>
      <h1>The Long Read</h1>
      {Array.from({ length: 40 }).map((_, i) => (
        <p key={i}>
          Paragraph {i + 1}. Replace this with your real article content. The
          scroll trigger measures how far the reader has scrolled through this
          container and opens the sign-in modal at roughly one third of the way
          down.
        </p>
      ))}
    </>
  );
}
