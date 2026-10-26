/**
 * Relation of a navigation link to the current path.
 * "page" — the link points to the current page; "section" — the current page lies inside the
 * link's section (/product-list/12 under /product-list). The section match stops at a segment
 * boundary, so /product-listing does not count; "/" is matched exactly.
 */
export function linkRelation(href: string, pathname: string): "page" | "section" | null {
  if (pathname === href) return "page";
  if (href !== "/" && pathname.startsWith(`${href}/`)) return "section";
  return null;
}
