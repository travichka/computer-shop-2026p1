"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/lib/auth-client";

/**
 * Revokes the current session (Better Auth deletes the Session row and clears the cookie), then
 * re-renders the server components, so the navigation and protected views match the server state.
 */
export default function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function end() {
    setPending(true);
    setError(null);
    const result = await signOut();
    setPending(false);
    if (result.error) {
      setError("Wylogowanie nie powiodło się.");
      return;
    }
    router.refresh();
  }

  return (
    <span className="auth-action">
      <button type="button" onClick={end} disabled={pending} aria-busy={pending}>
        {pending ? "Wylogowywanie…" : "Wyloguj"}
      </button>
      {error && (
        <span role="alert" className="form-error">
          {error}
        </span>
      )}
    </span>
  );
}
