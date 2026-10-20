import { SITE } from "@/lib/site";
import LayoutStateDemo from "./LayoutStateDemo";

export default function SiteFooter() {
  return (
    <footer id="main-footer">
      <p>
        © 2026 {SITE.name} · {SITE.author}
      </p>
      <p>{SITE.course}</p>
      <LayoutStateDemo />
    </footer>
  );
}
