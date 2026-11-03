"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient, signOut } from "@/lib/auth-client";

type Scope = "current" | "others" | "all";

const LABELS: Record<Scope, string> = {
  current: "Wyloguj to urządzenie",
  others: "Wyloguj pozostałe urządzenia",
  all: "Wyloguj wszędzie",
};

/**
 * Extension "Sesje na wielu urządzeniach": the current session only (signOut), every other session
 * (revokeOtherSessions) or all sessions of the user (revokeSessions). Better Auth deletes the
 * Session rows; with the cookie cache disabled every other profile is rejected on its next request.
 */
export default function SessionControls({ otherSessions }: { otherSessions: number }) {
  const router = useRouter();
  const [pending, setPending] = useState<Scope | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function revoke(scope: Scope) {
    setPending(scope);
    setError(null);
    const result =
      scope === "current"
        ? await signOut()
        : scope === "others"
          ? await authClient.revokeOtherSessions()
          : await authClient.revokeSessions();
    setPending(null);
    if (result.error) {
      setError("Nie udało się unieważnić sesji. Spróbuj ponownie.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(Object.keys(LABELS) as Scope[]).map((scope) => (
        <button
          key={scope}
          type="button"
          onClick={() => revoke(scope)}
          disabled={pending !== null || (scope === "others" && otherSessions === 0)}
          aria-busy={pending === scope}
        >
          {pending === scope ? "Trwa…" : LABELS[scope]}
        </button>
      ))}
      {error && (
        <p role="alert" className="basis-full font-bold text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
