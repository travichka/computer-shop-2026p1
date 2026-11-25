import { SITE } from "@/lib/site";
import { appVersion } from "@/lib/version";
import LayoutStateDemo from "./LayoutStateDemo";

export default function SiteFooter() {
  const version = appVersion();
  return (
    <footer id="main-footer">
      <p>
        © 2026 {SITE.name} · {SITE.author}
      </p>
      <p>{SITE.course}</p>
      <p className="muted">
        Wydanie <code title={version.commit}>{version.commit.slice(0, 7)}</code> · {version.environment}
      </p>
      <LayoutStateDemo />
    </footer>
  );
}
