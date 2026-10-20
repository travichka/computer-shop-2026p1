import type { Metadata } from "next";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { SITE } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: SITE.name,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  authors: [{ name: SITE.author }],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pl">
      <body>
        <a className="skip-link" href="#main-content">
          Przejdź do treści
        </a>
        <div id="page">
          <SiteHeader />
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
