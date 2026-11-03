import type { Metadata } from "next";
import { headers } from "next/headers";
import SessionControls from "@/components/auth/SessionControls";
import SignInButton from "@/components/auth/SignInButton";
import { auth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getCurrentSession } from "@/lib/session";

export const metadata: Metadata = { title: "Konto i sesje" };

/** Short description of a browser from its User-Agent (display only). */
function deviceLabel(userAgent: string | null | undefined): string {
  if (!userAgent) return "Nieznane urządzenie";
  const browser = /Firefox|Edg|Chrome|Safari/.exec(userAgent)?.[0]?.replace("Edg", "Edge") ?? "Przeglądarka";
  const system = /Windows|Mac OS X|Android|iPhone|Linux/.exec(userAgent)?.[0]?.replace("Mac OS X", "macOS") ?? "";
  return system ? `${browser}, ${system}` : browser;
}

export default async function AccountPage() {
  const session = await getCurrentSession();

  if (!session) {
    return (
      <section className="content placeholder" aria-labelledby="account-title">
        <h1 id="account-title">Konto</h1>
        <p role="status">Zaloguj się, aby zobaczyć swoje sesje.</p>
        <SignInButton returnTo="/account" />
      </section>
    );
  }

  // Only display fields leave the server: no session tokens, no ids, no OAuth data.
  const sessions = (await auth.api.listSessions({ headers: await headers() }))
    .map((s) => ({
      current: s.token === session.session.token,
      device: deviceLabel(s.userAgent),
      createdAt: new Date(s.createdAt).toISOString(),
      expiresAt: new Date(s.expiresAt).toISOString(),
    }))
    .sort((a, b) => Number(b.current) - Number(a.current) || b.createdAt.localeCompare(a.createdAt));

  return (
    <section aria-labelledby="account-title" className="rounded-lg bg-paper p-6 text-ink">
      <h1 id="account-title" className="mt-0 font-heading">
        Konto
      </h1>
      <p>
        {session.user.name} ({session.user.email})
      </p>
      <h2>Aktywne sesje ({sessions.length})</h2>
      <ul className="bullets">
        {sessions.map((s, index) => (
          <li key={index}>
            {s.device}
            {s.current && <strong> — to urządzenie</strong>}, zalogowano <time dateTime={s.createdAt}>{formatDate(s.createdAt)}</time>,
            ważna do <time dateTime={s.expiresAt}>{formatDate(s.expiresAt)}</time>
          </li>
        ))}
      </ul>
      <SessionControls otherSessions={sessions.length - 1} />
    </section>
  );
}
