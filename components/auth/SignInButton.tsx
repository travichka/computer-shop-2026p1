"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth-client";
import { safeReturnPath, type ReturnPath } from "@/lib/return-path";

/**
 * Starts the GitHub OAuth flow. Better Auth stores `state`, redirects to GitHub and, after the
 * callback, sets the session cookie and sends the browser to the (allow-listed) return path.
 */
export default function SignInButton({ returnTo, label = "Zaloguj przez GitHub" }: { returnTo: ReturnPath; label?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setPending(true);
    setError(null);
    const callbackURL = safeReturnPath(returnTo);
    const result = await signIn.social({ provider: "github", callbackURL, errorCallbackURL: "/login" });
    // On success the page navigates away; only a failed start comes back here.
    if (result.error) {
      setError("Nie udało się rozpocząć logowania. Spróbuj ponownie.");
      setPending(false);
    }
  }

  return (
    <span className="auth-action">
      <button type="button" onClick={start} disabled={pending} aria-busy={pending}>
        {pending ? "Przekierowanie…" : label}
      </button>
      {error && (
        <span role="alert" className="form-error">
          {error}
        </span>
      )}
    </span>
  );
}
