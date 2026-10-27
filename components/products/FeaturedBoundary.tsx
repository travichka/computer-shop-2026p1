"use client";

import { usePathname } from "next/navigation";
import { Component, type ReactNode } from "react";

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(previous: { children: ReactNode }) {
    // New server content (e.g. after retry() or router.refresh()) gets another chance.
    if (this.state.failed && previous.children !== this.props.children) this.setState({ failed: false });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <aside className="featured-error" role="alert">
        Nie udało się wczytać polecanych produktów.
      </aside>
    );
  }
}

/**
 * Error boundary placed directly around FeaturedPanel in @featured/page.tsx and default.tsx.
 * Without it a failing panel reaches the catalog's error.tsx (Next.js wraps every slot of the layout
 * with it) and a second full error page appears in the side column. A slot's own error.tsx does not
 * cover default.tsx. Keyed by pathname, so it resets after navigation like error.tsx.
 */
export default function FeaturedBoundary({ children }: { children: ReactNode }) {
  return <Boundary key={usePathname()}>{children}</Boundary>;
}
