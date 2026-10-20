import Link from "next/link";
import { NAV_LINKS, SITE } from "@/lib/site";
import NavLink from "./NavLink";

export default function SiteHeader() {
  return (
    <header id="main-header">
      <p id="logo">
        <Link href="/">{SITE.name}</Link>
      </p>
      <nav aria-label="Główna nawigacja">
        <ul>
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <NavLink href={link.href}>{link.label}</NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
