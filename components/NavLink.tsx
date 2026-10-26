"use client";

// Client component only because usePathname() needs the browser router state.
// It receives just href and label — highlighting a section needs no product data in the browser.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { linkRelation } from "@/lib/nav";

export default function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const relation = linkRelation(href, usePathname());

  return (
    <Link
      href={href}
      className={relation ? "active" : undefined}
      // aria-current="page" for the current page, "true" for the section containing it.
      aria-current={relation === "page" ? "page" : relation === "section" ? "true" : undefined}
    >
      {children}
    </Link>
  );
}
