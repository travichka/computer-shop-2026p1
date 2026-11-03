import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SignInButton from "@/components/auth/SignInButton";
import { safeReturnPath } from "@/lib/return-path";
import { getCurrentSession } from "@/lib/session";

export const metadata: Metadata = { title: "Logowanie" };

// Error codes Better Auth appends to errorCallbackURL; anything else gets the generic message.
const ERROR_MESSAGES: Record<string, string> = {
  email_not_found: "GitHub nie udostępnił adresu e-mail. Sprawdź, czy aplikacja jest typu OAuth App i ma zakres user:email.",
  state_mismatch: "Sesja logowania wygasła lub została przerwana. Spróbuj ponownie.",
  access_denied: "Logowanie zostało anulowane w GitHubie.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  // ?next= is checked against the allow-list — an external URL falls back to /basket.
  const returnTo = safeReturnPath(next);

  if (await getCurrentSession()) redirect(returnTo);

  const errorCode = typeof error === "string" ? error : undefined;

  return (
    <section className="content placeholder" aria-labelledby="login-title">
      <h1 id="login-title">Logowanie</h1>
      {errorCode && (
        <p role="alert" className="notice">
          {ERROR_MESSAGES[errorCode] ?? "Logowanie nie powiodło się. Spróbuj ponownie."}
        </p>
      )}
      <p>Sklep używa konta GitHub tylko do potwierdzenia tożsamości (profil i adres e-mail).</p>
      <SignInButton returnTo={returnTo} />
    </section>
  );
}
