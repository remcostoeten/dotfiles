// src/components/article-paywall.tsx
//
// Wraps an article. As the reader scrolls ~1/3 of the way down, the auth surface
// (a modal, no social login) auto-opens once via the shared trigger store.
//
// Flow:
//   useScrollOpenTrigger watches scroll progress on the article container ->
//   emits a `scrollOpen` event into the shared store ->
//   <AuthDrawer> (registered against the same store) applies the `scrollOpen`
//   policy from authConfig and opens the modal.

import { useRef, type ReactNode } from "react";
import {
  AuthDrawer,
  useScrollOpenTrigger,
} from "@remcostoeten/auth-drawer";

import { authAdapter } from "../auth/auth-adapter";
import { authConfig, SCROLL_THRESHOLD } from "../auth/auth-config";
import { triggerStore } from "../auth/trigger-store";

type TProps = {
  children: ReactNode;
};

export function ArticlePaywall({ children }: TProps) {
  const articleRef = useRef<HTMLDivElement>(null);

  useScrollOpenTrigger({
    containerRef: articleRef,
    threshold: SCROLL_THRESHOLD,
    once: true,
    // Only arm the scroll trigger while the scroll rule is configured.
    enabled: Boolean(authConfig.triggers?.scrollOpen),
    onTrigger: (progress) =>
      triggerStore.emit({
        kind: "scrollOpen",
        progress,
        threshold: SCROLL_THRESHOLD,
        container: "self",
      }),
  });

  return (
    <>
      {/* The scrollable article. Make sure it actually scrolls (e.g. it is the
          page's main scroll container, or give it a constrained height with
          overflow). useScrollOpenTrigger measures progress on this element. */}
      <div ref={articleRef} className="article-paywall__content">
        {children}
      </div>

      {/* hideTrigger: no floating button — the modal is opened by the scroll
          trigger (and by useAuth().openDrawer from your own UI if you want). */}
      <AuthDrawer
        adapter={authAdapter}
        config={authConfig}
        triggerStore={triggerStore}
        hideTrigger
        onSuccess={(action) => {
          if (action === "signIn" || action === "signUp") {
            // Reader unlocked the article. Add a toast / analytics call here.
          }
        }}
      />
    </>
  );
}
